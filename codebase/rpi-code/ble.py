import bluetooth
import struct
import time
from micropython import const


_IRQ_CENTRAL_CONNECT = const(1)
_IRQ_CENTRAL_DISCONNECT = const(2)
_IRQ_GATTS_WRITE = const(3)

_ADV_TYPE_FLAGS = const(0x01)
_ADV_TYPE_NAME = const(0x09)

_FLAG_WRITE = const(0x0008)
_FLAG_WRITE_NO_RESPONSE = const(0x0004)
_FLAG_NOTIFY = const(0x0010)

_CONFIG_SERVICE_UUID = bluetooth.UUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
_CONFIG_CHAR_UUID = bluetooth.UUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
_CONFIG_ACK_CHAR_UUID = bluetooth.UUID("6E400003-B5A3-F393-E0A9-E50E24DCCA9E")

_CONFIG_SERVICE = (
    _CONFIG_SERVICE_UUID,
    (
        (_CONFIG_CHAR_UUID, _FLAG_WRITE | _FLAG_WRITE_NO_RESPONSE),
        (_CONFIG_ACK_CHAR_UUID, _FLAG_NOTIFY),
    ),
)


def advertising_payload(name="SeedIot_67"):
    payload = bytearray()

    def add_field(adv_type, value):
        payload.extend(struct.pack("BB", len(value) + 1, adv_type))
        payload.extend(value)

    add_field(_ADV_TYPE_FLAGS, b"\x06")
    add_field(_ADV_TYPE_NAME, name.encode())

    return payload


class BLEConfigPeripheral:
    def __init__(self, on_config_received, name="SeedIot_67"):
        self.ble = bluetooth.BLE()
        self.name = name
        self.payload = advertising_payload(name)
        self.connected = False
        self.on_config_received = on_config_received
        self._config_buffer = b""
        self._config_handle = None
        self._config_ack_handle = None
        self._conn_handle = None
        self._stop_deadline_ms = None

        self.ble.active(True)
        self.ble.config(gap_name=name)
        self.ble.irq(self.irq_handler)

        ((self._config_handle, self._config_ack_handle),) = self.ble.gatts_register_services(
            (_CONFIG_SERVICE,)
        )

        self.ble.gatts_set_buffer(self._config_handle, 512, False)

    def irq_handler(self, event, data):
        if event == _IRQ_CENTRAL_CONNECT:
            conn_handle, _, _ = data
            self._conn_handle = conn_handle
            self.connected = True
            self._stop_deadline_ms = None
            print("[BLE] Urzadzenie polaczone")
            return

        if event == _IRQ_CENTRAL_DISCONNECT:
            self.connected = False
            self._conn_handle = None
            self._config_buffer = b""
            self._stop_deadline_ms = None
            print("[BLE] Urzadzenie rozlaczone")
            self.advertise()
            return

        if event != _IRQ_GATTS_WRITE:
            return

        _, value_handle = data

        if value_handle != self._config_handle:
            return

        chunk = self.ble.gatts_read(self._config_handle)

        if not chunk:
            print("[BLE] Odebrano pusty pakiet")

            if self._has_complete_message():
                self._handle_complete_messages()
            elif self._has_accept_command():
                print("[BLE] Wykryto ACCEPT bez terminatora")
                self._handle_accept_command()
            else:
                print("[BLE] Brak \\n w buforze, czekam na kolejne pakiety")

            return

        self._config_buffer += chunk

        print(
            "[BLE] Odebrano {} bajtow konfiguracji, razem {} bajtow".format(
                len(chunk),
                len(self._config_buffer),
            )
        )

        if not self._has_complete_message():
            if self._has_accept_command():
                print("[BLE] Wykryto ACCEPT bez terminatora")
                self._handle_accept_command()
                return

            print("[BLE] Brak \\n w buforze, czekam na kolejne pakiety")
            return

        self._handle_complete_messages()

    def _handle_complete_messages(self):
        while self._has_complete_message():
            if self._handle_complete_message():
                return

    def _handle_complete_message(self):
        try:
            text_payload = self._consume_message()
        except UnicodeError:
            print("[BLE] Bufor nie jest jeszcze poprawnym UTF-8")
            return False

        print("[BLE] Odebrano komende:", self._get_command_name(text_payload))

        if not text_payload:
            print("[BLE] Wiadomosc konfiguracji jest pusta")
            return False

        try:
            is_saved = self.on_config_received(text_payload)
        except Exception as error:
            print("[BLE] Blad w on_config_received:", error)
            self._send_ack("ERR:{}".format(self._get_command_name(text_payload)))
            return False

        command_name = self._get_command_name(text_payload)

        if is_saved:
            self._send_ack("ACK:{}".format(command_name))
            self._schedule_stop_after_config_delay()
            self._config_buffer = b""
            return True

        if command_name == "ACCEPT":
            self._send_ack("ERR:ACCEPT")
        else:
            self._send_ack("ACK:{}".format(command_name))

        print("[BLE] Dane nie tworza poprawnego configu, czekam na kolejne pakiety")
        return False

    def advertise(self):
        self.ble.gap_advertise(500000, adv_data=self.payload)
        print("[BLE] Reklamowanie jako: {}".format(self.name))

    def _has_complete_message(self):
        return b"\n" in self._config_buffer

    def _has_accept_command(self):
        return self._config_buffer.strip() == b"ACCEPT"

    def _handle_accept_command(self):
        self._config_buffer = b""

        try:
            is_saved = self.on_config_received("ACCEPT")
        except Exception as error:
            print("[BLE] Blad w on_config_received:", error)
            self._send_ack("ERR:ACCEPT")
            return

        if is_saved:
            self._send_ack("ACK:ACCEPT")
            self._schedule_stop_after_config_delay()
            return

        self._send_ack("ERR:ACCEPT")
        print("[BLE] ACCEPT odebrany, ale konfiguracja nie jest kompletna")

    def _get_command_name(self, text_payload):
        if ":" in text_payload:
            return text_payload.split(":", 1)[0].strip().upper()

        return text_payload.strip().upper()

    def _send_ack(self, message):
        if self._conn_handle is None:
            print("[BLE] Brak polaczenia, nie wysylam ACK:", message)
            return

        try:
            self.ble.gatts_notify(
                self._conn_handle,
                self._config_ack_handle,
                message.encode("utf-8"),
            )
            print("[BLE] Wyslano:", message)
        except Exception as error:
            print("[BLE] Nie udalo sie wyslac ACK:", error)

    def _schedule_stop_after_config_delay(self):
        self._stop_deadline_ms = time.ticks_add(time.ticks_ms(), 15000)
        print("[BLE] Konfiguracja zapisana, BLE zostanie wylaczone za 15 sekund")

    def poll(self):
        if self._stop_deadline_ms is None:
            return

        if time.ticks_diff(time.ticks_ms(), self._stop_deadline_ms) < 0:
            return

        self._stop_deadline_ms = None
        self.stop()

    def _consume_message(self):
        end_index = self._config_buffer.find(b"\n")
        payload_bytes = self._config_buffer[:end_index]

        self._config_buffer = self._config_buffer[end_index + 1:]

        return payload_bytes.decode("utf-8").strip()

    def stop(self):
        try:
            self.ble.gap_advertise(None)
        except Exception:
            pass

        self._stop_deadline_ms = None
        self.connected = False
        self.ble.active(False)

        print("[BLE] Modul BLE wylaczony")

import os
import network
import sys
import time
import ujson
from machine import Pin

try:
    import uselect
except ImportError:
    uselect = None

from ble import BLEConfigPeripheral
from settings import (
    AUTO_BATCH_MEASUREMENTS,
    BASE_INTERVAL_MS,
    LCD_DISPLAY_ENABLED,
    LCD_PAGE_INTERVAL_MS,
    SENSOR_READ_MULTIPLIERS,
    TPL5110_DONE_PIN,
    TPL5110_DONE_PULSE_MS,
    TPL5110_ENABLED,
)
from sensors import (
    BME280Sensor,
    BME680Sensor,
    DS18B20Sensor,
    LTR559Sensor,
    RainSensor,
    SCD41Sensor,
    SoilMoistureSensor,
    WindSensor,
)
from sensors.enviro_weather_driver import WindMeter
from lcd_display import I2cLcd16x2, LcdTelemetryDisplay
from tpl5110_power import TPL5110PowerController


CONFIG_FILE = "config.json"
LAST_UPLOADED_PAYLOAD_FILE = "last_uploaded_payload.json"
BLE_NAME = "SeedIot_67"
WIND_SAMPLE_MS = 1000
RAIN_SAMPLE_MS = 1000
UPLOAD_LED_PIN = 6
UPLOAD_LED_BLINK_MS = 150
BLE_ADVERTISING_BLINK_MS = 150
PENDING_CONFIG = {}

STATE_BOOT = "BOOT"
STATE_BLE_PAIRING = "BLE_PAIRING"
STATE_WAITING = "WAITING"

ENERGY_PROFILE_AUTO = 0
ENERGY_PROFILE_IDLE = 1
ENERGY_PROFILE_WIFI = 2
ENERGY_PROFILE_BLE = 3
ENERGY_PROFILE_SENSORS = 4

TESTER_BOOT_WINDOW_MS = 10000
TESTER_LOOP_DELAY_MS = 250
TESTER_STATUS_INTERVAL_MS = 5000

ENERGY_PROFILE_LABELS = {
    ENERGY_PROFILE_AUTO: "AUTO",
    ENERGY_PROFILE_IDLE: "IDLE",
    ENERGY_PROFILE_WIFI: "WIFI",
    ENERGY_PROFILE_BLE: "BLE",
    ENERGY_PROFILE_SENSORS: "SENSORS",
}

RUN_MODE_FULL = "FULL"
RUN_MODE_TEST = "TEST"

# Progi zmian (wartosci bezwzgledne), ponizej ktorych pomiar traktujemy
# jako mieszczacy sie w granicy bledu i pomijamy upload w trybie pelnym.
MEASUREMENT_CHANGE_THRESHOLDS = {
    "soil_moisture": {
        "raw_adc": 1200,
        "voltage_v": 0.06,
        "moisture_percent": 3.0,
    },
    "ds18b20": {
        "temperature_c": 0.5,
        "sensor_count": 0,
    },
    "bme280": {
        "temperature_c": 1.0,
        "pressure_hpa": 1.0,
        "humidity_percent": 3.0,
    },
    "bme680": {
        "temperature_c": 1.0,
        "pressure_hpa": 1.0,
        "humidity_percent": 3.0,
        "gas_resistance_kohm": 1.0,
    },
    "ltr559": {
        "als_ch0": 50,
        "als_ch1": 50,
        "status": 0,
    },
    "scd41": {
        "co2_ppm": 50.0,
        "temperature_c": 0.8,
        "humidity_percent": 6.0,
    },
    "wind": {
        "wind_speed_m_s": 0.5,
        "wind_pulses": 1,
        "wind_heading_deg": 22.5,
        "wind_direction_raw_adc": 200,
    },
    "rain": {
        "rain_mm": 0.3,
        "rain_mm_per_hour": 0.3,
        "rain_pulses": 1,
    },
}


def set_state(state):
    print("[STATE] {}".format(state))
    return state


class TesterConsole:
    def __init__(self):
        self.stdin = sys.stdin
        self.poller = uselect.poll()
        self.poller.register(self.stdin, uselect.POLLIN)

    def read_command(self):
        events = self.poller.poll(0)
        if not events:
            return None

        line = self.stdin.readline()
        if not line:
            return None

        return line.strip()


def file_exists(path):
    try:
        os.stat(path)
        return True
    except OSError:
        return False


def delete_config():
    try:
        os.remove(CONFIG_FILE)
        print("[CONFIG] Usunieto bledny config.json")
    except OSError:
        print("[CONFIG] Nie udalo sie usunac config.json")


def is_valid_config(config):
    if not isinstance(config, dict):
        return False

    required_keys = {
        "ssid": str,
        "passwd": str,
        "apiKey": str,
        "stationId": str,
        "serverUrl": str,
    }

    for key, expected_type in required_keys.items():
        if key not in config:
            print("[CONFIG] Brak pola '{}'".format(key))
            return False

        if not isinstance(config[key], expected_type):
            print("[CONFIG] Pole '{}' ma zly typ".format(key))
            return False

        if len(config[key]) == 0:
            print("[CONFIG] Pole '{}' jest puste".format(key))
            return False

    return True


def load_config():
    if not file_exists(CONFIG_FILE):
        print("[CONFIG] Brak config.json")
        return None

    try:
        with open(CONFIG_FILE, "r") as file:
            config = ujson.load(file)
    except Exception as error:
        print("[CONFIG] Blad odczytu JSON: {}".format(error))
        delete_config()
        return None

    if not is_valid_config(config):
        print("[CONFIG] Niepoprawny format config.json")
        delete_config()
        return None

    print("[CONFIG] Poprawnie zaladowano config.json")
    return config


def save_config(config):
    with open(CONFIG_FILE, "w") as file:
        ujson.dump(config, file)

    print("[CONFIG] Zapisano config.json")


def load_last_uploaded_payload():
    if not file_exists(LAST_UPLOADED_PAYLOAD_FILE):
        return None

    try:
        with open(LAST_UPLOADED_PAYLOAD_FILE, "r") as file:
            payload = ujson.load(file)
            print("[CACHE] Zaladowano ostatnio wyslany payload")
            return payload
    except Exception as error:
        print("[CACHE] Nie udalo sie odczytac cache payloadu: {}".format(error))
        return None


def save_last_uploaded_payload(payload):
    try:
        with open(LAST_UPLOADED_PAYLOAD_FILE, "w") as file:
            ujson.dump(payload, file)
        print("[CACHE] Zapisano ostatnio wyslany payload")
    except Exception as error:
        print("[CACHE] Nie udalo sie zapisac cache payloadu: {}".format(error))


def create_upload_led(pin=UPLOAD_LED_PIN):
    try:
        led = Pin(pin, Pin.OUT)
        led.off()
        return led
    except Exception as error:
        print("[LED] Nie udalo sie zainicjalizowac LED na pinie {}: {}".format(pin, error))
        return None


def create_tpl5110_controller():
    if not TPL5110_ENABLED:
        print("[TPL5110] Modul wylaczony w settings.py")
        return None

    try:
        controller = TPL5110PowerController(
            done_pin=TPL5110_DONE_PIN,
            pulse_ms=TPL5110_DONE_PULSE_MS,
        )
        print("[TPL5110] Controller aktywny na DONE pin={}".format(TPL5110_DONE_PIN))
        return controller
    except Exception as error:
        print("[TPL5110] Nie udalo sie uruchomic kontrolera: {}".format(error))
        return None


def create_lcd_display():
    if not LCD_DISPLAY_ENABLED:
        print("[LCD] Wyswietlacz wylaczony w settings.py")
        return None

    try:
        display = LcdTelemetryDisplay(
            I2cLcd16x2(),
            page_interval_ms=LCD_PAGE_INTERVAL_MS,
        )
        display.show_status("SeedIoT", "Starting...")
        print("[LCD] Wyswietlacz LCD 16x2 aktywny")
        return display
    except Exception as error:
        print("[LCD] Nie udalo sie uruchomic LCD: {}".format(error))
        return None


def lcd_show_status(runtime, line1, line2=""):
    display = runtime.get("lcd")
    if display is None:
        return False

    try:
        display.show_status(line1, line2)
        return True
    except Exception as error:
        print("[LCD] Blad statusu LCD: {}".format(error))
        runtime["lcd"] = None
        return False


def lcd_set_payload(runtime, payload):
    runtime["latest_payload"] = payload
    display = runtime.get("lcd")
    if display is None:
        return False

    try:
        return display.set_payload(payload)
    except Exception as error:
        print("[LCD] Blad aktualizacji danych LCD: {}".format(error))
        runtime["lcd"] = None
        return False


def lcd_update(runtime):
    display = runtime.get("lcd")
    if display is None:
        return False

    try:
        return display.update()
    except Exception as error:
        print("[LCD] Blad odswiezania LCD: {}".format(error))
        runtime["lcd"] = None
        return False


def sleep_with_lcd_updates(runtime, duration_ms, step_ms=250):
    deadline = time.ticks_add(time.ticks_ms(), duration_ms)

    while time.ticks_diff(deadline, time.ticks_ms()) > 0:
        lcd_update(runtime)
        remaining_ms = time.ticks_diff(deadline, time.ticks_ms())
        if remaining_ms <= 0:
            break
        time.sleep_ms(step_ms if remaining_ms > step_ms else remaining_ms)


def set_led_on(led):
    if led is None:
        return

    led.on()


def set_led_off(led):
    if led is None:
        return

    led.off()


def blink_upload_led(led, duration_ms=UPLOAD_LED_BLINK_MS):
    if led is None:
        return

    try:
        led.on()
        time.sleep_ms(duration_ms)
    finally:
        led.off()


def blink_ble_advertising_led(led, duration_ms=BLE_ADVERTISING_BLINK_MS):
    blink_upload_led(led, duration_ms)


def create_tester_console():
    if uselect is None:
        print("[TESTER] Brak uselect, konsola testerska niedostepna")
        return None

    try:
        console = TesterConsole()
        print("[TESTER] Konsola testerska aktywna na stdin")
        return console
    except Exception as error:
        print("[TESTER] Nie udalo sie uruchomic konsoli testerskiej: {}".format(error))
        return None


def energy_profile_name(profile):
    return ENERGY_PROFILE_LABELS.get(profile, "UNKNOWN")


def print_tester_help():
    print("[TESTER] Dostepne komendy:")
    print("[TESTER]   help")
    print("[TESTER]   status")
    print("[TESTER]   energy:0  -> normalny tryb AUTO")
    print("[TESTER]   energy:1  -> tryb IDLE (bez Wi-Fi, BLE i odczytow)")
    print("[TESTER]   energy:2  -> tylko Wi-Fi")
    print("[TESTER]   energy:3  -> tylko BLE")
    print("[TESTER]   energy:4  -> tylko odczyty z czujnikow")


def read_tester_command(console):
    if console is None:
        return None

    try:
        command = console.read_command()
    except Exception as error:
        print("[TESTER] Blad odczytu komendy: {}".format(error))
        return None

    if not command:
        return None

    print("[TESTER] Odebrano komende: {}".format(command))
    return command


def parse_energy_profile_command(command):
    if not command.startswith("energy:"):
        return None

    value = command.split(":", 1)[1].strip()
    if not value:
        return None

    try:
        profile = int(value)
    except ValueError:
        return None

    if profile not in ENERGY_PROFILE_LABELS:
        return None

    return profile


def handle_config_packet(packet):
    global PENDING_CONFIG

    print("[CONFIG] Odebrano komende konfiguracyjna: {}".format(packet))

    if packet == "ACCEPT":
        config = {
            "ssid": PENDING_CONFIG.get("ssid", ""),
            "passwd": PENDING_CONFIG.get("passwd", ""),
            "apiKey": PENDING_CONFIG.get("apiKey", ""),
            "stationId": PENDING_CONFIG.get("stationId", ""),
            "serverUrl": PENDING_CONFIG.get("serverUrl", ""),
        }

        if not is_valid_config(config):
            existing_config = load_config()
            if existing_config is not None:
                print("[CONFIG] ACCEPT powtorzony po zapisaniu config.json")
                return True

            print("[CONFIG] Brak kompletnej konfiguracji przed ACCEPT")
            return False

        try:
            save_config(config)
        except Exception as error:
            print("[CONFIG] Nie udalo sie zapisac config.json: {}".format(error))
            return False

        PENDING_CONFIG = {}
        print("[CONFIG] Konfiguracja odebrana i zapisana")
        return True

    if ":" not in packet:
        print("[CONFIG] Nieznana komenda konfiguracyjna")
        return False

    command, value = packet.split(":", 1)
    command = command.strip().upper()
    value = value.strip()

    if not value:
        print("[CONFIG] Komenda {} ma pusta wartosc".format(command))
        return False

    if command == "SSID":
        PENDING_CONFIG["ssid"] = value
        print("[CONFIG] Zapisano SSID w buforze")
        return False

    if command == "PASSWD":
        PENDING_CONFIG["passwd"] = value
        print("[CONFIG] Zapisano haslo Wi-Fi w buforze")
        return False

    if command == "APIKEY":
        PENDING_CONFIG["apiKey"] = value
        print("[CONFIG] Zapisano API key w buforze")
        return False

    if command == "STATIONID":
        PENDING_CONFIG["stationId"] = value
        print("[CONFIG] Zapisano station ID w buforze")
        return False

    if command == "SERVERURL":
        PENDING_CONFIG["serverUrl"] = value
        print("[CONFIG] Zapisano server URL w buforze")
        return False

    print("[CONFIG] Nieobslugiwana komenda: {}".format(command))
    return False


def log_waiting_status(config):
    if config is None:
        print("[WAITING] Oczekiwanie w trybie testowym bez config.json")
        return

    print(
        "[WAITING] Oczekiwanie. SSID='{}', API key dlugosc={}, stationId='{}'".format(
            config["ssid"],
            len(config["apiKey"]),
            config["stationId"],
        )
    )


def try_create_sensor(label, factory):
    try:
        sensor = factory()
        print("[SENSOR] {} initialized".format(label))
        return label, sensor
    except Exception as error:
        print("[SENSOR] {} unavailable: {}".format(label, error))
        return label, None


def initialize_sensors():
    shared_wind_meter = WindMeter()

    return [
        try_create_sensor("soil_moisture", SoilMoistureSensor),
        try_create_sensor("ds18b20", DS18B20Sensor),
        try_create_sensor("bme280", BME280Sensor),
        try_create_sensor("bme680", BME680Sensor),
        try_create_sensor("ltr559", LTR559Sensor),
        try_create_sensor("scd41", SCD41Sensor),
        try_create_sensor(
            "wind",
            lambda: WindSensor(sensor=shared_wind_meter, sample_ms=WIND_SAMPLE_MS),
        ),
        try_create_sensor(
            "rain",
            lambda: RainSensor(sensor=shared_wind_meter, sample_ms=RAIN_SAMPLE_MS),
        ),
    ]


def reset_sensor_sampling_state(runtime):
    runtime["sensor_last_read_ms"] = {}
    runtime["sensor_cached_readings"] = {}


def read_sensor(label, sensor):
    if sensor is None:
        return None

    if label == "scd41":
        return sensor.read(wait=True)

    return sensor.read()


def get_sensor_interval_ms(sensor_label):
    multiplier = SENSOR_READ_MULTIPLIERS.get(sensor_label, 1)
    if multiplier < 1:
        multiplier = 1
    return BASE_INTERVAL_MS * multiplier


def should_read_sensor_now(runtime, sensor_label):
    last_read_ms = runtime["sensor_last_read_ms"].get(sensor_label)
    if last_read_ms is None:
        return True

    interval_ms = get_sensor_interval_ms(sensor_label)
    return time.ticks_diff(time.ticks_ms(), last_read_ms) >= interval_ms


def collect_sensor_payload(runtime, sensors):
    readings = {}

    for label, sensor in sensors:
        if sensor is None:
            readings[label] = None
            runtime["sensor_cached_readings"][label] = None
            continue

        if should_read_sensor_now(runtime, label):
            try:
                reading = read_sensor(label, sensor)
                readings[label] = reading
                runtime["sensor_cached_readings"][label] = reading
                runtime["sensor_last_read_ms"][label] = time.ticks_ms()
            except Exception as error:
                print("[{}] read failed: {}".format(label, error))
                error_reading = {"error": str(error)}
                readings[label] = error_reading
                runtime["sensor_cached_readings"][label] = error_reading
                runtime["sensor_last_read_ms"][label] = time.ticks_ms()
        else:
            cached = runtime["sensor_cached_readings"].get(label)
            if cached is None:
                try:
                    cached = read_sensor(label, sensor)
                    runtime["sensor_cached_readings"][label] = cached
                    runtime["sensor_last_read_ms"][label] = time.ticks_ms()
                except Exception as error:
                    print("[{}] read failed: {}".format(label, error))
                    cached = {"error": str(error)}
                    runtime["sensor_cached_readings"][label] = cached
                    runtime["sensor_last_read_ms"][label] = time.ticks_ms()
            readings[label] = cached

    return {
        "payload": {
            "readings": readings,
        },
    }


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def list_exceeds_threshold(current_values, previous_values, threshold):
    if not isinstance(current_values, list) or not isinstance(previous_values, list):
        return True

    if len(current_values) != len(previous_values):
        return True

    for index in range(len(current_values)):
        current_item = to_float(current_values[index])
        previous_item = to_float(previous_values[index])
        if current_item is None or previous_item is None:
            if current_values[index] != previous_values[index]:
                return True
            continue

        if abs(current_item - previous_item) > threshold:
            return True

    return False


def reading_changed_beyond_thresholds(sensor_name, current_reading, previous_reading):
    if previous_reading is None:
        return True

    if current_reading is None:
        return previous_reading is not None

    if previous_reading is None:
        return True

    if not isinstance(current_reading, dict) or not isinstance(previous_reading, dict):
        return current_reading != previous_reading

    thresholds = MEASUREMENT_CHANGE_THRESHOLDS.get(sensor_name, {})
    keys = set(current_reading.keys()) | set(previous_reading.keys())

    for key in keys:
        current_value = current_reading.get(key)
        previous_value = previous_reading.get(key)

        if current_value is None or previous_value is None:
            if current_value != previous_value:
                return True
            continue

        if key == "status":
            if current_value != previous_value:
                return True
            continue

        threshold = thresholds.get(key)

        if isinstance(current_value, list) or isinstance(previous_value, list):
            if threshold is None:
                if current_value != previous_value:
                    return True
                continue
            if list_exceeds_threshold(current_value, previous_value, threshold):
                return True
            continue

        current_number = to_float(current_value)
        previous_number = to_float(previous_value)

        if threshold is None or current_number is None or previous_number is None:
            if current_value != previous_value:
                return True
            continue

        if abs(current_number - previous_number) > threshold:
            return True

    return False


def payload_changed_beyond_thresholds(current_payload, previous_payload):
    if previous_payload is None:
        return True

    current_readings = current_payload.get("payload", {}).get("readings", {})
    previous_readings = previous_payload.get("payload", {}).get("readings", {})
    sensor_names = set(current_readings.keys()) | set(previous_readings.keys())

    for sensor_name in sensor_names:
        current_reading = current_readings.get(sensor_name)
        previous_reading = previous_readings.get(sensor_name)

        if reading_changed_beyond_thresholds(
            sensor_name, current_reading, previous_reading
        ):
            return True

    return False


def maybe_signal_tpl5110_done(runtime, reason):
    controller = runtime.get("tpl5110")
    if controller is None:
        return False

    if runtime.get("run_mode") != RUN_MODE_FULL:
        return False

    if runtime.get("energy_profile") != ENERGY_PROFILE_AUTO:
        return False

    print("[TPL5110] Sygnal DONE: {}".format(reason))
    controller.signal_done()
    return True


def ensure_wifi_connected(config, wlan=None):
    wlan = wlan or network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        return wlan

    print("[WIFI] Laczenie z siecia '{}'".format(config["ssid"]))
    wlan.connect(config["ssid"], config["passwd"])

    deadline = time.time() + 20
    while not wlan.isconnected():
        if time.time() >= deadline:
            raise RuntimeError("Nie udalo sie polaczyc z Wi-Fi")
        time.sleep(0.5)

    print("[WIFI] Polaczono:", wlan.ifconfig())
    return wlan


def disconnect_wifi(wlan):
    if wlan is None:
        return None

    try:
        if wlan.isconnected():
            wlan.disconnect()
    except Exception as error:
        print("[WIFI] Blad rozlaczania:", error)

    try:
        wlan.active(False)
    except Exception as error:
        print("[WIFI] Blad wylaczania interfejsu:", error)

    print("[WIFI] Rozlaczono Wi-Fi")
    return None


def upload_station_report(config, report, wlan=None):
    try:
        import urequests
    except ImportError as error:
        print("[HTTP] urequests unavailable:", error)
        return False

    server_url = config["serverUrl"].rstrip("/")
    report_url = "{}/station-report".format(server_url)
    headers = {
        "Content-Type": "application/json",
        "x-station-id": config["stationId"],
        "x-station-key": config["apiKey"],
    }

    response = None

    try:
        response = urequests.post(
            report_url,
            data=ujson.dumps(report),
            headers=headers,
        )

        status_code = getattr(response, "status_code", None)
        if status_code not in (200, 201):
            body = None
            try:
                body = response.text
            except Exception:
                body = "<brak odpowiedzi>"

            raise RuntimeError("HTTP {}: {}".format(status_code, body))

        print("[HTTP] Wyslano raport do {}".format(report_url))
        return True
    finally:
        if response is not None:
            try:
                response.close()
            except Exception:
                pass


def ensure_ble_pairing_device(ble_device):
    if ble_device is not None:
        try:
            if ble_device.ble.active():
                return ble_device
        except Exception:
            pass

    ble_device = BLEConfigPeripheral(handle_config_packet, BLE_NAME)
    ble_device.advertise()
    return ble_device


def stop_ble_pairing_device(ble_device):
    if ble_device is None:
        return None

    try:
        ble_device.stop()
    except Exception as error:
        print("[BLE] Blad wylaczania BLE: {}".format(error))

    return None


def print_runtime_status(runtime):
    wifi = runtime["wifi"]
    ble_device = runtime["ble_device"]
    profile = runtime["energy_profile"]
    sensor_count = 0 if runtime["sensors"] is None else len(runtime["sensors"])

    try:
        ble_active = ble_device is not None and ble_device.ble.active()
    except Exception:
        ble_active = False

    wifi_connected = wifi is not None and wifi.isconnected()

    print(
        "[STATUS] state={} profile={} config={} wifi_connected={} ble_active={} sensors={}".format(
            runtime["state"],
            energy_profile_name(profile),
            runtime["config"] is not None,
            wifi_connected,
            ble_active,
            sensor_count,
        )
    )

    if wifi_connected:
        try:
            print("[STATUS] wifi_ifconfig={}".format(wifi.ifconfig()))
        except Exception:
            pass


def apply_energy_profile(runtime, profile):
    previous = runtime["energy_profile"]
    runtime["energy_profile"] = profile
    runtime["tester_status_deadline_ms"] = None

    print(
        "[TESTER] Zmiana profilu {} -> {}".format(
            energy_profile_name(previous),
            energy_profile_name(profile),
        )
    )

    if profile != ENERGY_PROFILE_AUTO:
        runtime["wifi"] = disconnect_wifi(runtime["wifi"])

    if profile in (ENERGY_PROFILE_IDLE, ENERGY_PROFILE_WIFI, ENERGY_PROFILE_SENSORS):
        runtime["ble_device"] = stop_ble_pairing_device(runtime["ble_device"])

    if profile == ENERGY_PROFILE_BLE:
        runtime["wifi"] = disconnect_wifi(runtime["wifi"])

    if profile in (ENERGY_PROFILE_IDLE, ENERGY_PROFILE_BLE):
        runtime["sensors"] = None
        reset_sensor_sampling_state(runtime)

    if profile == ENERGY_PROFILE_AUTO:
        runtime["config"] = load_config()
        if runtime["config"] is None:
            runtime["state"] = set_state(STATE_BLE_PAIRING)
            lcd_show_status(runtime, "BLE pairing", "Waiting...")
            runtime["ble_device"] = ensure_ble_pairing_device(runtime["ble_device"])
            runtime["sensors"] = None
        else:
            runtime["state"] = set_state(STATE_WAITING)
            lcd_show_status(runtime, "SeedIoT", "AUTO mode")
            if runtime["sensors"] is None:
                runtime["sensors"] = initialize_sensors()
                reset_sensor_sampling_state(runtime)
    else:
        runtime["state"] = set_state("TESTER_{}".format(energy_profile_name(profile)))
        lcd_show_status(runtime, "Tester mode", energy_profile_name(profile))


def handle_tester_command(command, runtime):
    normalized = command.strip().lower()

    if normalized == "help":
        print_tester_help()
        return True

    if normalized == "status":
        print_runtime_status(runtime)
        return True

    profile = parse_energy_profile_command(normalized)
    if profile is not None:
        apply_energy_profile(runtime, profile)
        print_runtime_status(runtime)
        return True

    print("[TESTER] Nieznana komenda. Wpisz 'help'.")
    return False


def maybe_print_profile_status(runtime, interval_ms=TESTER_STATUS_INTERVAL_MS):
    now = time.ticks_ms()
    deadline = runtime["tester_status_deadline_ms"]

    if deadline is not None and time.ticks_diff(now, deadline) < 0:
        return False

    runtime["tester_status_deadline_ms"] = time.ticks_add(now, interval_ms)
    print_runtime_status(runtime)
    return True


def run_tester_boot_window(console, runtime):
    if console is None:
        return

    print_tester_help()
    print(
        "[TESTER] Masz {} s na wybor profilu energy:n przed startem AUTO".format(
            TESTER_BOOT_WINDOW_MS // 1000
        )
    )

    deadline = time.ticks_add(time.ticks_ms(), TESTER_BOOT_WINDOW_MS)

    while time.ticks_diff(deadline, time.ticks_ms()) > 0:
        command = read_tester_command(console)
        if command is not None:
            handle_tester_command(command, runtime)
            if runtime["energy_profile"] != ENERGY_PROFILE_AUTO:
                return

        time.sleep_ms(TESTER_LOOP_DELAY_MS)

    print("[TESTER] Nie wybrano profilu, start trybu AUTO")


def run_auto_cycle(runtime, upload_led):
    config = runtime["config"]
    ble_device = runtime["ble_device"]

    if ble_device is not None:
        ble_device.poll()

    if runtime["state"] == STATE_BLE_PAIRING:
        print("[STATUS] TRYB_LACZENIA connected={}".format(ble_device.connected))
        if ble_device.connected:
            set_led_on(upload_led)
        else:
            blink_ble_advertising_led(upload_led)

        if file_exists(CONFIG_FILE):
            config = load_config()
            runtime["config"] = config
            if config is not None:
                set_led_off(upload_led)
                runtime["state"] = set_state(STATE_WAITING)
                print("[APP] Konfiguracja gotowa. Przechodze do trybu oczekiwania")
                lcd_show_status(runtime, "Config saved", "Starting...")
                runtime["sensors"] = initialize_sensors()
                reset_sensor_sampling_state(runtime)
            else:
                print("[APP] config.json nadal niepoprawny, pozostaje w trybie laczenia")
                runtime["ble_device"] = ensure_ble_pairing_device(runtime["ble_device"])

        return

    if runtime["state"] != STATE_WAITING:
        print("[STATUS] Nieznany stan: {}".format(runtime["state"]))
        return

    set_led_off(upload_led)
    if runtime["sensors"] is None:
        runtime["sensors"] = initialize_sensors()
        reset_sensor_sampling_state(runtime)

    log_waiting_status(config)

    run_mode = runtime.get("run_mode", RUN_MODE_FULL)

    if run_mode == RUN_MODE_TEST:
        print("[MODE] Tryb testowy: odczyty beda tylko wyswietlane w terminalu")
        for measurement_index in range(AUTO_BATCH_MEASUREMENTS):
            payload = collect_sensor_payload(runtime, runtime["sensors"])
            lcd_set_payload(runtime, payload)
            print(
                "[MEASURE][TEST] Pomiar {}/{}".format(
                    measurement_index + 1,
                    AUTO_BATCH_MEASUREMENTS,
                )
            )
            print(ujson.dumps(payload))

            if measurement_index < AUTO_BATCH_MEASUREMENTS - 1:
                sleep_with_lcd_updates(runtime, BASE_INTERVAL_MS)
        return

    if config is None:
        print("[APP] Brak konfiguracji dla trybu pelnego, pomijam cykl AUTO")
        return

    for measurement_index in range(AUTO_BATCH_MEASUREMENTS):
        last_uploaded_payload = runtime.get("last_uploaded_payload")
        payload = collect_sensor_payload(runtime, runtime["sensors"])
        lcd_set_payload(runtime, payload)
        print(
            "[MEASURE] Pomiar {}/{}".format(
                measurement_index + 1,
                AUTO_BATCH_MEASUREMENTS,
            )
        )
        print(ujson.dumps(payload))

        should_upload = payload_changed_beyond_thresholds(payload, last_uploaded_payload)

        if should_upload:
            try:
                runtime["wifi"] = ensure_wifi_connected(config, runtime["wifi"])
                if upload_station_report(config, payload, runtime["wifi"]):
                    runtime["last_uploaded_payload"] = payload
                    save_last_uploaded_payload(payload)
                    blink_upload_led(upload_led)
            except Exception as error:
                print("[HTTP] Blad wysylki raportu:", error)
        else:
            runtime["latest_payload"] = payload
            print("[HTTP] Zmiany mieszcza sie w granicy bledu, pomijam wysylke")

        if measurement_index < AUTO_BATCH_MEASUREMENTS - 1:
            sleep_with_lcd_updates(runtime, BASE_INTERVAL_MS)

    runtime["wifi"] = disconnect_wifi(runtime["wifi"])
    maybe_signal_tpl5110_done(runtime, "koniec cyklu AUTO")

    print("[AUTO] Cykl pomiarowy zakonczony, pozostaje aktywny")


def run_tester_profile(runtime, upload_led):
    profile = runtime["energy_profile"]

    if profile == ENERGY_PROFILE_IDLE:
        set_led_off(upload_led)
        runtime["wifi"] = disconnect_wifi(runtime["wifi"])
        runtime["ble_device"] = stop_ble_pairing_device(runtime["ble_device"])
        lcd_show_status(runtime, "Tester IDLE", "No activity")
        maybe_print_profile_status(runtime)
        return

    if profile == ENERGY_PROFILE_WIFI:
        set_led_off(upload_led)
        runtime["ble_device"] = stop_ble_pairing_device(runtime["ble_device"])
        if runtime["config"] is None:
            lcd_show_status(runtime, "Tester WIFI", "No config")
            if maybe_print_profile_status(runtime):
                print("[TESTER] Brak config.json, profil WIFI nie moze polaczyc sie z siecia")
            return

        try:
            runtime["wifi"] = ensure_wifi_connected(runtime["config"], runtime["wifi"])
        except Exception as error:
            if maybe_print_profile_status(runtime):
                print("[TESTER] Nie udalo sie utrzymac Wi-Fi: {}".format(error))
            runtime["wifi"] = disconnect_wifi(runtime["wifi"])
            return

        maybe_print_profile_status(runtime)
        lcd_show_status(runtime, "Tester WIFI", "Connected")
        return

    if profile == ENERGY_PROFILE_BLE:
        if not runtime.get("allow_ble", True):
            lcd_show_status(runtime, "Tester BLE", "Disabled")
            if maybe_print_profile_status(runtime):
                print("[TESTER] BLE wylaczone w tym buildzie")
            return
        runtime["wifi"] = disconnect_wifi(runtime["wifi"])
        runtime["ble_device"] = ensure_ble_pairing_device(runtime["ble_device"])
        if runtime["ble_device"].connected:
            set_led_on(upload_led)
            lcd_show_status(runtime, "Tester BLE", "Connected")
        else:
            blink_ble_advertising_led(upload_led)
            lcd_show_status(runtime, "Tester BLE", "Advertising")
        maybe_print_profile_status(runtime)
        return

    if profile == ENERGY_PROFILE_SENSORS:
        set_led_off(upload_led)
        runtime["wifi"] = disconnect_wifi(runtime["wifi"])
        runtime["ble_device"] = stop_ble_pairing_device(runtime["ble_device"])
        if runtime["sensors"] is None:
            runtime["sensors"] = initialize_sensors()
            reset_sensor_sampling_state(runtime)

        if maybe_print_profile_status(runtime):
            payload = collect_sensor_payload(runtime, runtime["sensors"])
            lcd_set_payload(runtime, payload)
            print("[TESTER] Odczyt czujnikow")
            print(ujson.dumps(payload))


def main(
    run_mode=RUN_MODE_FULL,
    allow_ble=True,
    enable_tester_console=True,
    enable_tester_boot_window=True,
):
    if run_mode == RUN_MODE_TEST:
        print("[START] Uruchomienie builda testerskiego")
    else:
        print("[START] Uruchomienie builda produkcyjnego")

    state = set_state(STATE_BOOT)
    config = load_config()
    upload_led = create_upload_led()
    console = create_tester_console() if enable_tester_console else None
    runtime = {
        "state": state,
        "config": config,
        "ble_device": None,
        "sensors": None,
        "wifi": None,
        "energy_profile": ENERGY_PROFILE_AUTO,
        "tester_status_deadline_ms": None,
        "run_mode": run_mode,
        "allow_ble": allow_ble,
        "latest_payload": None,
        "lcd": create_lcd_display(),
        "last_uploaded_payload": load_last_uploaded_payload(),
        "sensor_last_read_ms": {},
        "sensor_cached_readings": {},
        "boot_ms": time.ticks_ms(),
        "tpl5110": create_tpl5110_controller(),
    }

    if config is None and run_mode != RUN_MODE_TEST and allow_ble:
        runtime["state"] = set_state(STATE_BLE_PAIRING)
        print("[BLE] Brak konfiguracji. Start trybu laczenia BLE")
        lcd_show_status(runtime, "BLE pairing", "Waiting...")
        runtime["ble_device"] = ensure_ble_pairing_device(runtime["ble_device"])
    else:
        runtime["state"] = set_state(STATE_WAITING)
        if run_mode == RUN_MODE_TEST and config is None:
            print("[APP] Tryb testowy bez config.json. Przechodze do odczytow lokalnych")
        elif run_mode != RUN_MODE_TEST and config is None and not allow_ble:
            print("[APP] Brak config.json, a BLE jest wylaczone")
        else:
            print("[APP] Konfiguracja istnieje. Przechodze do trybu oczekiwania")
        lcd_show_status(runtime, "SeedIoT", "Reading...")
        runtime["sensors"] = initialize_sensors()
        reset_sensor_sampling_state(runtime)

    if enable_tester_boot_window:
        run_tester_boot_window(console, runtime)

    while True:
        command = read_tester_command(console)
        if command is not None:
            handle_tester_command(command, runtime)

        if runtime["energy_profile"] == ENERGY_PROFILE_AUTO:
            run_auto_cycle(runtime, upload_led)
        else:
            run_tester_profile(runtime, upload_led)

        sleep_with_lcd_updates(runtime, TESTER_LOOP_DELAY_MS)


if __name__ == "__main__":
    main(
        run_mode=RUN_MODE_FULL,
        allow_ble=True,
        enable_tester_console=True,
        enable_tester_boot_window=False,
    )

from machine import I2C, Pin
from machine import ADC
from machine import disable_irq, enable_irq
from time import sleep
from time import ticks_ms, ticks_diff


SDA_PIN = 4
SCL_PIN = 5
I2C_ID = 0
I2C_FREQ = 400_000
WIND_PIN = 9
RAIN_PIN = 10
WIND_DIR_PIN = 26


class BME280:
    def __init__(self, i2c, address=None):
        self.i2c = i2c
        self.address = address if address is not None else self._detect_address()
        self.t_fine = 0.0
        self._read_calibration()
        self._write_u8(0xF2, 0x01)  # humidity oversampling x1
        self._write_u8(0xF4, 0x27)  # temp/pressure x1, normal mode
        self._write_u8(0xF5, 0xA0)  # config

    def _detect_address(self):
        for address in (0x76, 0x77):
            if address in self.i2c.scan():
                return address
        raise OSError("Nie znaleziono BME280 na I2C")

    def _read_u16(self, reg):
        data = self.i2c.readfrom_mem(self.address, reg, 2)
        return data[0] | (data[1] << 8)

    def _read_s16(self, reg):
        value = self._read_u16(reg)
        if value > 32767:
            value -= 65536
        return value

    def _read_u8(self, reg):
        return self.i2c.readfrom_mem(self.address, reg, 1)[0]

    def _write_u8(self, reg, value):
        self.i2c.writeto_mem(self.address, reg, bytes((value & 0xFF,)))

    def _read_calibration(self):
        self.dig_T1 = self._read_u16(0x88)
        self.dig_T2 = self._read_s16(0x8A)
        self.dig_T3 = self._read_s16(0x8C)

        self.dig_P1 = self._read_u16(0x8E)
        self.dig_P2 = self._read_s16(0x90)
        self.dig_P3 = self._read_s16(0x92)
        self.dig_P4 = self._read_s16(0x94)
        self.dig_P5 = self._read_s16(0x96)
        self.dig_P6 = self._read_s16(0x98)
        self.dig_P7 = self._read_s16(0x9A)
        self.dig_P8 = self._read_s16(0x9C)
        self.dig_P9 = self._read_s16(0x9E)

        self.dig_H1 = self._read_u8(0xA1)
        self.dig_H2 = self._read_s16(0xE1)
        self.dig_H3 = self._read_u8(0xE3)

        e4 = self._read_u8(0xE4)
        e5 = self._read_u8(0xE5)
        e6 = self._read_u8(0xE6)

        h4 = (e4 << 4) | (e5 & 0x0F)
        if h4 > 2047:
            h4 -= 4096
        self.dig_H4 = h4

        h5 = (e6 << 4) | (e5 >> 4)
        if h5 > 2047:
            h5 -= 4096
        self.dig_H5 = h5

        h6 = self._read_u8(0xE7)
        if h6 > 127:
            h6 -= 256
        self.dig_H6 = h6

    def _read_raw(self):
        data = self.i2c.readfrom_mem(self.address, 0xF7, 8)
        adc_p = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4)
        adc_t = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4)
        adc_h = (data[6] << 8) | data[7]
        return adc_t, adc_p, adc_h

    def read(self):
        adc_t, adc_p, adc_h = self._read_raw()

        var1 = (adc_t / 16384.0 - self.dig_T1 / 1024.0) * self.dig_T2
        var2 = ((adc_t / 131072.0 - self.dig_T1 / 8192.0) ** 2) * self.dig_T3
        self.t_fine = var1 + var2
        temperature = self.t_fine / 5120.0

        var1 = self.t_fine / 2.0 - 64000.0
        var2 = var1 * var1 * self.dig_P6 / 32768.0
        var2 = var2 + var1 * self.dig_P5 * 2.0
        var2 = var2 / 4.0 + self.dig_P4 * 65536.0
        var1 = (self.dig_P3 * var1 * var1 / 524288.0 + self.dig_P2 * var1) / 524288.0
        var1 = (1.0 + var1 / 32768.0) * self.dig_P1
        if var1 == 0:
            pressure = 0.0
        else:
            pressure = 1048576.0 - adc_p
            pressure = (pressure - var2 / 4096.0) * 6250.0 / var1
            var1 = self.dig_P9 * pressure * pressure / 2147483648.0
            var2 = pressure * self.dig_P8 / 32768.0
            pressure = pressure + (var1 + var2 + self.dig_P7) / 16.0
            pressure = pressure / 100.0

        var_h = self.t_fine - 76800.0
        if var_h == 0:
            humidity = 0.0
        else:
            humidity = (
                adc_h
                - (self.dig_H4 * 64.0 + self.dig_H5 / 16384.0 * var_h)
            ) * (
                self.dig_H2
                / 65536.0
                * (1.0 + self.dig_H6 / 67108864.0 * var_h * (1.0 + self.dig_H3 / 67108864.0 * var_h))
            )
            humidity = humidity * (1.0 - self.dig_H1 * humidity / 524288.0)
            if humidity > 100.0:
                humidity = 100.0
            elif humidity < 0.0:
                humidity = 0.0

        return temperature, pressure, humidity


class LTR559:
    ADDRESS = 0x23

    def __init__(self, i2c, address=ADDRESS):
        self.i2c = i2c
        self.address = address
        self._init_sensor()

    def _write_u8(self, reg, value):
        self.i2c.writeto_mem(self.address, reg, bytes((value & 0xFF,)))

    def _read_u8(self, reg):
        return self.i2c.readfrom_mem(self.address, reg, 1)[0]

    def _read_u16(self, reg):
        data = self.i2c.readfrom_mem(self.address, reg, 2)
        return data[0] | (data[1] << 8)

    def _init_sensor(self):
        # ALS active, default gain. Default measurement rate is fine for a basic example.
        self._write_u8(0x80, 0x01)
        self._write_u8(0x85, 0x03)

    def read_raw(self):
        status = self._read_u8(0x8C)
        ch1 = self._read_u16(0x88)
        ch0 = self._read_u16(0x8A)
        return {
            "status": status,
            "als_ch0": ch0,
            "als_ch1": ch1,
        }


class WindMeter:
    def __init__(self, pin=9, rain_pin=10, direction_pin=26):
        self.pulse_pin = Pin(pin, Pin.IN, Pin.PULL_UP)
        self.rain_pin = Pin(rain_pin, Pin.IN, Pin.PULL_DOWN)
        self.direction_adc = ADC(Pin(direction_pin))
        self._pulses = 0
        self._rain_pulses = 0
        self.pulse_pin.irq(trigger=Pin.IRQ_FALLING, handler=self._on_pulse)
        self.rain_pin.irq(trigger=Pin.IRQ_RISING, handler=self._on_rain_pulse)

    def _on_pulse(self, _pin):
        self._pulses += 1

    def _on_rain_pulse(self, _pin):
        self._rain_pulses += 1

    def sample_speed(self, sample_ms=1000):
        start = ticks_ms()
        irq_state = disable_irq()
        start_pulses = self._pulses
        start_rain_pulses = self._rain_pulses
        enable_irq(irq_state)

        sleep(sample_ms / 1000)
        elapsed_ms = ticks_diff(ticks_ms(), start)

        irq_state = disable_irq()
        pulses = self._pulses - start_pulses
        rain_pulses = self._rain_pulses - start_rain_pulses
        enable_irq(irq_state)

        # Empiryczny przelicznik z popularnych konfiguracji Enviro Weather.
        # Dla okna 1 s to po prostu liczba impulsow w sekundzie razy wspolczynnik.
        speed_m_s = pulses * 0.0218 * (1000 / elapsed_ms)
        rain_mm = rain_pulses * 0.2794
        rain_mm_per_hour = rain_mm * (3600000 / elapsed_ms)
        return speed_m_s, pulses, rain_mm, rain_mm_per_hour, rain_pulses, elapsed_ms

    def read_direction_raw(self):
        return self.direction_adc.read_u16()

    def read_direction(self):
        value = self.read_direction_raw()

        # Zamiast przeliczać rezystancję, dobieramy najbliższy znany region
        # po raw ADC. To daje sensowny fallback nawet bez dokładnej tabeli.
        # Uzyj najpierw szerokiego porownania, potem zbalansowanego fallbacku.
        if value > 58000:
            return "W", 270, value
        if value > 43000:
            return "NW", 315, value
        if value > 30000:
            return "N", 0, value
        if value > 18000:
            return "SW", 225, value
        if value > 12000:
            return "S", 180, value
        if value > 7000:
            return "NE", 45, value
        if value > 3000:
            return "SE", 135, value
        return "E", 90, value


def scan_bus(i2c):
    devices = i2c.scan()
    print("I2C devices:", [hex(device) for device in devices])
    return devices


def main():
    i2c = I2C(
        I2C_ID,
        sda=Pin(SDA_PIN),
        scl=Pin(SCL_PIN),
        freq=I2C_FREQ,
    )

    devices = scan_bus(i2c)
    if not devices:
        raise OSError(
            "Nie znaleziono zadnych urzadzen I2C. Sprawdz piny SDA/SCL oraz polaczenie."
        )

    bme = BME280(i2c)
    ltr = LTR559(i2c) if LTR559.ADDRESS in devices else None
    wind = WindMeter(WIND_PIN, RAIN_PIN, WIND_DIR_PIN) if WIND_PIN is not None else None

    while True:
        temperature, pressure, humidity = bme.read()
        print("=== Enviro Weather ===")
        print("Temperatura: {:.2f} C".format(temperature))
        print("Cisnienie: {:.2f} hPa".format(pressure))
        print("Wilgotnosc: {:.2f} %".format(humidity))

        if ltr is not None:
            light = ltr.read_raw()
            print("Swiatlo raw ch0: {}".format(light["als_ch0"]))
            print("Swiatlo raw ch1: {}".format(light["als_ch1"]))
        else:
            print("LTR559 nie znaleziony na I2C 0x23")

        if wind is not None:
            wind_speed, wind_pulses, rain_mm, rain_mm_per_hour, rain_pulses, elapsed_ms = wind.sample_speed(1000)
            wind_dir, heading, adc_raw = wind.read_direction()
            print("Wiatr: {:.2f} m/s ({} impulsow / {} ms)".format(wind_speed, wind_pulses, elapsed_ms))
            print("Opady: {:.3f} mm/h ({} mm w oknie, {} impulsow)".format(rain_mm_per_hour, rain_mm, rain_pulses))
            print("Kierunek wiatru: {} ({} deg, ADC={})".format(wind_dir, heading, adc_raw))

        print()
        sleep(5)


main()

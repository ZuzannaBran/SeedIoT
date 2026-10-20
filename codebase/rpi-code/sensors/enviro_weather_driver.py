import time
from machine import ADC, I2C, Pin, disable_irq, enable_irq
from time import sleep, ticks_diff, ticks_ms


import sensor_pins


class BME280:
    def __init__(self, i2c, address=None):
        self.i2c = i2c
        self.address = address if address is not None else self._detect_address()
        self.t_fine = 0.0
        self._read_calibration()
        self._write_u8(0xF2, 0x01)
        self._write_u8(0xF4, 0x27)
        self._write_u8(0xF5, 0xA0)
        time.sleep_ms(100)

    def _detect_address(self):
        address = sensor_pins.BME280_I2C_ADDRESS
        if address in self.i2c.scan():
            return address
        raise OSError("BME280 not found on I2C")

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
        self.dig_H4 = (e4 << 4) | (e5 & 0x0F)
        if self.dig_H4 > 2047:
            self.dig_H4 -= 4096
        self.dig_H5 = (e6 << 4) | (e5 >> 4)
        if self.dig_H5 > 2047:
            self.dig_H5 -= 4096
        self.dig_H6 = self._read_u8(0xE7)
        if self.dig_H6 > 127:
            self.dig_H6 -= 256

    def _read_raw(self):
        data = self.i2c.readfrom_mem(self.address, 0xF7, 8)
        adc_p = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4)
        adc_t = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4)
        adc_h = (data[6] << 8) | data[7]
        return adc_t, adc_p, adc_h

    def read(self):
        adc_t, adc_p, adc_h = self._read_raw()

        var1 = (((adc_t >> 3) - (self.dig_T1 << 1)) * self.dig_T2) >> 11
        var2 = (
            (((((adc_t >> 4) - self.dig_T1) * ((adc_t >> 4) - self.dig_T1)) >> 12)
            * self.dig_T3)
            >> 14
        )
        self.t_fine = var1 + var2
        temperature = ((self.t_fine * 5 + 128) >> 8) / 100.0

        var1 = self.t_fine - 128000
        var2 = var1 * var1 * self.dig_P6
        var2 = var2 + ((var1 * self.dig_P5) << 17)
        var2 = var2 + (self.dig_P4 << 35)
        var1 = ((var1 * var1 * self.dig_P3) >> 8) + ((var1 * self.dig_P2) << 12)
        var1 = (((1 << 47) + var1) * self.dig_P1) >> 33

        if var1 == 0:
            pressure = 0
        else:
            pressure = 1048576 - adc_p
            pressure = (((pressure << 31) - var2) * 3125) // var1
            var1 = (self.dig_P9 * (pressure >> 13) * (pressure >> 13)) >> 25
            var2 = (self.dig_P8 * pressure) >> 19
            pressure = ((pressure + var1 + var2) >> 8) + (self.dig_P7 << 4)
        pressure = pressure / 25600.0

        humidity = self.t_fine - 76800
        humidity = (
            (
                (
                    (adc_h << 14)
                    - (self.dig_H4 << 20)
                    - (self.dig_H5 * humidity)
                    + 16384
                )
                >> 15
            )
            * (
                (
                    (
                        (((humidity * self.dig_H6) >> 10)
                        * (((humidity * self.dig_H3) >> 11) + 32768))
                        >> 10
                    )
                    + 2097152
                )
                * self.dig_H2
                + 8192
            )
            >> 14
        )
        humidity = humidity - (
            (
                ((humidity >> 15) * (humidity >> 15)) >> 7
            )
            * self.dig_H1
            >> 4
        )
        if humidity < 0:
            humidity = 0
        if humidity > 419430400:
            humidity = 419430400
        humidity = (humidity >> 12) / 1024.0

        return temperature, pressure, humidity


class LTR559:
    ADDRESS = sensor_pins.LTR559_I2C_ADDRESS

    def __init__(self, i2c, address=ADDRESS):
        self.i2c = i2c
        self.address = address
        self._write_u8(0x80, 0x01)
        self._write_u8(0x85, 0x03)

    def _write_u8(self, reg, value):
        self.i2c.writeto_mem(self.address, reg, bytes((value & 0xFF,)))

    def _read_u8(self, reg):
        return self.i2c.readfrom_mem(self.address, reg, 1)[0]

    def _read_u16(self, reg):
        data = self.i2c.readfrom_mem(self.address, reg, 2)
        return data[0] | (data[1] << 8)

    def read_raw(self):
        return {
            "status": self._read_u8(0x8C),
            "als_ch0": self._read_u16(0x8A),
            "als_ch1": self._read_u16(0x88),
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

    def sample_wind(self, sample_ms=1000):
        start = ticks_ms()
        irq_state = disable_irq()
        start_pulses = self._pulses
        enable_irq(irq_state)

        sleep(sample_ms / 1000)
        elapsed_ms = ticks_diff(ticks_ms(), start)

        irq_state = disable_irq()
        pulses = self._pulses - start_pulses
        enable_irq(irq_state)

        speed_m_s = pulses * 0.0218 * (1000 / elapsed_ms)
        return speed_m_s, pulses, elapsed_ms

    def sample_rain(self, sample_ms=1000):
        start = ticks_ms()
        irq_state = disable_irq()
        start_rain_pulses = self._rain_pulses
        enable_irq(irq_state)

        sleep(sample_ms / 1000)
        elapsed_ms = ticks_diff(ticks_ms(), start)

        irq_state = disable_irq()
        rain_pulses = self._rain_pulses - start_rain_pulses
        enable_irq(irq_state)

        rain_mm = rain_pulses * 0.2794
        rain_mm_per_hour = rain_mm * (3600000 / elapsed_ms)
        return rain_mm, rain_mm_per_hour, rain_pulses, elapsed_ms

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

        speed_m_s = pulses * 0.0218 * (1000 / elapsed_ms)
        rain_mm = rain_pulses * 0.2794
        rain_mm_per_hour = rain_mm * (3600000 / elapsed_ms)
        return speed_m_s, pulses, rain_mm, rain_mm_per_hour, rain_pulses, elapsed_ms

    def read_direction_raw(self):
        return self.direction_adc.read_u16()

    def read_direction(self):
        value = self.read_direction_raw()
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

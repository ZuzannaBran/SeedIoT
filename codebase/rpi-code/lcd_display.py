import time
from machine import I2C, Pin

import sensor_pins


LCD_CLEARDISPLAY = 0x01
LCD_RETURNHOME = 0x02
LCD_ENTRYMODESET = 0x04
LCD_DISPLAYCONTROL = 0x08
LCD_FUNCTIONSET = 0x20
LCD_SETDDRAMADDR = 0x80

LCD_ENTRYLEFT = 0x02
LCD_DISPLAYON = 0x04
LCD_2LINE = 0x08
LCD_5X8DOTS = 0x00
LCD_4BITMODE = 0x00

ENABLE = 0x04
BACKLIGHT = 0x08

MODE_COMMAND = 0
MODE_CHARACTER = 1


class I2cLcd16x2:
    def __init__(
        self,
        i2c=None,
        address=sensor_pins.LCD_I2C_ADDRESS,
        bus_id=sensor_pins.LCD_I2C_BUS_ID,
        sda_pin=sensor_pins.LCD_I2C_SDA_PIN,
        scl_pin=sensor_pins.LCD_I2C_SCL_PIN,
        freq=sensor_pins.LCD_I2C_FREQ,
    ):
        self.i2c = i2c or I2C(bus_id, sda=Pin(sda_pin), scl=Pin(scl_pin), freq=freq)
        self.address = address
        self.backlight = BACKLIGHT
        self._init_lcd()

    def _write_byte(self, value):
        self.i2c.writeto(self.address, bytes([value | self.backlight]))

    def _pulse_enable(self, value):
        self._write_byte(value | ENABLE)
        time.sleep_us(1)
        self._write_byte(value & ~ENABLE)
        time.sleep_us(50)

    def _write4bits(self, value):
        self._write_byte(value)
        self._pulse_enable(value)

    def _send(self, value, mode):
        high = value & 0xF0
        low = (value << 4) & 0xF0
        self._write4bits(high | mode)
        self._write4bits(low | mode)

    def command(self, value):
        self._send(value, MODE_COMMAND)

    def write_char(self, value):
        self._send(value, MODE_CHARACTER)

    def _init_lcd(self):
        time.sleep_ms(50)
        self._write4bits(0x30)
        time.sleep_ms(5)
        self._write4bits(0x30)
        time.sleep_us(150)
        self._write4bits(0x30)
        self._write4bits(0x20)

        self.command(LCD_FUNCTIONSET | LCD_4BITMODE | LCD_2LINE | LCD_5X8DOTS)
        self.command(LCD_DISPLAYCONTROL | LCD_DISPLAYON)
        self.clear()
        self.command(LCD_ENTRYMODESET | LCD_ENTRYLEFT)

    def clear(self):
        self.command(LCD_CLEARDISPLAY)
        time.sleep_ms(2)

    def move_to(self, col, row):
        row_offsets = (0x00, 0x40)
        if row < 0:
            row = 0
        if row > 1:
            row = 1
        if col < 0:
            col = 0
        if col > 15:
            col = 15
        self.command(LCD_SETDDRAMADDR | (col + row_offsets[row]))

    def putstr(self, text):
        for char in text:
            code = ord(char)
            if code < 32 or code > 126:
                code = ord("?")
            self.write_char(code)

    def show_lines(self, line1, line2=""):
        self.move_to(0, 0)
        self.putstr(_fit_lcd_line(line1))
        self.move_to(0, 1)
        self.putstr(_fit_lcd_line(line2))


def _fit_lcd_line(text):
    if text is None:
        text = ""
    text = str(text)
    if len(text) > 16:
        return text[:16]
    return text + (" " * (16 - len(text)))


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_number(value, decimals=1):
    number = _to_float(value)
    if number is None:
        return "--"
    if decimals == 0:
        return "{:.0f}".format(number)
    return "{:.1f}".format(number)


def _readings_from_payload(payload):
    if not isinstance(payload, dict):
        return {}

    root = payload.get("payload", payload)
    if not isinstance(root, dict):
        return {}

    readings = root.get("readings", root)
    if not isinstance(readings, dict):
        return {}

    return readings


def build_lcd_pages(payload):
    readings = _readings_from_payload(payload)
    pages = []

    soil = readings.get("soil_moisture")
    if isinstance(soil, dict):
        pages.append(("Soil moisture", "{} %".format(_format_number(soil.get("moisture_percent")))))

    ds18b20 = readings.get("ds18b20")
    if isinstance(ds18b20, dict):
        pages.append(("Soil temp", "{} C".format(_format_number(ds18b20.get("temperature_c")))))

    bme280 = readings.get("bme280")
    if isinstance(bme280, dict):
        pages.append(("Air temp", "{} C".format(_format_number(bme280.get("temperature_c")))))
        pages.append(("Air humidity", "{} %".format(_format_number(bme280.get("humidity_percent")))))
        pages.append(("Pressure", "{} hPa".format(_format_number(bme280.get("pressure_hpa"), 0))))

    bme680 = readings.get("bme680")
    if isinstance(bme680, dict) and not isinstance(bme280, dict):
        pages.append(("Air temp", "{} C".format(_format_number(bme680.get("temperature_c")))))
        pages.append(("Air humidity", "{} %".format(_format_number(bme680.get("humidity_percent")))))
        pages.append(("Pressure", "{} hPa".format(_format_number(bme680.get("pressure_hpa"), 0))))

    scd41 = readings.get("scd41")
    if isinstance(scd41, dict):
        pages.append(("CO2", "{} ppm".format(_format_number(scd41.get("co2_ppm"), 0))))

    ltr559 = readings.get("ltr559")
    if isinstance(ltr559, dict):
        pages.append(("Light CH0", _format_number(ltr559.get("als_ch0"), 0)))

    wind = readings.get("wind")
    if isinstance(wind, dict):
        pages.append(("Wind speed", "{} m/s".format(_format_number(wind.get("wind_speed_m_s")))))

    rain = readings.get("rain")
    if isinstance(rain, dict):
        pages.append(("Rain", "{} mm".format(_format_number(rain.get("rain_mm")))))

    return pages


class LcdTelemetryDisplay:
    def __init__(self, lcd, page_interval_ms=3000):
        self.lcd = lcd
        self.page_interval_ms = page_interval_ms
        self.pages = []
        self.page_index = 0
        self.last_switch_ms = None
        self.current_status = None

    def show_status(self, line1, line2=""):
        status = (line1, line2)
        if status == self.current_status:
            return False

        self.pages = []
        self.page_index = 0
        self.last_switch_ms = time.ticks_ms()
        self.current_status = status
        self.lcd.show_lines(line1, line2)
        return True

    def set_payload(self, payload):
        pages = build_lcd_pages(payload)
        if not pages:
            self.show_status("SeedIoT", "No readings")
            return False

        self.pages = pages
        self.page_index = 0
        self.last_switch_ms = None
        self.current_status = None
        self.update(force=True)
        return True

    def update(self, force=False):
        if not self.pages:
            return False

        now = time.ticks_ms()
        if (
            not force
            and self.last_switch_ms is not None
            and time.ticks_diff(now, self.last_switch_ms) < self.page_interval_ms
        ):
            return False

        line1, line2 = self.pages[self.page_index]
        self.lcd.show_lines(line1, line2)
        self.page_index = (self.page_index + 1) % len(self.pages)
        self.last_switch_ms = now
        return True

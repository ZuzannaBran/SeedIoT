import machine
import time
from machine import I2C, Pin, RTC

import sensor_pins


REG_CONTROL_2 = 0x01
REG_SECONDS = 0x04
REG_SECOND_ALARM = 0x0B

CONTROL_2_AIE = 0x80
CONTROL_2_AF = 0x40

ALARM_DISABLED = 0x80

HOLD_VSYS_EN_PIN = Pin(sensor_pins.ENVIRO_HOLD_VSYS_EN_PIN, Pin.OUT, value=True)


def bcd_to_int(value):
    return ((value >> 4) * 10) + (value & 0x0F)


def int_to_bcd(value):
    return ((value // 10) << 4) | (value % 10)


class PCF85063A:
    def __init__(self, i2c, address=sensor_pins.ENVIRO_RTC_I2C_ADDRESS):
        self.i2c = i2c
        self.address = address

    def read_reg(self, reg):
        return self.i2c.readfrom_mem(self.address, reg, 1)[0]

    def write_reg(self, reg, value):
        self.i2c.writeto_mem(self.address, reg, bytes((value & 0xFF,)))

    def read_time(self):
        data = self.i2c.readfrom_mem(self.address, REG_SECONDS, 7)

        second = bcd_to_int(data[0] & 0x7F)
        minute = bcd_to_int(data[1] & 0x7F)
        hour = bcd_to_int(data[2] & 0x3F)
        day = bcd_to_int(data[3] & 0x3F)
        weekday = data[4] & 0x07
        month = bcd_to_int(data[5] & 0x1F)
        year = 2000 + bcd_to_int(data[6])

        return year, month, day, hour, minute, second, weekday

    def clear_alarm_flag(self):
        control_2 = self.read_reg(REG_CONTROL_2)
        self.write_reg(REG_CONTROL_2, control_2 & ~CONTROL_2_AF)

    def alarm_fired(self):
        return bool(self.read_reg(REG_CONTROL_2) & CONTROL_2_AF)

    def set_minute_hour_alarm(self, hour, minute):
        alarm_data = bytes(
            (
                ALARM_DISABLED,
                int_to_bcd(minute) & 0x7F,
                int_to_bcd(hour) & 0x3F,
                ALARM_DISABLED,
                ALARM_DISABLED,
            )
        )
        self.i2c.writeto_mem(self.address, REG_SECOND_ALARM, alarm_data)

        control_2 = self.read_reg(REG_CONTROL_2)
        control_2 &= ~CONTROL_2_AF
        control_2 |= CONTROL_2_AIE
        self.write_reg(REG_CONTROL_2, control_2)


def create_rtc_i2c():
    return I2C(
        sensor_pins.I2C_BUS_ID,
        sda=Pin(sensor_pins.I2C_SDA_PIN),
        scl=Pin(sensor_pins.I2C_SCL_PIN),
        freq=sensor_pins.I2C_FREQ,
    )


def create_rtc(i2c=None):
    i2c = i2c or create_rtc_i2c()
    devices = i2c.scan()

    if sensor_pins.ENVIRO_RTC_I2C_ADDRESS not in devices:
        raise RuntimeError("PCF85063A RTC not found at 0x51")

    return PCF85063A(i2c)


def detect_usb_power():
    try:
        return bool(Pin("WL_GPIO2", Pin.IN).value())
    except Exception:
        return False


def format_datetime(dt):
    return "{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
        dt[0], dt[1], dt[2], dt[3], dt[4], dt[5]
    )


def sync_pico_rtc(dt):
    RTC().datetime((dt[0], dt[1], dt[2], dt[6], dt[3], dt[4], dt[5], 0))


def next_alarm_time(dt, sleep_minutes):
    hour = dt[3]
    minute = dt[4] + sleep_minutes

    while minute >= 60:
        minute -= 60
        hour += 1

    while hour >= 24:
        hour -= 24

    return hour, minute


def sleep_for_minutes(sleep_minutes, reset_on_usb=True, print_status=False):
    vbus_present = detect_usb_power()

    rtc = create_rtc()
    now = rtc.read_time()
    sync_pico_rtc(now)

    alarm_hour, alarm_minute = next_alarm_time(now, sleep_minutes)
    rtc.clear_alarm_flag()
    rtc.set_minute_hour_alarm(alarm_hour, alarm_minute)

    result = {
        "rtc": format_datetime(now),
        "power_source": "USB" if vbus_present else "Battery",
        "alarm_hour": alarm_hour,
        "alarm_minute": alarm_minute,
        "sleep_minutes": sleep_minutes,
    }

    if print_status:
        print("RTC:", result["rtc"])
        print("Power source:", result["power_source"])
        print(
            "Alarm set for {:02d}:{:02d} in {} minute(s)".format(
                result["alarm_hour"],
                result["alarm_minute"],
                result["sleep_minutes"],
            )
        )

    HOLD_VSYS_EN_PIN.init(Pin.IN)

    if not vbus_present:
        time.sleep(5)
        return result

    if reset_on_usb:
        while not rtc.alarm_fired():
            time.sleep(0.25)
        machine.reset()

    return result

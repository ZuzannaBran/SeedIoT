from machine import I2C, Pin

import sensor_pins
from sensors.enviro_weather_driver import LTR559


class LTR559Sensor:
    name = "ltr559"

    def __init__(
        self,
        i2c=None,
        address=sensor_pins.LTR559_I2C_ADDRESS,
        bus_id=sensor_pins.I2C_BUS_ID,
        sda_pin=sensor_pins.I2C_SDA_PIN,
        scl_pin=sensor_pins.I2C_SCL_PIN,
        freq=sensor_pins.ENVIRO_I2C_FREQ,
    ):
        self.i2c = i2c or I2C(bus_id, sda=Pin(sda_pin), scl=Pin(scl_pin), freq=freq)
        self.sensor = LTR559(self.i2c, address)

    def read(self):
        raw = self.sensor.read_raw()

        return {
            "status": raw["status"],
            "als_ch0": raw["als_ch0"],
            "als_ch1": raw["als_ch1"],
        }

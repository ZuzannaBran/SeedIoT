from machine import I2C, Pin

import sensor_pins
from sensors.enviro_weather_driver import BME280


class BME280Sensor:
    name = "bme280"

    def __init__(
        self,
        i2c=None,
        address=sensor_pins.BME280_I2C_ADDRESS,
        bus_id=sensor_pins.I2C_BUS_ID,
        sda_pin=sensor_pins.I2C_SDA_PIN,
        scl_pin=sensor_pins.I2C_SCL_PIN,
        freq=sensor_pins.I2C_FREQ,
    ):
        self.i2c = i2c or I2C(bus_id, sda=Pin(sda_pin), scl=Pin(scl_pin), freq=freq)
        self.sensor = BME280(self.i2c, address)

    def read(self):
        temperature, pressure, humidity = self.sensor.read()

        return {
            "temperature_c": temperature,
            "pressure_hpa": pressure,
            "humidity_percent": humidity,
        }

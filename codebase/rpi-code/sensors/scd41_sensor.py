import time
from machine import I2C, Pin

import sensor_pins
from sensors.scd4x_driver import SCD4X


class SCD41Sensor:
    name = "scd41"

    def __init__(self, i2c=None, address=None):
        if address is None:
            address = sensor_pins.SCD41_I2C_ADDRESS

        if i2c is None:
            i2c = I2C(
                sensor_pins.SCD41_I2C_BUS_ID,
                sda=Pin(sensor_pins.SCD41_I2C_SDA_PIN),
                scl=Pin(sensor_pins.SCD41_I2C_SCL_PIN),
                freq=sensor_pins.SCD41_I2C_FREQ,
            )

        self.i2c = i2c
        self.sensor = SCD4X(self.i2c, address)
        self.sensor.start_periodic_measurement()

    def data_ready(self):
        return self.sensor.data_ready

    def read(self, wait=False, timeout_seconds=6):
        if wait:
            deadline = time.time() + timeout_seconds
            while not self.sensor.data_ready:
                if time.time() >= deadline:
                    raise RuntimeError("SCD41 data not ready")
                time.sleep(0.5)
        elif not self.sensor.data_ready:
            raise RuntimeError("SCD41 data not ready")

        return {
            "co2_ppm": self.sensor.CO2,
            "temperature_c": self.sensor.temperature,
            "humidity_percent": self.sensor.relative_humidity,
        }

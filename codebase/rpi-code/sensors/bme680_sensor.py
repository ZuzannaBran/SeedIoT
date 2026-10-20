from machine import I2C, Pin, SoftI2C

import sensor_pins
from sensors.bme680_driver import BME680


class BME680Sensor:
    name = "bme680"

    def __init__(
        self,
        i2c=None,
        address=sensor_pins.BME680_I2C_ADDRESS,
        bus_id=sensor_pins.BME680_I2C_BUS_ID,
        sda_pin=sensor_pins.BME680_I2C_SDA_PIN,
        scl_pin=sensor_pins.BME680_I2C_SCL_PIN,
        freq=sensor_pins.BME680_I2C_FREQ,
    ):
        self.i2c = i2c or self._create_i2c(bus_id, sda_pin, scl_pin, freq)
        self.sensor = BME680(self.i2c, address)

        if not self.sensor.begin():
            raise RuntimeError("BME680 initialization failed")

    def _create_i2c(self, bus_id, sda_pin, scl_pin, freq):
        if sensor_pins.BME680_USE_SOFT_I2C:
            return SoftI2C(sda=Pin(sda_pin), scl=Pin(scl_pin), freq=freq)

        return I2C(bus_id, sda=Pin(sda_pin), scl=Pin(scl_pin), freq=freq)

    def read(self):
        temperature = self.sensor.readTemperature()
        pressure = self.sensor.readPressure()
        humidity = self.sensor.readHumidity()
        gas_resistance = self.sensor.readGas(0)

        return {
            "temperature_c": temperature,
            "pressure_hpa": None if pressure is None else pressure / 100,
            "humidity_percent": humidity,
            "gas_resistance_kohm": None
            if gas_resistance is None
            else gas_resistance / 1000,
        }

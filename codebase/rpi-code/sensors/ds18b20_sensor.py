import ds18x20
import onewire
import time
from machine import Pin

import sensor_pins


class DS18B20Sensor:
    name = "ds18b20"

    def __init__(self, pin=sensor_pins.DS18B20_PIN):
        self.bus = ds18x20.DS18X20(onewire.OneWire(Pin(pin)))
        self.roms = self.bus.scan()

        if not self.roms:
            raise RuntimeError("DS18B20 sensor not found")

    def read(self):
        self.bus.convert_temp()
        time.sleep_ms(750)

        temperatures = []
        for rom in self.roms:
            temperatures.append(self.bus.read_temp(rom))

        result = {
            "temperatures_c": temperatures,
            "sensor_count": len(temperatures),
        }

        if len(temperatures) == 1:
            result["temperature_c"] = temperatures[0]

        return result

from machine import ADC, Pin

import sensor_pins


class SoilMoistureSensor:
    name = "soil_moisture"

    def __init__(
        self,
        pin=sensor_pins.SOIL_MOISTURE_ADC_PIN,
        dry_value=sensor_pins.SOIL_MOISTURE_DRY_VALUE,
        wet_value=sensor_pins.SOIL_MOISTURE_WET_VALUE,
        reference_voltage=sensor_pins.SOIL_MOISTURE_REFERENCE_VOLTAGE,
    ):
        self.adc = ADC(Pin(pin))
        self.dry_value = dry_value
        self.wet_value = wet_value
        self.reference_voltage = reference_voltage

    def read(self):
        raw = self.adc.read_u16()
        voltage = raw * (self.reference_voltage / 65535)

        return {
            "raw_adc": raw,
            "voltage_v": voltage,
            "moisture_percent": self._map_moisture(raw),
        }

    def _map_moisture(self, raw):
        percentage = ((raw - self.dry_value) / (self.wet_value - self.dry_value)) * 100

        if percentage < 0:
            return 0

        if percentage > 100:
            return 100

        return percentage

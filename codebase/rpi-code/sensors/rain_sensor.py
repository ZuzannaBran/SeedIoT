import sensor_pins
from sensors.enviro_weather_driver import WindMeter


class RainSensor:
    name = "rain"

    def __init__(
        self,
        sensor=None,
        wind_pin=sensor_pins.WIND_SPEED_PIN,
        rain_pin=sensor_pins.RAIN_GAUGE_PIN,
        direction_pin=sensor_pins.WIND_DIRECTION_ADC_PIN,
        sample_ms=1000,
    ):
        self.sensor = sensor or WindMeter(wind_pin, rain_pin, direction_pin)
        self.sample_ms = sample_ms

    def read(self, sample_ms=None):
        sample_ms = self.sample_ms if sample_ms is None else sample_ms
        rain_mm, rain_mm_per_hour, rain_pulses, elapsed_ms = self.sensor.sample_rain(
            sample_ms
        )

        return {
            "rain_mm": rain_mm,
            "rain_mm_per_hour": rain_mm_per_hour,
            "rain_pulses": rain_pulses,
            "sample_elapsed_ms": elapsed_ms,
            "sample_requested_ms": sample_ms,
        }

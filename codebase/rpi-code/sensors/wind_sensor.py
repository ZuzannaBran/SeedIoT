import sensor_pins
from sensors.enviro_weather_driver import WindMeter


class WindSensor:
    name = "wind"

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
        wind_speed, wind_pulses, elapsed_ms = self.sensor.sample_wind(sample_ms)
        direction, heading, adc_raw = self.sensor.read_direction()

        return {
            "wind_speed_m_s": wind_speed,
            "wind_pulses": wind_pulses,
            "sample_elapsed_ms": elapsed_ms,
            "sample_requested_ms": sample_ms,
            "wind_direction": direction,
            "wind_heading_deg": heading,
            "wind_direction_raw_adc": adc_raw,
        }

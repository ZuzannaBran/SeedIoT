import sensor_pins
from sensors.enviro_weather_driver import WindMeter


class WindRainSensor:
    name = "wind_rain"

    def __init__(
        self,
        wind_pin=sensor_pins.WIND_SPEED_PIN,
        rain_pin=sensor_pins.RAIN_GAUGE_PIN,
        direction_pin=sensor_pins.WIND_DIRECTION_ADC_PIN,
        sample_ms=1000,
    ):
        self.sensor = WindMeter(wind_pin, rain_pin, direction_pin)
        self.sample_ms = sample_ms

    def read(self):
        (
            wind_speed,
            wind_pulses,
            rain_mm,
            rain_mm_per_hour,
            rain_pulses,
            elapsed_ms,
        ) = self.sensor.sample_speed(self.sample_ms)
        direction, heading, adc_raw = self.sensor.read_direction()

        return {
            "wind_speed_m_s": wind_speed,
            "wind_pulses": wind_pulses,
            "rain_mm": rain_mm,
            "rain_mm_per_hour": rain_mm_per_hour,
            "rain_pulses": rain_pulses,
            "sample_elapsed_ms": elapsed_ms,
            "wind_direction": direction,
            "wind_heading_deg": heading,
            "wind_direction_raw_adc": adc_raw,
        }

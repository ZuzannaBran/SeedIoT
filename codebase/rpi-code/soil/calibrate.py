import time

from machine import ADC, Pin
from sensor_pins import (
    SOIL_MOISTURE_ADC_PIN,
    SOIL_MOISTURE_REFERENCE_VOLTAGE,
)


def main():
    sensor = ADC(Pin(SOIL_MOISTURE_ADC_PIN))

    while True:
        raw = sensor.read_u16()
        voltage = raw * (SOIL_MOISTURE_REFERENCE_VOLTAGE / 65535)
        print("Raw ADC: {} | Voltage: {:.2f} V".format(raw, voltage))
        time.sleep(0.5)


if __name__ == "__main__":
    main()

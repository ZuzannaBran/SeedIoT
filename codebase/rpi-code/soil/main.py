import time

from sensors.soil_moisture_sensor import SoilMoistureSensor


def main():
    sensor = SoilMoistureSensor()

    while True:
        reading = sensor.read()
        print("Soil Moisture: {:.1f}%".format(reading["moisture_percent"]))
        time.sleep(1)


if __name__ == "__main__":
    main()

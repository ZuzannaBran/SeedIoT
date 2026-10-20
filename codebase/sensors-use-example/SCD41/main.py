import machine
import time
from scd4x import SCD4X

i2c = machine.I2C(0, sda=machine.Pin(4), scl=machine.Pin(5), freq=100000)

time.sleep(1)

try:
    sensor = SCD4X(i2c)
    sensor.start_periodic_measurement()
    print("SCD41 Initialized!")
except Exception as e:
    print("Failed to find SCD41. Check your wiring!", e)

while True:
    try:
        if sensor.data_ready:
            co2 = sensor.CO2
            temp = sensor.temperature
            hum = sensor.relative_humidity
            print(f"CO2:      {co2} ppm")
            print(f"Temp:     {temp:.2f} °C")
            print(f"Humidity: {hum:.2f} %")
            print("-" * 20)
            
        time.sleep(0.5) 
    except Exception as e:
        print("Error reading sensor:", e)
        time.sleep(2)
import machine
import time

soil_sensor = machine.ADC(machine.Pin(26))

#Wyniki po kalibracji
DRY_VALUE = 1800   # Suchy
WET_VALUE = 58000  # Zanuzony w pelnej szklance wody
# ----------------------------------------------------

def map_moisture(raw_adc):
    percentage = ((raw_adc-DRY_VALUE)/(WET_VALUE-DRY_VALUE))*100
    if percentage < 0: 
        percentage = 0
    if percentage > 100: 
        percentage = 100
    return percentage

while True:
    raw = soil_sensor.read_u16()
    moisture_percent = map_moisture(raw)
    print(f"Soil Moisture: {moisture_percent:.1f}%")
    time.sleep(1)
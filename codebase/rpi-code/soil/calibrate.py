import machine
import time

soil_sensor = machine.ADC(machine.Pin(26))

while True:
    raw_value = soil_sensor.read_u16()
    voltage = raw_value*(3.3/65535)
    print(f"Raw ADC: {raw_value} | Voltage: {voltage:.2f} V")
    
    time.sleep(0.5)
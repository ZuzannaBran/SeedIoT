import machine
import onewire, ds18x20
import time

ds_pin = machine.Pin(28)
ds_sensor = ds18x20.DS18X20(onewire.OneWire(ds_pin))

print("Szukam czujnika...")
roms = ds_sensor.scan()

if not roms:
    print("Nie znaleziono czujnika! Sprawdź kable.")
else:
    print(f"Znaleziono: {roms}")

while roms:
    ds_sensor.convert_temp()
    time.sleep_ms(750)
    for rom in roms:
        temp = ds_sensor.read_temp(rom)
        print(f"Temperatura: {temp:.2f}°C")
    time.sleep(1)
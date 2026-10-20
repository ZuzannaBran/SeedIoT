# SeedIoT — połączenia fizyczne i kontrola montażu

Mapa odnosi się do złączy **Raspberry Pi Pico W / Pico WH**. Numer `GPx` oznacza GPIO mikrokontrolera, natomiast „pin fizyczny” — pozycję na 40-pinowym złączu. Ostateczną konfigurację weryfikuj w [sensor_pins.py](codebase/rpi-code/sensor_pins.py).

## Mapa sygnałów

| Sygnał | GPIO | Pin fizyczny Pico | Moduł |
| --- | --- | --- | --- |
| I2C0 SDA | GP4 | 6 | BME280, LTR559, SCD41, LCD |
| I2C0 SCL | GP5 | 7 | BME280, LTR559, SCD41, LCD |
| SoftI2C SDA | GP11 | 15 | BME680 |
| SoftI2C SCL | GP12 | 16 | BME680 |
| OneWire | GP28 | 34 | DS18B20 |
| ADC gleby | GP27 | 32 | Czujnik pojemnościowy |
| ADC kierunku wiatru | GP26 | 31 | Kierunkowskaz |
| Impulsy wiatru | GP9 | 12 | Anemometr |
| Impulsy deszczu | GP10 | 14 | Opadomierz |
| TPL5110 DONE | GP15 | 20 | Moduł zasilania |

Punkty odniesienia: **3V3(OUT)** — pin fizyczny 36, **GND** — m.in. pin 38, **VSYS** — pin 39, **VBUS** — pin 40. Pin VBUS nie jest wyjściem 3,3 V. Dokładny sposób doprowadzenia zasilania zależy od schematu całego układu.

## Topologia magistral

~~~text
Pico W
|-- I2C0 GP4/GP5 -------- BME280 (0x77)
|                      \-- LTR559 (0x23)
|                      \-- SCD41 (0x62)
|                      \-- LCD/PCF8574 (0x27)
|-- SoftI2C GP11/GP12 --- BME680 (0x77)
|-- OneWire GP28 -------- DS18B20
|-- ADC GP27 ------------ Wilgotność gleby
|-- ADC GP26 ------------ Kierunek wiatru
|-- GP9 / GP10 ---------- Anemometr / opadomierz
\-- GP15 ---------------- TPL5110 DONE
~~~

Wszystkie moduły komunikujące się bez izolacji galwanicznej muszą mieć wspólną masę. **Nie zakładaj**, że poziomy logiczne każdego kupionego modułu są zgodne z GPIO Pico: przed podłączeniem sprawdź specyfikację breakoutów i ich rezystorów podciągających.

## Kontrola przed uruchomieniem

1. Odłącz zasilanie i porównaj numerację fizycznych pinów z oznaczeniami GPIO.
2. Sprawdź polaryzację zasilania oraz brak zwarcia między 3,3 V i GND.
3. Zweryfikuj napięcia sygnałów SDA/SCL, zwłaszcza przy module LCD zasilanym 5 V.
4. Sprawdź podciągnięcie magistral I2C i OneWire do odpowiedniego napięcia.
5. Zweryfikuj konfigurację TPL5110 oraz dopuszczalne napięcie jego konkretnej płytki.
6. Podłącz zasilanie i wykonaj skan magistral; dopiero później uruchamiaj pomiary i łączność radiową.

## Test I2C w MicroPython

~~~python
from machine import I2C, Pin, SoftI2C

i2c_main = I2C(0, sda=Pin(4), scl=Pin(5), freq=100_000)
i2c_bme680 = SoftI2C(sda=Pin(11), scl=Pin(12), freq=100_000)

print("I2C0:", [hex(address) for address in i2c_main.scan()])
print("BME680:", [hex(address) for address in i2c_bme680.scan()])
~~~

Przy kompletnym wyposażeniu i domyślnych adresach spodziewane wyniki to odpowiednio `0x23`, `0x27`, `0x62`, `0x77` oraz na osobnej magistrali `0x77`. Inny wynik wymaga sprawdzenia okablowania i faktycznego adresu modułu.

## Dalsze testy

- **Gleba:** wykonaj kalibrację suchy/mokry przy użyciu skryptów z `codebase/rpi-code/soil/`, korzystających z GP27.
- **DS18B20:** wykonaj skan OneWire na GP28; czujnik wymaga czasu na konwersję temperatury.
- **Wiatr i deszcz:** sprawdź liczniki impulsów i kalibrację mechanicznych modułów.
- **TPL5110:** zweryfikuj impulsy DONE i rzeczywiste zachowanie zasilania na stole pomiarowym przed instalacją w terenie.

Opis funkcjonalny i ograniczenia układu znajdują się w [architekturze sprzętowej](KONFIGURACJA_SPRZĘTOWA.md).

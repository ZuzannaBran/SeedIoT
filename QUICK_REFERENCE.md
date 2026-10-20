# SZYBKA REFERENCYJNA TABELA - KONFIGURACJA SPRZĘTOWA SEEDIOT

## 🔍 Quick Reference Card

### Raspberry Pi Pico - Kluczowe Specyfikacje
| Parametr | Wartość |
|----------|---------|
| **Mikrokontroler** | ARM Cortex-M0+ Dual-core @ 133 MHz |
| **Pamięć RAM** | 264 KB |
| **Pamięć Flash** | 2 MB |
| **Napięcie zasilania** | 1.8V - 5.5V (VSYS) |
| **GPIO Pinów** | 26 (0-25) + 3 dodatkowe |
| **I2C Interfejsy** | 2 (I2C0, I2C1) |
| **SPI Interfejsy** | 2 |
| **UART Interfejsy** | 2 |
| **Kanały ADC** | 3 (12-bit) |
| **Komunikacja** | Bluetooth LE (wbudowany) |

---

## 🔗 Pinout - Szybki Przegląd

```
┌─────────────────────────────────────────────────────────────┐
│ PORTY ZASILANIA                                             │
├─────────────────────────────────────────────────────────────┤
│ Pin 1  │ VBUS (5V)       │ Pin 40 │ VBUS (5V)              │
│ Pin 3  │ GND             │ Pin 38 │ GND                    │
│ Pin 39 │ VSYS (3.3V out) │ Pin 39 │ VSYS (3.3V)           │
│ Pin 36 │ 3V3(OUT)        │ Pin 36 │ 3V3(OUT)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ I2C BUS #0 (GPIO 4, 5)                                      │
├─────────────────────────────────────────────────────────────┤
│ Pin 4  │ GP4 (SDA) ──→ BME280, LTR559, SCD41, LCD         │
│ Pin 5  │ GP5 (SCL) ──→ Częstość: 100 kHz                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ I2C SOFT (GPIO 11, 12) - BME680                            │
├─────────────────────────────────────────────────────────────┤
│ Pin 15 │ GP11 (SDA)                                        │
│ Pin 16 │ GP12 (SCL)     Częstość: 100 kHz                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ONEWIRE & ADC & GPIO SPECJALNE                             │
├─────────────────────────────────────────────────────────────┤
│ Pin 34 │ GP28 (OneWire) ──→ DS18B20                        │
│ Pin 32 │ GP27 (ADC1)    ──→ Wilgotność gleby              │
│ Pin 31 │ GP26 (ADC0)    ──→ Kierunek wiatru               │
│ Pin 12 │ GP9            ──→ Prędkość wiatru (licznik)     │
│ Pin 14 │ GP10           ──→ Opad deszczu (licznik)        │
│ Pin 20 │ GP15           ──→ TPL5110 DONE (control)        │
│ Pin 9  │ GP6            ──→ LED statusowe                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Sensory - Szybka Tabela

### I2C Adresów

| I2C Bus | Adres | Hex | Urządzenie | Napięcie | Pomiary |
|---------|-------|-----|-----------|----------|---------|
| #0 | 35 | 0x23 | LTR559 | 3.3V | ALS (światło) |
| #0 | 39 | 0x27 | LCD16x2 | 5V | Wyświetlacz |
| #0 | 98 | 0x62 | SCD41 | 5V | CO₂, T, RH |
| #0 | 119 | 0x77 | BME280 | 3.3V | T, P, RH |
| Soft | 119 | 0x77 | BME680 | 3.3V | T, P, RH, VOC |

### Sensory Pomiarowe

| # | Sensor | Typ | Interface | Parametry | Min | Max | Dokładność |
|---|--------|-----|-----------|-----------|-----|-----|-----------|
| 1 | BME280 | Atmos. | I2C 0x77 | T°C, hPa, % | -40°C | +85°C | ±1.0°C |
| 2 | BME680 | Atmos.+ | I2C 0x77 | T°C, hPa, %, Ω | -40°C | +85°C | ±1.0°C |
| 3 | SCD41 | CO₂ | I2C 0x62 | ppm, T°C, % | 400 | 5000ppm | ±40ppm |
| 4 | LTR559 | Light | I2C 0x23 | lux (2 ch) | 0 | 64000lux | - |
| 5 | DS18B20 | Temp | OneWire | T°C | -55°C | +125°C | ±0.5°C |
| 6 | Soil ADC | Moist | ADC#1 | %, V | 0 | 100% | ±3% |
| 7 | Wind | Speed | GPIO#9 | m/s | 0 | ∞ | - |
| 8 | Rain | Gauge | GPIO#10 | mm | 0 | ∞ | 0.2794mm/pulse |

---

## ⚡ GPIO Alokacja - Pełna Tabela

| GPIO | Pin | Funkcja | Typ | Urządzenie | Napięcie | Stan |
|------|-----|---------|-----|-----------|----------|------|
| 0-1 | - | Spare | - | - | - | ✓ Dostępne |
| 2 | 4 | ENVIRO_HOLD | Output | Moduł | 3.3V | ✓ Aktywny |
| 3 | 5 | ENVIRO_INT | Input | Moduł | 3.3V | ✓ Aktywny |
| **4** | **6** | **I2C0_SDA** | **I2C** | **Bus #0** | **3.3V** | **✓ Aktywny** |
| **5** | **7** | **I2C0_SCL** | **I2C** | **Bus #0** | **3.3V** | **✓ Aktywny** |
| 6 | 9 | LED_STATUS | Output | Dioda | 3.3V | ✓ Aktywny |
| 7 | 10 | Spare | - | - | - | ✓ Dostępne |
| 8 | 11 | RTC_ALARM | Input | Zegar | 3.3V | ✓ Aktywny |
| **9** | **12** | **WIND_SPEED** | **Input/Counter** | **Anemometr** | **3.3V** | **✓ Aktywny** |
| **10** | **14** | **RAIN_GAUGE** | **Input/Counter** | **Opadomierz** | **3.3V** | **✓ Aktywny** |
| **11** | **15** | **I2C_SDA_SOFT** | **I2C** | **BME680** | **3.3V** | **✓ Aktywny** |
| **12** | **16** | **I2C_SCL_SOFT** | **I2C** | **BME680** | **3.3V** | **✓ Aktywny** |
| 13-14 | - | Spare | - | - | - | ✓ Dostępne |
| **15** | **20** | **TPL5110_DONE** | **Output** | **Power** | **3.3V** | **✓ Aktywny** |
| 16-25 | - | Spare | - | - | - | ✓ Dostępne |
| **26** | **31** | **ADC0** | **Analog** | **Wind Dir** | **0-3.3V** | **✓ Aktywny** |
| **27** | **32** | **ADC1** | **Analog** | **Soil Moist** | **0-3.3V** | **✓ Aktywny** |
| **28** | **34** | **ONEWIRE** | **OneWire** | **DS18B20** | **3.3V** | **✓ Aktywny** |

---

## 🔌 Zasilanie - Schemat Rozdzielczego Napięcia

```
ŹRÓDŁO: Bateria (5-12V) / Adapter
                │
                ▼
        ┌──────────────┐
        │  TPL5110     │
        │ Power Mgmt   │
        └──────┬───────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    Pico VSYS    Urządzenia
    3.3V/1A      5V OUTPUT
        │             │
        │         ┌───┴────────┐
        │         │            │
        ▼         ▼            ▼
    Pico Core  SCD41      LCD16x2
    & GPIO   (5V)         (5V)
        │
    ┌───┴──────┬──────┬──────┬──────┐
    │          │      │      │      │
    ▼          ▼      ▼      ▼      ▼
  3.3V      3.3V    3.3V   3.3V   3.3V
    │          │      │      │      │
   All      BME280  BME680 LTR559 DS18B20
  GPIO                 & More...
```

---

## 📈 Cykl Pomiaru - Timeline

```
Boot Event (TPL5110 timer)
│
├─ t=0ms: Włączenie Pico (VSYS HIGH)
│
├─ t=0-500ms: INICJACJA
│  ├─ GPIO setup
│  ├─ I2C magistrale
│  ├─ OneWire
│  └─ ADC konfiguracja
│
├─ t=500-4000ms: POMIARY (3500ms rezerwy)
│  ├─ Iteracja #1-350 (co 10ms)
│  │  ├─ Odczyt: soil_moisture (mult=1)
│  │  ├─ Odczyt: bme280 (mult=1)
│  │  ├─ Odczyt: bme680 (mult=1)
│  │  ├─ Odczyt: ltr559 (mult=1)
│  │  ├─ Odczyt: scd41 (mult=1)
│  │  ├─ Odczyt: wind (mult=1)
│  │  ├─ Odczyt: rain (mult=1)
│  │  └─ Odczyt: ds18b20 (mult=2, co 20ms)
│  │
│  ├─ Przetworzenie agregacyjne
│  └─ Przygotowanie JSON payload
│
├─ t=4000-8000ms: UPLOAD Wi-Fi (4000ms rezerwy)
│  ├─ Połączenie do SSID
│  ├─ HTTP POST do serwera
│  ├─ Potwierdzenie
│  └─ Rozłączenie
│
├─ t=8000ms: SYGNAŁ DONE
│  ├─ GPIO 15: LOW→HIGH (pulse 20ms)
│  └─ TPL5110 otrzymuje sygnał
│
└─ t=8020ms+: ZASILANIE OFF
   └─ Oczekiwanie na timer TPL5110 (~60 sekund)
```

---

## 🛠️ Rezystory i Kondensatory - Bill of Materials (BOM)

### Rezystory
```
Typ              | Wartość | Ilość | Funkcja
─────────────────┼─────────┼───────┼────────────────────
Pull-up          | 4.7 kΩ  | 4-6   | I2C Bus (SDA/SCL)
Pull-up (OneWire)| 4.7 kΩ  | 1     | GPIO28 (DS18B20)
Pull-up (GPIO)   | 10 kΩ   | 2-4   | GPIO9, GPIO10 (optional)
```

### Kondensatory
```
Typ              | Wartość | Ilość | Funkcja
─────────────────┼─────────┼───────┼────────────────────
Filtrujący       | 100nF   | 3-5   | VDD każdego sensora
Pomoc            | 10µF    | 2-3   | Wielkokapacitowy na VDD głównie
```

---

## 📝 Interwały Odczytów - Multipliers

```
Sensor               | Multiplier | Interwał (ms) | Częstość
─────────────────────┼────────────┼───────────────┼─────────────────
soil_moisture        | 1          | 10            | Co 10ms
bme280               | 1          | 10            | Co 10ms
bme680               | 1          | 10            | Co 10ms
ltr559               | 1          | 10            | Co 10ms
scd41                | 1          | 10            | Co 10ms
wind                 | 1          | 10            | Co 10ms (próbka 1000ms)
rain                 | 1          | 10            | Co 10ms (próbka 1000ms)
─────────────────────┼────────────┼───────────────┼─────────────────
ds18b20              | 2          | 20            | Co 20ms (co 2 iteracje)
```

---

## ✅ Checklist Montażu

### Przed podłączeniem zasilania
- [ ] Sprawdzić wszystkie połączenia I2C
- [ ] Upewnić się, że rezystory pull-up są zainstalowane
- [ ] Sprawdzić brak zwykstowych zwarć
- [ ] Zweryfikować orientację komponentów
- [ ] Sprawdzić baterię/zasilacz

### Po podłączeniu zasilania
- [ ] LED statusowe włącza się
- [ ] Pico się włącza
- [ ] Żaden komponent się nie grzeje
- [ ] I2C skanowanie zwraca prawidłowe adresy
- [ ] Każdy sensor odpowiada prawidłowo

### Kalibracja
- [ ] Czujnik wilgotności gleby - kalibracja sucho/mokro
- [ ] Kierunkowmierz - weryfikacja kierunków
- [ ] Termometry - porównanie wartości
- [ ] Opadomierz - test manualny (licznik impulsów)
- [ ] Anemometr - test ruchem ręcznym

---

## 🐛 Diagnostyka - Komendy

### I2C Skanowanie (MicroPython)
```python
from machine import I2C, Pin

# Bus 0
i2c0 = I2C(0, sda=Pin(4), scl=Pin(5))
print("I2C0:", [hex(x) for x in i2c0.scan()])

# Bus Software
i2c1 = I2C(1, sda=Pin(11), scl=Pin(12))
print("I2C1:", [hex(x) for x in i2c1.scan()])

# Oczekiwane:
# I2C0: ['0x23', '0x27', '0x62', '0x77']
# I2C1: ['0x77']
```

### Diagnostyka ADC
```python
from machine import ADC, Pin

# Wilgotność gleby (GPIO27)
adc_soil = ADC(Pin(27))
print("Soil Raw:", adc_soil.read_u16())

# Kierunek wiatru (GPIO26)
adc_wind = ADC(Pin(26))
print("Wind Raw:", adc_wind.read_u16())
```

### Test OneWire
```python
import ds18x20, onewire
from machine import Pin

ds = ds18x20.DS18X20(onewire.OneWire(Pin(28)))
roms = ds.scan()
print(f"Znalezione czujniki: {len(roms)}")

ds.convert_temp()
import time
time.sleep_ms(750)
for rom in roms:
    print(ds.read_temp(rom))
```

---

## 📞 Kontakt i Dokumentacja

**Pliki Konfiguracyjne:**
- `codebase/rpi-code/sensor_pins.py` - Definicje pinów
- `codebase/rpi-code/settings.py` - Ustawienia systemowe
- `codebase/rpi-code/main.py` - Główna pętla

**Moduły Sensorów:**
- `codebase/rpi-code/sensors/` - Wszystkie drivery

**Dokumentacja Zewnętrzna:**
- [RP2040 Datasheet](https://datasheets.raspberrypi.com/)
- [MicroPython Docs](https://micropython.org/)
- [I2C Protocol](https://en.wikipedia.org/wiki/I%C2%B2C)

---

**Quick Reference v1.0** | Czerwiec 2026 | Projekt SeedIoT

# KONFIGURACJA SPRZĘTOWA STACJI SEEDIOT

## 📋 Spis treści
1. [Przegląd systemu](#przegląd-systemu)
2. [Platforma główna](#platforma-główna)
3. [Interfejsy komunikacyjne](#interfejsy-komunikacyjne)
4. [Sensory pomiarowe](#sensory-pomiarowe)
5. [Komponenty wspomagające](#komponenty-wspomagające)
6. [Schemat pinów GPIO](#schemat-pinów-gpio)
7. [Zasilanie i zarządzanie energią](#zasilanie-i-zarządzanie-energią)
8. [Komunikacja i łączność](#komunikacja-i-łączność)

---

## Przegląd systemu

**SeedIoT** to inteligentna stacja do monitorowania upraw, która zbiera dane z múltipla czujników i komunikuje się bezprzewodowo z serwerem. System jest zoptymalizowany pod kątem zużycia energii, aby mógł pracować autonomicznie na bateriach przez długi okres czasu.

### Architektura warstwy sprzętowej
```
┌─────────────────────────────────────────┐
│       RASPBERRY PI PICO (RP2040)        │
│                                          │
│  - Mikrokontroler ARM Cortex-M0+        │
│  - 264 KB RAM                           │
│  - Obsługa I2C, SPI, UART, ADC, GPIO    │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────────────────────────────────┐
       │                                              │
   ┌───▼────────┐               ┌──────────────────┐
   │   SENSORY  │               │   KOMPONENTY     │
   │ POMIAROWE  │               │  WSPOMÁGAJĄCE    │
   └────────────┘               └──────────────────┘
```

---

## Platforma główna

### Raspberry Pi Pico (RP2040)
- **Mikrokontroler**: ARM Cortex-M0+ (dual-core @ 133 MHz)
- **Pamięć RAM**: 264 KB
- **Pamięć Flash**: 2 MB
- **Interfejsy**:
  - 2× I2C
  - 2× SPI
  - 2× UART
  - 26× GPIO piny
  - 3× ADC kanały (12-bit)
- **Zasilanie**: 1.8V - 5.5V
- **MicroPython**: Oprogramowanie uruchamiane w wyposażeniu

---

## Interfejsy komunikacyjne

### I2C (Inter-Integrated Circuit)
**Bus I2C #0** (Główny)
- **SDA Pin**: GPIO 4
- **SCL Pin**: GPIO 5
- **Częstotliwość**: 100 kHz
- **Adres magistrali**: 0x00

Urządzenia podłączone do I2C #0:
1. **BME280** (czujnik atmosferyczny) - adres: `0x77`
2. **LTR559** (czujnik światła) - adres: `0x23`
3. **SCD41** (czujnik CO₂) - adres: `0x62`
4. **LCD 16x2** (wyświetlacz) - adres: `0x27`

**Bus I2C (Niezależny dla BME680)**
- **SDA Pin**: GPIO 11
- **SCL Pin**: GPIO 12
- **Częstotliwość**: 100 kHz
- **Urządzenie**: BME680 (czujnik atmosferyczny rozszerzony)

### OneWire
- **Pin**: GPIO 28
- **Urządzenie**: DS18B20 (czujnik temperatury cyfrowy)
- **Protokół**: Dallas OneWire

### GPIO (cyfrowe)
Piny używane do pomiaru impulsów i sterowania:
- **GPIO 9**: Pomiar prędkości wiatru (liczenieimpulsów)
- **GPIO 10**: Pomiar opadu deszczu (liczenieimpulsów)
- **GPIO 15**: Sterowanie zasilaniem TPL5110 (pin DONE)
- **GPIO 6**: LED statusowe/dioda aktywności

### ADC (Analog-to-Digital Converter)
- **ADC Pin 1 (GPIO 27)**: Pomiar wilgotności gleby
- **ADC Pin 0 (GPIO 26)**: Pomiar kierunku wiatru
- **Rozdzielczość**: 12-bit (0-4095)
- **Napięcie odniesienia**: 3.3V

---

## Sensory pomiarowe

### 1. BME280 - Czujnik atmosferyczny (temperatura, ciśnienie, wilgotność)
**Parametry techniczne:**
- **Interfejs**: I2C (Główny bus)
- **Adres I2C**: `0x77`
- **Zasilanie**: 1.7V - 3.6V
- **Dokładność temperatury**: ±1.0°C
- **Dokładność ciśnienia**: ±1 hPa
- **Dokładność wilgotności**: ±3%
- **Czas pomiaru**: ~23.25 ms

**Dane pomiarowe:**
```json
{
  "temperature_c": 22.5,
  "pressure_hpa": 1013.25,
  "humidity_percent": 45.3
}
```

**Interwał odczytu**: co 10ms (BASE_INTERVAL_MS)

### 2. BME680 - Rozszerzony czujnik atmosferyczny (z czujnikiem gazu)
**Parametry techniczne:**
- **Interfejs**: I2C (Niezależny bus, Software I2C)
- **Adres I2C**: `0x77`
- **Zasilanie**: 1.7V - 3.6V
- **Czujnik gazu**: VOC (Volatile Organic Compounds) - rezystancja
- **Piny**: SDA=GPIO11, SCL=GPIO12

**Dane pomiarowe:**
```json
{
  "temperature_c": 22.5,
  "pressure_hpa": 1013.25,
  "humidity_percent": 45.3,
  "gas_resistance_ohms": 125000
}
```

**Interwał odczytu**: co 10ms (BASE_INTERVAL_MS)

### 3. DS18B20 - Cyfrowy czujnik temperatury
**Parametry techniczne:**
- **Interfejs**: OneWire (GPIO 28)
- **Dokładność**: ±0.5°C
- **Zakres**: -55°C do +125°C
- **Czas konwersji**: 750ms
- **Adres**: Unikalny na każdy czujnik
- **Możliwość**: Kaskadowe podłączenie wielu czujników

**Dane pomiarowe:**
```json
{
  "temperature_c": 18.75,
  "sensor_count": 1,
  "temperatures_c": [18.75]
}
```

**Interwał odczytu**: co 20ms (BASE_INTERVAL_MS × 2)

### 4. SCD41 - Czujnik CO₂, temperatury i wilgotności
**Parametry techniczne:**
- **Interfejs**: I2C (Główny bus)
- **Adres I2C**: `0x62`
- **Zasilanie**: 2.4V - 5.5V
- **Dokładność CO₂**: ±40 ppm
- **Zakres CO₂**: 400-5000 ppm
- **Pomiar**: Mierzy rzeczywiste wartości CO₂ (NDIR)
- **Czas pomiaru**: ~5 sekund
- **Funkcja**: `start_periodic_measurement()` - pomiary cykliczne

**Dane pomiarowe:**
```json
{
  "co2_ppm": 450,
  "temperature_c": 22.3,
  "humidity_percent": 44.5
}
```

**Interwał odczytu**: co 10ms (BASE_INTERVAL_MS)

### 5. LTR559 - Czujnik światła (ALS - Ambient Light Sensor)
**Parametry techniczne:**
- **Interfejs**: I2C (Główny bus)
- **Adres I2C**: `0x23`
- **Zasilanie**: 2.25V - 3.6V
- **Czułość**: Dwa kanały pomiarowe (ALS_CH0, ALS_CH1)
- **Zakres**: 0 - 64000 lux
- **Funkcja**: Detekcja światła dziennego

**Dane pomiarowe:**
```json
{
  "status": 0,
  "als_ch0": 1500,
  "als_ch1": 800
}
```

**Interwał odczytu**: co 10ms (BASE_INTERVAL_MS)

### 6. Czujnik wilgotności gleby (Capacitive)
**Parametry techniczne:**
- **Interfejs**: ADC (GPIO 27)
- **Zasilanie**: 3.3V
- **Typ**: Pojemnościowy
- **Rezolucja ADC**: 12-bit (0-65535)
- **Napięcie max**: 3.3V

**Kalibracja:**
- **Wartość "sucho"** (DRY): 1800 (raw ADC)
- **Wartość "mokro"** (WET): 58000 (raw ADC)
- **Napięcie odniesienia**: 3.3V

**Dane pomiarowe:**
```json
{
  "raw_adc": 30000,
  "voltage_v": 1.5,
  "moisture_percent": 52.3
}
```

**Interwał odczytu**: co 10ms (BASE_INTERVAL_MS)

### 7. DS18B20 - Temperatura gleby
Dodatkowy czujnik temperatury mogący mierzyć temperaturę gleby (opcjonalnie).

---

## Komponenty wspomagające

### 1. LCD 16x2 - Wyświetlacz
**Parametry techniczne:**
- **Typ**: 16 znaków × 2 linie
- **Interfejs**: I2C (poprzez ekspander PCF8574)
- **Adres I2C**: `0x27`
- **Zasilanie**: 3.3V - 5V
- **Tryb**: 4-bitowy
- **Funkcje**:
  - Wyświetlanie danych z sensorów
  - Strony informacyjne (rotacja co 3 sekundy)
  - Podświetlenie LED

**Stan włączenia**: `LCD_DISPLAY_ENABLED = True`
**Interwał zmian strony**: 3000ms

### 2. TPL5110 - Kontroler zarządzania zasilaniem
**Parametry techniczne:**
- **Pin DONE**: GPIO 15
- **Funkcja**: Sterowanie czasem włączenia mikrokontrolera
- **Impuls DONE**: 20ms (LOW→HIGH)
- **Maksymalne okno włączenia**: 10000ms
- **Rezerwa na odczyty sensorów**: 3500ms
- **Rezerwa na upload Wi-Fi**: 4000ms

**Stan włączenia**: `TPL5110_ENABLED = True`

---

## Schemat pinów GPIO

### Podsumowanie przypisań pinów

| GPIO | Funkcja | Typ | Urządzenie |
|------|---------|-----|-----------|
| 2 | ENVIRO_HOLD_VSYS_EN | Output | Modułu zewnętrzny |
| 3 | ENVIRO_EXTERNAL_INTERRUPT | Input | Modułu zewnętrzny |
| 4 | I2C_SDA (główny) | I2C | Główny bus |
| 5 | I2C_SCL (główny) | I2C | Główny bus |
| 6 | ACTIVITY_LED / Upload LED | Output | Dioda statusowa |
| 8 | RTC_ALARM | Input | Zegar czasu rzeczywistego |
| 9 | WIND_SPEED_PIN | Input (licznik) | Anemometr |
| 10 | RAIN_GAUGE_PIN | Input (licznik) | Niedoskonały deszczu |
| 11 | I2C_SDA (BME680) | I2C | BME680 (Software I2C) |
| 12 | I2C_SCL (BME680) | I2C | BME680 (Software I2C) |
| 15 | TPL5110_DONE_PIN | Output | Kontroler zasilania |
| 26 | WIND_DIRECTION_ADC | ADC | Kierunkowmierz wiatru |
| 27 | SOIL_MOISTURE_ADC | ADC | Czujnik wilgotności gleby |
| 28 | DS18B20_PIN | OneWire | Czujnik temperatury |

### Pinógrafia (Pinout Diagram)
```
RASPBERRY PI PICO (Top View)
┌─────────────────────────────────┐
│  GPIO0  GPIO1                   │
│  GPIO2  GPIO3                   │
│  GPIO4  GPIO5  (I2C0: SDA/SCL)  │
│  GPIO6  GPIO7                   │
│  GPIO8  GPIO9  (WIND_SPEED)     │
│  GPIO10 GPIO11 (RAIN/BME680_SDA)│
│  GPIO12 GPIO13 (BME680_SCL)     │
│  GPIO14 GPIO15 (TPL5110_DONE)   │
│  GPIO16 GPIO17                  │
│  GPIO18 GPIO19                  │
│  GPIO20 GPIO21                  │
│  GPIO22 GPIO23                  │
│  GPIO24 GPIO25                  │
│  GPIO26 (Wind Dir ADC)          │
│  GPIO27 (Soil ADC)              │
│  GPIO28 (DS18B20 OneWire)       │
└─────────────────────────────────┘
```

---

## Zasilanie i zarządzanie energią

### Profil energetyczny
System wspiera 5 profili energetycznych:

1. **AUTO (0)** - Automatyczne, zoptymalizowane
2. **IDLE (1)** - Uśpienie, minimalne zużycie
3. **WIFI (2)** - Upload danych przez Wi-Fi
4. **BLE (3)** - Parowanie przez Bluetooth LE
5. **SENSORS (4)** - Pełna aktywacja sensorów

### Strategia oszczędzania energii

**Cykl pomiarowy:**
```
┌─────────────────────────────────────────┐
│     BOOT (Budzenie z TPL5110)          │
├─────────────────────────────────────────┤
│  1. Inicjacja sensorów (0.5s)           │
│  2. Odczyt sensorów (3.5s rezerwy)      │
│  3. Przetworzenie danych                │
│  4. Upload Wi-Fi (4s rezerwy)           │
│  5. Wysłanie sygnału DONE do TPL5110    │
│  6. Uśpienie (TPL5110 wyłącza zasilanie)│
└─────────────────────────────────────────┘
  Całkowity czas cyklu: ~10s (konfigurowalne)
```

### Interwały odczytów sensorów

Każdy sensor ma configurowalny mnożnik interwału:

```python
SENSOR_READ_MULTIPLIERS = {
    "soil_moisture": 1,      # co 10ms
    "ds18b20": 2,            # co 20ms
    "bme280": 1,             # co 10ms
    "bme680": 1,             # co 10ms
    "ltr559": 1,             # co 10ms
    "scd41": 1,              # co 10ms
    "wind": 1,               # co 10ms
    "rain": 1,               # co 10ms
}
```

### Źródło zasilania
- **Zasilacz**: Bateria (konfiguracja zewnętrzna)
- **Napięcie nomainalne**: 3.3V (dla Pico)
- **Regulacja**: TPL5110 zapewnia sterowanie włącznikiem
- **Maksymalna rezerwacja energii**: ~10 sekund włączenia na cykl

---

## Komunikacja i łączność

### Bluetooth LE (BLE)
**Nazwa urządzenia**: `SeedIot_67`

**Usługi BLE:**
- **Service UUID**: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- **Characteristic Write**: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` (Zapis konfiguracji)
- **Characteristic Notify**: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` (Potwierdzenie)

**Funkcjonalność:**
- Parowanie stacji z aplikacją mobilną
- Wysyłanie konfiguracji (SSID, hasło Wi-Fi, itp.)
- Potwierdzanie poprawności konfiguracji

**Payload Advertising:**
```
Flagi: 0x06 (LE General Discoverable Mode)
Nazwa: "SeedIot_67"
```

### Wi-Fi
**Funkcje:**
- Upload danych do serwera
- Pobieranie aktualizacji konfiguracji
- Integracja z serwerem NestJS

**Ograniczenia:**
- Włączane tylko podczas cyklu pomiaru (oszczędzanie energii)
- Maksymalny czas połączenia: ~4 sekundy

---

## Podsumowanie - Tabela technicznych specyfikacji

| Parametr | Wartość |
|----------|---------|
| **Platforma** | Raspberry Pi Pico (RP2040) |
| **Procesór** | ARM Cortex-M0+ (133 MHz) |
| **RAM** | 264 KB |
| **Liczba sensorów** | 8 typów głównych |
| **Główny interfejs komunikacji** | I2C (100 kHz) |
| **Liczba pinów GPIO** | 26 dostępnych |
| **Liczba kanałów ADC** | 3 (12-bit) |
| **Zasilanie** | 3.3V (z regulacją TPL5110) |
| **Optymalizacja** | Tryb zoptymalizowany pod baterię |
| **Komunikacja bezprzewodowa** | BLE + Wi-Fi |
| **Interwał pomiarowy** | 10ms (konfigurowalne) |

---

## Notatki i referencje

### Pliki konfiguracyjne
- [sensor_pins.py](codebase/rpi-code/sensor_pins.py) - Definicje pinów
- [settings.py](codebase/rpi-code/settings.py) - Ustawienia systemowe
- [main.py](codebase/rpi-code/main.py) - Główna pętla aplikacji

### Moduły sensorów
- `sensors/bme280_sensor.py` - Obsługa BME280
- `sensors/bme680_sensor.py` - Obsługa BME680
- `sensors/ds18b20_sensor.py` - Obsługa DS18B20
- `sensors/scd41_sensor.py` - Obsługa SCD41
- `sensors/ltr559_sensor.py` - Obsługa LTR559
- `sensors/soil_moisture_sensor.py` - Obsługa wilgotności gleby
- `sensors/wind_sensor.py` - Obsługa anemometru
- `sensors/rain_sensor.py` - Obsługa opadomierza

### Zasoby
- [Dokumentacja RP2040](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- [Dokumentacja I2C](https://en.wikipedia.org/wiki/I%C2%B2C)
- [MicroPython](https://micropython.org/)

---

**Data opracowania**: czerwiec 2026
**Wersja**: 1.0
**Status**: Aktywna konfiguracja

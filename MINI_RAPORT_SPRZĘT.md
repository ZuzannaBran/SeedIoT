# MINI RAPORT: ARCHITEKTURA SPRZĘTOWA SEEDIOT

## 🎯 Cel raportu
Analiza warstwy sprzętowej systemu SeedIoT - stacji do inteligentnego monitorowania upraw. Raport zawiera szczegółowy opis wszystkich komponentów sprzętowych, ich konfiguracji i wzajemnych połączeń.

---

## 1. ARCHITEKTURA OGÓLNA

### Blokowy schemat systemu
```
╔════════════════════════════════════════════════════════════════════╗
║                    SYSTEM SEEDIOT - WARSTWA SPRZĘTOWA              ║
╚════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│                   ZASILANIE (BATERIA / ADAPTER)                     │
│                                                                      │
│  ┌─────────┐         ┌──────────────────────┐      ┌────────────┐   │
│  │ BATERIA │ ───→   │  TPL5110 REGULATOR   │  ──→ │  PICO 3.3V │   │
│  │ 5-12V   │         │  (Power Management)  │      │  RP2040    │   │
│  └─────────┘         └──────────────────────┘      └────────────┘   │
│                                                            │          │
│                                                            ▼          │
│                     ┌──────────────────────────────────────────────┐  │
│                     │       RASPBERRY PI PICO RP2040              │  │
│                     │                                              │  │
│                     │  • ARM Cortex-M0+ @ 133 MHz               │  │
│                     │  • 264 KB RAM, 2 MB Flash                 │  │
│                     │  • 26x GPIO pins                          │  │
│                     │  • 3x ADC Channels (12-bit)               │  │
│                     │  • 2x I2C, 2x SPI, 2x UART               │  │
│                     │  • Bluetooth LE & 802.11b/g/n (opcjonalnie)│  │
│                     └──────────────────────────────────────────────┘  │
│                                      │                                │
└──────────────────────────────────────┼────────────────────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
        ┌─────────────┐       ┌────────────────┐    ┌──────────────┐
        │   SENSORY   │       │  INTERFEJSY    │    │ KOMPONENTY   │
        │ POMIAROWE   │       │  KOMUNIKACJI   │    │  WSPOMAGAJĄCE│
        └─────────────┘       └────────────────┘    └──────────────┘
```

---

## 2. MAPA SENSORÓW

### Sensorów główne i ich role

| # | Czujnik | Typ | Interfejs | Adres I2C | Pomiary | Status |
|---|---------|-----|-----------|-----------|---------|--------|
| 1 | BME280 | Atmosferyczny | I2C | 0x77 | T°C, ciśnienie, RH% | ✅ Aktywny |
| 2 | BME680 | Atmosferyczny (extended) | I2C | 0x77 | T°C, ciśnienie, RH%, VOC | ✅ Aktywny |
| 3 | DS18B20 | Temperatura cyfrowa | OneWire | - | T°C (gleba) | ✅ Aktywny |
| 4 | SCD41 | CO₂ / Temperatura | I2C | 0x62 | CO₂, T°C, RH% | ✅ Aktywny |
| 5 | LTR559 | Światło (ALS) | I2C | 0x23 | Lux (2 kanały) | ✅ Aktywny |
| 6 | Wilgotność gleby | Pojemnościowy | ADC | - | Raw, V, % | ✅ Aktywny |
| 7 | Anemometr | Prędkość wiatru | GPIO (licznik) | - | m/s, kierunek | ✅ Aktywny |
| 8 | Opadomierz | Opad deszczu | GPIO (licznik) | - | mm, mm/h | ✅ Aktywny |

### Diagram połączeń sensorów

```
RASPBERRY PI PICO
│
├─ I2C Bus #0 (GPIO 4 SDA, GPIO 5 SCL) @ 100kHz
│  ├─ BME280 (addr: 0x77) ──→ Temperatura, ciśnienie, wilgotność
│  ├─ LTR559 (addr: 0x23) ──→ Natężenie światła
│  ├─ SCD41 (addr: 0x62) ──→ CO₂, temperatura, wilgotność
│  └─ LCD16x2 (addr: 0x27) ─→ Wyświetlacz (PCF8574)
│
├─ I2C Bus (Software, GPIO 11 SDA, GPIO 12 SCL) @ 100kHz
│  └─ BME680 (addr: 0x77) ──→ Temperatura, ciśnienie, wilgotność, VOC
│
├─ OneWire (GPIO 28)
│  └─ DS18B20 ──→ Temperatura cyfrowa (gleba)
│
├─ ADC #0 (GPIO 26) ──→ Kierunek wiatru (napięcie)
│
├─ ADC #1 (GPIO 27) ──→ Wilgotność gleby (napięcie)
│
├─ GPIO 9 (Licznik) ──→ Anemometr (impulsy)
│
├─ GPIO 10 (Licznik) ──→ Opadomierz (impulsy)
│
└─ GPIO 15 (Output) ──→ TPL5110 PIN DONE (sterowanie zasilaniem)
```

---

## 3. KONFIGURACJA INTERFEJSÓW KOMUNIKACYJNYCH

### 3.1 I2C (Inter-Integrated Circuit)

**Magistrala I2C #0:**
```
Pico GPIO 4 (SDA) ────────────────────── BME280 (SDA)
Pico GPIO 5 (SCL) ────────────────────── BME280 (SCL)
                        ├──────────────── LTR559 (SDA)
                        │    (Shared)    LTR559 (SCL)
                        ├──────────────── SCD41 (SDA)
                        │                SCD41 (SCL)
                        └──────────────── LCD16x2 (SDA)
                                        LCD16x2 (SCL)
Parametry: 100 kHz, pull-up rezystory
```

**Magistrala I2C (Software) - BME680:**
```
Pico GPIO 11 (SDA) ────────────────────── BME680 (SDA)
Pico GPIO 12 (SCL) ────────────────────── BME680 (SCL)

Parametry: 100 kHz, Software I2C
Uzasadnienie: Oddzielenie od magistrali głównej w celu 
              uniknięcia konfliktów adresowych (0x77)
```

### 3.2 OneWire (Dallas Protocol)

```
Pico GPIO 28 ──→ DS18B20 (Data Line)
              └─ GND (Ground)

Charakterystyka:
- Możliwość podłączenia wielu czujników na jednym pinie
- Wymaga rezystora pull-up (typowo 4.7kΩ do VDD)
```

### 3.3 ADC (Analog-to-Digital Converter)

```
Czujnik Wilgotności Gleby:
┌────────────────────────────┐
│ Pojemnościowy czujnik      │
│ • Zasilanie: 3.3V          │
│ • Wyjście: Napięcie 0-3.3V │
└────────────────────────────┘
                │
                ▼
    Pico ADC (GPIO 27, ADC#1)
         12-bit (0-4095)
                │
                ▼
    Konwersja do wartości:
    - Raw ADC (0-65535 mapowany)
    - Napięcie (V)
    - Procent wilgotności (%)
         │
         └─→ Kalibracja:
             • Sucho (1800 ADC)
             • Mokro (58000 ADC)

Kierunek Wiatru:
┌────────────────────────────┐
│ Potencjometr kierunkowy    │
│ • Zasilanie: 3.3V          │
│ • Wyjście: Napięcie 0-3.3V │
└────────────────────────────┘
                │
                ▼
    Pico ADC (GPIO 26, ADC#0)
         12-bit (0-4095)
```

---

## 4. SENSORYKA DETALIZOWANA

### Sensorów Meteorologiczne

#### BME280 vs BME680
```
┌──────────────┬──────────────┬──────────────┐
│  Parametr    │   BME280     │   BME680     │
├──────────────┼──────────────┼──────────────┤
│ Temperatura  │ ✓ Tak        │ ✓ Tak        │
│ Ciśnienie    │ ✓ Tak        │ ✓ Tak        │
│ Wilgotność   │ ✓ Tak        │ ✓ Tak        │
│ Czujnik gazu │ ✗ Nie        │ ✓ Tak (VOC)  │
│ Zakres T°    │ -40 do +85°C │ -40 do +85°C │
│ Dokładność   │ ±1.0°C       │ ±1.0°C       │
│ Interface    │ I2C          │ I2C (soft)   │
└──────────────┴──────────────┴──────────────┘

Rationale: Redundancja + rozszerzona funkcjonalność
```

### Sensorów Wilgotności i Temperatury

```
WARSTWA GLEBY (Soil Layer):
┌─────────────────────────────────────────┐
│ Czujnik wilgotności gleby (ADC)         │
│ Czujnik temperatury (DS18B20)           │
│ Czujnik temperatury + RH (BME680)       │
└─────────────────────────────────────────┘
         │
         ├─→ Wilgotność: Pojemnościowy ADC
         ├─→ Temperatura gleby: DS18B20 (OneWire)
         └─→ Temperatura otoczenia: BME280/BME680

WARSTWA POWIETRZA (Air Layer):
┌─────────────────────────────────────────┐
│ Temperatura: BME280, BME680, SCD41      │
│ Wilgotność: BME280, BME680, SCD41       │
│ Ciśnienie: BME280, BME680              │
│ CO₂: SCD41                              │
│ Światło: LTR559                         │
└─────────────────────────────────────────┘
```

### Sensorów Wiatru i Opadu

```
ANEMOMETR (Wind Speed):
┌──────────────────────────┐
│ Filiżanka obrotowa       │
│ • Osie: 3 filiżanki      │
│ • Impuls/obrót: 1        │
│ • Pin: GPIO 9            │
│ • Licznik impulsy        │
│ • Konwersja: m/s         │
└──────────────────────────┘
         │
         ▼
   Licznik GPIO #9
   Próbkowanie: 1000ms
   Rezultat: wind_speed_m_s

KIERUNKOWMIERZ (Wind Direction):
┌──────────────────────────┐
│ Potencjometr obrotowy    │
│ • 360° → 0-3.3V          │
│ • ADC mapowanie          │
│ • Kierunki: N,NE,E,...   │
└──────────────────────────┘
         │
         ▼
   ADC (GPIO 26)
   Rezultat: wind_heading_deg

OPADOMIERZ (Rain Gauge):
┌──────────────────────────┐
│ Bascula (huśtawka)       │
│ • 1 impuls = 0.2794 mm   │
│ • Pin: GPIO 10           │
│ • Licznik impulsy        │
│ • Konwersja: mm, mm/h    │
└──────────────────────────┘
         │
         ▼
   Licznik GPIO #10
   Próbkowanie: 1000ms
   Rezultat: rain_mm, rain_mm_per_hour
```

---

## 5. ZARZĄDZANIE ZASILANIEM

### TPL5110 Power Management

```
CYKL PRACY URZĄDZENIA:
┌─────────────────────────────────────┐
│  TPL5110 wysyła impuls włączenia   │ (Wbudowany timer)
└────────────────┬────────────────────┘
                 │ (Pico włącza się)
                 ▼
      ┌─────────────────────────┐
      │ FAZA INICJACJI (0.5s)   │
      │ • Uruchomienie sensorów │
      │ • Konfiguracja interfejsów
      └─────────────────────────┘
                 │
                 ▼
      ┌─────────────────────────┐
      │ FAZA POMIARU (3.5s)     │
      │ • Odczyt BME280        │
      │ • Odczyt BME680        │
      │ • Odczyt DS18B20       │
      │ • Odczyt SCD41         │
      │ • Odczyt LTR559        │
      │ • Odczyt wilgotności   │
      │ • Odczyt wiatru        │
      │ • Odczyt deszczu       │
      │ • Przetworzenie danych │
      └─────────────────────────┘
                 │
                 ▼
      ┌─────────────────────────┐
      │ FAZA UPLOAD (4s)        │
      │ • Połączenie Wi-Fi      │
      │ • Wysłanie do serwera   │
      └─────────────────────────┘
                 │
                 ▼
      ┌─────────────────────────┐
      │ SYGNAŁ DONE (20ms)      │
      │ GPIO 15: LOW→HIGH       │
      └─────────────────────────┘
                 │
                 ▼
      ┌─────────────────────────┐
      │ TPL5110 wyłącza zasilanie
      │ Oczekiwanie na timer    │
      │ (konfigurowalny czas)   │
      └─────────────────────────┘
```

**Okno czasowe:**
```
    0ms ├─── Boot ─────┤ 500ms (Inicjacja)
  500ms ├─── Sensory ──┤ 4000ms (Pomiary + przetworzenie)
 4000ms ├─── WiFi ─────┤ 8000ms (Upload)
 8000ms ├─ DONE signal ─┤ 8020ms (20ms impuls)
 8020ms └─ Zasilanie OFF ─── ~60 sekund (timer TPL5110) ───→
```

---

## 6. KOMUNIKACJA BEZPRZEWODOWA

### BLE (Bluetooth Low Energy)
```
URZĄDZENIE BLE:
┌─────────────────────────────────────┐
│ Nazwa: "SeedIot_67"                │
│ Typ: Peripheral (slave)             │
│ Power: Low Energy (10-100mA peak)   │
└─────────────────────────────────────┘

USŁUGI:
┌──────────────────────────────────────────┐
│ Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
│ ├─ Characteristic (Write): 6E400002-...
│ │  └─ Funkcja: Przyjmowanie konfiguracji
│ │     (SSID, hasło WiFi, adres serwera)
│ │
│ └─ Characteristic (Notify): 6E400003-...
│    └─ Funkcja: Wysyłanie potwierdzeń
│       (ACK, status konfiguracji)
└──────────────────────────────────────────┘

PRZEPŁYW DANYCH:
┌─────────────────────────────────────┐
│ Aplikacja mobilna                   │
│ (SeedIoT UI)                        │
└────────────────┬────────────────────┘
                 │ BLE
                 ▼
┌─────────────────────────────────────┐
│ Pico RP2040                         │
│ (Bluetooth LE Peripheral)           │
└─────────────────────────────────────┘
```

### Wi-Fi
```
STAN: Opcjonalny / Wbudowany w Pico
ROLA: Upload danych do serwera
INTEGRACJA: Z serwerem NestJS (seediot-server)

PRZEPŁYW DANYCH:
┌──────────────────────────────────────┐
│ Zebrane dane z sensorów              │
└────────────────┬─────────────────────┘
                 │
                 ▼
       ┌─────────────────────┐
       │ JSON Payload:       │
       │ {                   │
       │  "timestamp": "...", │
       │  "temperature": 22.5,│
       │  "humidity": 45.3,  │
       │  "co2": 450,        │
       │  "soil_moisture": 52│
       │  ...                │
       │ }                   │
       └────────────┬────────┘
                    │ HTTP POST
                    ▼
       ┌─────────────────────┐
       │ SeedIoT Server      │
       │ (NestJS)            │
       │ Base URL: /api/...  │
       └────────────┬────────┘
                    │
                    ▼
       ┌─────────────────────┐
       │ Baza danych         │
       │ Przetwarzanie       │
       │ Notyfikacje         │
       └─────────────────────┘
```

---

## 7. PRZEPŁYW DANYCH POMIARU

```
PEŁNY CYKL POMIAROWY:

1. BUDZENIE
   ├─ TPL5110 timer → impuls włączenia
   └─ Pico się włącza

2. INICJACJA (500ms)
   ├─ Inicjacja GPIO
   ├─ Inicjacja I2C magistral
   ├─ Inicjacja OneWire
   ├─ Inicjacja ADC
   └─ Inicjacja sensorów

3. KONFIGURACJA INTERWAŁÓW
   ├─ Licznik cykli: 0
   └─ Multiplier dla każdego sensora

4. PĘTLA POMIAROWA (3500ms, 350 iteracji × 10ms)
   ├─ Iteracja #1: Odczyt soil_moisture, bme280, bme680, ltr559, scd41, wind, rain
   ├─ Iteracja #2: Odczyt soil_moisture, bme280, bme680, ltr559, scd41, wind, rain +
   │              DS18B20 (multiplier=2)
   ├─ Iteracja #n: Analogicznie...
   └─ Akumulacja wyników

5. PRZETWORZENIE DANYCH
   ├─ Konwersja sumarycznych wartości
   ├─ Obliczenie średnich / sum
   ├─ Weryfikacja zmian (thresholds)
   └─ Formatowanie JSON payload

6. UPLOAD Wi-Fi (4000ms)
   ├─ Połączenie z sieć Wi-Fi (SSID/hasło z konfiguracji)
   ├─ POST request do serwera
   ├─ Potwierdzenie dostarczenia
   └─ Rozłączenie

7. SYGNAŁ DONE
   ├─ GPIO 15: LOW
   ├─ Sleep 2ms
   ├─ GPIO 15: HIGH (pulse start)
   ├─ Sleep 20ms (pulse duration)
   └─ GPIO 15: LOW (pulse end)

8. ZASILANIE OFF
   └─ TPL5110 wyłącza zasilanie
```

---

## 8. PODSUMOWANIE ZASOBÓW SPRZĘTOWYCH

### Podsumowanie I2C Adresów

```
I2C BUS #0 (GPIO 4 SDA, GPIO 5 SCL):
├─ 0x23: LTR559 (Light Sensor)
├─ 0x27: LCD16x2 (Expander PCF8574)
├─ 0x62: SCD41 (CO₂ Sensor)
└─ 0x77: BME280 (Atmospheric Sensor)

I2C BUS (Software, GPIO 11/12):
└─ 0x77: BME680 (Extended Atmospheric Sensor)
         [Adres taki sam, ale inny bus]

OneWire:
└─ GPIO 28: DS18B20 (Multiple sensors possible)

ADC:
├─ GPIO 26: Wind Direction (ADC#0)
└─ GPIO 27: Soil Moisture (ADC#1)

GPIO Cyfrowe:
├─ GPIO 4: I2C SDA (Main)
├─ GPIO 5: I2C SCL (Main)
├─ GPIO 6: Activity LED / Status
├─ GPIO 9: Wind Speed Pulse Counter
├─ GPIO 10: Rain Gauge Pulse Counter
├─ GPIO 11: I2C SDA (Software, BME680)
├─ GPIO 12: I2C SCL (Software, BME680)
└─ GPIO 15: TPL5110 DONE Signal
```

### Zużycie Zasobów
```
GPIO: 13 z 26 pinów (50%)
I2C: 2 magistrale (1 hardware + 1 software)
ADC: 2 z 3 kanałów (67%)
Magistrale seryjne: 0/2 UART, 0/2 SPI
OneWire: 1 pin
```

---

## 9. WNIOSKI I ZALECENIA

### Zalety architektury
✅ **Oszczędność energii** - Integracja TPL5110 umożliwia autonomiczną pracę na bateriach  
✅ **Redundancja danych** - Wiele sensorów mierzy te same parametry  
✅ **Rozszerzalność** - OneWire umożliwia kaskadowe podłączenie czujników  
✅ **Niska latencja** - Direct GPIO access dla zdarzeń czasu rzeczywistego  
✅ **Niskokosztowe** - Sensory I2C z dobrze dostępnym supportsem  

### Potencjalne ulepszenia
⚠️ **Rozdzielenie adresów I2C** - BME280 i BME680 dzielą adres 0x77 (wymaga osobnych magistral)  
⚠️ **Kalibracja ADC** - Czujnik wilgotności gleby wymaga kalibracji dla każdej lokalizacji  
⚠️ **Rezystory pull-up** - Konieczne dla magistral I2C i OneWire  
⚠️ **Filtracja szumu** - PWM wiatru/deszczu może wymagać dedykowanego licznika z filtracją  

---

## Odnośniki i zasoby

📄 **Dokumentacja techniczna**:
- [Datasheet RP2040](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- [Raspberry Pi Pico Documentation](https://www.raspberrypi.com/documentation/microcontrollers/rp2040.html)

📁 **Pliki źródłowe**:
- `codebase/rpi-code/sensor_pins.py` - Konfiguracja pinów
- `codebase/rpi-code/settings.py` - Ustawienia systemowe
- `codebase/rpi-code/sensors/` - Moduły sensorów
- `codebase/rpi-code/main.py` - Główna pętla

🔗 **Dodatkowe artykuły**:
- I2C Protocol: https://en.wikipedia.org/wiki/I%C2%B2C
- OneWire Protocol: https://en.wikipedia.org/wiki/1-Wire
- MicroPython: https://micropython.org/

---

**Raport opracowany**: czerwiec 2026  
**Wersja**: 1.0  
**Status**: ✅ Aktualny

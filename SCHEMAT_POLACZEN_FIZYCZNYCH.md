# SCHEMAT POŁĄCZEŃ FIZYCZNYCH - SEEDIOT

## Pinout Raspberry Pi Pico - Widok Górny

```
            RASPBERRY PI PICO RP2040
            =======================

        GPIO Numbering (Left Side)     (Right Side)
        ────────────────────────────────────────────

         1 │ GP0                  │ 40 │ VBUS
         2 │ GP1                  │ 39 │ VSYS
         3 │ GND                  │ 38 │ GND
         4 │ GP2 (ENVIRO_HOLD)    │ 37 │ 3V3_EN
         5 │ GP3 (ENVIRO_INT)     │ 36 │ 3V3(OUT)
         6 │ GP4 (I2C0_SDA)       │ 35 │ ADC_REF
         7 │ GP5 (I2C0_SCL)       │ 34 │ GP28 (ADC2 - Wind Dir)
         8 │ GND                  │ 33 │ GND
         9 │ GP6 (ACTIVITY_LED)   │ 32 │ GP27 (ADC1 - Soil Moist)
        10 │ GP7                  │ 31 │ GP26 (ADC0 - Wind Dir)
        11 │ GP8 (RTC_ALARM)      │ 30 │ RUN
        12 │ GP9 (WIND_SPEED)     │ 29 │ GP22
        13 │ GND                  │ 28 │ GND
        14 │ GP10 (RAIN_GAUGE)    │ 27 │ GP21
        15 │ GP11 (I2C_SDA_BME680)│ 26 │ GP20
        16 │ GP12 (I2C_SCL_BME680)│ 25 │ GND
        17 │ GND                  │ 24 │ GP19
        18 │ GP13                 │ 23 │ GP18
        19 │ GP14                 │ 22 │ GND
        20 │ GP15 (TPL5110_DONE)  │ 21 │ GP17
        
        Wszystkie GND (masy) są połączone wewnętrznie
```

---

## Tablica Połączeń Sensorów

### 1. BME280 - Czujnik Atmosferyczny (I2C Bus #0)

```
BME280 Sensor Pins:
┌─────────────────────────────────────┐
│ Pin Name      │ RP2040 Pin         │
├─────────────────────────────────────┤
│ VDD (3.3V)    │ 3V3(OUT) [pin 36]  │
│ GND           │ GND [pins 3,8,13..] │
│ SCL           │ GP5 [pin 7]        │
│ SDA           │ GP4 [pin 6]        │
└─────────────────────────────────────┘

I2C Address: 0x77 (default)
Wiring:
    Pico GP4 (SDA) ────[Pull-up 4.7kΩ]──── 3V3
         │
         ├───────────── BME280 SDA
         │
    Pico GP5 (SCL) ────[Pull-up 4.7kΩ]──── 3V3
         │
         └───────────── BME280 SCL
    
    Pico GND ───────────────────────────── BME280 GND
    3V3(OUT) ───────────────────────────── BME280 VDD
```

### 2. BME680 - Czujnik Rozszerzony (Software I2C)

```
BME680 Sensor Pins:
┌─────────────────────────────────────┐
│ Pin Name      │ RP2040 Pin         │
├─────────────────────────────────────┤
│ VDD (3.3V)    │ 3V3(OUT) [pin 36]  │
│ GND           │ GND (any)          │
│ SCL           │ GP12 [pin 16]      │
│ SDA           │ GP11 [pin 15]      │
└─────────────────────────────────────┘

I2C Address: 0x77 (NIEZALEŻNE - inny bus!)
Wiring:
    Pico GP11 (SDA) ──[Pull-up 4.7kΩ]──── 3V3
         │
         ├───────────── BME680 SDA
         │
    Pico GP12 (SCL) ──[Pull-up 4.7kΩ]──── 3V3
         │
         └───────────── BME680 SCL
    
    Pico GND ───────────────────────────── BME680 GND
    3V3(OUT) ───────────────────────────── BME680 VDD
```

### 3. SCD41 - Czujnik CO₂ (I2C Bus #0)

```
SCD41 Sensor Pins:
┌─────────────────────────────────────┐
│ Pin Name      │ RP2040 Pin         │
├─────────────────────────────────────┤
│ VDD (5V)      │ VBUS [pin 1]       │
│ GND           │ GND (any)          │
│ SDA           │ GP4 [pin 6] (SHARED)
│ SCL           │ GP5 [pin 7] (SHARED)
└─────────────────────────────────────┘

I2C Address: 0x62
WARNING: SCD41 wymaga 5V! VBUS nie GND!
Wiring:
    Pico VBUS (5V) ─────────────────────── SCD41 VDD
    Pico GND ───────────────────────────── SCD41 GND
    
    SCD41 SDA ──────────────────────────── Shared I2C Bus #0
    SCD41 SCL ──────────────────────────── Shared I2C Bus #0
```

### 4. LTR559 - Czujnik Światła (I2C Bus #0)

```
LTR559 Sensor Pins:
┌─────────────────────────────────────┐
│ Pin Name      │ RP2040 Pin         │
├─────────────────────────────────────┤
│ VDD (3.3V)    │ 3V3(OUT) [pin 36]  │
│ GND           │ GND (any)          │
│ SDA           │ GP4 [pin 6] (SHARED)
│ SCL           │ GP5 [pin 7] (SHARED)
└─────────────────────────────────────┘

I2C Address: 0x23
Wiring:
    Pico 3V3(OUT) ──────────────────────── LTR559 VDD
    Pico GND ───────────────────────────── LTR559 GND
    
    LTR559 SDA ──────────────────────────── Shared I2C Bus #0
    LTR559 SCL ──────────────────────────── Shared I2C Bus #0
```

### 5. DS18B20 - Czujnik Temperatury (OneWire)

```
DS18B20 Sensor (TO-92 Package):
        ┌─────────┐
        │         │
    GND ├─────────┤ (Pin 2)
        │DS18B20  │
    DQ  ├─────────┤ (Pin 3)
        │         │
    VDD ├─────────┤ (Pin 1)
        └─────────┘

Wiring:
    Pico GND (any) ──────────────────────── DS18B20 GND (Pin 2)
    Pico 3V3(OUT) ──────────────────────── DS18B20 VDD (Pin 1)
    
    Pico GP28 ──[Pull-up 4.7kΩ to 3V3]──── DS18B20 DQ (Pin 3)
    
    ┌─────────────────────────────────────┐
    │ Dodatkowo można podłączyć wiele      │
    │ czujników DS18B20 na GP28 (daisy-   │
    │ chain), każdy ma unikalny adres.    │
    └─────────────────────────────────────┘
```

### 6. Czujnik Wilgotności Gleby (ADC)

```
Pojemnościowy Czujnik Wilgotności:
┌────────────────────────────┐
│ Pin         │ RP2040 Pin   │
├────────────────────────────┤
│ VDD (3.3V)  │ 3V3(OUT)     │
│ GND         │ GND (any)    │
│ AOUT        │ GPIO27 (ADC1)│
└────────────────────────────┘

Wiring:
    Pico 3V3(OUT) ──────────────────── Sensor VDD
    Pico GND (any) ──────────────────── Sensor GND
    
    Sensor AOUT ─────────────────────── Pico GPIO27
    
    ┌─────────────────────────────────────┐
    │ Sensor Output: 0-3.3V              │
    │ ADC Input (GPIO27): 0-4095 raw     │
    │                                     │
    │ Calibration:                        │
    │ • Dry:  1800 ADC (mapowany)        │
    │ • Wet: 58000 ADC (mapowany)        │
    │                                     │
    │ Konwersja:                         │
    │ Voltage = raw × (3.3 / 65535)     │
    │ Moisture% = mapuj(raw)            │
    └─────────────────────────────────────┘
```

### 7. Anemometr (Wind Speed Sensor)

```
Anemometr - Impulse Counter:
┌────────────────────────────┐
│ Pin         │ RP2040 Pin   │
├────────────────────────────┤
│ VDD (3.3V)  │ 3V3(OUT)     │
│ GND         │ GND (any)    │
│ PULSE       │ GPIO9        │
└────────────────────────────┘

Wiring:
    Pico 3V3(OUT) ──────────────────── Anemometer VDD
    Pico GND ──────────────────────── Anemometer GND
    
    Pico GPIO9 ────[Pull-up 10kΩ]───── Anemometer PULSE
         (Counter dla impulsów)
    
    ┌─────────────────────────────────────┐
    │ 1 obrót = 1 impuls                 │
    │ Próbkowanie: 1000ms                │
    │ Wynik: wind_speed_m_s              │
    └─────────────────────────────────────┘
```

### 8. Kierunkowmierz (Wind Direction)

```
Kierunkowmierz - Potencjometr:
┌────────────────────────────┐
│ Pin         │ RP2040 Pin   │
├────────────────────────────┤
│ VDD (3.3V)  │ 3V3(OUT)     │
│ GND         │ GND (any)    │
│ WIPER       │ GPIO26 (ADC0)│
└────────────────────────────┘

Wiring:
    Pico 3V3(OUT) ──────────────────── Potentiometer VDD
    Pico GND ──────────────────────── Potentiometer GND
    
    Pico GPIO26 (ADC0) ────────────── Potentiometer WIPER
    
    ┌─────────────────────────────────────┐
    │ 360° → 0-3.3V                      │
    │ ADC Input: 0-4095 raw              │
    │ Konwersja: raw/4095 × 360°        │
    │ Kierunki: N,NE,E,SE,S,SW,W,NW    │
    │ Wynik: wind_heading_deg            │
    └─────────────────────────────────────┘
```

### 9. Opadomierz (Rain Gauge)

```
Opadomierz - Impulse Counter (Bascula):
┌────────────────────────────┐
│ Pin         │ RP2040 Pin   │
├────────────────────────────┤
│ VDD (3.3V)  │ 3V3(OUT)     │
│ GND         │ GND (any)    │
│ PULSE       │ GPIO10       │
└────────────────────────────┘

Wiring:
    Pico 3V3(OUT) ──────────────────── Rain Gauge VDD
    Pico GND ──────────────────────── Rain Gauge GND
    
    Pico GPIO10 ───[Pull-up 10kΩ]──── Rain Gauge PULSE
         (Counter dla impulsów)
    
    ┌─────────────────────────────────────┐
    │ 1 impuls ≈ 0.2794 mm opadu        │
    │ Próbkowanie: 1000ms                │
    │ Wynik: rain_mm, rain_mm_per_hour   │
    └─────────────────────────────────────┘
```

### 10. LCD 16x2 (I2C I/O Expander)

```
LCD 16x2 z PCF8574 Expanderem:
┌────────────────────────────┐
│ Pin         │ RP2040 Pin   │
├────────────────────────────┤
│ VDD (5V)    │ VBUS [pin 1] │
│ GND         │ GND (any)    │
│ SDA         │ GP4 [pin 6]  │ (SHARED Bus #0)
│ SCL         │ GP5 [pin 7]  │ (SHARED Bus #0)
└────────────────────────────┘

I2C Address: 0x27 (Expander PCF8574)

Wiring:
    Pico VBUS (5V) ───────────────────── LCD VDD
    Pico GND ──────────────────────────── LCD GND
    
    LCD SDA ────────────────────────────── Shared I2C Bus #0
    LCD SCL ────────────────────────────── Shared I2C Bus #0
```

### 11. TPL5110 - Kontroler Zasilania

```
TPL5110 Power Controller:
┌────────────────────────────┐
│ Pin         │ RP2040 Pin   │
├────────────────────────────┤
│ BAT+ (5-12V)│ Battery +    │
│ GND         │ GND (any)    │
│ OUT+        │ Pico VSYS    │
│ OUT-        │ Pico GND     │
│ DONE        │ GPIO15       │
└────────────────────────────┘

Wiring (Zasilanie):
    Battery+ ──────────────────────── TPL5110 BAT+
    
    TPL5110 OUT+ ──────────────────── Pico VSYS [pin 39]
    TPL5110 OUT- ──────────────────── Pico GND (any)
    TPL5110 GND ───────────────────── Battery GND
    
Wiring (Kontrola):
    Pico GPIO15 ──────────────────── TPL5110 DONE
    
    ┌─────────────────────────────────────┐
    │ DONE Pulse Protocol:                │
    │ 1. Normalnie: GPIO15 = LOW         │
    │ 2. Pulse: LOW → HIGH (20ms) → LOW  │
    │ 3. Efekt: TPL5110 wyłącza zasilanie│
    │                                     │
    │ Konfiguracja opornika DELAY:       │
    │ Określa czas wybudzenia             │
    │ (np. ~1 min, ~5 min, etc.)         │
    └─────────────────────────────────────┘
```

---

## Kompletny Schemat Połączeń

### Schemat Blokowy

```
                    ┌─────────────────┐
                    │  ZASILANIE (5V) │
                    │    (Bateria)    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   TPL5110       │
                    │  (Power Mgmt)   │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │  RASPBERRY PI PICO       │
              │      RP2040              │
              │                          │
              ├──────────────────────────┤
              │  GPIO Allocation:        │
              │  • GP4/5: I2C Bus #0     │
              │  • GP11/12: I2C Software │
              │  • GP28: OneWire         │
              │  • GP26/27: ADC          │
              │  • GP9/10: Pulse Count   │
              │  • GP15: TPL5110 DONE    │
              │  • GP6: Status LED       │
              └──────────────────────────┘
              │
    ┌─────────┼──────┬──────┬──────┬────────────┐
    │         │      │      │      │            │
    ▼         ▼      ▼      ▼      ▼            ▼
  I2C#0   I2C_SW   OneWire  ADC   GPIO        GPIO
  Bus0    (GP11/12) (GP28)  (GP26) (GPIO9)    (GPIO10)
   │         │       │       │       │          │
   ├────┬────┼──┬────┤       │       │          │
   │    │    │  │    │       │       │          │
 BME280 LTR SCD LCD  BME680 DS18B  Moisture  Wind   Rain
 (0x77) 559  41  16x2 (0x77) (Soil)  (ADC1)  Speed  Gauge
        0x23 0x62 0x27              (ADC0)  Meter

           ┌─────────────────┐
           │   KOMUNIKACJA   │
           ├─────────────────┤
           │  • BLE (onboard)│
           │  • Wi-Fi (opt)  │
           │  • Upload HTTP  │
           └─────────────────┘
```

---

## Rezystory Pull-Up

### Wymagane rezystory Pull-Up dla I2C i OneWire

```
┌─────────────────────────────────────────┐
│ REZYSTORY PULL-UP (Ważne!)              │
├─────────────────────────────────────────┤
│                                         │
│ I2C Bus #0 (GP4 SDA, GP5 SCL):         │
│   • 4.7 kΩ do 3V3 (SDA)                │
│   • 4.7 kΩ do 3V3 (SCL)                │
│                                         │
│ I2C Bus Software (GP11 SDA, GP12 SCL):  │
│   • 4.7 kΩ do 3V3 (SDA)                │
│   • 4.7 kΩ do 3V3 (SCL)                │
│                                         │
│ OneWire (GP28):                        │
│   • 4.7 kΩ do 3V3                      │
│                                         │
│ GPIO Liczniki (GP9, GP10):             │
│   • 10 kΩ do 3V3 (optional, dla czystości)
│                                         │
└─────────────────────────────────────────┘
```

---

## Tabela Zasilania

### Napięcia dla poszczególnych komponentów

```
┌────────────────────────────────────────┐
│ KOMPONENTY ZASILANE Z 3.3V:            │
├────────────────────────────────────────┤
│ • Raspberry Pi Pico CORE (GPIO)        │
│ • BME280 (3.3V nominal)                │
│ • BME680 (3.3V nominal)                │
│ • LTR559 (3.3V nominal)                │
│ • DS18B20 (3.3V nominal)               │
│ • Anemometr (3.3V nominal)             │
│ • Opadomierz (3.3V nominal)            │
│ • Czujnik wilgotności gleby (3.3V)     │
│ • Rezystory pull-up (3V3)              │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ KOMPONENTY ZASILANE Z 5V (VBUS):       │
├────────────────────────────────────────┤
│ • SCD41 (5V recommended)               │
│ • LCD 16x2 backlight (5V)              │
│ • PCF8574 expander (5V compatible)     │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ KOMPONENTY ZASILANE Z BATTERY:         │
├────────────────────────────────────────┤
│ • TPL5110 (5-12V input)                │
│ • TPL5110 Output → Pico VSYS (3.3V)   │
│ (TPL5110 oszczędza energię!)          │
└────────────────────────────────────────┘
```

---

## Procedura Montażu

### Krok po kroku

```
1. PRZYGOTOWANIE
   ☐ Sprawdzić wszystkie komponenty
   ☐ Przygotować rezystory pull-up
   ☐ Przygotować lutownicę/kabel

2. ZASILANIE
   ☐ Podłączyć bateria do TPL5110
   ☐ TPL5110 OUT+ do Pico VSYS
   ☐ TPL5110 OUT- do Pico GND
   ☐ TPL5110 GND do Battery GND

3. I2C BUS #0
   ☐ Pico GP4 → rezystor 4.7kΩ → 3V3
   ☐ Pico GP5 → rezystor 4.7kΩ → 3V3
   ☐ BME280 SDA → GP4, SCL → GP5
   ☐ LTR559 SDA → GP4, SCL → GP5
   ☐ SCD41 SDA → GP4, SCL → GP5, VDD → VBUS (5V)
   ☐ LCD SDA → GP4, SCL → GP5, VDD → VBUS (5V)

4. I2C BUS SOFTWARE (BME680)
   ☐ Pico GP11 → rezystor 4.7kΩ → 3V3
   ☐ Pico GP12 → rezystor 4.7kΩ → 3V3
   ☐ BME680 SDA → GP11, SCL → GP12

5. ONEWIRE (DS18B20)
   ☐ Pico GP28 → rezystor 4.7kΩ → 3V3
   ☐ DS18B20 DQ → GP28

6. ADC
   ☐ Czujnik wilgotności AOUT → GPIO27
   ☐ Kierunkowmierz WIPER → GPIO26

7. GPIO LICZNIKI
   ☐ Anemometr PULSE → GP9 + rezystor 10kΩ (optional)
   ☐ Opadomierz PULSE → GP10 + rezystor 10kΩ (optional)

8. KONTROLA ZASILANIA
   ☐ Pico GPIO15 → TPL5110 DONE

9. STATUS
   ☐ Pico GPIO6 → LED statusowe (optional)

10. TESTY
    ☐ Podłączyć zasilanie
    ☐ Zanotować czy Pico się włącza
    ☐ Testować I2C skanowanie
    ☐ Testować odczyt każdego sensora
```

---

## Sprawdzenie I2C

### I2C Scanner (Python/MicroPython)

```python
from machine import I2C, Pin

# Skanuj I2C Bus #0
i2c0 = I2C(0, sda=Pin(4), scl=Pin(5), freq=100000)
print("I2C Bus #0 devices:")
devices = i2c0.scan()
print(devices)

# Skanuj I2C Bus Software (BME680)
i2c_soft = I2C(1, sda=Pin(11), scl=Pin(12), freq=100000)
print("I2C Bus (Software) devices:")
devices = i2c_soft.scan()
print(devices)

# Expected addresses (in decimal):
# - LTR559: 35 (0x23)
# - LCD: 39 (0x27)
# - SCD41: 98 (0x62)
# - BME280/BME680: 119 (0x77)
```

---

## Notatki Praktyczne

### Najczęstsze problemy i rozwiązania

```
❌ Problem: I2C urządzenie nie zostało znalezione
✅ Rozwiązanie:
   • Sprawdzić rezystory pull-up
   • Sprawdzić zasilanie (VDD)
   • Sprawdzić połączenia SDA/SCL
   • Sprawdzić adres I2C (skanować)

❌ Problem: ADC odczytuje niepoprawne wartości
✅ Rozwiązanie:
   • Ponownie kalibrować sensor
   • Sprawdzić napięcie odniesienia (3.3V)
   • Dodać kondensator filtrujący (100nF)

❌ Problem: OneWire DS18B20 nie reaguje
✅ Rozwiązanie:
   • Sprawdzić rezystor pull-up (MUSI być!)
   • Sprawdzić połączenie DQ
   • Zmienić pin na inny (np. GP25)

❌ Problem: Sensory pracują ale dane są szumne
✅ Rozwiązanie:
   • Dodać kondensatory filtrujące na VDD (100nF + 10µF)
   • Skrócić kable (szczególnie dla ADC)
   • Osłonić kablami ekranowanymi

❌ Problem: TPL5110 nie wyłącza Pico
✅ Rozwiązanie:
   • Sprawdzić GPIO15 połączenie
   • Sprawdzić impuls DONE (20ms)
   • Sprawdzić konfigurację rezystora DELAY
```

---

**Stworzono**: czerwiec 2026  
**Wersja**: 1.0  
**Format**: ASCII Schematic + Wiring Guide

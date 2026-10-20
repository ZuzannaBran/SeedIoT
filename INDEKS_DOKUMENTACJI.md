# 📚 INDEKS DOKUMENTACJI SPRZĘTOWEJ - SEEDIOT

## Spis zawartości dokumentów

### 🎯 Gdzie szukać czego?

#### 🚀 Chcę szybko zobaczyć co jest w urządzeniu
👉 **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Szybka referencyjna tabela
- Pinout karty
- Tabela sensorów
- GPIO alokacja
- Zasilanie
- Interwały pomiarów
- Checklist montażu

---

#### 🔧 Chcę złożyć urządzenie (kabel po kablu)
👉 **[SCHEMAT_POLACZEN_FIZYCZNYCH.md](SCHEMAT_POLACZEN_FIZYCZNYCH.md)** - Praktyczny przewodnik
- Widok z góry Pico z numerami pinów
- Schemat każdego sensora indywidualnie
- Krok po kroku procedura montażu
- Tabela zasilania
- Rezystory pull-up gdzie?
- Rozwiązywanie problemów

---

#### 📖 Chcę pełną specyfikację techniczną
👉 **[KONFIGURACJA_SPRZĘTOWA.md](KONFIGURACJA_SPRZĘTOWA.md)** - Oficjalny dokument
- Przegląd systemu
- Specyfikacja każdego sensora
- Zasilanie i zarządzanie energią
- Interfejsy komunikacyjne (I2C, OneWire, GPIO)
- Parametry techniczne
- Cykl pomiarowy

---

#### 📊 Chcę zrozumieć architekturę systemu
👉 **[MINI_RAPORT_SPRZĘT.md](MINI_RAPORT_SPRZĘT.md)** - Raport analityczny
- Architektura ogólna (blokowy schemat)
- Mapa sensorów (diagram połączeń)
- Szczegółowe omówienie każdego sensora
- Zarządzanie zasilaniem (TPL5110)
- Przepływ danych pomiaru
- Zalety i ulepszenia

---

## 📋 Mapy Dokumentów

### Dokument: QUICK_REFERENCE.md
```
├─ Specyfikacje Raspberry Pi Pico
├─ Pinout (szybki przegląd)
├─ Tabela sensorów
├─ GPIO alokacja
├─ Zasilanie
├─ Cykl pomiaru (timeline)
├─ Bill of Materials (BOM)
├─ Interwały odczytów
├─ Checklist montażu
├─ Diagnostyka
└─ Kontakt i dokumentacja
```

### Dokument: SCHEMAT_POLACZEN_FIZYCZNYCH.md
```
├─ Pinout Raspberry Pi Pico (widok górny)
├─ Tablica połączeń sensorów (12 sekcji)
│  ├─ BME280
│  ├─ BME680
│  ├─ SCD41
│  ├─ LTR559
│  ├─ DS18B20
│  ├─ Czujnik wilgotności gleby
│  ├─ Anemometr
│  ├─ Kierunkowmierz
│  ├─ Opadomierz
│  ├─ LCD 16x2
│  ├─ TPL5110
│  └─ Rezystory Pull-up
├─ Kompletny schemat połączeń (blokowy)
├─ Rezystory Pull-Up
├─ Tabela zasilania
├─ Procedura montażu (10 kroków)
├─ Sprawdzenie I2C (kod Python)
├─ Notatki praktyczne
└─ Rozwiązywanie problemów
```

### Dokument: KONFIGURACJA_SPRZĘTOWA.md
```
├─ Przegląd systemu
│  ├─ Architektura warstwy sprzętowej
│  └─ Platforma główna (RP2040)
├─ Interfejsy komunikacyjne
│  ├─ I2C (Bus #0 i Software)
│  ├─ OneWire
│  ├─ GPIO (cyfrowe)
│  └─ ADC (Analog)
├─ Sensory pomiarowe (8 typów)
│  ├─ BME280
│  ├─ BME680
│  ├─ DS18B20
│  ├─ SCD41
│  ├─ LTR559
│  ├─ Wilgotność gleby
│  ├─ Anemometr
│  └─ Opadomierz
├─ Komponenty wspomagające
│  ├─ LCD 16x2
│  └─ TPL5110
├─ Schemat pinów GPIO
├─ Zasilanie i zarządzanie energią
├─ Komunikacja i łączność (BLE + Wi-Fi)
└─ Podsumowanie techniczne
```

### Dokument: MINI_RAPORT_SPRZĘT.md
```
├─ Cel raportu
├─ Architektura ogólna
│  └─ Blokowy schemat systemu
├─ Mapa sensorów
│  ├─ Tabela sensorów
│  └─ Diagram połączeń
├─ Konfiguracja interfejsów
│  ├─ I2C (2 magistrale)
│  ├─ OneWire
│  └─ ADC
├─ Sensoryka detalizowana
│  ├─ BME280 vs BME680
│  ├─ Wilgotność i temperatura
│  └─ Wiatr i opad
├─ Zarządzanie zasilaniem (TPL5110)
├─ Komunikacja bezprzewodowa (BLE + Wi-Fi)
├─ Specyfikacja wyświetlacza LCD
├─ Przepływ danych pomiaru
├─ Podsumowanie zasobów
└─ Wnioski i zalecenia
```

---

## 🎯 Scenariusze Użycia

### Scenariusz 1: Nowy zespół projektowy, pierwsza lektura
**Kolejność czytania:**
1. QUICK_REFERENCE.md - poznać component overview (5 min)
2. MINI_RAPORT_SPRZĘT.md - zrozumieć architekturę (15 min)
3. KONFIGURACJA_SPRZĘTOWA.md - szczegółowa specyfikacja (20 min)
4. SCHEMAT_POLACZEN_FIZYCZNYCH.md - praktyka montażu (opcjonalnie)

### Scenariusz 2: Budowanie urządzenia od zera
**Kolejność czytania:**
1. QUICK_REFERENCE.md - checklist przed montażem
2. SCHEMAT_POLACZEN_FIZYCZNYCH.md - krok po kroku montaż
3. KONFIGURACJA_SPRZĘTOWA.md - szczegóły techniczne
4. QUICK_REFERENCE.md - diagnostyka i testy

### Scenariusz 3: Debugowanie problemu
**Co robić:**
1. SCHEMAT_POLACZEN_FIZYCZNYCH.md → sekcja "Najczęstsze problemy"
2. QUICK_REFERENCE.md → sekcja "Diagnostyka"
3. KONFIGURACJA_SPRZĘTOWA.md → szczegółowe specyfikacje

### Scenariusz 4: Szybka weryfikacja/przypomnienie
**Co robić:**
1. QUICK_REFERENCE.md - pinout, tabela sensorów, checklist
2. SCHEMAT_POLACZEN_FIZYCZNYCH.md → szukane połączenie

---

## 🔑 Kluczowe Informacje - Gdzie Szukać

### Sprzęt (Hardware)
- **Procesor**: KONFIGURACJA_SPRZĘTOWA.md → Platforma główna
- **Architektura**: MINI_RAPORT_SPRZĘT.md → Architektura ogólna
- **Pinout**: QUICK_REFERENCE.md → Pinout, SCHEMAT_POLACZEN_FIZYCZNYCH.md → Pinout widok górny

### Sensory
- **Specyfikacje**: KONFIGURACJA_SPRZĘTOWA.md → Sensory pomiarowe
- **Analiza porównawcza**: MINI_RAPORT_SPRZĘT.md → Sensoryka detalizowana
- **Wiring**: SCHEMAT_POLACZEN_FIZYCZNYCH.md → Tablica połączeń

### Zasilanie
- **Zarządzanie energią**: KONFIGURACJA_SPRZĘTOWA.md → Zasilanie i zarządzanie energią
- **Cykl pomiaru**: MINI_RAPORT_SPRZĘT.md → Zarządzanie zasilaniem
- **Timeline**: QUICK_REFERENCE.md → Cykl pomiaru

### Interfejsy Komunikacji
- **I2C**: KONFIGURACJA_SPRZĘTOWA.md → Interfejsy komunikacyjne
- **OneWire**: KONFIGURACJA_SPRZĘTOWA.md → Interfejsy komunikacyjne
- **ADC**: KONFIGURACJA_SPRZĘTOWA.md → Interfejsy komunikacyjne
- **BLE/Wi-Fi**: KONFIGURACJA_SPRZĘTOWA.md → Komunikacja i łączność

### Montaż
- **Procedura**: SCHEMAT_POLACZEN_FIZYCZNYCH.md → Procedura montażu
- **Rezystory**: SCHEMAT_POLACZEN_FIZYCZNYCH.md → Rezystory Pull-Up
- **Checklist**: QUICK_REFERENCE.md → Checklist montażu

### Diagnostyka
- **I2C**: QUICK_REFERENCE.md → Diagnostyka
- **ADC**: QUICK_REFERENCE.md → Diagnostyka
- **OneWire**: QUICK_REFERENCE.md → Diagnostyka
- **Problemy**: SCHEMAT_POLACZEN_FIZYCZNYCH.md → Notatki praktyczne

---

## 📊 Tabela Porównawcza Dokumentów

| Cecha | Quick Ref | Schemat Fizyczny | Konfiguracja | Mini Raport |
|-------|-----------|------------------|--------------|------------|
| **Czytanie szybkie** | ✅ | ✓ | ✗ | ✓ |
| **Zabudowanie** | ✓ | ✅ | ✗ | ✗ |
| **Specyfikacja Tech** | ✓ | ✓ | ✅ | ✓ |
| **Schemat Fizyczny** | ✓ | ✅ | ✗ | ✗ |
| **Architektura** | ✗ | ✓ | ✓ | ✅ |
| **Diagnostyka** | ✅ | ✓ | ✗ | ✗ |
| **Cykl pomiaru** | ✓ | ✓ | ✓ | ✅ |
| **BOM** | ✅ | ✓ | ✗ | ✗ |

---

## 🔗 Cross-References (Odnośniki)

### Sensor: BME280
- Specyfikacja: [KONFIGURACJA_SPRZĘTOWA.md](KONFIGURACJA_SPRZĘTOWA.md#1-bme280---czujnik-atmosferyczny)
- Wiring: [SCHEMAT_POLACZEN_FIZYCZNYCH.md](SCHEMAT_POLACZEN_FIZYCZNYCH.md#1-bme280---czujnik-atmosferyczny-i2c-bus-0)
- Szybka ref: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#i2c-adresów)

### Sensor: SCD41 (CO₂)
- Specyfikacja: [KONFIGURACJA_SPRZĘTOWA.md](KONFIGURACJA_SPRZĘTOWA.md#4-scd41---czujnik-co₂)
- Wiring: [SCHEMAT_POLACZEN_FIZYCZNYCH.md](SCHEMAT_POLACZEN_FIZYCZNYCH.md#3-scd41---czujnik-co₂)
- Szybka ref: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#i2c-adresów)

### TPL5110 Power Management
- Specyfikacja: [KONFIGURACJA_SPRZĘTOWA.md](KONFIGURACJA_SPRZĘTOWA.md#2-tpl5110---kontroler-zarządzania-zasilaniem)
- Wiring: [SCHEMAT_POLACZEN_FIZYCZNYCH.md](SCHEMAT_POLACZEN_FIZYCZNYCH.md#11-tpl5110---kontroler-zasilania)
- Architektura: [MINI_RAPORT_SPRZĘT.md](MINI_RAPORT_SPRZĘT.md#tpl5110-power-management)
- Timeline: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-cykl-pomiaru---timeline)

### I2C Bus
- Interfejsy: [KONFIGURACJA_SPRZĘTOWA.md](KONFIGURACJA_SPRZĘTOWA.md#i2c-inter-integrated-circuit)
- Schemat: [MINI_RAPORT_SPRZĘT.md](MINI_RAPORT_SPRZĘT.md#31-i2c-inter-integrated-circuit)
- Wiring: [SCHEMAT_POLACZEN_FIZYCZNYCH.md](SCHEMAT_POLACZEN_FIZYCZNYCH.md#kompletny-schemat-połączeń)
- Diagnostyka: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-diagnostyka---komendy)

---

## 📞 Informacje o Dokumentach

### Wersja
- **Wersja**: 1.0
- **Data**: Czerwiec 2026
- **Status**: ✅ Aktualny
- **Projekt**: SeedIoT - Stacja monitorująca do zarządzania uprawami

### Autorstwo
- **Zespół**: Patryk Rusak, Zuzanna Baran, Alicja Ciepielska, Nguyen Anh Do, Antoni Kucisz
- **Dokumentacja**: Warstwa sprzętowa (Hardware Layer)
- **Język**: Polski

### Formaty Dokumentów
- **Format**: Markdown (.md)
- **Edytor**: Dowolny edytor tekstu / VS Code
- **Struktura**: Hierarchiczna z tabelami i diagramami ASCII

---

## 📝 Uwagi

### Dla nowych czytelników
1. Zapoznaj się najpierw z QUICK_REFERENCE.md (5 minut)
2. Następnie przejdź do MINI_RAPORT_SPRZĘT.md (15 minut)
3. Wróć do SCHEMAT_POLACZEN_FIZYCZNYCH.md kiedy będziesz coś budować

### Dla zespołu deweloperskiego
- Trzymaj QUICK_REFERENCE.md zawsze pod ręką
- Dokumenty mogą być drukowo jako ściągi
- Aktualizuj dokumenty gdy dodasz nowy sensor

### Dla przyszłych projektów
- Struktura tych dokumentów może być szablonacją dla nowych projektów sprzętowych
- Zawsze start z QUICK_REFERENCE.md
- Zawsze dokumentuj fizyczne schematami ASCII

---

## 🎓 Dodatkowe Zasoby

### Dokumentacja Zewnętrzna
- [Raspberry Pi Pico Documentation](https://www.raspberrypi.com/documentation/microcontrollers/rp2040.html)
- [RP2040 Datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- [MicroPython Documentation](https://micropython.org/doc/)

### Sensory (Producentowie)
- **Bosch Sensortec**: BME280, BME680
- **STMicroelectronics**: LTR559
- **Sensirion**: SCD41
- **Maxim Integrated**: DS18B20
- **Sparkfun / Adafruit**: Komponenty i tutoriale

### Protokoły
- [I2C Protocol](https://en.wikipedia.org/wiki/I%C2%B2C)
- [OneWire/Dallas Protocol](https://en.wikipedia.org/wiki/1-Wire)
- [Bluetooth LE](https://en.wikipedia.org/wiki/Bluetooth_Low_Energy)

---

## ✅ Checklist Czytania

```
Nowy członek zespołu - co przeczytać?
☐ QUICK_REFERENCE.md (5 min) - Szybka orientacja
☐ MINI_RAPORT_SPRZĘT.md (15 min) - Zrozumienie systemu
☐ SCHEMAT_POLACZEN_FIZYCZNYCH.md (20 min) - Praktyka montażu
☐ KONFIGURACJA_SPRZĘTOWA.md (30 min) - Szczegóły techniczne

Budowanie urządzenia?
☐ QUICK_REFERENCE.md → Checklist montażu
☐ SCHEMAT_POLACZEN_FIZYCZNYCH.md → Krok po kroku
☐ SCHEMAT_POLACZEN_FIZYCZNYCH.md → Rezystory pull-up
☐ QUICK_REFERENCE.md → Diagnostyka

Problem do rozwiązania?
☐ SCHEMAT_POLACZEN_FIZYCZNYCH.md → Notatki praktyczne
☐ QUICK_REFERENCE.md → Diagnostyka
☐ KONFIGURACJA_SPRZĘTOWA.md → Specyfikacja problematycznego sensora
```

---

**Indeks Dokumentacji v1.0** | Czerwiec 2026 | Projekt SeedIoT  
*Ostatnia aktualizacja: Czerwiec 2026*

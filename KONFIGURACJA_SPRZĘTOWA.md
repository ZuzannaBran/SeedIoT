# SeedIoT — architektura sprzętowa

Dokument opisuje konfigurację odzwierciedloną w firmware. Źródłem prawdy dla numerów GPIO, adresów czujników i interwałów są odpowiednio [sensor_pins.py](codebase/rpi-code/sensor_pins.py) oraz [settings.py](codebase/rpi-code/settings.py). Przed montażem należy sprawdzić oznaczenia użytych modułów.

## Platforma

Kontroler: **Raspberry Pi Pico W / Pico WH (RP2040)** z MicroPython. Łączność Wi-Fi i BLE wymaga wersji płytki wyposażonej w radio oraz kompatybilnego firmware. Zwykły Raspberry Pi Pico (bez W) nie zapewnia tych interfejsów.

Firmware działa bez systemu operacyjnego Linux. Odpowiada za pomiary, parowanie BLE, wysyłkę HTTP i sterowanie zasilaniem przez opcjonalny układ TPL5110.

## Podłączone interfejsy

| Element | Połączenie | Adres / GPIO |
| --- | --- | --- |
| BME280 | I2C0, SDA GP4 / SCL GP5 | 0x77 |
| LTR559 | I2C0, SDA GP4 / SCL GP5 | 0x23 |
| SCD41 | I2C0, SDA GP4 / SCL GP5 | 0x62 |
| LCD 16×2 przez PCF8574 | I2C0, SDA GP4 / SCL GP5 | 0x27 (konfigurowalny) |
| BME680 | programowy I2C, SDA GP11 / SCL GP12 | 0x77 |
| DS18B20 | OneWire | GP28 |
| Wilgotność gleby | ADC | GP27 |
| Kierunek wiatru | ADC | GP26 |
| Anemometr | wejście impulsowe | GP9 |
| Opadomierz | wejście impulsowe | GP10 |
| TPL5110 DONE | wyjście cyfrowe | GP15 |

Obie magistrale I2C pracują w konfiguracji programu z częstotliwością 100 kHz. Identyczny adres 0x77 dla BME280 i BME680 nie powoduje konfliktu, ponieważ urządzenia znajdują się na osobnych magistralach.

## Funkcje oprogramowania

- Odczyty są grupowane w strukturę `payload.readings`; nieobecne sensory mogą zwracać `null` lub informację o błędzie.
- Bazowy krok pomiarowy `BASE_INTERVAL_MS` wynosi 10 000 ms, a częstotliwości poszczególnych czujników definiuje `SENSOR_READ_MULTIPLIERS`.
- Firmware posiada profile `AUTO`, `IDLE`, `WIFI`, `BLE` i `SENSORS`. Szczegóły w [README firmware](codebase/rpi-code/README.md).
- W profilu AUTO raport jest wysyłany po przekroczeniu progów zmian względem ostatniego poprawnie wysłanego odczytu.
- Ustawienia `TPL5110_ENABLED` i parametrów czasowych znajdują się w `settings.py`. Sterownik zgłasza `DONE` na GP15; skuteczne odcięcie zasilania zależy od prawidłowego połączenia modułu TPL5110.

## Zasilanie i bezpieczeństwo elektryczne

- GPIO układu RP2040 pracują z logiką **3,3 V i nie są odporne na 5 V**. Każda linia sygnałowa z modułu zasilanego napięciem 5 V wymaga sprawdzenia poziomu logicznego; może być niezbędny konwerter poziomów.
- Nie podłączaj 5–12 V bezpośrednio do pinu 3V3(OUT) ani do wejść GPIO. Zakres zasilania VSYS i warunki zasilania pozostałych modułów sprawdź w kartach katalogowych.
- Szczególnej uwagi wymaga wyświetlacz LCD z ekspanderem PCF8574: sposób zasilania i podciągania SDA/SCL zależy od konkretnej płytki.
- Rezystor podciągający OneWire (typowo 4,7 kΩ do 3,3 V) i rezystory I2C należy dobrać do rzeczywistej magistrali oraz wyposażenia breakoutów.
- Konfiguracja TPL5110 w repozytorium jest **konfiguracją programową**, nie pomiarem poboru energii ani potwierdzeniem autonomicznego czasu pracy.

## Status weryfikacji

Mapa GPIO i konfiguracja firmware zostały zestawione z plikami źródłowymi. Nie potwierdza to fizycznych połączeń, dokładności kalibracji, odporności środowiskowej ani wyniku testów energetycznych. Przed uruchomieniem zastosuj [procedurę kontroli okablowania](SCHEMAT_POLACZEN_FIZYCZNYCH.md).

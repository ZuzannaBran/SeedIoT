# SeedIot RPi Firmware

## 1. Opis
Ten projekt to firmware napisany w `MicroPython` dla płytki `Raspberry Pi Pico / Pico W`, której zadaniem jest obsługa stacji pomiarowej. Urządzenie zbiera dane z kilku czujników środowiskowych i glebowych, a następnie może wysyłać je do zewnętrznego serwera przez Wi‑Fi.

Kod został przygotowany tak, żeby działał bez rozbudowanego systemu operacyjnego, bez kontenerów i bez dodatkowego backendu na samym urządzeniu. Cała logika działa bezpośrednio na mikrokontrolerze.

Firmware obsługuje dwa główne scenariusze:
- normalną pracę stacji pomiarowej
- tryby testerskie uruchamiane z terminala szeregowego

Przy pierwszym uruchomieniu urządzenie może wejść w tryb konfiguracji przez `BLE`, aby ustawić:
- nazwę sieci Wi‑Fi
- hasło do Wi‑Fi
- identyfikator stacji
- klucz API
- adres serwera

Po zapisaniu konfiguracji urządzenie potrafi:
- inicjalizować dostępne czujniki
- odczytywać ich wartości
- budować wspólny payload JSON
- wysyłać dane metodą `POST` do endpointu `/station-report`

Projekt jest przydatny zarówno do docelowej pracy pomiarowej, jak i do testów hardware'u, bo można ręcznie przełączać profile energetyczne i tryby działania, np. samo `Wi‑Fi`, samo `BLE`, sam odczyt czujników albo tryb bezczynności.

## 2. Frameworki i technologie
Projekt nie używa klasycznego frameworka aplikacyjnego w stylu webowym. To kod firmware działający na mikrokontrolerze. Najważniejsze elementy technologiczne to:

- `MicroPython` jako środowisko uruchomieniowe
- `Raspberry Pi Pico / Pico W` jako platforma sprzętowa
- `BLE` do konfiguracji urządzenia przy pierwszym uruchomieniu
- `Wi‑Fi` do komunikacji z API
- `HTTP + JSON` do wysyłania raportów
- `I2C` do komunikacji z częścią sensorów
- `I2C` do obsługi wyświetlacza LCD 16x2 z ekspanderem PCF8574
- `ADC` do odczytu czujników analogowych
- `OneWire` do obsługi `DS18B20`

W praktyce projekt bazuje głównie na:
- modułach systemowych MicroPython, np. `machine`, `network`, `time`, `os`
- prostych sterownikach sensorów w katalogu `sensors/`
- własnej logice sterowania w `main.py`

## 3. Czujniki i ich podpięcie
Aktualna mapa pinów znajduje się w pliku `sensor_pins.py`. To jest najważniejsze miejsce, jeśli chcesz zmienić okablowanie albo dopasować projekt do innej wersji płytki lub modułów.

### Magistrala I2C
Wspólna magistrala I2C została ustawiona tak:
- `I2C_BUS_ID = 0`
- `SDA = GPIO 4`
- `SCL = GPIO 5`

Na tej magistrali działają między innymi:
- `LTR559`
- `BME280`
- `SCD41`
- RTC z wcześniejszej logiki `enviro`, chociaż główny firmware już z tego nie korzysta

### BME680
`BME680` w tej konfiguracji używa osobnej magistrali `SoftI2C`:
- `SDA = GPIO 11`
- `SCL = GPIO 12`

To ważne, bo ten czujnik nie jest wpięty tak samo jak reszta I2C.

### Soil moisture
Czujnik wilgotności gleby jest czytany analogowo:
- `ADC pin = GPIO 27`

W kodzie są też ustawione progi kalibracji:
- `dry = 1800`
- `wet = 58000`

Na tej podstawie wyliczany jest procent wilgotności. Jeśli zmienisz sensor albo sposób zasilania, te wartości prawdopodobnie trzeba będzie skalibrować ponownie.

### DS18B20
Czujnik temperatury `DS18B20` jest podpięty do:
- `GPIO 28`

To czujnik `OneWire`, więc powinien mieć poprawne podłączenie zgodne z tym standardem, zwykle razem z rezystorem podciągającym.

### Wiatr i deszcz
Piny dla części pogodowej:
- prędkość wiatru: `GPIO 9`
- deszczomierz: `GPIO 10`
- kierunek wiatru analogowo: `GPIO 26`

W projekcie jest współdzielony obiekt `WindMeter`, z którego korzysta zarówno moduł od wiatru, jak i od opadów.

### Lista obsługiwanych sensorów
Firmware próbuje inicjalizować:
- `SoilMoistureSensor`
- `DS18B20Sensor`
- `BME280Sensor`
- `BME680Sensor`
- `LTR559Sensor`
- `SCD41Sensor`
- `WindSensor`
- `RainSensor`

Jeśli któryś sensor nie jest dostępny, kod nie powinien od razu wywrócić całego programu. Zamiast tego zapisuje informację, że dany moduł jest niedostępny i kontynuuje pracę z pozostałymi.

## 4. Struktura kodu
Najważniejsze pliki i katalogi:

- `main.py`
  Główna pętla programu. Tutaj znajduje się:
  - start firmware
  - ładowanie konfiguracji
  - tryb BLE do parowania
  - logika Wi‑Fi
  - zbieranie danych z czujników
  - upload danych do API
  - tryby testerskie `energy:n`

- `main_test.py`
  Wersja developerska uruchamiana w trybie testowym:
  - bez BLE
  - bez uploadu do API
  - z lokalnym logowaniem odczytów w terminalu

- `lcd_display.py`
  Obsługa wyświetlacza LCD 16x2 po I2C. Moduł pokazuje kolejne wartości z ostatniego payloadu pomiarowego, zmieniając ekran co kilka sekund.

- `ble.py`
  Obsługa BLE używana do konfiguracji urządzenia. Ten moduł tworzy usługę GATT, odbiera komendy konfiguracyjne i odsyła potwierdzenia `ACK` albo `ERR`.

- `sensor_pins.py`
  Jedno centralne miejsce z mapą pinów, adresów I2C i stałych konfiguracyjnych dla hardware'u.

- `sensors/`
  Katalog z warstwą sensorów. Są tu zarówno cienkie wrappery typu `read()`, jak i sterowniki niższego poziomu.

- `soil/`
  Pomocnicze skrypty do prostych testów i kalibracji czujnika wilgotności gleby.

- `enviro_sleep.py`
  Stary moduł związany z RTC i uśpieniem. Obecnie główny firmware nie przechodzi już w ten tryb, ale plik nadal leży w repo.

### Jak działa przepływ programu
W skrócie:
1. `main.py` startuje
2. sprawdzany jest `config.json`
3. jeśli konfiguracji nie ma, uruchamia się `BLE`
4. jeśli konfiguracja istnieje, inicjalizowane są czujniki
5. urządzenie może połączyć się z `Wi‑Fi`
6. budowany jest payload z odczytami
7. dane są wysyłane do serwera
8. pętla trwa dalej

## 5. Tryby działania
Projekt ma obecnie dwa poziomy działania: normalny tryb firmware oraz tryby testerskie.

### Tryb normalny
To jest standardowa logika działania stacji:
- jeśli nie ma `config.json`, urządzenie czeka na konfigurację przez `BLE`
- jeśli konfiguracja jest dostępna, przechodzi do zbierania danych i wysyłki

W trybie automatycznym firmware:
- ładuje konfigurację
- inicjalizuje sensory
- łączy się z Wi‑Fi
- wykonuje serię pomiarów
- wysyła dane do API
- pozostaje aktywny

### Tryby testerskie
Dla testerów została dodana obsługa komend z terminala szeregowego. Po uruchomieniu firmware przez kilka sekund można wybrać profil, a później także przełączać go w trakcie działania.

Dostępne komendy:
- `help`
- `status`
- `energy:0`
- `energy:1`
- `energy:2`
- `energy:3`
- `energy:4`

Znaczenie profili:

- `energy:0`
  Powrót do normalnego trybu `AUTO`.

- `energy:1`
  Tryb `IDLE`. Wyłączane są aktywne elementy robocze. To profil do pomiaru zachowania urządzenia w możliwie spokojnym stanie.

- `energy:2`
  Tryb `WIFI`. Firmware utrzymuje połączenie Wi‑Fi i raportuje status tego połączenia. To jest przydatne do testów poboru energii lub stabilności komunikacji radiowej bez udziału sensorów i BLE.

- `energy:3`
  Tryb `BLE`. Urządzenie uruchamia reklamowanie BLE i może być wykrywane przez aplikację lub telefon. To jest dobry tryb do testów provisioningu i pomiarów poboru energii przy aktywnym BLE.

- `energy:4`
  Tryb `SENSORS`. Firmware inicjalizuje sensory i cyklicznie wykonuje odczyt, wypisując payload do terminala. Bez wysyłki do API i bez utrzymywania BLE.

### Ważna uwaga o profilach
Samo wpisanie `energy:n` nie tylko zapisuje wybór, ale faktycznie przełącza działanie programu. To znaczy:
- `energy:2` uruchamia logikę Wi‑Fi
- `energy:3` uruchamia BLE
- `energy:4` uruchamia odczyty z czujników

To są realne tryby robocze, a nie tylko etykiety konfiguracyjne.

## 6. Odpalenie i co trzeba zmienić
### Co jest potrzebne
Do uruchomienia potrzebujesz:
- płytki `Raspberry Pi Pico` albo `Pico W`
- wgranego `MicroPython`
- skopiowanych plików projektu na filesystem urządzenia
- poprawnie podłączonych sensorów

### Co wrzucić na urządzenie
Na płytce powinny znaleźć się co najmniej:
- `main.py`
- `ble.py`
- `lcd_display.py`
- `settings.py`
- `sensor_pins.py`
- katalog `sensors/`

Opcjonalnie mogą zostać też pliki pomocnicze, np. z `soil/`, ale nie są wymagane do głównej pracy firmware.

### Czy trzeba coś zmieniać przed uruchomieniem
To zależy od sprzętu:

- jeśli piny w Twoim układzie są takie same jak w `sensor_pins.py`, to nie trzeba nic zmieniać
- jeśli masz inne podpięcie, zmień `sensor_pins.py`
- jeśli masz inny czujnik wilgotności gleby, skalibruj ponownie wartości `dry` i `wet`
- jeśli nie używasz wszystkich sensorów, nic nie szkodzi, firmware i tak spróbuje uruchomić tylko to, co jest dostępne

### Pierwszy start
Przy pierwszym starcie:
- jeśli nie ma pliku `config.json`, urządzenie wejdzie w tryb BLE
- wtedy trzeba przesłać konfigurację

Po zapisaniu konfiguracji firmware może przejść do normalnej pracy i wysyłania danych do serwera.

### Uruchomienie dla testerów
Jeśli chcesz testować profile:
1. uruchom urządzenie
2. otwórz terminal szeregowy
3. wpisz `energy:n` dla wybranego profilu

Przydatne komendy:
- `status` pokazuje bieżący stan
- `help` wypisuje listę komend

### Harmonogram odczytow czujnikow (settings.py)
Interwaly odczytow sa teraz konfigurowane w `settings.py`:
- `BASE_INTERVAL_MS` - podstawowy krok czasu
- `SENSOR_READ_MULTIPLIERS` - mnozniki dla kazdego czujnika

Efektywny interwal to:
- `interwal_czujnika = BASE_INTERVAL_MS * multiplier`

Przyklad:
- `BASE_INTERVAL_MS = 10000`
- `ds18b20 = 2` oznacza odczyt co `20000 ms`

### LCD 16x2 po I2C
Firmware obsługuje opcjonalny wyświetlacz LCD 16x2 z ekspanderem PCF8574. Domyślny adres I2C to `0x27`, a piny magistrali są takie same jak dla głównego I2C:
- `SDA = GPIO 4`
- `SCL = GPIO 5`

Po zebraniu payloadu z czujników wyświetlacz pokazuje jedną wartość pomiarową naraz i automatycznie przełącza się na kolejną co kilka sekund. Interwał przełączania można zmienić w `settings.py` przez `LCD_PAGE_INTERVAL_MS`, a całą obsługę można wyłączyć przez `LCD_DISPLAY_ENABLED = False`.

Jeśli używany moduł LCD ma inny adres, zmień `LCD_I2C_ADDRESS` w `sensor_pins.py`, najczęściej na `0x27` albo `0x3F`.

### TPL5110 (odcinanie zasilania poza czasem pracy)
Firmware ma obsluge TPL5110 w trybie pelnym (`FULL`) i profilu `AUTO`.

Konfiguracja w `settings.py`:
- `TPL5110_ENABLED`
- `TPL5110_DONE_PIN`
- `TPL5110_DONE_PULSE_MS`
- `TPL5110_ON_WINDOW_MS`
- `TPL5110_SENSOR_READ_BUFFER_MS`
- `TPL5110_WIFI_UPLOAD_BUFFER_MS`

Zasada:
- gdy firmware konczy prace i wchodzi w okres bez odczytu, wysyla sygnal `DONE`
- TPL5110 odcina wtedy zasilanie calego ukladu
- przed uploadem firmware sprawdza budzet czasu (okno TPL5110 minus bufory), aby zdazyc pobrac dane i opcjonalnie wyslac Wi-Fi

### Tryby uruchomienia po podziale plikow
- `main.py` - build produkcyjny (domyslny), bez wyboru 1/2 w terminalu
- `main_test.py` - build developerski w trybie testowym (bez BLE i bez uploadu HTTP)

Do szybkiego testu lokalnego użyj `mpremote`:
1. przejdź do katalogu:
   - `cd C:\Users\p4tkr\Documents\projekt-6\codebase\rpi-code`
2. (jednorazowo) zainstaluj narzędzie:
   - `pip install mpremote`
3. wgraj pliki na urządzenie:
   - `mpremote fs cp main.py :main.py`
   - `mpremote fs cp ble.py :ble.py`
   - `mpremote fs cp lcd_display.py :lcd_display.py`
   - `mpremote fs cp settings.py :settings.py`
   - `mpremote fs cp sensor_pins.py :sensor_pins.py`
   - `mpremote fs cp -r sensors :sensors`
4. uruchom build produkcyjny:
   - `mpremote run main.py`
5. uruchom build developerski:
   - `mpremote run main_test.py`

## 7. Inne informacje
### Konfiguracja urządzenia
Plik `config.json` musi zawierać:
- `ssid`
- `passwd`
- `apiKey`
- `stationId`
- `serverUrl`

Jeśli plik jest uszkodzony albo nie ma wymaganych pól, firmware traktuje go jako błędny i przechodzi z powrotem do logiki konfiguracji.

### API
Dane są wysyłane na:

`{serverUrl}/station-report`

Nagłówki używane przy wysyłce:
- `Content-Type: application/json`
- `x-station-id`
- `x-station-key`

Payload zawiera słownik `readings`, w którym dla każdego czujnika pojawia się osobny obiekt z odczytem albo `null`, jeśli czujnik nie został uruchomiony.

### Zachowanie przy błędach
Kod stara się nie przerywać pracy przy pierwszym problemie. Typowe zachowania:
- brak pojedynczego sensora nie zatrzymuje całego systemu
- błędy odczytu są logowane
- błędy połączenia Wi‑Fi są logowane
- błędy HTTP są logowane

To jest dobre do developmentu i testów, bo łatwiej zobaczyć stan całego urządzenia, zamiast kończyć program przy pierwszym wyjątku.

### Obecny stan logiki zasilania
W głównym przepływie została usunięta automatyczna logika `enviro_sleep`. To oznacza, że firmware po wykonaniu cyklu nie przechodzi już w tryb RTC sleep, tylko zostaje aktywny.

To upraszcza:
- debugowanie
- testy przez terminal
- pomiary zachowania w różnych profilach

Ale jednocześnie oznacza, że jeśli celem będzie później bardzo niski pobór energii w pracy bateryjnej, to logikę oszczędzania energii trzeba będzie jeszcze zaprojektować osobno.

### Gdzie najlepiej zaczynać zmiany
Jeśli chcesz rozwijać projekt, najczęściej zaczniesz od jednego z tych miejsc:
- `main.py` jeśli chcesz zmieniać przepływ działania
- `sensor_pins.py` jeśli zmieniasz hardware
- `sensors/` jeśli dodajesz nowy czujnik albo poprawiasz sterownik
- `ble.py` jeśli chcesz rozszerzyć konfigurację przez BLE

# SeedIoT — firmware stacji pomiarowej

Firmware dla Raspberry Pi Pico W / Pico WH oparty na **MicroPython**. Obsługuje czujniki, lokalne pomiary, konfigurację przez Bluetooth LE, komunikację Wi-Fi/HTTP oraz opcjonalne zarządzanie zasilaniem przez TPL5110.

## Wymagania

- Raspberry Pi Pico **W** lub **WH** z wersją MicroPython obsługującą radio Wi-Fi i BLE.
- Czujniki podłączone zgodnie z [mapą GPIO](../../SCHEMAT_POLACZEN_FIZYCZNYCH.md).
- Python oraz narzędzie `mpremote` na komputerze programisty.
- Dostęp do serwera API SeedIoT, jeśli planowana jest wysyłka raportów.

Zwykły Pico bez W nie obsłuży komunikacji bezprzewodowej zastosowanej w projekcie.

## Struktura

| Plik / katalog | Rola |
| --- | --- |
| `main.py` | Główna pętla, pomiary, BLE, Wi-Fi, raportowanie, profile energetyczne |
| `main_test.py` | Punkt wejścia do testów lokalnych bez BLE i wysyłki HTTP |
| `sensor_pins.py` | Mapa GPIO, I2C, adresów i wartości kalibracyjnych |
| `settings.py` | Harmonogram pomiarów, TPL5110, LCD |
| `sensors/` | Warstwa odczytów i sterowniki czujników |
| `ble.py` | Konfiguracja stacji przez usługę BLE GATT |
| `lcd_display.py` | Obsługa opcjonalnego LCD 16×2 |
| `tpl5110_power.py` | Impuls DONE do kontrolera zasilania |
| `soil/` | Pomocnicze skrypty kalibracji wilgotności gleby |

## Wgrywanie i uruchomienie

W katalogu `codebase/rpi-code`:

~~~bash
python -m pip install mpremote
mpremote fs cp main.py :main.py
mpremote fs cp main_test.py :main_test.py
mpremote fs cp ble.py :ble.py
mpremote fs cp lcd_display.py :lcd_display.py
mpremote fs cp tpl5110_power.py :tpl5110_power.py
mpremote fs cp settings.py :settings.py
mpremote fs cp sensor_pins.py :sensor_pins.py
mpremote fs cp -r sensors :sensors
~~~

Przed pierwszym uruchomieniem sprawdź `sensor_pins.py` i `settings.py`. Jeśli nie masz fizycznie podłączonego TPL5110, ustaw `TPL5110_ENABLED = False` w `settings.py`. Obsługa `urequests` musi być dostępna w użytej wersji MicroPython.

Aby uruchomić główny firmware, użyj `mpremote run main.py` albo zresetuj płytkę z zapisanym plikiem `main.py`. Do testu pomiarów bez rejestracji stacji użyj `mpremote run main_test.py`.

## Pierwsza konfiguracja

Gdy na urządzeniu nie ma poprawnego `config.json`, główny firmware uruchamia usługę BLE. Aplikacja mobilna przesyła polecenia konfiguracyjne dotyczące nazwy i hasła Wi-Fi, identyfikatora stacji, klucza API oraz adresu backendu. Po ich zaakceptowaniu zapisywany jest `config.json`.

Przykładowa struktura pliku — wartości są fikcyjne:

~~~json
{
  "ssid": "WiFi-Example",
  "passwd": "replace-me",
  "apiKey": "station-api-key",
  "stationId": "station-id",
  "serverUrl": "http://192.168.1.10:3000"
}
~~~

Plik zawiera dane uwierzytelniające. **Nie dodawaj go do repozytorium ani nie publikuj jego zawartości w logach.** Adres serwera musi być dostępny z sieci urządzenia; `localhost` nie wskazuje backendu działającego na innym komputerze.

## Pomiary i API

- Każdy odczyt może mieć inny interwał: `BASE_INTERVAL_MS * SENSOR_READ_MULTIPLIERS[nazwa]`.
- Raport HTTP trafia do `POST /station-report` jako JSON z polem `payload.readings`.
- Nagłówki `x-station-id` i `x-station-key` autoryzują urządzenie w backendzie.
- Firmware przechowuje ostatni skutecznie wysłany payload i ogranicza wysyłkę, gdy różnice mieszczą się w skonfigurowanych progach.

Domyślne parametry pomiarów, próg wysyłki, praca TPL5110 i dostępność poszczególnych czujników wymagają sprawdzenia na rzeczywistym stanowisku.

## Profile diagnostyczne

Z terminala szeregowego dostępne są: `help`, `status`, `energy:0` (AUTO), `energy:1` (IDLE), `energy:2` (WIFI), `energy:3` (BLE), `energy:4` (SENSORS). W `main_test.py` BLE i przesyłanie raportów są wyłączone.

## Weryfikacja

1. Zeskanuj obie magistrale I2C, zgodnie z [instrukcją montażu](../../SCHEMAT_POLACZEN_FIZYCZNYCH.md).
2. Sprawdź odczyty w trybie `main_test.py`.
3. Skalibruj czujnik gleby i czujniki pogodowe na konkretnej instalacji.
4. Dopiero potem sprawdź BLE, Wi-Fi, rejestrację i zapis raportów w API.
5. Sprawdź na fizycznym układzie cykl TPL5110, jeśli moduł jest używany.

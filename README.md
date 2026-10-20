# SeedIoT

**SeedIoT** to zespołowy projekt systemu monitorowania warunków upraw. Łączy stację pomiarową opartą na Raspberry Pi Pico W, API obsługujące użytkowników i pomiary oraz aplikację mobilną do zarządzania stacjami i analizy odczytów.

Projekt obejmuje firmware, backend, interfejs mobilny, dokumentację sprzętową i modele elementów obudowy. Kod ma charakter projektu inżynierskiego; przed wdrożeniem terenowym wymagane są testy integracyjne, kalibracja czujników i weryfikacja zasilania.

## Architektura

~~~text
Czujniki środowiskowe i glebowe
              |
     Raspberry Pi Pico W
       MicroPython, BLE
              |
         Wi-Fi / HTTP
              |
       API NestJS (JWT)
              |
          PostgreSQL
              |
   Aplikacja React Native / Expo
~~~

1. Firmware zbiera dane z czujników, udostępnia konfigurację przez BLE i wysyła raporty HTTP.
2. API odpowiada za konta użytkowników, rejestrowanie stacji, uwierzytelnianie urządzeń i historię pomiarów.
3. Aplikacja umożliwia logowanie, dodawanie stacji, parowanie przez BLE oraz przegląd danych pomiarowych.

## Technologie

| Warstwa | Technologie | Lokalizacja |
| --- | --- | --- |
| Firmware | MicroPython, I2C, OneWire, ADC, BLE, Wi-Fi | [codebase/rpi-code](codebase/rpi-code) |
| Backend | TypeScript, NestJS, PostgreSQL, REST, JWT, Swagger | [codebase/seediot-server](codebase/seediot-server) |
| Aplikacja mobilna | React Native, Expo, TypeScript, Expo Router | [codebase/seediot-ui](codebase/seediot-ui) |
| Eksperymenty z czujnikami | Przykładowe programy MicroPython | [codebase/sensors-use-example](codebase/sensors-use-example) |

## Dokumentacja i uruchamianie

- [Firmware: konfiguracja, tryby pracy i testowanie](codebase/rpi-code/README.md)
- [Backend: konfiguracja PostgreSQL i uruchomienie API](codebase/seediot-server/README.md)
- [Aplikacja: uruchomienie i połączenie z API](codebase/seediot-ui/README.md)
- [Architektura i konfiguracja sprzętowa](KONFIGURACJA_SPRZĘTOWA.md)
- [Mapa połączeń oraz procedura weryfikacji](SCHEMAT_POLACZEN_FIZYCZNYCH.md)

Dodatkowe materiały: [raporty projektowe](raporty) (PDF), [modele CAD](druk3d) (Fusion 360) i skrypty generowania raportów w katalogu głównym. Pliki PDF i CAD są artefaktami projektu, a nie instrukcją uruchomienia.

## Stan i ograniczenia

- Repozytorium zawiera implementacje poszczególnych komponentów. Ich obecność nie oznacza zakończonej walidacji całego rozwiązania w warunkach terenowych.
- Backend wymaga uruchomionej bazy PostgreSQL. Repozytorium nie zawiera pliku Docker Compose ani Dockerfile.
- Parowanie BLE i dostęp do Wi-Fi korzystają z natywnych modułów mobilnych; nie należy zakładać ich działania w Expo Go.
- Połączenia sprzętowe trzeba zweryfikować z dokumentacją konkretnych modułów. Szczególnie ważne są poziomy napięć magistrali I2C oraz konfiguracja TPL5110.
- Przed udostępnieniem systemu w sieci publicznej należy skonfigurować HTTPS, bezpieczne sekrety JWT oraz ochronę i monitoring API.

## Zespół

Patryk Rusak, Zuzanna Baran, Alicja Ciepielska, Nguyen Anh Do, Antoni Kucisz.

# SeedIoT — aplikacja mobilna

Aplikacja w **React Native, Expo i TypeScript**. Zawiera logowanie i rejestrację, panel stacji, kreator konfiguracji urządzenia przez Bluetooth LE i widoki raportów pomiarowych.

## Wymagania

- Node.js i npm zgodne z zależnościami aplikacji.
- Działający backend SeedIoT; instrukcja znajduje się w [README API](../seediot-server/README.md).
- Dla BLE i zarządzania sieciami Wi-Fi: natywny build Android/iOS oraz odpowiednie uprawnienia systemowe.

**Expo Go nie zapewnia wymaganych niestandardowych modułów BLE i Wi-Fi.** Na potrzeby parowania użyj zbudowanej aplikacji, nie samej sesji w Expo Go. Niektóre funkcje skanowania Wi-Fi są dostępne tylko na Androidzie.

## Konfiguracja

W katalogu `codebase/seediot-ui`:

~~~bash
npm ci
~~~

Utwórz lokalny plik `.env` z adresem backendu dostępnym zarówno z telefonu, jak i z Pico W:

~~~dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
~~~

Adres jest przykładowy. Urządzenia muszą mieć połączenie sieciowe z podanym hostem. W aplikacji istnieje mechanizm automatycznego wykrywania adresu serwera w trybie developerskim, ale jawne ustawienie `EXPO_PUBLIC_API_URL` jest bardziej przewidywalne. Nie używaj `localhost`, jeśli serwer działa na innym urządzeniu.

Zmienne `EXPO_PUBLIC_*` trafiają do aplikacji klienckiej i nie mogą zawierać sekretów.

## Uruchamianie

~~~bash
npm start
npm run android
~~~

Na macOS, z wymaganym środowiskiem Xcode, można użyć `npm run ios`. Komendy `android` i `ios` budują aplikację z natywnymi integracjami. Nie każda funkcja będzie działała na symulatorze bez fizycznego Bluetooth i Wi-Fi.

Kontrola statyczna:

~~~bash
npm run lint
npm run typecheck
~~~

## Główne moduły

| Ścieżka | Funkcja |
| --- | --- |
| `app/onboard.tsx` | Ekran powitalny, logowanie i rejestracja |
| `app/dashboard.tsx` | Lista i przegląd stacji |
| `app/pair.tsx` | Parowanie, BLE i konfiguracja Wi-Fi |
| `app/station/[id].tsx` | Szczegóły stacji i wykresy |
| `app/station/[id]/raw.tsx` | Dane raportów w postaci surowej |
| `lib/auth-api.ts` | Klient API i wybór adresu backendu |
| `lib/session.ts` | Przechowywanie sesji |
| `constants/strings.ts` | Teksty i stałe interfejsu |

## Typowy scenariusz

1. Uruchom backend i aplikację w tej samej dostępnej sieci.
2. Zarejestruj konto albo zaloguj się.
3. Utwórz stację i zachowaj otrzymany jednorazowo klucz.
4. Przeprowadź parowanie BLE i konfigurację Wi-Fi urządzenia.
5. Zweryfikuj nadejście pomiarów na ekranie stacji i w API.

Do wersji produkcyjnej używaj HTTPS; adres IP i HTTP w przykładach są przeznaczone do lokalnych testów.

# SeedIoT — backend API

API w **NestJS** i **TypeScript**, z bazą **PostgreSQL**. Odpowiada za rejestrację i logowanie użytkowników, zarządzanie stacjami oraz przechowywanie historii odczytów. Interfejs OpenAPI (Swagger) jest dostępny pod `/api`.

## Wymagania

- Node.js w wersji LTS kompatybilnej z użytymi zależnościami, npm.
- Działający PostgreSQL, do którego aplikacja może się połączyć.

Repozytorium **nie zawiera** `docker-compose.yml` ani `Dockerfile`. Bazę danych uruchamia się niezależnie od backendu, np. lokalnie lub w kontenerze.

## Uruchomienie lokalne

W katalogu `codebase/seediot-server`:

~~~bash
cp .env.example .env
npm ci
npm run start:dev
~~~

Przed uruchomieniem edytuj `.env`, ustaw odpowiednie dane PostgreSQL i **własne, losowo wygenerowane wartości** `JWT_ACCESS_SECRET` oraz `JWT_REFRESH_SECRET`. Wzorcowe sekrety z pliku `.env.example` nie nadają się do środowiska publicznego.

Jeżeli nie masz lokalnej instancji PostgreSQL, możesz tymczasowo uruchomić bazę w osobnym kontenerze (Docker jest opcjonalny):

~~~bash
docker run --name seediot-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=seediot -p 5432:5432 -d postgres:16
~~~

Podany przykład bazy i hasła służy **wyłącznie do lokalnego developmentu**. Wartości w `.env.example` zakładają host `localhost`, port `5432` i bazę `seediot`. Serwis tworzy wymagane tabele przy inicjalizacji połączenia. W przypadku niedostępnej bazy może uruchomić się mimo ostrzeżenia, ale operacje bazodanowe nie będą działać.

## Najważniejsze endpointy

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| GET | `/` | Odpowiedź testowa |
| GET | `/health` | Status API i dostępności bazy |
| POST | `/auth/register` | Rejestracja |
| POST | `/auth/login` | Logowanie |
| POST | `/auth/refresh` | Odświeżenie tokenu |
| GET | `/auth/me` | Profil użytkownika (JWT) |
| POST | `/stations` | Utworzenie stacji; klucz API zwracany jednorazowo |
| GET | `/stations` | Lista własnych stacji (JWT) |
| GET | `/stations/:id/reports` | Historia z paginacją i filtrami dat (JWT) |
| DELETE | `/stations/:id` | Usunięcie własnej stacji (JWT) |
| POST | `/station-report` | Raport urządzenia; nagłówki `x-station-id` i `x-station-key` |

Raport urządzenia:

~~~json
{
  "payload": {
    "readings": {
      "soil_moisture": { "moisture_percent": 46.2 }
    }
  }
}
~~~

Pełny kontrakt żądań i walidacja pól są określone przez kontrolery, DTO i Swagger UI pod `http://localhost:3000/api`.

## Polecenia deweloperskie

~~~bash
npm run build
npm run lint:check
npm test -- --runInBand
npm run test:e2e
~~~

Testy end-to-end wymagają środowiska zgodnego z konfiguracją serwera. Testy i build należy przeprowadzić po instalacji zależności; samo istnienie skryptów nie potwierdza ich poprawnego wykonania.

## Bezpieczeństwo

- Nie zapisuj rzeczywistych sekretów do Git; plik `.env` jest ignorowany.
- Produkcja wymaga HTTPS, zaufanej bazy, mocnych sekretów, ograniczenia dostępu i monitoringu.
- Klucz stacji jest zwracany tylko podczas tworzenia; backend zapisuje jego hash.
- Identyfikatory użytkowników i stacji są kontrolowane w endpointach wymagających autoryzacji.

Kod: `src/auth/`, `src/stations/`, `src/database/`.

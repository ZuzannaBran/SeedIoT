# Seediot Server

## Wstep

Ten serwer to backend API dla projektu SeedIoT. Odpowiada za uwierzytelnianie uzytkownikow, zarzadzanie stacjami oraz przyjmowanie raportow z czujnikow. Udostepnia tez Swagger UI do testowania endpointow.

## Technologie uzywane

- Node.js + npm
- NestJS (framework backendowy)
- PostgreSQL (baza danych)
- Docker + Docker Compose (uruchamianie lokalnej infrastruktury)

## Struktura projektu

- `src/` - glowny kod aplikacji
- `src/main.ts` - wejscie aplikacji i konfiguracja serwera
- `src/app.module.ts` - glowny modul aplikacji
- `src/auth/` - logika logowania, rejestracji i JWT
- `src/stations/` - logika stacji i raportow
- `src/database/` - konfiguracja polaczenia z baza
- `test/` - testy e2e
- `dist/` - build po kompilacji TypeScript
- `docker-compose.yml` - lokalny Postgres i uslugi kontenerowe
- `Dockerfile` - obraz aplikacji
- `.env.example` - przykladowe zmienne srodowiskowe

## Uruchomienie

Ponizej sa dwie opcje: cala aplikacja w Dockerze albo lokalnie z Postgres w Dockerze.

### Wymagania

- Node.js (zalecane LTS)
- npm
- Docker + Docker Compose

### Opcja 1: Caly stack w Docker Compose

1. Skopiuj plik srodowiskowy:

```powershell
Copy-Item .env.example .env
```

2. Zbuduj i uruchom kontenery:

```bash
docker compose up --build -d
```

3. Otworz:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api`

### Opcja 2: Postgres w Dockerze, aplikacja lokalnie

1. Skopiuj plik srodowiskowy:

```powershell
Copy-Item .env.example .env
```

2. Uruchom Postgresa:

```bash
npm run db:up
```

3. Zainstaluj zaleznosci:

```bash
npm install
```

4. Uruchom aplikacje:

```bash
npm run start:dev
```

## Konfiguracja srodowiska

Aplikacja czyta ustawienia z pliku `.env`. Domyslne lokalne wartosci z `.env.example`:

- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=seediot`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seediot`
- `JWT_ACCESS_SECRET=change-me-access`
- `JWT_REFRESH_SECRET=change-me-refresh`

W Docker Compose backend laczy sie z Postgres przez hostname `postgres`.

## Dostepne endpointy (skrót)

- `GET /` - prosty endpoint testowy
- `GET /health` - status aplikacji i polaczenia z baza
- `GET /api` - Swagger UI

## Autoryzacja i raporty

- Uzytkownicy: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- Stacje (wymagaja JWT): `POST /stations`, `GET /stations`, `DELETE /stations/:id`, `GET /stations/:id/reports`
- Raporty ze stacji: `POST /station-report` z naglowkami `x-station-id` i `x-station-key`

Przyklad przeplywu:

1. Rejestracja lub logowanie.
2. Utworzenie stacji `POST /stations`.
3. Zapisanie `apiKey` (pokazywany raz).
4. Wysylanie danych z urzadzenia na `POST /station-report`.

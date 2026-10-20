# Seediot UI

## Wstep

Ta aplikacja to frontend mobilny projektu SeedIoT. Umozliwia uzytkownikom logowanie, dodawanie i przeglad stacji oraz podglad raportow z czujnikow. Jest zbudowana w Expo i dziala na Android oraz iOS.

## Technologie uzywane

- React Native + Expo
- TypeScript
- Expo Router (routing oparty o strukture katalogow)
- Tailwind/NaitveWind (stylowanie)

## Struktura projektu

- `app/` - ekrany i routing aplikacji
- `app/_layout.tsx` - glowny layout nawigacji
- `app/index.tsx` - ekran startowy
- `app/onboard.tsx` - onboarding
- `app/pair.tsx` - parowanie stacji
- `app/dashboard.tsx` - panel glowny
- `app/station/` - widoki szczegolowe stacji
- `lib/` - logika komunikacji z API i narzedzia
- `constants/` - stale teksty i konfiguracje
- `assets/` - grafiki i zasoby
- `global.css` - style globalne
- `app.json` - konfiguracja Expo

## Uruchomienie

### Wymagania

- Node.js (zalecane LTS)
- npm
- Expo CLI (uruchamiane przez `npx`)

### Krok po kroku

1. Zainstaluj zaleznosci:

```bash
npm install
```

2. Uruchom aplikacje:

```bash
npx expo start
```

3. Uruchom na urzadzeniu lub emulatorze:

- Android emulator
- iOS simulator
- Expo Go

## Konfiguracja

Jezeli aplikacja laczy sie z backendem, sprawdz ustawienia w plikach w `lib/` (np. adres API). W razie potrzeby zaktualizuj je do adresu lokalnego lub serwerowego.

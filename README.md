# Stacja monitorująca do zarządzania uprawami

## Skład zespołu
- Patryk Rusak
- Zuzanna Baran
- Alicja Ciepielska
- Nguyen Anh Do
- Antoni Kucisz

## Opis projektu
Projekt koncentruje się na systemie inteligentnego monitorowania upraw, który rozwiązuje problem opóźnionej reakcji na zagrożenia rolnicze poprzez bieżącą analizę parametrów glebowych i atmosferycznych. Wykorzystując sieć czujników IoT, rozwiązanie umożliwia wczesne wykrywanie stresu roślin oraz zagrożeń pożarowych. Dzięki integracji danych w czasie rzeczywistym, system stanowi nowoczesną alternatywę dla czasochłonnych i nieefektywnych wizyt kontrolnych na dużych obszarach pól.

## Raporty
Wszystkie raporty z postępów projektu są dostępne w folderze `reports`. Każdy raport zawiera szczegółowe informacje na temat realizacji poszczególnych etapów projektu.

## Kod projektu
Wszystkie pliki związane z kodem projektu znajdują się w folderze `codebase`. Znajdują się tam odpowiednio:
- `rpi-code`: kod przeznaczony do uruchomienia na Raspberry Pi, odpowiedzialny za zbieranie danych z czujników i komunikację z serwerem.
- `seediot-server`: kod serwera, który przetwarza dane z Raspberry Pi, komunikuje się z aplikacją mobilną i zarządza bazą danych. Program napisany w języky Typescript z wykorzystaniem frameworka NestJS.
- `seediot-ui`: kod aplikacji mobilnej, która umożliwia użytkownikom monitorowanie stanu upraw i otrzymywanie powiadomień o zagrożeniach. Program napisany w języku React Native.
- `sensors-use-example`: przykładowy kod do testowania działania czujników, który można uruchomić na Raspberry Pi.

## Dokumentacje modułów
Każdy moduł(aplikacja, serwer, kod Raspberry Pi) posiada swoją własną dokumentację, która znajduje się folderze głównym każdego modułu. Dokumentacja zawiera szczegółowe instrukcje dotyczące instalacji, konfiguracji i użytkowania poszczególnych komponentów systemu.
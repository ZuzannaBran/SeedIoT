# Bazowy interwal petli pomiarowej w milisekundach.
BASE_INTERVAL_MS = 10000

# Ile krokow pomiarowych wykonac w jednym cyklu AUTO.
AUTO_BATCH_MEASUREMENTS = 10

# Odczyt co (BASE_INTERVAL_MS * multiplier)
SENSOR_READ_MULTIPLIERS = {
    # Wilgotnosc gleby (ADC, procent i napiecie).
    "soil_moisture": 1,
    # Temperatura z DS18B20.
    "ds18b20": 2,
    # BME280: temperatura, cisnienie, wilgotnosc.
    "bme280": 1,
    # BME680: temperatura, cisnienie, wilgotnosc, opor gazu.
    "bme680": 1,
    # LTR559: kanaly swiatla ALS.
    "ltr559": 1,
    # SCD41: CO2, temperatura, wilgotnosc.
    "scd41": 1,
    # Predkosc i kierunek wiatru.
    "wind": 1,
    # Opad i intensywnosc opadu.
    "rain": 1,
}

# TPL5110 power timer
# Czy obsluga TPL5110 ma byc aktywna.
TPL5110_ENABLED = True

# GPIO podlaczony do pinu DONE modulu TPL5110.
TPL5110_DONE_PIN = 15

# Dlugosc impulsu DONE (LOW->HIGH) w ms.
TPL5110_DONE_PULSE_MS = 20

# Maksymalny "czas okna wlaczenia" na jeden cykl po wybudzeniu przez TPL5110.
# Ustaw zgodnie z rezystorem DELAY na plytce TPL5110.
TPL5110_ON_WINDOW_MS = 10000

# Bufory czasu, by zdazyc odczytac sensory i opcjonalnie wyslac Wi-Fi.
# Rezerwa czasu na odczyty z sensorow.
TPL5110_SENSOR_READ_BUFFER_MS = 3500

# Rezerwa czasu na ewentualny upload Wi-Fi/HTTP.
TPL5110_WIFI_UPLOAD_BUFFER_MS = 4000

# LCD 16x2 na ekspanderze I2C PCF8574.
LCD_DISPLAY_ENABLED = True
LCD_PAGE_INTERVAL_MS = 3000

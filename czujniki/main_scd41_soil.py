import machine
import time
from scd4x import SCD4X

try:
    from picographics import PicoGraphics, DISPLAY_PICO_DISPLAY_2, PEN_RGB332
except ImportError:
    PicoGraphics = None
    DISPLAY_PICO_DISPLAY_2 = None
    PEN_RGB332 = None


I2C_ID = 0
I2C_SDA_PIN = 4
I2C_SCL_PIN = 5
SOIL_ADC_PIN = 26

# Wyniki po kalibracji soilWatch
DRY_VALUE = 1800
WET_VALUE = 58000


def map_moisture(raw_adc):
    percentage = ((raw_adc - DRY_VALUE) / (WET_VALUE - DRY_VALUE)) * 100
    if percentage < 0:
        percentage = 0
    if percentage > 100:
        percentage = 100
    return percentage


def init_scd41():
    i2c = machine.I2C(
        I2C_ID,
        sda=machine.Pin(I2C_SDA_PIN),
        scl=machine.Pin(I2C_SCL_PIN),
        freq=100000,
    )
    time.sleep(1)

    try:
        sensor = SCD4X(i2c)
        sensor.start_periodic_measurement()
        print("SCD41 initialized")
        return sensor
    except Exception as e:
        print("SCD41 init failed:", e)
        return None


def init_display():
    if PicoGraphics is None:
        print("Pico Display 2.0 library not found")
        return None

    try:
        display = PicoGraphics(display=DISPLAY_PICO_DISPLAY_2, pen_type=PEN_RGB332)
        print("Pico Display 2.0 initialized")
        return display
    except Exception as e:
        print("Display init failed:", e)
        return None


def draw_screen(display, soil_raw, soil_percent, co2_text, temp_text, hum_text, status_text):
    if display is None:
        return

    width, height = display.get_bounds()

    black = display.create_pen(0, 0, 0)
    white = display.create_pen(255, 255, 255)
    green = display.create_pen(80, 220, 120)
    cyan = display.create_pen(80, 200, 255)
    yellow = display.create_pen(255, 220, 80)

    display.set_pen(black)
    display.clear()

    display.set_pen(white)
    display.text("SCD41 + soilWatch", 10, 10, width - 20, 2)

    display.set_pen(green)
    display.text("Soil: {:.1f}%".format(soil_percent), 10, 45, width - 20, 4)

    display.set_pen(white)
    display.text("Raw: {}".format(soil_raw), 10, 78, width - 20, 2)

    display.set_pen(cyan)
    display.text(co2_text, 10, 110, width - 20, 3)
    display.text(temp_text, 10, 140, width - 20, 3)
    display.text(hum_text, 10, 170, width - 20, 3)

    display.set_pen(yellow)
    display.text(status_text, 10, height - 28, width - 20, 2)
    display.update()


soil_sensor = machine.ADC(machine.Pin(SOIL_ADC_PIN))
scd41 = init_scd41()
display = init_display()


while True:
    try:
        raw_soil = soil_sensor.read_u16()
        soil_percent = map_moisture(raw_soil)

        print("Soil raw:  {} | Soil moisture: {:.1f}%".format(raw_soil, soil_percent))

        if scd41 is not None and scd41.data_ready:
            co2 = scd41.CO2
            temp = scd41.temperature
            hum = scd41.relative_humidity

            print("CO2:      {} ppm".format(co2))
            print("Temp:     {:.2f} C".format(temp))
            print("Humidity: {:.2f} %".format(hum))
            co2_text = "CO2: {} ppm".format(co2)
            temp_text = "Temp: {:.2f} C".format(temp)
            hum_text = "Hum:  {:.2f} %".format(hum)
            status_text = "SCD41 ready"
        elif scd41 is None:
            print("SCD41 unavailable")
            co2_text = "CO2: --"
            temp_text = "Temp: --"
            hum_text = "Hum:  --"
            status_text = "SCD41 unavailable"
        else:
            print("SCD41 waiting for data")
            co2_text = "CO2: reading..."
            temp_text = "Temp: reading..."
            hum_text = "Hum:  reading..."
            status_text = "Waiting for SCD41"

        draw_screen(
            display,
            raw_soil,
            soil_percent,
            co2_text,
            temp_text,
            hum_text,
            status_text,
        )

        print("-" * 24)
        time.sleep(1)
    except Exception as e:
        print("Read error:", e)
        time.sleep(2)

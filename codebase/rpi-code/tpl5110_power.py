import time
from machine import Pin


class TPL5110PowerController:
    def __init__(self, done_pin, pulse_ms=20):
        self.done_pin = Pin(done_pin, Pin.OUT)
        self.done_pin.value(0)
        self.pulse_ms = pulse_ms

    def signal_done(self):
        # DONE musi przejsc z LOW do HIGH, aby TPL5110 odcial zasilanie.
        self.done_pin.value(0)
        time.sleep_ms(2)
        self.done_pin.value(1)
        time.sleep_ms(self.pulse_ms)
        self.done_pin.value(0)

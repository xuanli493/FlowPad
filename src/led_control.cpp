#include "led_control.h"
#include "wifi_manager.h"

uint32_t led_parse_hex(const String& hex) {
    const char* s = hex.c_str();
    if (s[0] == '#') s++;
    return strtoul(s, NULL, 16);
}

void led_init() {
    FastLED.addLeds<WS2812B, PIN_LEDS, GRB>(leds, NUM_LEDS);
    FastLED.setBrightness(128);
    FastLED.clear(true);
    Serial.printf("[LED] GPIO%d, %d LEDs\n", PIN_LEDS, NUM_LEDS);
}

void led_set(const String& mode, CRGB color, int brightness) {
    ledModeStr   = mode;
    ledColor     = color;
    ledBrightness = brightness;
    FastLED.setBrightness(brightness);
    if (mode == "off") {
        FastLED.clear(true);
    } else if (mode == "solid") {
        fill_solid(leds, NUM_LEDS, color);
        FastLED.show();
    }
}

// ============================================================================
// 非阻塞 flash: 快闪 N 次后自动回到 off
// ============================================================================
static CRGB   _flashColor;
static int    _flashTotal;
static int    _flashInterval;
static int    _flashCount = 0;
static bool   _flashOn    = false;
static unsigned long _flashLast = 0;

void led_flash(CRGB color, int count, int intervalMs) {
    _flashColor    = color;
    _flashTotal    = count * 2;  // on+off 各算一次
    _flashInterval = intervalMs;
    _flashCount    = 0;
    _flashOn       = false;
    _flashLast     = 0;
    ledModeStr = "flash";
}

void led_update() {
    // --- flash 模式 ---
    if (ledModeStr == "flash") {
        if (millis() - _flashLast >= (unsigned long)_flashInterval) {
            _flashLast = millis();
            _flashOn = !_flashOn;
            if (_flashOn) {
                fill_solid(leds, NUM_LEDS, _flashColor);
                FastLED.setBrightness(255);
                FastLED.show();
            } else {
                FastLED.clear(true);
            }
            _flashCount++;
            if (_flashCount >= _flashTotal) {
                ledModeStr = "off";
                _flashCount = 0;
                FastLED.clear(true);
            }
        }
        return;
    }

    if (ledModeStr == "off" || ledModeStr == "solid") return;

    // --- breathe ---
    if (ledModeStr == "breathe") {
        static unsigned long last = 0;
        if (millis() - last < 20) return;
        last = millis();
        float t = millis() / 1000.0f;
        uint8_t b = (uint8_t)((sinf(t * 1.5f) * 0.5f + 0.5f) * ledBrightness);
        FastLED.setBrightness(max((uint8_t)4, b));
        fill_solid(leds, NUM_LEDS, ledColor);
        FastLED.show();
    }

    // --- rainbow ---
    if (ledModeStr == "rainbow") {
        static unsigned long last = 0;
        static uint8_t hue = 0;
        if (millis() - last < 20) return;
        last = millis();
        hue++;
        fill_rainbow(leds, NUM_LEDS, hue, 7);
        FastLED.setBrightness(ledBrightness);
        FastLED.show();
    }
}

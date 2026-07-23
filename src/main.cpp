/**
 * FlowPad Phase 4 — 入口 (精简版)
 */
#include "config.h"
#include "led_control.h"
#include "wifi_manager.h"
#include "storage.h"
#include "hx711_driver.h"
#include "ntp_time.h"
#include "drink_state.h"
#include "api_routes.h"
#include "esp_sleep.h"
#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1
#include <ElegantOTA.h>

// ============================================================================
// RTC 持久化 (深度睡眠不丢失)
// ============================================================================
RTC_DATA_ATTR bool rtc_away_mode = false;       // 是否从 AWAY 深度睡眠醒来
RTC_DATA_ATTR int  rtc_boot_count = 0;

// ============================================================================
// 全局变量定义
// ============================================================================
AsyncWebServer server(80);
HX711_ADC    LoadCell(PIN_HX711_DT, PIN_HX711_SCK);
CRGB         leds[NUM_LEDS];

bool   wifiConnected = false;
bool   apMode        = false;
String wifiSSID      = "";
String wifiPass      = "";
String apSSID        = "FlowPad-Setup";
String apPass        = "";
WifiNetwork scanResults[MAX_SCAN_NETWORKS];
int scanCount = 0;

bool   timeSynced = false;
time_t lastNtpTry = 0;

String ledModeStr    = "off";
CRGB   ledColor      = CRGB::Blue;
int    ledBrightness = 128;

float      calibZeroOffset = 0;
float      calibTareG      = 0;
float      calibFullRefG   = 0;
float      calibFactor     = 2200;
CalibState calibState      = CALIB_NONE;

DrinkState    drinkState         = STATE_UNKNOWN;
float         weightFiltered     = 0;
float         weightStable       = 0;
unsigned long pickedUpAt         = 0;
unsigned long stateEnteredAt     = 0;
unsigned long lastStrawCheck     = 0;
float         strawDrinkBase     = 0;
float         weightBeforePickup = 0;

float         weightBuf[WEIGHT_BUF_SIZE];
int           weightBufIdx  = 0;
int           weightBufCount = 0;
unsigned long lastWeightRead = 0;

DrinkEvent eventsToday[MAX_EVENTS_TODAY];
int        eventCount    = 0;
int        eventDay      = 0;
int        todayTotalMl  = 0;
int        todayEvents   = 0;
DaySummary streak[MAX_STREAK];
int        streakCount   = 0;

Settings settings;
unsigned long lastDrinkAt = 0;

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200, SERIAL_8N1, 20, 21);
    delay(500);

    rtc_boot_count++;
    esp_sleep_wakeup_cause_t wakeCause = esp_sleep_get_wakeup_cause();

    Serial.println("\n========================================");
    Serial.printf("  FlowPad boot #%d (cause=%d, away=%d)\n",
                   rtc_boot_count, (int)wakeCause, rtc_away_mode);
    Serial.println("========================================");

    // ---- AWAY 模式快速唤醒检测 ----
    if (rtc_away_mode && wakeCause == ESP_SLEEP_WAKEUP_TIMER) {
        // 快速初始化 HX711, 不做完整启动
        pinMode(PIN_HX711_SCK, OUTPUT);
        digitalWrite(PIN_HX711_SCK, LOW);  // 唤醒 HX711
        delay(2);

        // 等待首次转换完成 (DT 变低)
        pinMode(PIN_HX711_DT, INPUT);
        unsigned long start = millis();
        while (digitalRead(PIN_HX711_DT) == HIGH) {
            if (millis() - start > 200) break;
        }

        if (digitalRead(PIN_HX711_DT) == LOW) {
            // 读一次原始值判断有无杯子
            long raw = 0;
            for (int i = 0; i < 24; i++) {
                digitalWrite(PIN_HX711_SCK, HIGH);
                delayMicroseconds(1);
                raw = (raw << 1) | digitalRead(PIN_HX711_DT);
                digitalWrite(PIN_HX711_SCK, LOW);
                delayMicroseconds(1);
            }
            // 第 25 个脉冲设置增益
            digitalWrite(PIN_HX711_SCK, HIGH);
            delayMicroseconds(1);
            digitalWrite(PIN_HX711_SCK, LOW);

            // 补码转换
            if (raw & 0x800000) raw |= 0xFF000000;
            float grams = ((float)raw - calibZeroOffset) / calibFactor;

            float threshold = calibTareG * 0.3f;
            if (threshold < 10) threshold = 10;

            if (grams > threshold) {
                Serial.printf("[AWAY] cup detected (%.1fg > %.1f), resuming...\n", grams, threshold);
                rtc_away_mode = false;
                ESP.restart();  // 完整重启
            }
        }

        // 仍然空载 → 关 HX711, 继续睡
        pinMode(PIN_HX711_SCK, OUTPUT);
        digitalWrite(PIN_HX711_SCK, HIGH);
        delayMicroseconds(70);

        Serial.printf("[AWAY] still empty, sleeping %ds...\n", AWAY_WAKE_SEC);
        esp_sleep_enable_timer_wakeup((uint64_t)AWAY_WAKE_SEC * 1000000ULL);
        esp_deep_sleep_start();
        // unreachable
    }

    // ---- 正常启动 ----
    Serial.println("  FlowPad Phase 4 — calibration + drink");
    Serial.println("========================================");

    led_init();
    storage_init();
    storage_load_settings();
    storage_load_calib();
    storage_load_drinks();
    wifi_load_config();

    hx711_init();
    wifi_init();
    ntp_init();

    drink_state_init();
    api_setup();

    // OTA 固件升级 (回调必须在 begin() 之前设置)
    ElegantOTA.onStart([]() {
        led_set("solid", CRGB(50, 0, 50), 32);
    });
    ElegantOTA.onProgress([](size_t cur, size_t total) {
        Serial.printf("[OTA] %u%%\n", (unsigned)(cur * 100 / total));
    });
    ElegantOTA.onEnd([](bool success) {
        if (success) led_set("solid", CRGB(0, 50, 0), 64);
    });
    ElegantOTA.begin(&server);

    server.begin();
    Serial.printf("[HTTP] started on :80 (heap=%u)\n", ESP.getFreeHeap());

    // 启动指示灯
    if (calibState != CALIB_DONE) {
        led_set("solid", CRGB(255, 255, 255), 32);
    } else {
        led_set("solid", CRGB(0, 0, 32), 32);
    }

    Serial.println("========================================");
}

// ============================================================================
// LOOP
// ============================================================================
void loop() {
    // --- AWAY 深度睡眠入口 ---
    if (drinkState == STATE_AWAY) {
        Serial.println("[AWAY] entering deep sleep...");
        hx711_power_down();
        led_power_off();
        rtc_away_mode = true;
        delay(50);

        esp_sleep_enable_timer_wakeup((uint64_t)AWAY_WAKE_SEC * 1000000ULL);
        esp_deep_sleep_start();
        // unreachable
    }

    if (!timeSynced) ntp_sync();
    drink_check_day_rollover();
    hx711_update();

    static unsigned long lastState = 0;
    if (millis() - lastState >= 500) {
        lastState = millis();
        drink_state_update();
    }

    led_update();

    // OTA 心跳
    ElegantOTA.loop();

    static unsigned long lastStatus = 0;
    if (millis() - lastStatus >= 30000) {
        lastStatus = millis();
        Serial.printf("[UPTIME] %lus | WiFi:%s weight:%.1fg state:%d calib:%d heap:%u\n",
                       millis() / 1000,
                       wifiConnected ? "OK" : "DOWN",
                       weightFiltered, (int)drinkState,
                       (int)calibState, ESP.getFreeHeap());
    }

    delay(5);
}

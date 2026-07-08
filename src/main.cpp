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
String apPass        = "12345678";
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
    Serial.println("\n========================================");
    Serial.println("  FlowPad Phase 4 — calibration + drink");
    Serial.println("========================================");

    led_init();
    storage_init();
    storage_load_settings();
    storage_load_calib();
    storage_load_drinks();
    wifi_load_config();   // 加载保存的 WiFi (有则用, 无则 AP)

    hx711_init();
    wifi_init();
    ntp_init();

    drink_state_init();
    api_setup();

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
    if (!timeSynced) ntp_sync();
    drink_check_day_rollover();
    hx711_update();

    static unsigned long lastState = 0;
    if (millis() - lastState >= 500) {
        lastState = millis();
        drink_state_update();
    }

    led_update();

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

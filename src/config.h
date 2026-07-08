#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <FastLED.h>
#include <HX711_ADC.h>
#include <time.h>

// ============================================================================
// 硬件引脚
// ============================================================================
#define PIN_LEDS       7
#define NUM_LEDS       23
#define PIN_HX711_DT   4
#define PIN_HX711_SCK  6

// ============================================================================
// WiFi
// ============================================================================
#define WIFI_TIMEOUT_SEC  15
#define WIFI_SCAN_PER_CHAN_MS 300   // 每信道 300ms, 13 信道 ≈ 4 秒
#define MAX_SCAN_NETWORKS 20

// ============================================================================
// NTP
// ============================================================================
#define GMT_OFFSET_SEC  (8 * 3600)

// ============================================================================
// 喝水检测参数
// ============================================================================
#define DRINK_THRESHOLD_G    20
#define STRAW_THRESHOLD_G    50
#define PICKUP_TIMEOUT_MS    120000
#define AWAY_TIMEOUT_MS      1800000
#define STABILITY_WINDOW_MS  2000
#define STABILITY_MAX_VAR_G  10
#define MERGE_WINDOW_MS      30000
#define EVAPORATION_G_PER_H  5
#define WEIGHT_BUF_SIZE      40
#define MAX_EVENTS_TODAY     50
#define MAX_STREAK            7

// ============================================================================
// 枚举
// ============================================================================
enum DrinkState : uint8_t {
    STATE_UNKNOWN = 0,
    STATE_IDLE,
    STATE_PICKED_UP,
    STATE_STRAW_DRINK,
    STATE_EMPTY,
};

enum CalibState : uint8_t {
    CALIB_NONE = 0,
    CALIB_ZERO_DONE,
    CALIB_DONE,
};

// ============================================================================
// 数据结构
// ============================================================================
struct DrinkEvent {
    uint8_t  hour;
    uint8_t  minute;
    uint16_t ml;
    char     type[8];
};

struct DaySummary {
    uint16_t totalMl;
    uint8_t  eventCount;
    uint8_t  day;
    uint8_t  month;
};

struct Settings {
    int    targetMl      = 2000;
    int    reminderMin   = 30;
    int    ledBrightness = 128;
    String ledColor      = "0000FF";
};

struct WifiNetwork {
    String ssid;
    int    rssi;
    bool   secure;
};

// ============================================================================
// 全局变量 (extern 声明, 定义在 main.cpp)
// ============================================================================
extern AsyncWebServer server;
extern HX711_ADC    LoadCell;
extern CRGB         leds[NUM_LEDS];

// WiFi
extern bool   wifiConnected;
extern bool   apMode;
extern String wifiSSID;
extern String wifiPass;
extern String apSSID;
extern String apPass;
extern WifiNetwork scanResults[MAX_SCAN_NETWORKS];
extern int scanCount;

// 时钟
extern bool   timeSynced;
extern time_t lastNtpTry;

// LED
extern String ledModeStr;
extern CRGB   ledColor;
extern int    ledBrightness;

// 校准
extern float     calibZeroOffset;
extern float     calibTareG;
extern float     calibFullRefG;
extern float     calibFactor;
extern CalibState calibState;

// 喝水检测
extern DrinkState    drinkState;
extern float         weightFiltered;
extern float         weightStable;
extern unsigned long pickedUpAt;
extern unsigned long stateEnteredAt;
extern unsigned long lastStrawCheck;
extern float         strawDrinkBase;
extern float         weightBeforePickup;

// 环形缓冲
extern float  weightBuf[WEIGHT_BUF_SIZE];
extern int    weightBufIdx;
extern int    weightBufCount;
extern unsigned long lastWeightRead;

// 喝水记录
extern DrinkEvent eventsToday[MAX_EVENTS_TODAY];
extern int        eventCount;
extern int        eventDay;
extern int        todayTotalMl;
extern int        todayEvents;
extern DaySummary streak[MAX_STREAK];
extern int        streakCount;

// 设置
extern Settings settings;

// 喝水提醒
extern unsigned long lastDrinkAt;

// 文件路径
#define FILE_SETTINGS "/config.json"
#define FILE_CALIB    "/calib.json"
#define FILE_DRINKS   "/drinks.json"
#define FILE_WIFI     "/wifi.json"

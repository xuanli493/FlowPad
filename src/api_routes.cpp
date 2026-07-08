#include "api_routes.h"
#include "storage.h"
#include "hx711_driver.h"
#include "led_control.h"
#include "wifi_manager.h"
#include "ntp_time.h"
#include "drink_state.h"

static String _build_status_json() {
    JsonDocument doc;
    doc["wifi"]       = wifiConnected ? "connected" : "ap";
    doc["ip"]         = wifi_local_ip();
    doc["rssi"]       = wifi_rssi();
    doc["apMode"]     = apMode;
    doc["uptime"]     = millis() / 1000;
    doc["weight"]     = roundf(weightFiltered * 10) / 10.0f;
    doc["ledMode"]    = ledModeStr;
    doc["freeHeap"]   = ESP.getFreeHeap();
    doc["calibrated"] = (calibState == CALIB_DONE);
    doc["drinkState"] = (int)drinkState;
    doc["time"]       = ntp_synced() ? ntp_time_str() : "N/A";
    String out; serializeJson(doc, out);
    return out;
}

void api_setup() {
    // --- 静态文件 ---
    server.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (LittleFS.exists("/www/index.html")) {
            req->send(LittleFS, "/www/index.html", "text/html");
        } else {
            req->send(200, "text/plain", "SPA not uploaded\n");
        }
    });

    // --- GET /api/status ---
    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", _build_status_json());
    });

    // --- GET /api/weight ---
    server.on("/api/weight", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;
        doc["grams"]      = roundf(weightFiltered * 10) / 10.0f;
        doc["stable"]     = (drinkState == STATE_IDLE);
        doc["calibrated"] = (calibState == CALIB_DONE);
        doc["state"]      = (int)drinkState;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // --- GET /api/time ---
    server.on("/api/time", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;
        doc["time"]   = ntp_synced() ? ntp_time_str() : "N/A";
        doc["synced"] = timeSynced;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // --- GET /api/history ---
    server.on("/api/history", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;

        JsonArray sArr = doc["streak"].to<JsonArray>();
        for (int i = 0; i < streakCount; i++) {
            JsonObject s = sArr.add<JsonObject>();
            String date = "2026-";
            date += (streak[i].month < 10 ? "0" : "") + String(streak[i].month) + "-";
            date += (streak[i].day < 10 ? "0" : "") + String(streak[i].day);
            s["date"]    = date;
            s["totalMl"] = streak[i].totalMl;
            s["target"]  = settings.targetMl;
            s["records"] = streak[i].eventCount;
        }

        JsonObject today = doc["today"].to<JsonObject>();
        today["totalMl"] = todayTotalMl;
        today["events"]  = todayEvents;
        today["target"]  = settings.targetMl;

        JsonArray eArr = today["list"].to<JsonArray>();
        for (int i = 0; i < eventCount; i++) {
            JsonObject e = eArr.add<JsonObject>();
            char buf[6];
            snprintf(buf, sizeof(buf), "%02d:%02d", eventsToday[i].hour, eventsToday[i].minute);
            e["time"] = buf;
            e["ml"]   = eventsToday[i].ml;
            e["type"] = eventsToday[i].type;
        }

        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // --- GET /api/calibrate ---
    server.on("/api/calibrate", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;
        doc["calibrated"] = (calibState == CALIB_DONE);
        doc["step"]       = (int)calibState;
        doc["tare"]       = roundf(calibTareG * 10) / 10.0f;
        doc["fullRef"]    = roundf(calibFullRefG * 10) / 10.0f;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // --- POST /api/calibrate/step1 (空载) ---
    server.on("/api/calibrate/step1", HTTP_POST, [](AsyncWebServerRequest* req) {
        LoadCell.tareNoDelay();
        calibZeroOffset = 0;
        calibState = CALIB_ZERO_DONE;
        storage_save_calib();
        Serial.println("[CALIB] step1 done");
        req->send(200, "application/json", "{\"ok\":true,\"step\":1}");
    });

    // --- POST /api/calibrate/step2 (空杯) ---
    server.on("/api/calibrate/step2", HTTP_POST, [](AsyncWebServerRequest* req) {
        delay(1000);
        float avg = hx711_sample_average(20, 2000);
        calibTareG = avg;
        calibState = CALIB_DONE;
        calibFullRefG = 0;
        drinkState = STATE_IDLE;
        weightStable = avg;
        storage_save_calib();
        Serial.printf("[CALIB] step2: tare=%.1fg → DONE\n", calibTareG);

        JsonDocument doc;
        doc["ok"]   = true;
        doc["step"] = 2;
        doc["tare"] = roundf(calibTareG * 10) / 10.0f;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // --- POST /api/led ---
    server.on("/api/led", HTTP_POST,
        [](AsyncWebServerRequest* req) { req->send(200, "application/json", "{\"ok\":true}"); },
        NULL,
        [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t index, size_t total) {
            static String body;
            if (index == 0) body = "";
            for (size_t i = 0; i < len; i++) body += (char)data[i];
            if (index + len >= total) {
                JsonDocument doc;
                if (deserializeJson(doc, body)) return;
                if (doc["mode"].is<const char*>())       ledModeStr  = doc["mode"].as<String>();
                if (doc["color"].is<const char*>()) {
                    settings.ledColor = doc["color"].as<String>();
                    ledColor = CRGB(led_parse_hex(doc["color"].as<String>()));
                }
                if (doc["brightness"].is<int>()) {
                    ledBrightness = doc["brightness"].as<int>();
                    settings.ledBrightness = ledBrightness;
                }
                led_set(ledModeStr, ledColor, ledBrightness);
            }
        }
    );

    // --- GET /api/settings ---
    server.on("/api/settings", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;
        doc["targetMl"]      = settings.targetMl;
        doc["reminderMin"]   = settings.reminderMin;
        doc["ledBrightness"] = settings.ledBrightness;
        doc["ledColor"]      = settings.ledColor;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // --- POST /api/settings ---
    server.on("/api/settings", HTTP_POST,
        [](AsyncWebServerRequest* req) { req->send(200, "application/json", "{\"ok\":true}"); },
        NULL,
        [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t index, size_t total) {
            static String body;
            if (index == 0) body = "";
            for (size_t i = 0; i < len; i++) body += (char)data[i];
            if (index + len >= total) {
                JsonDocument doc;
                if (deserializeJson(doc, body)) return;
                if (doc["targetMl"].is<int>())      settings.targetMl      = doc["targetMl"];
                if (doc["reminderMin"].is<int>())   settings.reminderMin   = doc["reminderMin"];
                if (doc["ledBrightness"].is<int>()) settings.ledBrightness = doc["ledBrightness"];
                if (doc["ledColor"].is<const char*>()) settings.ledColor   = doc["ledColor"].as<String>();
                storage_save_settings();
            }
        }
    );

    server.onNotFound([](AsyncWebServerRequest* req) {
        req->send(404, "text/plain", "404");
    });

    // --- 恢复出厂设置 ---
    server.on("/api/factory/reset", HTTP_POST, [](AsyncWebServerRequest* req) {
        LittleFS.remove(FILE_SETTINGS);
        LittleFS.remove(FILE_CALIB);
        LittleFS.remove(FILE_DRINKS);
        LittleFS.remove(FILE_WIFI);
        Serial.println("[FACTORY] all config deleted, restarting...");
        AsyncWebServerResponse* rsp = req->beginResponse(200, "application/json",
            "{\"ok\":true,\"restart\":true}");
        rsp->addHeader("Connection", "close");
        req->send(rsp);
        delay(500);
        ESP.restart();
    });

    // --- 配网 API ---

    // GET /api/wifi/scan — 返回缓存的扫描结果
    server.on("/api/wifi/scan", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;
        JsonArray arr = doc["networks"].to<JsonArray>();
        for (int i = 0; i < scanCount; i++) {
            JsonObject n = arr.add<JsonObject>();
            n["ssid"]   = scanResults[i].ssid;
            n["rssi"]   = scanResults[i].rssi;
            n["secure"] = scanResults[i].secure;
        }
        doc["count"] = scanCount;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // POST /api/wifi/rescan — AP 模式下重新扫描
    server.on("/api/wifi/rescan", HTTP_POST, [](AsyncWebServerRequest* req) {
        if (!apMode) {
            req->send(400, "application/json", "{\"ok\":false,\"error\":\"not in AP mode\"}");
            return;
        }
        wifi_rescan();
        JsonDocument doc;
        JsonArray arr = doc["networks"].to<JsonArray>();
        for (int i = 0; i < scanCount; i++) {
            JsonObject n = arr.add<JsonObject>();
            n["ssid"]   = scanResults[i].ssid;
            n["rssi"]   = scanResults[i].rssi;
            n["secure"] = scanResults[i].secure;
        }
        doc["count"] = scanCount;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // GET /api/wifi/status — 当前 WiFi 状态
    server.on("/api/wifi/status", HTTP_GET, [](AsyncWebServerRequest* req) {
        JsonDocument doc;
        doc["connected"] = wifiConnected;
        doc["apMode"]    = apMode;
        doc["ip"]        = wifi_local_ip();
        doc["ssid"]      = wifiConnected ? wifiSSID : "";
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // POST /api/wifi/connect — 保存并重启
    server.on("/api/wifi/connect", HTTP_POST,
        [](AsyncWebServerRequest* req) {},
        NULL,
        [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t index, size_t total) {
            static String body;
            if (index == 0) body = "";
            for (size_t i = 0; i < len; i++) body += (char)data[i];
            if (index + len >= total) {
                JsonDocument doc;
                deserializeJson(doc, body);
                const char* ssid = doc["ssid"] | "";
                const char* pass = doc["pass"] | "";
                if (strlen(ssid) > 0) {
                    wifi_save_config(ssid, pass);
                    AsyncWebServerResponse* rsp = req->beginResponse(200, "application/json",
                        "{\"ok\":true,\"restart\":true}");
                    rsp->addHeader("Connection", "close");
                    req->send(rsp);
                    delay(500);
                    ESP.restart();
                } else {
                    req->send(400, "application/json", "{\"ok\":false,\"error\":\"no ssid\"}");
                }
            }
        }
    );

    server.begin();
    Serial.println("[HTTP] started on :80");
}

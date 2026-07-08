#include "storage.h"

void storage_init() {
    Serial.print("[FS] Mounting... ");
    if (LittleFS.begin(true)) {
        Serial.println("OK");
    } else {
        Serial.println("FAILED");
    }
}

// ============================================================================
// 校准
// ============================================================================
void storage_save_calib() {
    File f = LittleFS.open(FILE_CALIB, "w");
    if (!f) return;
    JsonDocument doc;
    doc["offset"]   = calibZeroOffset;
    doc["tare"]     = calibTareG;
    doc["full_ref"] = calibFullRefG;
    doc["factor"]   = calibFactor;
    doc["state"]    = (int)calibState;
    serializeJson(doc, f);
    f.close();
    Serial.println("[CALIB] saved");
}

void storage_load_calib() {
    if (!LittleFS.exists(FILE_CALIB)) return;
    File f = LittleFS.open(FILE_CALIB, "r");
    if (!f) return;
    JsonDocument doc;
    if (deserializeJson(doc, f)) { f.close(); return; }
    f.close();
    calibZeroOffset = doc["offset"]  | 0.0f;
    calibTareG      = doc["tare"]    | 0.0f;
    calibFullRefG   = doc["full_ref"]| 0.0f;
    calibFactor     = doc["factor"]  | 2200.0f;
    calibState      = (CalibState)(doc["state"] | 0);
    Serial.printf("[CALIB] loaded: offset=%.1f tare=%.1fg full=%.1fg state=%d\n",
                  calibZeroOffset, calibTareG, calibFullRefG, calibState);
}

// ============================================================================
// 喝水记录
// ============================================================================
void storage_save_drinks() {
    File f = LittleFS.open(FILE_DRINKS, "w");
    if (!f) return;
    JsonDocument doc;

    JsonArray sArr = doc["streak"].to<JsonArray>();
    for (int i = 0; i < streakCount; i++) {
        JsonObject s = sArr.add<JsonObject>();
        s["total"]  = streak[i].totalMl;
        s["events"] = streak[i].eventCount;
        s["day"]    = streak[i].day;
        s["month"]  = streak[i].month;
    }

    JsonArray eArr = doc["events"].to<JsonArray>();
    for (int i = 0; i < eventCount; i++) {
        JsonObject e = eArr.add<JsonObject>();
        e["h"]    = eventsToday[i].hour;
        e["m"]    = eventsToday[i].minute;
        e["ml"]   = eventsToday[i].ml;
        e["type"] = eventsToday[i].type;
    }

    serializeJson(doc, f);
    f.close();
}

void storage_load_drinks() {
    if (!LittleFS.exists(FILE_DRINKS)) return;
    File f = LittleFS.open(FILE_DRINKS, "r");
    if (!f) return;
    JsonDocument doc;
    if (deserializeJson(doc, f)) { f.close(); return; }
    f.close();

    JsonArray sArr = doc["streak"].as<JsonArray>();
    streakCount = 0;
    for (JsonObject s : sArr) {
        if (streakCount >= MAX_STREAK) break;
        streak[streakCount].totalMl   = s["total"];
        streak[streakCount].eventCount = s["events"];
        streak[streakCount].day        = s["day"];
        streak[streakCount].month      = s["month"];
        streakCount++;
    }

    JsonArray eArr = doc["events"].as<JsonArray>();
    eventCount = 0;
    for (JsonObject e : eArr) {
        if (eventCount >= MAX_EVENTS_TODAY) break;
        eventsToday[eventCount].hour   = e["h"];
        eventsToday[eventCount].minute = e["m"];
        eventsToday[eventCount].ml     = e["ml"];
        strncpy(eventsToday[eventCount].type, e["type"] | "pickup", 7);
        eventCount++;
    }

    todayTotalMl = 0;
    for (int i = 0; i < eventCount; i++) todayTotalMl += eventsToday[i].ml;
    todayEvents = eventCount;

    Serial.printf("[DRINKS] loaded: %d streak, %d events today\n", streakCount, eventCount);
}

// ============================================================================
// 设置
// ============================================================================
void storage_save_settings() {
    File f = LittleFS.open(FILE_SETTINGS, "w");
    if (!f) return;
    JsonDocument doc;
    doc["targetMl"]      = settings.targetMl;
    doc["reminderMin"]   = settings.reminderMin;
    doc["ledBrightness"] = settings.ledBrightness;
    doc["ledColor"]      = settings.ledColor;
    serializeJson(doc, f);
    f.close();
}

void storage_load_settings() {
    if (!LittleFS.exists(FILE_SETTINGS)) return;
    File f = LittleFS.open(FILE_SETTINGS, "r");
    if (!f) return;
    JsonDocument doc;
    if (deserializeJson(doc, f)) { f.close(); return; }
    f.close();
    settings.targetMl      = doc["targetMl"]      | 2000;
    settings.reminderMin   = doc["reminderMin"]   | 30;
    settings.ledBrightness = doc["ledBrightness"] | 128;
    settings.ledColor      = doc["ledColor"]      | "0000FF";
}

#include "drink_state.h"
#include "storage.h"
#include "led_control.h"
#include "ntp_time.h"

// ============================================================================
// 事件记录
// ============================================================================
static void _add_drink_event(int ml, const char* type) {
    if (eventCount >= MAX_EVENTS_TODAY) return;
    time_t now; time(&now);
    struct tm* t = localtime(&now);
    eventsToday[eventCount].hour   = t->tm_hour;
    eventsToday[eventCount].minute = t->tm_min;
    eventsToday[eventCount].ml     = ml;
    strncpy(eventsToday[eventCount].type, type, 7);
    eventCount++;
    todayTotalMl += ml;
    todayEvents++;
    lastDrinkAt = millis();
    storage_save_drinks();

    if (strcmp(type, "refill") == 0 && weightStable > calibFullRefG) {
        calibFullRefG = weightStable;
        storage_save_calib();
        Serial.printf("[FULL] updated ref: %.1fg\n", calibFullRefG);
    }

    // 目标达成 → 彩虹 3 秒
    if (todayTotalMl >= settings.targetMl) {
        led_set("rainbow", ledColor, 128);
        static unsigned long goalAt = millis();
        goalAt = millis();
    }

    Serial.printf("[DRINK] +%dml type=%s total=%dml today\n", ml, type, todayTotalMl);
}

// ============================================================================
// 日期切换
// ============================================================================
void drink_check_day_rollover() {
    int today = ntp_day_of_year();
    if (eventDay != 0 && eventDay != today) {
        if (streakCount >= MAX_STREAK) {
            for (int i = 0; i < MAX_STREAK - 1; i++) streak[i] = streak[i + 1];
            streakCount = MAX_STREAK - 1;
        }
        streak[streakCount].totalMl    = todayTotalMl;
        streak[streakCount].eventCount = todayEvents;
        int m, d; ntp_get_date(&m, &d);
        streak[streakCount].month = m;
        streak[streakCount].day   = d;
        streakCount++;

        eventCount = 0;
        todayTotalMl = 0;
        todayEvents  = 0;
        storage_save_drinks();
        Serial.println("[DRINKS] day rolled over");
    }
    eventDay = today;
}

// ============================================================================
// 稳定检测
// ============================================================================
static bool _wait_for_stable(unsigned long timeoutMs) {
    static unsigned long start = 0;
    static float ref = 0;

    if (start == 0) { start = millis(); ref = weightFiltered; return false; }

    if (abs(weightFiltered - ref) > STABILITY_MAX_VAR_G) {
        start = millis(); ref = weightFiltered; return false;
    }

    if (millis() - start >= timeoutMs) {
        weightStable = weightFiltered;
        start = 0;
        return true;
    }
    return false;
}

static void _update_stable_weight() {
    static unsigned long last = 0;
    static float first = 0;
    static unsigned long firstAt = 0;

    float w = weightFiltered;
    if (firstAt == 0 || abs(w - first) > STABILITY_MAX_VAR_G) {
        first = w; firstAt = millis(); return;
    }

    if (millis() - firstAt >= STABILITY_WINDOW_MS) {
        weightStable = weightStable * 0.7f + w * 0.3f;
        firstAt = 0;

        static unsigned long lastEvap = 0;
        if (millis() - lastEvap > 3600000) {
            lastEvap = millis();
            if (abs(weightStable - weightFiltered) < EVAPORATION_G_PER_H) {
                weightStable = weightFiltered;
            }
        }
    }
}

// ============================================================================
// 主状态机
// ============================================================================
void drink_state_init() {
    if (calibState == CALIB_DONE) {
        drinkState = STATE_IDLE;
        weightStable = weightFiltered;
    }
    eventDay = ntp_day_of_year();
}

void drink_state_update() {
    if (calibState != CALIB_DONE) { drinkState = STATE_UNKNOWN; return; }

    float w = weightFiltered;
    float threshold = calibTareG * 0.3f;
    if (threshold < 10) threshold = 10;

    switch (drinkState) {

    case STATE_IDLE: {
        if (w < threshold) {
            weightBeforePickup = weightStable;
            pickedUpAt = millis();
            drinkState = STATE_PICKED_UP;
            Serial.printf("[STATE] IDLE → PICKED_UP (w=%.1f < %.1f)\n", w, threshold);
            led_set("solid", CRGB(255, 100, 0), 128);
            break;
        }

        if (weightStable - w > STRAW_THRESHOLD_G && w >= threshold) {
            strawDrinkBase = weightStable;
            lastStrawCheck = millis();
            drinkState = STATE_STRAW_DRINK;
            Serial.printf("[STATE] IDLE → STRAW_DRINK (drop %.1fg)\n", weightStable - w);
            led_set("solid", CRGB(0, 180, 255), 128);
            break;
        }

        _update_stable_weight();
        break;
    }

    case STATE_PICKED_UP: {
        if (w >= threshold) {
            if (_wait_for_stable(2000)) {
                float delta = weightBeforePickup - weightStable;
                if (delta > DRINK_THRESHOLD_G) {
                    _add_drink_event((int)round(delta), "pickup");
                    led_set("solid", CRGB(0, 200, 50), 128);
                } else if (delta < -DRINK_THRESHOLD_G) {
                    _add_drink_event((int)round(-delta), "refill");
                    led_set("solid", CRGB(0, 100, 255), 128);
                } else {
                    Serial.printf("[STATE] PICKED_UP → IDLE (no change, delta=%.1f)\n", delta);
                }
                drinkState = STATE_IDLE;
                weightStable = weightFiltered;
                led_set("off", CRGB::Black, 128);
            }
            break;
        }
        if (millis() - pickedUpAt > PICKUP_TIMEOUT_MS) {
            drinkState = STATE_EMPTY;
            stateEnteredAt = millis();
            Serial.println("[STATE] PICKED_UP → EMPTY (timeout)");
            led_set("off", CRGB::Black, 128);
        }
        break;
    }

    case STATE_STRAW_DRINK: {
        unsigned long elapsed = millis() - lastStrawCheck;
        if (elapsed > 3000 && _wait_for_stable(1000)) {
            float delta = strawDrinkBase - weightStable;
            if (delta > DRINK_THRESHOLD_G) {
                _add_drink_event((int)round(delta), "straw");
                Serial.printf("[STATE] STRAW_DRINK → IDLE (drank %dml)\n", (int)round(delta));
            }
            drinkState = STATE_IDLE;
            weightStable = weightFiltered;
            led_set("off", CRGB::Black, 128);
            break;
        }
        if (elapsed > 2000 && abs(weightFiltered - strawDrinkBase) < STRAW_THRESHOLD_G) {
            drinkState = STATE_IDLE;
            Serial.println("[STATE] STRAW_DRINK → IDLE (false alarm)");
            led_set("off", CRGB::Black, 128);
        }
        break;
    }

    case STATE_EMPTY: {
        if (w >= threshold && _wait_for_stable(2000)) {
            float newTare = weightFiltered;
            float diff = abs(newTare - calibTareG);
            if (diff > 50) {
                Serial.printf("[STATE] EMPTY → IDLE (new cup: %.1fg, old: %.1fg)\n", newTare, calibTareG);
            } else if (diff > 5) {
                // micro-adjust
            }
            calibTareG = newTare;
            storage_save_calib();
            weightStable = weightFiltered;
            drinkState = STATE_IDLE;
            Serial.printf("[STATE] EMPTY → IDLE (tare=%.1fg)\n", calibTareG);
        }
        if (millis() - stateEnteredAt > AWAY_TIMEOUT_MS) {
            drinkState = STATE_AWAY;
            Serial.println("[STATE] EMPTY → AWAY (30min timeout, entering deep sleep)");
        }
        break;
    }

    case STATE_AWAY:
        // AWAY 状态由 main.cpp 的 deep sleep 逻辑接管, 这里不做处理
        break;

    default: break;
    }

    // --- 喝水提醒 ---
    if (drinkState == STATE_IDLE && lastDrinkAt > 0 && ledModeStr != "breathe") {
        unsigned long sinceDrink = millis() - lastDrinkAt;
        if (sinceDrink > (unsigned long)settings.reminderMin * 60000UL) {
            led_set("breathe", CRGB(0, 100, 255), 128);
        }
    }
}

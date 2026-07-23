#include "hx711_driver.h"

static bool _initialized = false;
static bool _powered_down = false;

void hx711_init() {
    Serial.print("[HX711] Init... ");
    LoadCell.begin();
    unsigned long start = millis();
    while (!LoadCell.update()) {
        if (millis() - start > 3000) break;
    }
    LoadCell.start(2000);
    LoadCell.setCalFactor(calibFactor);
    _initialized = true;
    _powered_down = false;
    Serial.printf("OK (factor=%.1f)\n", calibFactor);
}

bool hx711_update() {
    if (!_initialized || _powered_down) return false;
    if (!LoadCell.update()) return false;

    float raw = LoadCell.getData();
    weightBuf[weightBufIdx] = raw;
    weightBufIdx = (weightBufIdx + 1) % WEIGHT_BUF_SIZE;
    if (weightBufCount < WEIGHT_BUF_SIZE) weightBufCount++;

    if (millis() - lastWeightRead >= 100 && weightBufCount > 0) {
        lastWeightRead = millis();
        float sum = 0;
        for (int i = 0; i < weightBufCount; i++) sum += weightBuf[i];
        weightFiltered = sum / weightBufCount;
        return true;
    }
    return false;
}

float hx711_get_grams() {
    return weightFiltered;
}

float hx711_sample_average(int samples, unsigned long timeoutMs) {
    float sum = 0;
    int cnt = 0;
    unsigned long start = millis();
    while (millis() - start < timeoutMs && cnt < samples) {
        if (LoadCell.update()) {
            sum += LoadCell.getData();
            cnt++;
        }
    }
    return cnt > 0 ? sum / cnt : weightFiltered;
}

void hx711_set_factor(float f) {
    calibFactor = f;
    LoadCell.setCalFactor(f);
}

// ============================================================================
// PD_SCK 休眠控制 (HX711 内置 <1µA 休眠)
// ============================================================================
void hx711_power_down() {
    if (_powered_down) return;
    // 暂停库的连续读数 (下次 update 会跳过)
    // 然后拉高 SCK >60µs 触发 HX711 休眠
    pinMode(PIN_HX711_SCK, OUTPUT);
    digitalWrite(PIN_HX711_SCK, HIGH);
    delayMicroseconds(70);
    _powered_down = true;
    Serial.println("[HX711] powered down");
}

void hx711_power_up() {
    if (!_powered_down) return;
    // 拉低 SCK 唤醒 HX711, 芯片自动开始一次新转换
    digitalWrite(PIN_HX711_SCK, LOW);
    delayMicroseconds(5);

    // 等待 DT 变低 (转换完成), 超时 100ms
    unsigned long start = millis();
    while (digitalRead(PIN_HX711_DT) == HIGH) {
        if (millis() - start > 100) {
            Serial.println("[HX711] wake timeout");
            _powered_down = false;
            return;
        }
    }
    _powered_down = false;
    Serial.println("[HX711] powered up");
}

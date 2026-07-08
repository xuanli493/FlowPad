#include "hx711_driver.h"

static bool _initialized = false;

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
    Serial.printf("OK (factor=%.1f)\n", calibFactor);
}

bool hx711_update() {
    if (!_initialized) return false;
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

#include "wifi_manager.h"
#include "led_control.h"

// ============================================================================
// 扫描
// ============================================================================
bool wifi_scan() {
    Serial.print("[WiFi] Scanning... ");
    int n = WiFi.scanNetworks(false, true, false, WIFI_SCAN_PER_CHAN_MS);
    Serial.printf("%d networks\n", n);

    scanCount = 0;
    for (int i = 0; i < n && scanCount < MAX_SCAN_NETWORKS; i++) {
        // 去重
        bool dup = false;
        for (int j = 0; j < scanCount; j++) {
            if (scanResults[j].ssid == WiFi.SSID(i)) { dup = true; break; }
        }
        if (dup) continue;

        scanResults[scanCount].ssid   = WiFi.SSID(i);
        scanResults[scanCount].rssi   = WiFi.RSSI(i);
        scanResults[scanCount].secure = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
        scanCount++;
    }

    // 按信号强度排序
    for (int i = 0; i < scanCount - 1; i++) {
        for (int j = i + 1; j < scanCount; j++) {
            if (scanResults[j].rssi > scanResults[i].rssi) {
                WifiNetwork tmp = scanResults[i];
                scanResults[i] = scanResults[j];
                scanResults[j] = tmp;
            }
        }
    }

    WiFi.scanDelete();
    return scanCount > 0;
}

// ============================================================================
// 保存/加载 WiFi 配置
// ============================================================================
void wifi_save_config(const char* ssid, const char* pass) {
    File f = LittleFS.open(FILE_WIFI, "w");
    if (!f) return;
    JsonDocument doc;
    doc["ssid"] = ssid;
    doc["pass"] = pass;
    serializeJson(doc, f);
    f.close();
    Serial.printf("[WiFi] saved config: %s\n", ssid);
}

void wifi_load_config() {
    if (!LittleFS.exists(FILE_WIFI)) {
        return;
    }
    File f = LittleFS.open(FILE_WIFI, "r");
    if (!f) return;
    JsonDocument doc;
    if (deserializeJson(doc, f)) { f.close(); return; }
    f.close();

    String saved = doc["ssid"] | "";
    String pass  = doc["pass"] | "";
    if (saved.length() == 0) return;

    wifiSSID = saved;
    wifiPass = pass;
    Serial.printf("[WiFi] loaded config: %s\n", wifiSSID.c_str());
}

bool wifi_config_exists() {
    return LittleFS.exists(FILE_WIFI);
}

// ============================================================================
// 初始化: 连接或 AP
// ============================================================================
void wifi_init() {
    if (wifiSSID.length() > 0 && wifiPass.length() > 0) {
        // 有保存的 WiFi，尝试连接
        Serial.printf("[WiFi] Connecting to %s", wifiSSID.c_str());
        WiFi.mode(WIFI_STA);
        WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());

        int elapsed = 0;
        while (WiFi.status() != WL_CONNECTED && elapsed < WIFI_TIMEOUT_SEC * 2) {
            delay(500); Serial.print("."); elapsed++;
        }

        if (WiFi.status() == WL_CONNECTED) {
            wifiConnected = true;
            Serial.printf("\n[WiFi] OK IP=%s RSSI=%d\n",
                          WiFi.localIP().toString().c_str(), WiFi.RSSI());

            // mDNS
            Serial.print("[mDNS] ");
            if (MDNS.begin("flowpad")) {
                MDNS.addService("http", "tcp", 80);
                Serial.println("OK");
            } else {
                Serial.println("FAILED");
            }
            return;
        }
        Serial.println("\n[WiFi] FAILED → AP mode");
        led_flash(CRGB(255, 0, 0), 2, 200);  // 红快闪 2 次
        WiFi.disconnect(true);
        delay(500);
    }

    // 扫描 + 开 AP
    WiFi.mode(WIFI_STA);
    delay(500);
    wifi_scan();
    WiFi.mode(WIFI_AP);
    apMode = true;

    if (apPass.length() > 0) {
        WiFi.softAP(apSSID.c_str(), apPass.c_str());
    } else {
        WiFi.softAP(apSSID.c_str());
    }
    Serial.printf("[WiFi] AP IP=%s\n", WiFi.softAPIP().toString().c_str());

    // AP 模式黄呼吸灯效
    led_set("breathe", CRGB(255, 200, 0), 64);
}

bool wifi_is_connected() { return wifiConnected; }
bool wifi_is_ap_mode()   { return apMode; }
int  wifi_rssi()         { return wifiConnected ? WiFi.RSSI() : 0; }

String wifi_local_ip() {
    return apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
}

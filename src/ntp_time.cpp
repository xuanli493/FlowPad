#include "ntp_time.h"

void ntp_init() {
    timeSynced = false;
    lastNtpTry = 0;
}

bool ntp_sync() {
    if (timeSynced) return true;
    if (!wifiConnected) return false;
    if (millis() < 5000) return false;
    if (millis() - lastNtpTry < 10000) return false;

    lastNtpTry = millis();
    Serial.print("[NTP] syncing... ");
    configTime(GMT_OFFSET_SEC, 0, "ntp.aliyun.com", "ntp1.aliyun.com", "pool.ntp.org");

    time_t now;
    for (int i = 0; i < 30; i++) {
        time(&now);
        if (now > 1700000000) {
            timeSynced = true;
            struct tm* t = localtime(&now);
            Serial.printf("OK %04d-%02d-%02d %02d:%02d:%02d\n",
                          t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
                          t->tm_hour, t->tm_min, t->tm_sec);
            return true;
        }
        delay(100);
    }
    Serial.println("FAILED");
    return false;
}

bool ntp_synced() { return timeSynced; }

String ntp_time_str() {
    time_t now;
    time(&now);
    struct tm* t = localtime(&now);
    char buf[32];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d:%02d",
             t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
             t->tm_hour, t->tm_min, t->tm_sec);
    return String(buf);
}

void ntp_get_date(int* month, int* day) {
    time_t now; time(&now);
    struct tm* t = localtime(&now);
    *month = t->tm_mon + 1;
    *day   = t->tm_mday;
}

int ntp_day_of_year() {
    time_t now; time(&now);
    return localtime(&now)->tm_yday;
}

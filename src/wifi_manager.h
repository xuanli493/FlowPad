#pragma once
#include "config.h"

void wifi_init();
bool wifi_scan();                // 扫描并缓存到 scanResults
bool wifi_rescan();              // AP 模式下重新扫描 (临时切 STA→扫→回 AP)
void wifi_load_config();         // 加载 /wifi.json
void wifi_save_config(const char* ssid, const char* pass);
bool wifi_config_exists();

bool wifi_is_connected();
bool wifi_is_ap_mode();
int  wifi_rssi();
String wifi_local_ip();

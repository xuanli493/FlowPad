#pragma once
#include "config.h"

void hx711_init();
bool hx711_update();
float hx711_get_grams();
float hx711_sample_average(int samples, unsigned long timeoutMs);
void hx711_set_factor(float f);

// PD_SCK 休眠控制 (HX711 内置特性, 无需外部 MOS)
void hx711_power_down();   // SCK 拉高 >60µs, HX711 进入 <1µA 休眠
void hx711_power_up();     // SCK 拉低, 唤醒并等待首次转换完成

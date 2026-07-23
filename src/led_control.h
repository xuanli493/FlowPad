#pragma once
#include "config.h"

uint32_t led_parse_hex(const String& hex);
void led_init();
void led_set(const String& mode, CRGB color, int brightness);
void led_update();
void led_flash(CRGB color, int count, int intervalMs);  // 非阻塞快闪
void led_power_on();    // GPIO2 HIGH → AO3401 导通, 灯带电
void led_power_off();   // GPIO2 LOW  → AO3401 截止, 灯带彻底断电

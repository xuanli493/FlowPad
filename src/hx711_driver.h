#pragma once
#include "config.h"

void hx711_init();
bool hx711_update();
float hx711_get_grams();
float hx711_sample_average(int samples, unsigned long timeoutMs);
void hx711_set_factor(float f);

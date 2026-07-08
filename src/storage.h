#pragma once
#include "config.h"

// --- LittleFS ---
void storage_init();

// --- 校准 ---
void storage_load_calib();
void storage_save_calib();

// --- 喝水记录 ---
void storage_load_drinks();
void storage_save_drinks();

// --- 设置 ---
void storage_load_settings();
void storage_save_settings();

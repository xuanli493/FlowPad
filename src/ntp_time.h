#pragma once
#include "config.h"

void ntp_init();
bool ntp_sync();
bool ntp_synced();
String ntp_time_str();
void ntp_get_date(int* month, int* day);
int  ntp_day_of_year();

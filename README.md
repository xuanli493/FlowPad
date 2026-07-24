# FlowPad 智能杯垫

基于 ESP32-C3 的智能饮水监测杯垫，通过高精度称重传感器实时追踪饮水量，配合 AI 饮水教练提供个性化健康建议。

## 功能特性

### 智能喝水检测
- **拿起喝水检测**：拿起杯子 → 放回 → 自动计算喝水量
- **吸管喝水检测**：重量突然下降但不归零 → 识别吸管饮用
- **接水识别**：重量增加 → 自动更新满杯参考值
- **换杯自动学习**：换杯子后自动识别新皮重，无需重新校准
- **多口合并**：30 秒内连续多次拿起自动合并为一次事件
- **蒸发补偿**：每小时自动修正重量基线

### AI 饮水教练
- 浏览器端调用 OpenAI 兼容 API（支持 OpenAI / DeepSeek / 通义千问 / 自定义）
- 基于近 7 天喝水数据生成个性化分析报告
- API Key 端到端加密存储于浏览器 localStorage
- 单次分析成本 < 0.01 元（使用 DeepSeek）

### 毛玻璃风 Web 仪表盘
- 设备本地托管 SPA，局域网零延迟访问
- Hash 路由：仪表盘 / 校准向导 / 设置 / OOBE 配网
- **仪表盘**：实时重量、喝水进度环、SVG 7 天柱状图、AI 分析卡片
- **校准向导**：两步校准（空载 → 空杯），满杯动态学习
- **设置**：喝水目标 + 年龄段预设、提醒间隔、LED 颜色/亮度、AI 配置
- **OOBE 配网**：WiFi 扫描、密码输入、一键连接

### WS2812B 灯效系统
- 23 颗可独立寻址 RGB LED
- 灯效模式：常亮 / 呼吸 / 彩虹 / 快闪 / 关闭
- 场景联动：校准中（白色）、喝水提醒（蓝色呼吸）、目标达成（彩虹）、配网中（黄色呼吸）、错误（红色快闪）
- AO3401 P-MOS 硬件断电控制，休眠时彻底关闭

### 功耗管理
- **活跃模式**（杯子在位）：WiFi 保活，~15mA
- **空载检测**：杯子被拿走 2 分钟 → 降功耗
- **AWAY 深度睡眠**：30 分钟无人 → HX711 PD_SCK 休眠 + LED 断电 + ESP32 深度睡眠（~5µA）
- 定时器周期性唤醒检查（30 秒间隔），杯子放回自动恢复

### OTA 远程升级
- 基于 ElegantOTA，Web 页面拖拽上传固件
- ESP32 双分区 OTA（app0 / app1），升级失败自动回滚
- 前端支持 gzip 压缩传输，节省带宽

## 硬件规格

| 组件 | 型号 / 参数 |
|------|------------|
| MCU | ESP32-C3, RISC-V 160MHz, 4MB Flash |
| 称重 | HX711 24-bit ADC + 称重传感器 |
| 灯珠 | WS2812B × 23, FastLED 驱动 |
| LED 供电 | AO3401 P-MOS 开关, GPIO2 控制 |
| 串口 | UART0 → CH340, GPIO20=RX, GPIO21=TX |
| 电池 | 2000mAh 锂电, DCDC 升压 |
| 存储 | LittleFS ~1.4MB |

## 开发环境

| 工具 | 说明 |
|------|------|
| PlatformIO | 固件编译 & 烧录 |
| Arduino Framework | ESP32-C3 开发框架 |
| Node.js | 前端构建脚本（合并 HTML/CSS/JS → gzip） |
| Python | 一键刷写脚本 `scripts/flash.py` |

## 关键依赖

| 库 | 用途 |
|----|------|
| HX711_ADC (olkal) | 称重传感器驱动 |
| FastLED | WS2812B 灯带控制 |
| ESPAsyncWebServer | HTTP 服务 + REST API |
| ArduinoJson | JSON 序列化 |
| ElegantOTA | Web OTA 固件升级 |

## 快速开始

```bash
# 一键构建 + 编译 + 烧录 + 上传文件系统
python scripts/flash.py

# 仅构建不烧录（CI / 检查编译）
python scripts/flash.py --no-upload --no-fs

# 烧录后打开串口监视
python scripts/flash.py --monitor

# 仅构建前端
python scripts/build.py
```

## 使用流程

1. **上电**：ESP32-C3 启动，若未配网则自动开启 AP 热点 `FlowPad-Setup`
2. **配网**：手机连接热点 → 浏览器访问 `192.168.4.1` → 扫描 WiFi → 输入密码 → 连接
3. **校准**：前端自动跳转校准向导 → 空载 → 放上空杯 → 完成
4. **使用**：访问 `http://flowpad.local` → 正常喝水自动记录
5. **AI 分析**：设置页配置 API Key → 仪表盘点"AI 分析"获取个性化建议
6. **升级**：访问 `http://flowpad.local/update` → 拖拽固件上传

## 项目结构

```
FlowPad/
├── src/                    # 固件源码
│   ├── main.cpp            # 入口 + setup/loop + 深度睡眠
│   ├── config.h            # 引脚定义 + 常量
│   ├── hx711_driver.cpp    # HX711 驱动 + PD_SCK 休眠
│   ├── led_control.cpp     # FastLED 灯效 + MOSFET 电源控制
│   ├── wifi_manager.cpp    # WiFi STA/AP + 配网
│   ├── drink_state.cpp     # 喝水检测状态机
│   ├── api_routes.cpp      # REST API + 静态文件 + gzip
│   ├── storage.cpp         # LittleFS 读写
│   ├── ntp_time.cpp        # NTP 对时
│   └── calibration.cpp     # 校准逻辑
├── frontend/               # 前端 SPA
│   ├── index.html          # 入口
│   ├── css/style.css       # 毛玻璃风样式
│   └── js/
│       ├── app.js          # 路由 + 初始化
│       ├── router.js       # Hash 路由
│       ├── pages/          # 各页面逻辑
│       └── ai.js           # AI 分析模块
├── scripts/
│   ├── flash.py            # 一键刷写
│   └── build.js            # 前端构建
├── data/www/               # 构建输出 → LittleFS
└── platformio.ini          # PlatformIO 配置
```

## 喝水检测状态机

```
UNKNOWN → IDLE → PICKED_UP → (喝水/接水/忽略) → IDLE
                        ↓ (2分钟超时)
                      EMPTY → (杯子放回, 自动学习) → IDLE
                        ↓ (30分钟超时)
                      AWAY → 深度睡眠 → 定时唤醒检查 → (杯子放回) → 重启
```

## 许可证

MIT

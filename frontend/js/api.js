/**
 * FlowPad API 客户端
 */
const API = (() => {
    const BASE = '';

    async function get(path) {
        const res = await fetch(BASE + path);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    async function post(path, data) {
        const res = await fetch(BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {})
        });
        // wifi/connect 会重启设备, 可能没有响应
        if (path === '/api/wifi/connect') return { ok: true };
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    // --- 设备 ---
    function getStatus()  { return get('/api/status'); }
    function getWeight()  { return get('/api/weight'); }
    function getTime()    { return get('/api/time'); }

    // --- 校准 ---
    function calibrateStep1()  { return post('/api/calibrate/step1'); }
    function calibrateStep2()  { return post('/api/calibrate/step2'); }
    function getCalibState()   { return get('/api/calibrate'); }

    // --- 喝水历史 ---
    function getHistory() { return get('/api/history'); }

    // --- LED ---
    function setLed(data)     { return post('/api/led', data); }

    // --- 设置 ---
    function getSettings()    { return get('/api/settings'); }
    function setSettings(d)   { return post('/api/settings', d); }

    // --- 配网 ---
    function getWifiScan()    { return get('/api/wifi/scan'); }
    function getWifiStatus()  { return get('/api/wifi/status'); }
    function connectWifi(ssid, pass) { return post('/api/wifi/connect', {ssid, pass}); }

    // --- 恢复出厂 ---
    function factoryReset()   { return post('/api/factory/reset'); }

    return {
        get, post,
        getStatus, getWeight, getTime,
        calibrateStep1, calibrateStep2, getCalibState,
        getHistory,
        setLed,
        getSettings, setSettings,
        getWifiScan, getWifiStatus, connectWifi,
        factoryReset
    };
})();

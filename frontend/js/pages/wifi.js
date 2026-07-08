/**
 * 配网向导 - AP 模式选 WiFi + 输密码 → 连接重启
 */
function Wifi(container) {
    let networks = [];
    let selectedSSID = '';
    let connecting = false;

    async function render() {
        let status = { connected: false, apMode: false, ssid: '', ip: '' };
        try { status = await API.getWifiStatus(); } catch (e) {}

        if (status.connected) {
            container.innerHTML = `
                <div class="card" style="text-align:center">
                    <div style="font-size:48px;margin-bottom:12px">&#127758;</div>
                    <h2>已连接</h2>
                    <p style="color:var(--text-dim);font-size:14px">
                        ${status.ssid}<br>
                        IP: ${status.ip}
                    </p>
                    <p style="color:var(--text-hint);font-size:12px;margin-top:16px">
                        如需更换 WiFi，请长按设备按钮重置
                    </p>
                </div>
            `;
            return;
        }

        // AP 模式: 加载扫描列表
        try {
            const data = await API.getWifiScan();
            networks = data.networks || [];
        } catch (e) {
            networks = [];
        }

        container.innerHTML = `
            <div class="card">
                <div style="text-align:center;margin-bottom:20px">
                    <div style="font-size:36px;margin-bottom:8px">&#128246;</div>
                    <h2>配置 WiFi</h2>
                    <p style="color:var(--text-hint);font-size:13px">
                        当前模式: AP · ${status.ip || '192.168.4.1'}
                    </p>
                </div>

                <div class="form-group">
                    <label class="form-label">WiFi 网络</label>
                    <div style="display:flex;gap:8px">
                        <select id="wifiSelect" class="form-input" style="flex:1">
                            <option value="">选择网络...</option>
                        </select>
                        <button id="btnRefresh" class="btn btn-sm">刷新</button>
                    </div>
                    <div style="font-size:11px;color:var(--text-hint);margin-top:4px" id="scanInfo">
                        ${networks.length} 个网络可用
                    </div>
                </div>

                <div class="form-group" id="passwordGroup" style="display:none">
                    <label class="form-label">密码</label>
                    <input type="password" id="wifiPassword" class="form-input"
                           placeholder="请输入 WiFi 密码" style="width:100%">
                    <label style="display:inline-flex;align-items:center;margin-top:6px;cursor:pointer;
                                  font-size:12px;color:var(--text-hint);gap:4px">
                        <input type="checkbox" id="showPass">
                        显示密码
                    </label>
                </div>

                <button id="btnConnect" class="btn btn-block" disabled>
                    连接
                </button>

                <div id="connectStatus" style="display:none;margin-top:12px;padding:16px;
                     border-radius:8px;background:#f0f7ff;text-align:center">
                    <p style="font-size:14px;color:var(--primary)">设备正在重启...</p>
                    <p style="font-size:24px;font-weight:700;color:var(--primary);margin:8px 0"
                       id="countdown">--</p>
                    <p style="font-size:12px;color:var(--text-hint)">
                        重启后请重新连接到新的 WiFi 网络访问设备
                    </p>
                </div>

                <div id="connectError" style="display:none;margin-top:12px;padding:10px;border-radius:8px;
                     background:#fff0f0;color:#c00;font-size:13px;text-align:center"></div>

                <p style="color:var(--text-hint);font-size:11px;text-align:center;margin-top:16px">
                    设备已扫描附近网络保存到本地<br>选择后输入密码，自动重启连接
                </p>
            </div>
        `;

        // 填充下拉
        const sel = document.getElementById('wifiSelect');
        networks.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.ssid;
            const sig = n.rssi > -50 ? ' [强]' : n.rssi > -70 ? '' : ' [弱]';
            opt.textContent = n.ssid + (n.secure ? ' \uD83D\uDD12' : '') + sig;
            sel.appendChild(opt);
        });

        bindEvents();
    }

    function bindEvents() {
        const sel = document.getElementById('wifiSelect');
        const pwd = document.getElementById('wifiPassword');
        const pwGroup = document.getElementById('passwordGroup');
        const btn = document.getElementById('btnConnect');
        const err = document.getElementById('connectError');
        const statusDiv = document.getElementById('connectStatus');
        const cd = document.getElementById('countdown');

        if (sel) sel.addEventListener('change', () => {
            selectedSSID = sel.value;
            if (selectedSSID) {
                pwGroup.style.display = '';
                pwd.focus();
                updateConnectButton();
            } else {
                pwGroup.style.display = 'none';
                btn.disabled = true;
                err.style.display = 'none';
            }
        });

        if (pwd) pwd.addEventListener('input', updateConnectButton);

        const showP = document.getElementById('showPass');
        if (showP) showP.addEventListener('change', () => {
            pwd.type = showP.checked ? 'text' : 'password';
        });

        if (btn) btn.addEventListener('click', async () => {
            if (connecting) return;
            connecting = true;
            btn.style.display = 'none';
            err.style.display = 'none';
            statusDiv.style.display = '';

            // 倒计时
            let remaining = 30;
            cd.textContent = remaining + 's';
            const timer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(timer);
                    cd.textContent = '请刷新页面';
                } else {
                    cd.textContent = remaining + 's';
                }
            }, 1000);

            try {
                await API.connectWifi(selectedSSID, pwd.value);
                // ESP.restart() 会断开, 可能收不到响应
                clearInterval(timer);
                cd.textContent = '请重新连接 WiFi 访问设备';
            } catch (e) {
                clearInterval(timer);
                connecting = false;
                btn.style.display = '';
                statusDiv.style.display = 'none';
                err.style.display = '';
                err.textContent = '连接失败: ' + e.message;
            }
        });

        const refresh = document.getElementById('btnRefresh');
        if (refresh) refresh.addEventListener('click', async () => {
            refresh.disabled = true;
            refresh.textContent = '扫描中...';
            try {
                const data = await API.rescanWifi();
                networks = data.networks || [];
                render();
            } catch (e) {
                refresh.textContent = '失败';
                setTimeout(() => { refresh.textContent = '刷新'; refresh.disabled = false; }, 1500);
            }
        });
    }

    function updateConnectButton() {
        const btn = document.getElementById('btnConnect');
        const pwd = document.getElementById('wifiPassword');
        if (!btn || connecting) return;
        btn.disabled = !selectedSSID || !pwd || pwd.value.length === 0;
    }

    render();
    return { destroy() {} };
}

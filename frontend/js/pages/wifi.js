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
                    <select id="wifiSelect" class="form-input" style="width:100%">
                        <option value="">选择网络...</option>
                    </select>
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
                    网络列表来自设备启动时扫描<br>如列表为空，请重启设备后重试
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

        if (btn) btn.addEventListener('click', () => {
            if (connecting) return;
            connecting = true;
            btn.style.display = 'none';
            err.style.display = 'none';
            statusDiv.style.display = '';

            // Fire-and-forget: 设备必然重启, fetch 必然失败
            API.connectWifi(selectedSSID, pwd.value);

            // 纯前端倒计时 8 秒
            let remaining = 8;
            cd.textContent = remaining + 's';
            const timer = setInterval(() => {
                remaining--;
                if (remaining > 0) {
                    cd.textContent = remaining + 's';
                } else {
                    clearInterval(timer);
                    cd.textContent = '请重新连接 WiFi 访问设备';
                }
            }, 1000);
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

/**
 * 设置页
 */
function Settings(container) {
    let data = null;

    async function render() {
        data = await API.get('/api/settings');

        container.innerHTML = `
            <div class="card">
                <h2>喝水目标</h2>
                <div class="form-group">
                    <label>每日目标 (ml)</label>
                    <input type="number" id="targetMl" value="${data.targetMl}" min="500" max="10000" step="100">
                </div>
            </div>

            <div class="card">
                <h2>提醒</h2>
                <div class="form-group">
                    <label>提醒间隔 (分钟)</label>
                    <input type="number" id="reminderMin" value="${data.reminderMin}" min="5" max="120" step="5">
                </div>
            </div>

            <div class="card">
                <h2>灯光</h2>
                <div class="form-group">
                    <label>模式</label>
                    <select id="ledMode">
                        <option value="off">关闭</option>
                        <option value="solid">常亮</option>
                        <option value="breathe">呼吸</option>
                        <option value="rainbow">彩虹</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>颜色</label>
                    <div class="color-row">
                        <input type="color" id="ledColor" value="#${data.ledColor}">
                        <span id="ledColorHex" style="font-size:14px;color:var(--text-dim)">#${data.ledColor}</span>
                    </div>
                    <div class="led-presets">
                        <div class="led-preset" style="background:#0071e3" data-color="0071E3" title="蓝"></div>
                        <div class="led-preset" style="background:#5856d6" data-color="5856D6" title="紫"></div>
                        <div class="led-preset" style="background:#34c759" data-color="34C759" title="绿"></div>
                        <div class="led-preset" style="background:#ff9500" data-color="FF9500" title="橙"></div>
                        <div class="led-preset" style="background:#ff3b30" data-color="FF3B30" title="红"></div>
                        <div class="led-preset" style="background:#aeaeb2" data-color="AEAEB2" title="白"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>亮度: <span id="briVal" style="font-weight:400">${data.ledBrightness}</span></label>
                    <input type="range" id="ledBrightness" value="${data.ledBrightness}" min="4" max="255" step="1">
                </div>
            </div>

            <div class="btn-group" style="justify-content:flex-end">
                <button class="btn" id="btnSave">保存设置</button>
            </div>

            <p class="page-footer">设置自动保存到设备 \u00B7 断电不丢失</p>

            <div class="card" style="margin-top:24px;border:1px solid #ffd3d3">
                <h2 style="color:#cc0000">危险操作</h2>
                <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">
                    清除所有校准数据、喝水记录、WiFi 配置和设置，恢复出厂状态。
                </p>
                <button class="btn btn-danger" id="btnReset">恢复出厂设置</button>
            </div>
        `;

        // 初始化当前模式
        const status = await API.get('/api/status');
        const modeSel = document.getElementById('ledMode');
        if (modeSel) modeSel.value = status.ledMode || 'solid';

        bindEvents();
    }

    function bindEvents() {
        document.getElementById('btnSave').addEventListener('click', async () => {
            const payload = {
                targetMl:      parseInt(document.getElementById('targetMl').value),
                reminderMin:   parseInt(document.getElementById('reminderMin').value),
                ledBrightness: parseInt(document.getElementById('ledBrightness').value),
                ledColor:      document.getElementById('ledColor').value.replace('#', '')
            };
            await API.post('/api/settings', payload);
            await API.post('/api/led', {
                mode:       document.getElementById('ledMode').value,
                color:      payload.ledColor,
                brightness: payload.ledBrightness
            });
            showToast('已保存');
        });

        document.getElementById('ledBrightness').addEventListener('input', e => {
            document.getElementById('briVal').textContent = e.target.value;
        });

        document.getElementById('ledColor').addEventListener('input', e => {
            document.getElementById('ledColorHex').textContent = e.target.value;
        });

        container.querySelectorAll('.led-preset').forEach(p => {
            p.addEventListener('click', () => {
                const c = p.dataset.color;
                document.getElementById('ledColor').value = '#' + c;
                document.getElementById('ledColorHex').textContent = '#' + c;
            });
        });

        document.getElementById('ledMode').addEventListener('change', async e => {
            await API.post('/api/led', { mode: e.target.value });
        });

        // 恢复出厂
        const btnR = document.getElementById('btnReset');
        if (btnR) {
            btnR.addEventListener('click', () => {
                if (btnR.textContent === '确认重置?') {
                    btnR.disabled = true;
                    btnR.textContent = '重置中...';
                    API.factoryReset().catch(() => {});
                } else {
                    btnR.textContent = '确认重置?';
                    btnR.style.background = '#cc0000';
                    setTimeout(() => {
                        btnR.textContent = '恢复出厂设置';
                        btnR.style.background = '';
                    }, 3000);
                }
            });
        }
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }

    render();

    return { destroy() {} };
}

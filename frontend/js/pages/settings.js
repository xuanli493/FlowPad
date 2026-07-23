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
                <div class="led-presets" style="margin-top:4px;gap:6px">
                    <button class="preset-btn" data-ml="800"  style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #d0d0d5;background:#fff;cursor:pointer">儿童 800</button>
                    <button class="preset-btn" data-ml="1200" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #d0d0d5;background:#fff;cursor:pointer">少年 1200</button>
                    <button class="preset-btn" data-ml="1500" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #d0d0d5;background:#fff;cursor:pointer">青少年 1500</button>
                    <button class="preset-btn" data-ml="2000" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #d0d0d5;background:#fff;cursor:pointer">成人 2000</button>
                    <button class="preset-btn" data-ml="3000" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #d0d0d5;background:#fff;cursor:pointer">运动员 3000</button>
                </div>
            </div>

            <div class="card">
                <h2>AI 分析</h2>
                <p style="font-size:12px;color:var(--text-hint);margin-bottom:14px">
                    配置后可在仪表盘查看 AI 饮水分析。API Key 仅存储于本浏览器。
                </p>
                <div class="form-group">
                    <label>模型提供商</label>
                    <select id="aiProvider">
                        <option value="openai">OpenAI</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="qwen">通义千问</option>
                        <option value="custom">自定义</option>
                    </select>
                </div>
                <div class="form-group" id="aiEndpointGroup" style="display:none">
                    <label>API Base URL</label>
                    <input type="text" id="aiEndpoint" placeholder="https://your-api.example.com/v1">
                </div>
                <div class="form-group">
                    <label>API Key</label>
                    <div style="display:flex;gap:8px">
                        <input type="password" id="aiApiKey" placeholder="sk-..." style="flex:1">
                        <button class="btn btn-outline" id="btnFetchModels" style="padding:10px 14px;font-size:13px;white-space:nowrap">获取模型</button>
                    </div>
                </div>
                <div class="form-group" id="aiModelGroup" style="display:none">
                    <label>选择模型</label>
                    <select id="aiModel"></select>
                </div>
                <div id="aiStatus" style="font-size:12px;color:var(--text-dim);margin-top:4px"></div>
                <div class="btn-group" style="justify-content:flex-end">
                    <button class="btn btn-outline" id="btnClearAiResult" style="font-size:12px;padding:8px 14px">清除分析缓存</button>
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

            <div class="card" style="margin-top:24px">
                <h2>固件升级</h2>
                <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">
                    上传新固件 (.bin) 进行 OTA 无线升级。
                </p>
                <a href="/update" class="btn btn-outline" style="text-decoration:none">打开升级页面</a>
            </div>

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

        // 年龄段预设
        container.querySelectorAll('.preset-btn').forEach(b => {
            b.addEventListener('click', () => {
                document.getElementById('targetMl').value = b.dataset.ml;
            });
        });

        document.getElementById('ledMode').addEventListener('change', async e => {
            await API.post('/api/led', { mode: e.target.value });
        });

        // ====== AI 配置事件 ======
        const aiCfg = AI.loadConfig();
        const aiProv = document.getElementById('aiProvider');
        const aiKey  = document.getElementById('aiApiKey');
        const aiEp   = document.getElementById('aiEndpoint');
        const aiEpG  = document.getElementById('aiEndpointGroup');
        const aiMod  = document.getElementById('aiModel');
        const aiModG = document.getElementById('aiModelGroup');
        const aiStat = document.getElementById('aiStatus');

        // 恢复已保存的配置
        if (aiProv) aiProv.value = aiCfg.provider;
        if (aiKey)  aiKey.value  = aiCfg.apiKey || '';
        if (aiEp)   aiEp.value   = aiCfg.endpoint || '';
        toggleCustomEndpoint();

        // 提供商切换
        if (aiProv) aiProv.addEventListener('change', () => {
            toggleCustomEndpoint();
            aiModG.style.display = 'none';
            aiStat.textContent = '';
        });

        function toggleCustomEndpoint() {
            const v = aiProv.value;
            aiEpG.style.display = (v === 'custom') ? '' : 'none';
        }

        // 获取模型列表
        document.getElementById('btnFetchModels').addEventListener('click', async () => {
            const provider = aiProv.value;
            const apiKey   = aiKey.value.trim();
            if (!apiKey) { aiStat.textContent = '请先填写 API Key'; return; }

            // 保存当前配置
            const cfg = {
                provider,
                apiKey,
                endpoint: provider === 'custom' ? aiEp.value.trim() : AI.PROVIDERS[provider].base,
                model: ''
            };
            AI.saveConfig(cfg);

            aiStat.textContent = '正在获取模型列表...';
            document.getElementById('btnFetchModels').disabled = true;
            try {
                const models = await AI.fetchModels(provider, apiKey, cfg.endpoint);
                const prevModel = AI.loadConfig().model;
                aiMod.innerHTML = models.map(m =>
                    '<option value="' + m + '"' + (m === prevModel ? ' selected' : '') + '>' + m + '</option>'
                ).join('');
                aiModG.style.display = '';
                aiStat.textContent = '已获取 ' + models.length + ' 个模型';
                // 如果有之前的选中且匹配，自动保存
                if (prevModel && models.includes(prevModel)) {
                    cfg.model = prevModel;
                    AI.saveConfig(cfg);
                } else if (models.length > 0) {
                    cfg.model = models[0];
                    AI.saveConfig(cfg);
                }
            } catch (e) {
                aiStat.textContent = e.message;
            }
            document.getElementById('btnFetchModels').disabled = false;
        });

        // 模型切换自动保存
        if (aiMod) aiMod.addEventListener('change', () => {
            const cfg = AI.loadConfig();
            cfg.model = aiMod.value;
            AI.saveConfig(cfg);
            aiStat.textContent = '已保存';
            setTimeout(() => { if (aiStat.textContent === '已保存') aiStat.textContent = ''; }, 1500);
        });

        // 清除分析缓存
        document.getElementById('btnClearAiResult').addEventListener('click', () => {
            AI.clearResult();
            aiStat.textContent = '分析缓存已清除';
            setTimeout(() => { if (aiStat.textContent === '分析缓存已清除') aiStat.textContent = ''; }, 1500);
        });

        // 如果有保存的模型，展示模型下拉
        if (aiCfg.model && aiCfg.apiKey) {
            aiMod.innerHTML = '<option value="' + aiCfg.model + '" selected>' + aiCfg.model + '</option>';
            aiModG.style.display = '';
        }

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

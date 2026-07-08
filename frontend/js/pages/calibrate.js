/**
 * 校准向导 - 接入真实 API
 */
function Calibrate(container) {
    let step = 1;
    let weightTimer = null;

    async function render() {
        // 先查询当前校准状态
        let calibState = { calibrated: false, step: 0, tare: 0, fullRef: 0 };
        try { calibState = await API.getCalibState(); } catch (e) {}

        // 如果已校准，直接跳到完成
        if (calibState.calibrated) step = 3;
        else if (calibState.step >= 1) step = 2;

        container.innerHTML = `
            <div class="card" style="text-align:center">
                <h2>校准向导</h2>

                <div class="calibrate-weight" id="calWeight">-- g</div>
                <div class="calibrate-hint" id="calHint"></div>

                <div class="calibrate-step${step === 1 ? ' active' : ''}" id="step1">
                    <div class="calibrate-icon">&#127907;</div>
                    <p style="color:var(--text-dim);font-size:15px;margin-bottom:16px">
                        请移开杯垫上所有物品
                    </p>
                    <button class="btn btn-block" id="btnStep1">记录空载</button>
                </div>

                <div class="calibrate-step${step === 2 ? ' active' : ''}" id="step2">
                    <div class="calibrate-icon">&#9749;</div>
                    <p style="color:var(--text-dim);font-size:15px;margin-bottom:16px">
                        请放上空杯子 (不含水)
                    </p>
                    <div style="font-size:13px;color:var(--text-hint);margin-bottom:12px">
                        当前重量: <span id="step2Weight">--</span> g
                    </div>
                    <button class="btn btn-block" id="btnStep2">记录空杯</button>
                </div>

                <div class="calibrate-step${step === 3 ? ' active' : ''}" id="step3">
                    <div class="calibrate-icon">&#9989;</div>
                    <p style="font-size:17px;font-weight:500;margin-bottom:8px">校准完成</p>
                    <p style="color:var(--text-dim);font-size:14px">
                        杯重 <strong>${calibState.tare || '--'}</strong> g
                    </p>
                    <p style="color:var(--text-hint);font-size:12px;margin-top:8px">
                        满杯重量自动学习 · 换杯无需重校准
                    </p>
                    <button class="btn btn-outline" id="btnRecalib" style="margin-top:16px">重新校准</button>
                </div>
            </div>
        `;

        if (step < 3) {
            updateWeight();
            weightTimer = setInterval(updateWeight, 800);
        }

        bindEvents();
    }

    async function updateWeight() {
        try {
            const data = await API.getWeight();
            const el = document.getElementById('calWeight');
            if (el) el.textContent = data.grams.toFixed(1) + ' g';

            const s2w = document.getElementById('step2Weight');
            if (s2w) s2w.textContent = data.grams.toFixed(1);
        } catch (e) {
            const el = document.getElementById('calWeight');
            if (el) el.textContent = '-- g';
        }
    }

    function bindEvents() {
        const btn1 = document.getElementById('btnStep1');
        const btn2 = document.getElementById('btnStep2');
        const btnR = document.getElementById('btnRecalib');

        if (btn1) {
            btn1.addEventListener('click', async () => {
                btn1.disabled = true;
                btn1.textContent = '记录中...';
                try {
                    await API.calibrateStep1();
                    document.getElementById('step1').classList.remove('active');
                    document.getElementById('step2').classList.add('active');
                    document.getElementById('calHint').textContent = '空载已记录';
                    step = 2;
                } catch (e) {
                    showToast('校准失败: ' + e.message, true);
                }
                btn1.disabled = false;
                btn1.textContent = '记录空载';
            });
        }

        if (btn2) {
            btn2.addEventListener('click', async () => {
                btn2.disabled = true;
                btn2.textContent = '记录中...';
                try {
                    const result = await API.calibrateStep2();
                    document.getElementById('step2').classList.remove('active');
                    document.getElementById('step3').classList.add('active');
                    document.getElementById('calWeight').textContent = result.tare + ' g';
                    document.getElementById('calHint').textContent = '';
                    step = 3;
                    if (weightTimer) clearInterval(weightTimer);
                } catch (e) {
                    showToast('校准失败: ' + e.message, true);
                }
                btn2.disabled = false;
                btn2.textContent = '记录空杯';
            });
        }

        if (btnR) {
            btnR.addEventListener('click', () => {
                step = 1;
                if (weightTimer) clearInterval(weightTimer);
                render();
                Router.navigate();
            });
        }
    }

    function showToast(msg, isError) {
        const t = document.createElement('div');
        t.className = 'toast' + (isError ? ' error' : '');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }

    render();

    return {
        destroy() { if (weightTimer) clearInterval(weightTimer); }
    };
}

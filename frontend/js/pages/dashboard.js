/**
 * 仪表盘 - 实时重量 + 喝水进度 + 历史图表
 */
function Dashboard(container) {
    let refreshTimer = null;

    function render() {
        container.innerHTML = `
            <div class="card">
                <div class="weight-display">
                    <span class="weight-value" id="weightVal">--</span>
                    <span class="weight-unit">g</span>
                </div>
                <div class="weight-sub" id="weightSub"></div>
            </div>

            <div class="card">
                <h2>今日喝水</h2>
                <div class="progress-card">
                    <div class="progress-ring-wrap">
                        <svg width="100" height="100" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none"
                                    stroke="#e8e8ed" stroke-width="7"/>
                            <circle id="progressArc" cx="50" cy="50" r="42" fill="none"
                                    stroke="url(#ringGrad)" stroke-width="7"
                                    stroke-linecap="round"
                                    stroke-dasharray="0 264"
                                    transform="rotate(-90 50 50)"
                                    style="transition: stroke-dasharray 0.8s ease"/>
                            <defs>
                                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stop-color="#0071e3"/>
                                    <stop offset="100%" stop-color="#5856d6"/>
                                </linearGradient>
                            </defs>
                        </svg>
                        <div class="progress-ring-text">
                            <span class="ml" id="drinkMl">0</span>
                            <span class="target">ml</span>
                        </div>
                    </div>
                    <div class="progress-info">
                        <div class="progress-info-label">目标</div>
                        <div class="progress-info-value" id="drinkTarget">2000 ml</div>
                        <div class="progress-bar-wrap">
                            <div class="progress-bar-fill" id="progressBar" style="width:0%"></div>
                        </div>
                        <div style="margin-top:6px;font-size:12px;color:var(--text-hint)" id="drinkPercent">0%</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>7 天记录</h2>
                <div class="chart-container" id="barChart"></div>
            </div>

            <div class="card">
                <h2>设备</h2>
                <div class="status-grid" id="statusGrid"></div>
            </div>

            <div class="card" id="todayEventsCard" style="display:none">
                <h2>今日详情</h2>
                <div id="todayEvents"></div>
            </div>
        `;

        refresh();
        refreshTimer = setInterval(refresh, 3000);
    }

    async function refresh() {
        try {
            const [status, weight, history] = await Promise.all([
                API.getStatus(),
                API.getWeight(),
                API.getHistory()
            ]);

            // 重量
            const wv = document.getElementById('weightVal');
            if (wv) wv.textContent = weight.grams.toFixed(1);

            const ws = document.getElementById('weightSub');
            if (ws) {
                if (weight.calibrated) {
                    const labels = ['?', '就绪', '检测中', '吸管', '空载'];
                    ws.textContent = (weight.stable ? '\u2022 稳定' : '\u2022 波动') +
                                     ' \u00B7 ' + (labels[weight.state] || '?');
                } else {
                    ws.textContent = '\u26A0 未校准 \u00B7 请前往校准页';
                }
            }

            // 喝水进度
            const today = history.today || {};
            const targetMl = today.target || 2000;
            const totalMl = today.totalMl || 0;
            const pct = Math.min(1, totalMl / targetMl);

            const arc = document.getElementById('progressArc');
            if (arc) {
                const circ = 2 * Math.PI * 42;
                arc.setAttribute('stroke-dasharray', (pct * circ) + ' ' + circ);
            }
            const dm = document.getElementById('drinkMl');
            if (dm) dm.textContent = Math.round(totalMl);
            const dt = document.getElementById('drinkTarget');
            if (dt) dt.textContent = targetMl + ' ml';
            const pb = document.getElementById('progressBar');
            if (pb) pb.style.width = (pct * 100) + '%';
            const dp = document.getElementById('drinkPercent');
            if (dp) dp.textContent = Math.round(pct * 100) + '%';

            // 设备状态
            const sg = document.getElementById('statusGrid');
            if (sg) {
                sg.innerHTML = `
                    <div class="status-item"><div class="status-label">WiFi</div><div class="status-value">${status.wifi}</div></div>
                    <div class="status-item"><div class="status-label">IP</div><div class="status-value" style="font-size:13px">${status.ip}</div></div>
                    <div class="status-item"><div class="status-label">时间</div><div class="status-value" style="font-size:12px">${status.time || 'N/A'}</div></div>
                    <div class="status-item"><div class="status-label">运行</div><div class="status-value">${fmtUptime(status.uptime)}</div></div>
                `;
            }

            // 今日事件详情
            const eventList = today.list || [];
            const tec = document.getElementById('todayEventsCard');
            const tel = document.getElementById('todayEvents');
            if (tec && tel && eventList.length > 0) {
                tec.style.display = '';
                tel.innerHTML = eventList.slice().reverse().map(e => {
                    const icon = e.type === 'straw' ? '\uD83E\uDD64' :
                                 e.type === 'refill' ? '\uD83D\uDEB0' : '\uD83E\uDD5B';
                    return `<div style="display:flex;justify-content:space-between;align-items:center;
                                 padding:8px 0;border-bottom:1px solid var(--border);font-size:14px">
                        <span><span style="margin-right:6px">${icon}</span>${e.time}</span>
                        <span style="font-weight:500;color:${e.type === 'refill' ? 'var(--accent)' : 'var(--text)'}">
                            ${e.type === 'refill' ? '+' : '-'}${e.ml}ml
                        </span>
                    </div>`;
                }).join('');
            } else if (tec) {
                tec.style.display = 'none';
            }

            // 柱状图
            const streak = history.streak || [];
            if (streak.length > 0) drawBarChart(streak);

        } catch (e) {
            console.warn('Dashboard refresh failed:', e.message);
        }
    }

    function drawBarChart(streak) {
        const el = document.getElementById('barChart');
        if (!el) return;
        const w = Math.min(el.clientWidth - 10, 500);
        const h = 180;
        const pad = { top: 10, right: 8, bottom: 28, left: 8 };
        const maxMl = Math.max(...streak.map(d => d.target), 2000);
        const gap = 6;
        const bw = (w - pad.left - pad.right - gap * (streak.length - 1)) / streak.length;

        let bars = '';
        streak.forEach((d, i) => {
            const bh = Math.max(2, (d.totalMl / maxMl) * (h - pad.top - pad.bottom));
            const x = pad.left + i * (bw + gap);
            const y = h - pad.bottom - bh;
            const color = d.totalMl >= d.target ? '#34c759' : '#0071e3';
            const label = d.date.slice(5);
            bars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${color}"
                           opacity="${d.totalMl >= d.target ? '1' : '0.7'}">
                         <title>${d.date}: ${Math.round(d.totalMl)}ml / ${d.target}ml</title>
                     </rect>
                     <text x="${x + bw/2}" y="${h - 10}" text-anchor="middle"
                           fill="#aeaeb2" font-size="10" font-weight="500">${label}</text>`;
        });

        const refY = h - pad.bottom - (streak[0].target / maxMl) * (h - pad.top - pad.bottom);
        el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
            <line x1="${pad.left}" y1="${refY}" x2="${w - pad.right}" y2="${refY}"
                  stroke="#e0e0e5" stroke-dasharray="3 3"/>
            <text x="${w - pad.right - 2}" y="${refY - 6}" text-anchor="end"
                  fill="#c0c0c5" font-size="9">${streak[0].target}ml</text>
            ${bars}
        </svg>`;
    }

    function fmtUptime(s) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    render();

    return {
        destroy() { if (refreshTimer) clearInterval(refreshTimer); }
    };
}

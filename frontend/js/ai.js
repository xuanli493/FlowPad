/**
 * FlowPad AI 分析模块
 * 浏览器端直接调用 AI API, ESP32 无中转
 */

const AI = (() => {
    const STORAGE_KEY = 'flowpad_ai_config';
    const RESULT_KEY  = 'flowpad_ai_result';

    const DEFAULTS = {
        provider: 'openai',
        apiKey: '',
        model: '',
        endpoint: ''
    };

    // ====== Provider 预设 ======
    const PROVIDERS = {
        openai: { label: 'OpenAI',    base: 'https://api.openai.com/v1',                   model: 'gpt-4o-mini' },
        deepseek:{ label: 'DeepSeek', base: 'https://api.deepseek.com/v1',                 model: 'deepseek-chat' },
        qwen:   { label: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
        custom: { label: '自定义',   base: '',                                             model: '' }
    };

    // ====== 配置读写 ======
    function loadConfig() {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? { ...DEFAULTS, ...JSON.parse(s) } : { ...DEFAULTS };
        } catch { return { ...DEFAULTS }; }
    }

    function saveConfig(cfg) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    }

    // ====== 模型列表拉取 ======
    async function fetchModels(provider, apiKey, customEndpoint) {
        const info = PROVIDERS[provider];
        if (!info) throw new Error('Unknown provider');

        let base = info.base;
        if (provider === 'custom') {
            base = customEndpoint.replace(/\/+$/, '');
        }
        if (!base) throw new Error('请填写 API Endpoint');

        const res = await fetch(base + '/models', {
            headers: { 'Authorization': 'Bearer ' + apiKey }
        });
        if (!res.ok) throw new Error('API 请求失败 (' + res.status + '), 请检查 Key 和 Endpoint');

        const json = await res.json();
        const blacklist = ['embedding', 'whisper', 'tts', 'dall-e', 'moderation', 'omni', 'realtime', 'audio'];
        return (json.data || [])
            .map(m => m.id)
            .filter(id => !blacklist.some(b => id.includes(b)))
            .sort();
    }

    // ====== AI 分析 ======
    async function analyze(drinkData) {
        const cfg = loadConfig();
        if (!cfg.apiKey) throw new Error('请先在设置页配置 AI API Key');
        if (!cfg.model)    throw new Error('请先在设置页选择模型');

        const info = PROVIDERS[cfg.provider];
        let endpoint = cfg.endpoint;
        if (!endpoint && info) {
            endpoint = info.base + '/chat/completions';
        }
        if (!endpoint) throw new Error('无法确定 API 地址');

        const systemPrompt = `你是一位专业的饮水健康教练，名字叫 FlowPad Coach。你的风格是：
- 温暖鼓励，不说教
- 用数据说话，不泛泛而谈
- 每次分析给 3 个核心发现 + 2 条可操作建议
- 用中文回复，控制在 200-350 字
- 如果发现明显不健康模式（如半天不喝水），会特别提醒

知识背景：
- 成人每日推荐饮水量 1500-2500ml，视体重和运动量而定
- 单次饮水超过 350ml 吸收效率下降
- 睡前 2 小时不宜大量饮水
- 运动后应补充 400-800ml
- 喝水最好分散在一天，不要集中几小时内灌完`;

        const userPrompt = buildUserPrompt(drinkData);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + cfg.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: cfg.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error('API 请求失败 (' + res.status + '): ' + err.slice(0, 200));
        }

        const json = await res.json();
        const reply = json.choices?.[0]?.message?.content;
        if (!reply) throw new Error('AI 未返回有效内容');

        // 缓存结果
        const result = { text: reply, time: new Date().toISOString() };
        localStorage.setItem(RESULT_KEY, JSON.stringify(result));
        return result;
    }

    function buildUserPrompt(d) {
        const todayEvents = (d.eventsToday || []).slice();
        const listText = todayEvents.length === 0
            ? '（暂无记录）'
            : todayEvents.map(e => {
                const icon = e.type === 'straw' ? '[吸管]' : e.type === 'refill' ? '[接水]' : '[拿起]';
                return icon + ' ' + e.time + ' ' + e.ml + 'ml';
              }).join('\n');

        const currentHour = new Date().getHours();
        const greeting = currentHour < 5 ? '凌晨' : currentHour < 10 ? '上午' : currentHour < 14 ? '中午' : currentHour < 18 ? '下午' : '晚上';

        const streak = (d.streak || []).map(s => '  ' + s.date + ': ' + Math.round(s.totalMl) + 'ml (目标' + s.target + 'ml, ' + (s.totalMl >= s.target ? '达标' : '未达标') + ')').join('\n');

        return `以下是我的喝水数据，请分析并给出建议：

【基本信息】
当前时间：${new Date().toLocaleString('zh-CN')}（${greeting}）
每日目标：${d.targetMl || 2000}ml
今日已喝：${d.todayMl || 0}ml（共 ${todayEvents.length} 次）

【今日记录】
${listText}

【最近 7 天】
${streak || '（暂无数据）'}

请从以下角度分析：
1. 今天的节奏是否健康（间隔、单次量）
2. 最近 7 天的规律性和趋势
3. 距离今日目标的差距`;
    }

    // ====== 缓存结果 ======
    function getCachedResult() {
        try {
            const s = localStorage.getItem(RESULT_KEY);
            return s ? JSON.parse(s) : null;
        } catch { return null; }
    }

    function clearResult() {
        localStorage.removeItem(RESULT_KEY);
    }

    return {
        loadConfig, saveConfig, fetchModels, analyze,
        getCachedResult, clearResult,
        PROVIDERS, DEFAULTS
    };
})();

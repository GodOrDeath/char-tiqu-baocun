// ============================================================
// 角色提取保存 扩展 - 通用 OpenAI 格式 API 配置面板
// 支持通过酒馆后端代理，解决 CORS 跨域问题
// ============================================================

console.log('[角色提取保存] 扩展加载中...');

(function () {
    'use strict';

    const win = window.parent || window;
    const doc = win.document;

    // ---------- 样式 ----------
    const CSS = `
        #ctb-panel {
            position: fixed; left: 0; top: 0; z-index: 30000;
            width: min(520px, 94vw); max-height: min(85vh, calc(100dvh - 20px));
            display: flex; flex-direction: column;
            background: var(--SmartThemeBlurTintColor, rgba(24,24,28,0.96));
            color: var(--SmartThemeBodyColor, #ddd);
            border: 1px solid var(--SmartThemeBorderColor, #555);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            overflow: hidden;
            font-size: 13px;
        }
        #ctb-panel.ctb-hidden { display: none; }
        #ctb-panel .ctb-head {
            display: flex; align-items: center; padding: 8px 12px;
            border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
            cursor: move; touch-action: none; user-select: none;
        }
        #ctb-panel .ctb-head span { flex: 1; font-weight: 600; }
        #ctb-panel .ctb-head button {
            background: transparent; border: none; color: inherit;
            cursor: pointer; font-size: 16px; opacity: 0.7;
            padding: 0 4px;
        }
        #ctb-panel .ctb-head button:hover { opacity: 1; }
        #ctb-panel .ctb-body {
            padding: 14px 16px; overflow-y: auto; flex: 1;
            display: flex; flex-direction: column; gap: 8px;
        }
        #ctb-panel .ctb-field {
            display: flex; align-items: center; gap: 8px;
        }
        #ctb-panel .ctb-field label {
            flex: 0 0 110px; text-align: right; opacity: 0.8;
            font-size: 12px; font-weight: 500;
        }
        #ctb-panel .ctb-field input, #ctb-panel .ctb-field select {
            flex: 1; background: transparent; color: inherit;
            border: 1px solid var(--SmartThemeBorderColor, #555);
            border-radius: 6px; padding: 4px 7px; font-size: 12px;
            height: 28px; box-sizing: border-box;
        }
        #ctb-panel .ctb-field input[type="checkbox"] {
            flex: 0 0 auto; width: 18px; height: 18px;
            accent-color: var(--SmartThemeQuoteColor, #4a6fa5);
        }
        #ctb-panel .ctb-field .ctb-check-label {
            flex: 0 0 auto; text-align: left; opacity: 0.8;
            font-size: 12px;
        }
        #ctb-panel .ctb-field input:disabled {
            opacity: 0.5; cursor: not-allowed;
        }
        #ctb-panel .ctb-actions {
            display: flex; gap: 8px; margin-top: 4px;
            justify-content: flex-end;
        }
        #ctb-panel .ctb-btn {
            padding: 5px 14px; border: none; border-radius: 6px;
            background: var(--SmartThemeQuoteColor, #4a6fa5);
            color: #fff; font-weight: 600; cursor: pointer;
            font-size: 12px;
        }
        #ctb-panel .ctb-btn:hover { filter: brightness(1.15); }
        #ctb-panel .ctb-btn.ctb-test { background: #2d8b5e; }
        #ctb-panel .ctb-btn.ctb-models { background: #b58a4a; }
        #ctb-panel .ctb-status {
            font-size: 12px; opacity: 0.8; margin-top: 4px;
            padding: 4px 8px; border-radius: 4px;
            background: color-mix(in srgb, var(--SmartThemeQuoteColor, #4a6fa5) 12%, transparent);
            min-height: 20px;
        }
        #ctb-panel .ctb-status.error {
            background: color-mix(in srgb, #d05555 25%, transparent);
            color: #ffa0a0;
        }
        #ctb-panel .ctb-status.success {
            background: color-mix(in srgb, #2d8b5e 25%, transparent);
            color: #a0e0a0;
        }
        #ctb-panel .ctb-response {
            margin-top: 4px; padding: 6px 8px; border-radius: 6px;
            background: rgba(0,0,0,0.2); border: 1px solid var(--SmartThemeBorderColor, #444);
            white-space: pre-wrap; word-break: break-word;
            max-height: 120px; overflow: auto;
            font-size: 12px; display: none;
        }
        .ctb-field-group {
            display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
        }
        .ctb-field-group .ctb-field { flex: 1; }
        .ctb-field-group .ctb-field label { flex: 0 0 80px; }
        @media (max-width: 480px) {
            .ctb-field-group { grid-template-columns: 1fr; }
        }
    `;

    // ---------- 注入样式 ----------
    const styleEl = doc.createElement('style');
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);

    // ---------- 创建面板 ----------
    const panel = doc.createElement('div');
    panel.id = 'ctb-panel';
    panel.className = 'ctb-hidden';
    panel.innerHTML = `
        <div class="ctb-head">
            <span>⚙️ 总结模型</span>
            <button data-act="close">✕</button>
        </div>
        <div class="ctb-body">
            <div class="ctb-field">
                <label>API 类型</label>
                <input id="ctb-api-type" value="自定义OpenAI" readonly style="opacity:0.7;cursor:default;" />
            </div>
            <div class="ctb-field">
                <label>自定义端点</label>
                <input id="ctb-api-url" placeholder="https://api.openai.com/v1" />
            </div>
            <div class="ctb-field">
                <label>API Key</label>
                <input id="ctb-api-key" type="password" placeholder="sk-..." />
            </div>
            <div class="ctb-field">
                <label>代理模式</label>
                <input id="ctb-proxy" type="checkbox" checked />
                <span class="ctb-check-label">使用酒馆后端代理 (绕过CORS)</span>
            </div>
            <div class="ctb-field">
                <label>选择或输入模型</label>
                <input id="ctb-model" placeholder="gpt-3.5-turbo" list="ctb-model-list" />
                <datalist id="ctb-model-list"></datalist>
            </div>
            <div class="ctb-field-group">
                <div class="ctb-field">
                    <label>温度</label>
                    <input id="ctb-temperature" type="number" step="0.1" value="1" />
                </div>
                <div class="ctb-field">
                    <label>上下文</label>
                    <input id="ctb-context" type="number" value="2000000" />
                </div>
                <div class="ctb-field">
                    <label>最大输出</label>
                    <input id="ctb-max-tokens" type="number" value="65000" />
                </div>
                <div class="ctb-field" style="justify-content:flex-start; gap:4px;">
                    <label style="flex:0 0 auto;">流式</label>
                    <input id="ctb-stream" type="checkbox" checked />
                    <span class="ctb-check-label">开启</span>
                </div>
            </div>
            <div class="ctb-actions">
                <button class="ctb-btn ctb-test" data-act="test">🧪 测试</button>
                <button class="ctb-btn ctb-models" data-act="list-models">📋 获取模型</button>
                <button class="ctb-btn" data-act="save">💾 保存</button>
            </div>
            <div id="ctb-status" class="ctb-status">就绪</div>
            <div id="ctb-response" class="ctb-response"></div>
        </div>
    `;
    doc.body.appendChild(panel);

    // ---------- DOM 引用 ----------
    const urlInput = doc.getElementById('ctb-api-url');
    const keyInput = doc.getElementById('ctb-api-key');
    const proxyCheck = doc.getElementById('ctb-proxy');
    const modelInput = doc.getElementById('ctb-model');
    const tempInput = doc.getElementById('ctb-temperature');
    const ctxInput = doc.getElementById('ctb-context');
    const maxInput = doc.getElementById('ctb-max-tokens');
    const streamCheck = doc.getElementById('ctb-stream');
    const statusDiv = doc.getElementById('ctb-status');
    const responseDiv = doc.getElementById('ctb-response');
    const modelList = doc.getElementById('ctb-model-list');

    // ---------- 设置持久化 ----------
    const SETTINGS_KEY = 'ctb_settings';
    function loadSettings() {
        try {
            const raw = win.localStorage.getItem(SETTINGS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }
    function saveSettingsToStorage(settings) {
        try {
            win.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {}
    }

    // 填充已保存的值
    const saved = loadSettings();
    urlInput.value = saved.url || 'https://gcli.ggchan.dev/v1';
    keyInput.value = saved.key || '';
    proxyCheck.checked = saved.proxy !== undefined ? saved.proxy : true;
    modelInput.value = saved.model || 'gemini-3.1-pro-preview';
    tempInput.value = saved.temperature ?? 1;
    ctxInput.value = saved.context ?? 2000000;
    maxInput.value = saved.max_tokens ?? 65000;
    streamCheck.checked = saved.stream !== undefined ? saved.stream : true;

    // ---------- 代理模式切换 ----------
    function updateProxyMode() {
        const enabled = proxyCheck.checked;
        if (enabled) {
            urlInput.disabled = true;
            keyInput.disabled = true;
            urlInput.value = '/api/backends/openai/chat/completions';
            keyInput.value = '';
            // 清空模型列表
            modelList.innerHTML = '';
        } else {
            urlInput.disabled = false;
            keyInput.disabled = false;
            // 恢复之前保存的自定义端点（如果有）
            const oldUrl = saved.url || 'https://api.openai.com/v1';
            urlInput.value = oldUrl;
            const oldKey = saved.key || '';
            keyInput.value = oldKey;
        }
    }
    proxyCheck.addEventListener('change', () => {
        updateProxyMode();
        autoSave();
    });

    // ---------- 自动保存 ----------
    function autoSave() {
        const settings = {
            url: urlInput.value.trim(),
            key: keyInput.value.trim(),
            proxy: proxyCheck.checked,
            model: modelInput.value.trim(),
            temperature: parseFloat(tempInput.value) || 1,
            context: parseInt(ctxInput.value) || 2000000,
            max_tokens: parseInt(maxInput.value) || 65000,
            stream: streamCheck.checked,
        };
        saveSettingsToStorage(settings);
    }

    [urlInput, keyInput, modelInput, tempInput, ctxInput, maxInput, streamCheck].forEach(el => {
        el.addEventListener('change', autoSave);
        el.addEventListener('input', autoSave);
    });

    // 初始应用代理状态
    updateProxyMode();

    // ---------- 显示状态 ----------
    function setStatus(msg, type = '') {
        statusDiv.textContent = msg;
        statusDiv.className = 'ctb-status' + (type ? ' ' + type : '');
    }

    function showResponse(text) {
        if (text) {
            responseDiv.style.display = 'block';
            responseDiv.textContent = text;
        } else {
            responseDiv.style.display = 'none';
        }
    }

    // ---------- API 调用函数 ----------
    async function callOpenAI(messages, options = {}) {
        let url = urlInput.value.trim();
        const key = keyInput.value.trim();
        const model = modelInput.value.trim() || 'gpt-3.5-turbo';
        const temperature = parseFloat(tempInput.value) || 1;
        const max_tokens = parseInt(maxInput.value) || 65000;
        const stream = streamCheck.checked;

        if (!url) throw new Error('请填写 API 端点地址');
        if (!proxyCheck.checked && !key) throw new Error('请填写 API Key');

        // 如果启用代理，强制使用代理路径
        if (proxyCheck.checked) {
            url = '/api/backends/openai/chat/completions';
        }

        const headers = {
            'Content-Type': 'application/json',
        };
        if (!proxyCheck.checked) {
            headers['Authorization'] = `Bearer ${key}`;
        }

        const body = {
            model,
            messages,
            temperature,
            max_tokens,
            stream,
            ...options
        };

        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            credentials: 'same-origin'  // 确保代理请求发送 cookies
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${errText}`);
        }

        if (stream) {
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let result = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) result += content;
                    } catch (e) {}
                }
            }
            return result;
        } else {
            const data = await resp.json();
            const content = data.choices?.[0]?.message?.content || '';
            return content;
        }
    }

    // ---------- 测试连接 ----------
    async function testConnection() {
        setStatus('⏳ 测试中...', '');
        showResponse('');
        try {
            const result = await callOpenAI([
                { role: 'user', content: 'Hello, please respond with "OK" only.' }
            ]);
            setStatus('✅ 测试成功', 'success');
            showResponse(result);
        } catch (err) {
            setStatus('❌ 测试失败: ' + err.message, 'error');
            showResponse('错误: ' + err.message);
        }
    }

    // ---------- 获取模型列表 ----------
    async function listModels() {
        const url = urlInput.value.trim();
        const key = keyInput.value.trim();
        let modelsUrl;
        if (proxyCheck.checked) {
            modelsUrl = '/api/backends/openai/models';
        } else {
            if (!url) { setStatus('⚠️ 请先填写 API 端点', 'error'); return; }
            if (!key) { setStatus('⚠️ 请先填写 API Key', 'error'); return; }
            modelsUrl = url.replace(/\/+$/, '') + '/models';
        }

        setStatus('⏳ 获取模型列表...', '');
        showResponse('');
        try {
            const headers = {};
            if (!proxyCheck.checked) {
                headers['Authorization'] = `Bearer ${key}`;
            }
            const resp = await fetch(modelsUrl, {
                headers,
                credentials: 'same-origin'
            });
            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(`HTTP ${resp.status}: ${errText}`);
            }
            const data = await resp.json();
            const models = data.data?.map(m => m.id) || [];
            if (!models.length) {
                setStatus('⚠️ 未获取到模型', 'error');
                return;
            }
            modelList.innerHTML = models.map(m => `<option value="${m}">`).join('');
            setStatus(`✅ 获取到 ${models.length} 个模型`, 'success');
            showResponse(models.join('\n'));
        } catch (err) {
            setStatus('❌ 获取失败: ' + err.message, 'error');
            showResponse('错误: ' + err.message);
        }
    }

    // ---------- 保存设置 ----------
    function saveSettings() {
        autoSave();
        setStatus('💾 设置已保存', 'success');
        showResponse('');
    }

    // ---------- 面板控制 ----------
    function togglePanel() {
        const hidden = panel.classList.toggle('ctb-hidden');
        if (!hidden) {
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${Math.max(8, (win.innerWidth - rect.width) / 2)}px`;
            panel.style.top = `${Math.max(8, (win.innerHeight - rect.height) / 2)}px`;
            setStatus('就绪', '');
            showResponse('');
        }
    }

    // ---------- 拖动逻辑 ----------
    (function initDrag() {
        const head = panel.querySelector('.ctb-head');
        let isDragging = false, offsetX, offsetY;
        head.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            const rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            isDragging = true;
            const onMove = (ev) => {
                if (!isDragging) return;
                panel.style.left = `${ev.clientX - offsetX}px`;
                panel.style.top = `${ev.clientY - offsetY}px`;
            };
            const onUp = () => {
                isDragging = false;
                doc.removeEventListener('pointermove', onMove);
                doc.removeEventListener('pointerup', onUp);
                doc.removeEventListener('pointercancel', onUp);
            };
            doc.addEventListener('pointermove', onMove);
            doc.addEventListener('pointerup', onUp);
            doc.addEventListener('pointercancel', onUp);
            e.preventDefault();
        });
    })();

    // ---------- 面板事件绑定 ----------
    panel.addEventListener('click', (e) => {
        const target = e.target.closest('[data-act]');
        if (!target) return;
        const act = target.dataset.act;
        if (act === 'close') {
            panel.classList.add('ctb-hidden');
        } else if (act === 'test') {
            testConnection();
        } else if (act === 'list-models') {
            listModels();
        } else if (act === 'save') {
            saveSettings();
        }
    });

    // ---------- 注入魔法棒菜单项 ----------
    function injectMenuItem() {
        const menu = doc.getElementById('extensionsMenu');
        if (!menu) {
            setTimeout(injectMenuItem, 300);
            return;
        }
        if (menu.querySelector('[data-ctb="true"]')) return;

        const item = doc.createElement('div');
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.style.cursor = 'pointer';
        item.setAttribute('data-ctb', 'true');
        item.innerHTML = `
            <div class="fa-fw fa-solid fa-save extensionsMenuExtensionButton"></div>
            <span>角色提取保存</span>
        `;
        item.addEventListener('click', togglePanel);
        menu.appendChild(item);
        console.log('[角色提取保存] ✅ 菜单项已注入');
    }

    injectMenuItem();

    // ---------- 窗口resize适配 ----------
    win.addEventListener('resize', () => {
        if (panel.classList.contains('ctb-hidden')) return;
        const rect = panel.getBoundingClientRect();
        const left = Math.min(Math.max(rect.left, 8), win.innerWidth - rect.width - 8);
        const top = Math.min(Math.max(rect.top, 8), win.innerHeight - rect.height - 8);
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
    });

    console.log('[角色提取保存] 扩展初始化完成 (代理模式已支持)');
})();

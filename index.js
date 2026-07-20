// ============================================================
// 角色提取保存 扩展 - 带UI面板 + OpenAI兼容API
// ============================================================

console.log('[角色提取保存] 扩展加载中...');

(function () {
    'use strict';

    // ---------- 获取主窗口 ----------
    const win = window.parent || window;
    const doc = win.document;

    // ---------- 样式（UI面板） ----------
    const CSS = `
        #ctb-panel {
            position: fixed; left: 0; top: 0; z-index: 30000;
            width: min(420px, 94vw); max-height: min(80vh, calc(100dvh - 20px));
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
            padding: 12px; overflow-y: auto; flex: 1;
            display: flex; flex-direction: column; gap: 8px;
        }
        #ctb-panel .ctb-row {
            display: flex; gap: 6px; align-items: center;
        }
        #ctb-panel .ctb-row label {
            flex: 0 0 70px; text-align: right; opacity: 0.8;
            font-size: 12px;
        }
        #ctb-panel .ctb-row input, #ctb-panel .ctb-row textarea {
            flex: 1; background: transparent; color: inherit;
            border: 1px solid var(--SmartThemeBorderColor, #555);
            border-radius: 6px; padding: 4px 7px; font-size: 12px;
        }
        #ctb-panel .ctb-row textarea {
            min-height: 60px; resize: vertical;
            font-family: inherit;
        }
        #ctb-panel .ctb-response {
            background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;
            white-space: pre-wrap; word-break: break-word;
            max-height: 200px; overflow: auto;
            border: 1px solid var(--SmartThemeBorderColor, #444);
            font-size: 12px;
        }
        #ctb-panel .ctb-btn {
            padding: 6px 12px; border: none; border-radius: 6px;
            background: var(--SmartThemeQuoteColor, #4a6fa5);
            color: #fff; font-weight: 600; cursor: pointer;
        }
        #ctb-panel .ctb-btn:hover { filter: brightness(1.15); }
        #ctb-panel .ctb-status {
            font-size: 12px; opacity: 0.7; margin-top: 4px;
        }
    `;

    // ---------- 注入样式 ----------
    const styleEl = doc.createElement('style');
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);

    // ---------- 创建UI面板 ----------
    const panel = doc.createElement('div');
    panel.id = 'ctb-panel';
    panel.className = 'ctb-hidden';
    panel.innerHTML = `
        <div class="ctb-head">
            <span>🤖 角色提取保存</span>
            <button data-act="close">✕</button>
        </div>
        <div class="ctb-body">
            <div class="ctb-row"><label>API地址</label><input id="ctb-api-url" placeholder="https://api.openai.com/v1/chat/completions" /></div>
            <div class="ctb-row"><label>API密钥</label><input id="ctb-api-key" type="password" placeholder="sk-..." /></div>
            <div class="ctb-row"><label>模型</label><input id="ctb-model" placeholder="gpt-3.5-turbo" /></div>
            <div class="ctb-row"><label>消息</label><textarea id="ctb-prompt" placeholder="输入要发送的内容..."></textarea></div>
            <div class="ctb-row" style="justify-content:flex-end;">
                <button class="ctb-btn" data-act="send">🚀 发送</button>
                <button class="ctb-btn" data-act="clear">🗑️ 清空响应</button>
            </div>
            <div id="ctb-response" class="ctb-response">等待响应...</div>
            <div id="ctb-status" class="ctb-status">就绪</div>
        </div>
    `;
    doc.body.appendChild(panel);

    // ---------- 持久化设置 ----------
    const SETTINGS_KEY = 'ctb_settings';
    function loadSettings() {
        try {
            const raw = win.localStorage.getItem(SETTINGS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }
    function saveSettings(settings) {
        try {
            win.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {}
    }

    // ---------- 填充设置 ----------
    const settings = loadSettings();
    const urlInput = doc.getElementById('ctb-api-url');
    const keyInput = doc.getElementById('ctb-api-key');
    const modelInput = doc.getElementById('ctb-model');
    const promptInput = doc.getElementById('ctb-prompt');
    const responseDiv = doc.getElementById('ctb-response');
    const statusDiv = doc.getElementById('ctb-status');

    if (settings.url) urlInput.value = settings.url;
    if (settings.key) keyInput.value = settings.key;
    if (settings.model) modelInput.value = settings.model;

    // 自动保存输入变化
    [urlInput, keyInput, modelInput].forEach(el => {
        el.addEventListener('change', () => {
            settings.url = urlInput.value;
            settings.key = keyInput.value;
            settings.model = modelInput.value;
            saveSettings(settings);
        });
    });

    // ---------- API调用函数 ----------
    async function callOpenAI(prompt) {
        const url = urlInput.value.trim();
        const key = keyInput.value.trim();
        const model = modelInput.value.trim() || 'gpt-3.5-turbo';

        if (!url) { statusDiv.textContent = '⚠️ 请填写API地址'; return; }
        if (!key) { statusDiv.textContent = '⚠️ 请填写API密钥'; return; }
        if (!prompt) { statusDiv.textContent = '⚠️ 请输入消息'; return; }

        statusDiv.textContent = '⏳ 发送请求中...';
        responseDiv.textContent = '等待响应...';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '（无内容）';
            responseDiv.textContent = content;
            statusDiv.textContent = '✅ 响应成功';
        } catch (err) {
            statusDiv.textContent = '❌ 错误: ' + err.message;
            responseDiv.textContent = '错误: ' + err.message;
        }
    }

    // ---------- 面板显示/隐藏 ----------
    function togglePanel() {
        const hidden = panel.classList.toggle('ctb-hidden');
        if (!hidden) {
            // 定位
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${Math.max(8, (win.innerWidth - rect.width) / 2)}px`;
            panel.style.top = `${Math.max(8, (win.innerHeight - rect.height) / 2)}px`;
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

    // ---------- 面板内事件 ----------
    panel.addEventListener('click', (e) => {
        const target = e.target.closest('[data-act]');
        if (!target) return;
        const act = target.dataset.act;
        if (act === 'close') {
            panel.classList.add('ctb-hidden');
        } else if (act === 'send') {
            const prompt = promptInput.value.trim();
            if (prompt) callOpenAI(prompt);
        } else if (act === 'clear') {
            responseDiv.textContent = '（已清空）';
            statusDiv.textContent = '就绪';
        }
    });

    // 允许Ctrl+Enter发送
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const prompt = promptInput.value.trim();
            if (prompt) callOpenAI(prompt);
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

    // 启动注入
    injectMenuItem();

    // ---------- 页面resize时让面板不跑出边界（简易） ----------
    win.addEventListener('resize', () => {
        if (panel.classList.contains('ctb-hidden')) return;
        const rect = panel.getBoundingClientRect();
        const left = Math.min(Math.max(rect.left, 8), win.innerWidth - rect.width - 8);
        const top = Math.min(Math.max(rect.top, 8), win.innerHeight - rect.height - 8);
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
    });

    console.log('[角色提取保存] 扩展初始化完成');
})();

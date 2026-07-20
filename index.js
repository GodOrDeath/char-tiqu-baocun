// ================================================================
// 📝 角色提取器 (char-tiqu-baocun)
// 功能：可拖动图标 + OpenAI 格式 API 配置面板
// 通过 /api/proxy 转发请求，解决 CORS
// ================================================================

import { getContext } from '../../../extensions.js';

// ---------- 默认设置 ----------
const DEFAULT_SETTINGS = {
    apiType: 'custom_openai',
    apiUrl: 'https://gcli.ggchan.dev/v1/chat/completions',
    apiKey: '',
    model: 'gemini-2.0-flash',
    temperature: 0.3,
    contextLength: 2000000,
    maxTokens: 65000,
    stream: false,
};

let settings = { ...DEFAULT_SETTINGS };
let panelVisible = false;
let buttonCreated = false;

// ---------- 设置管理 ----------
function loadSettings() {
    try {
        const stored = localStorage.getItem('ce-settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            settings = { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    try {
        localStorage.setItem('ce-settings', JSON.stringify(settings));
    } catch (e) { /* ignore */ }
}

// ---------- Toast ----------
function showToast(message, type = 'info') {
    const toast = document.getElementById('ce-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    const colors = {
        success: { bg: 'rgba(100,220,100,0.12)', border: 'rgba(100,220,100,0.2)', text: '#8f8' },
        error: { bg: 'rgba(255,80,80,0.12)', border: 'rgba(255,80,80,0.2)', text: '#f88' },
        info: { bg: 'rgba(91,124,250,0.12)', border: 'rgba(91,124,250,0.2)', text: '#b8c8ff' },
    };
    const c = colors[type] || colors.info;
    toast.style.background = c.bg;
    toast.style.borderColor = c.border;
    toast.style.color = c.text;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

// ---------- 代理转发 ----------
function getProxyBase() {
    return window.location.origin;
}

async function proxyFetch(targetUrl, method, headers, body, isStream = false) {
    const proxyUrl = `${getProxyBase()}/api/proxy`;
    const payload = {
        targetUrl: targetUrl,
        method: method,
        headers: headers || {},
        body: body, // 对象，代理会 JSON.stringify
        isStream: isStream,
    };
    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Proxy Error ${response.status}: ${errText}`);
    }
    return response;
}

// ---------- UI HTML ----------
function getPanelHTML() {
    return `
        <div id="ce-panel" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 99999;
            background: #1a1a2e;
            border-radius: 16px;
            width: 520px;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 16px 64px rgba(0,0,0,0.85);
            border: 1px solid rgba(255,255,255,0.06);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: #e0e0e0;
            padding: 0;
            display: none;
        ">
            <div style="padding: 16px 24px 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 17px; font-weight: 600; color: #f0f0f0;">📝 角色提取器</span>
                <button id="ce-close-panel" style="background:transparent; border:none; color:#666; font-size:20px; cursor:pointer; padding:2px 10px; border-radius:6px; transition:all 0.2s;" onmouseover="this.style.color='#eee'" onmouseout="this.style.color='#666'">✕</button>
            </div>
            <div style="padding: 20px 24px 24px 24px;">
                <!-- API 类型 -->
                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 12px; color: #999; margin-bottom: 4px; font-weight: 500;">API 类型</label>
                    <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 14px; font-size:14px; color:#ccc; display:flex; align-items:center; gap:8px;">
                        <span style="color:#5b7cfa;">●</span> 自定义 OpenAI
                    </div>
                </div>
                <!-- 自定义端点 -->
                <div style="margin-bottom: 14px;">
                    <label for="ce-apiurl" style="display: block; font-size: 12px; color: #999; margin-bottom: 4px; font-weight: 500;">自定义端点（基础 URL）</label>
                    <input type="text" id="ce-apiurl" placeholder="https://gcli.ggchan.dev/v1/chat/completions" style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e0e0e0; font-size:13px; box-sizing:border-box; transition:border 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#5b7cfa'; this.style.boxShadow='0 0 0 3px rgba(91,124,250,0.15)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none'">
                </div>
                <!-- API Key -->
                <div style="margin-bottom: 14px;">
                    <label for="ce-apikey" style="display: block; font-size: 12px; color: #999; margin-bottom: 4px; font-weight: 500;">API Key</label>
                    <input type="password" id="ce-apikey" placeholder="sk-..." style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e0e0e0; font-size:13px; box-sizing:border-box; transition:border 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#5b7cfa'; this.style.boxShadow='0 0 0 3px rgba(91,124,250,0.15)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none'">
                </div>
                <!-- 模型输入 + datalist -->
                <div style="margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label for="ce-model" style="font-size: 12px; color: #999; font-weight: 500;">选择或输入模型</label>
                        <button id="ce-fetch-models-btn" style="background:transparent; border:none; color:#5b7cfa; cursor:pointer; font-size:12px; padding:2px 8px; border-radius:4px;" onmouseover="this.style.background='rgba(91,124,250,0.1)'" onmouseout="this.style.background='transparent'">🔄 刷新列表</button>
                    </div>
                    <input type="text" id="ce-model" list="ce-model-list" placeholder="gemini-2.0-flash" style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e0e0e0; font-size:13px; box-sizing:border-box; transition:border 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#5b7cfa'; this.style.boxShadow='0 0 0 3px rgba(91,124,250,0.15)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none'">
                    <datalist id="ce-model-list"></datalist>
                </div>
                <!-- 温度 + 上下文 + 最大输出 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label for="ce-temperature" style="display: block; font-size: 12px; color: #999; margin-bottom: 4px; font-weight: 500;">温度</label>
                        <input type="number" id="ce-temperature" min="0" max="1" step="0.05" style="width:100%; padding:10px 12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e0e0e0; font-size:13px; box-sizing:border-box;">
                    </div>
                    <div>
                        <label for="ce-context" style="display: block; font-size: 12px; color: #999; margin-bottom: 4px; font-weight: 500;">上下文</label>
                        <input type="number" id="ce-context" min="1" step="1000" style="width:100%; padding:10px 12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e0e0e0; font-size:13px; box-sizing:border-box;">
                    </div>
                    <div>
                        <label for="ce-max-tokens" style="display: block; font-size: 12px; color: #999; margin-bottom: 4px; font-weight: 500;">最大输出</label>
                        <input type="number" id="ce-max-tokens" min="1" step="100" style="width:100%; padding:10px 12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e0e0e0; font-size:13px; box-sizing:border-box;">
                    </div>
                </div>
                <!-- 流式 -->
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 6px 0;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #ccc;">
                        <input type="checkbox" id="ce-stream" style="width:16px; height:16px; accent-color:#5b7cfa; cursor:pointer;"> 流式
                    </label>
                </div>
                <!-- 按钮 -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;">
                    <button id="ce-test-btn" style="padding:10px 24px; background:rgba(255,255,255,0.07); color:#ccc; border:1px solid rgba(255,255,255,0.08); border-radius:8px; font-weight:500; font-size:13px; cursor:pointer; transition:all 0.2s; flex:1;" onmouseover="this.style.background='rgba(255,255,255,0.14)'" onmouseout="this.style.background='rgba(255,255,255,0.07)'">🔍 测试</button>
                    <button id="ce-save-btn" style="padding:10px 24px; background:#5b7cfa; color:#fff; border:none; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s; flex:1;" onmouseover="this.style.background='#4a6ae0'; transform:translateY(-1px)'" onmouseout="this.style.background='#5b7cfa'; transform:none'">💾 保存</button>
                </div>
                <div id="ce-toast" style="margin-top:16px; display:none; padding:10px 16px; border-radius:8px; font-size:13px; border:1px solid transparent; transition:all 0.3s;"></div>
            </div>
        </div>
    `;
}

// ---------- 创建面板 ----------
function createPanel() {
    if (document.getElementById('ce-panel')) return;
    const div = document.createElement('div');
    div.innerHTML = getPanelHTML();
    document.body.appendChild(div.firstElementChild);

    const panel = document.getElementById('ce-panel');
    const closeBtn = document.getElementById('ce-close-panel');
    const saveBtn = document.getElementById('ce-save-btn');
    const testBtn = document.getElementById('ce-test-btn');
    const fetchModelsBtn = document.getElementById('ce-fetch-models-btn');

    // 关闭
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
        panelVisible = false;
    });
    // 点击外部关闭
    document.addEventListener('mousedown', (e) => {
        if (panelVisible && panel.style.display === 'block') {
            if (!panel.contains(e.target) && e.target.id !== 'ce-draggable-btn') {
                panel.style.display = 'none';
                panelVisible = false;
            }
        }
    });

    // 保存
    saveBtn.addEventListener('click', () => {
        settings.apiUrl = document.getElementById('ce-apiurl').value.trim() || DEFAULT_SETTINGS.apiUrl;
        settings.apiKey = document.getElementById('ce-apikey').value.trim();
        settings.model = document.getElementById('ce-model').value.trim() || DEFAULT_SETTINGS.model;
        settings.temperature = parseFloat(document.getElementById('ce-temperature').value) || 0.3;
        settings.contextLength = parseInt(document.getElementById('ce-context').value) || 2000000;
        settings.maxTokens = parseInt(document.getElementById('ce-max-tokens').value) || 65000;
        settings.stream = document.getElementById('ce-stream').checked;
        saveSettings();
        showToast('✅ 设置已保存', 'success');
    });

    // 测试
    testBtn.addEventListener('click', async () => {
        const url = document.getElementById('ce-apiurl').value.trim();
        const key = document.getElementById('ce-apikey').value.trim();
        const model = document.getElementById('ce-model').value.trim() || 'gemini-2.0-flash';
        if (!url) { showToast('⚠️ 请填写 API 地址', 'error'); return; }
        if (!key) { showToast('⚠️ 请填写 API Key', 'error'); return; }
        showToast('⏳ 测试连接中...', 'info');
        try {
            const requestBody = {
                model: model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
                temperature: parseFloat(document.getElementById('ce-temperature').value) || 0.3,
            };
            const response = await proxyFetch(url, 'POST', {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            }, requestBody, false);
            const data = await response.json();
            const modelUsed = data.model || model;
            showToast(`✅ 连接成功！模型: ${modelUsed}`, 'success');
        } catch (err) {
            showToast(`❌ 连接失败: ${err.message}`, 'error');
        }
    });

    // 获取模型
    fetchModelsBtn.addEventListener('click', async () => {
        const url = document.getElementById('ce-apiurl').value.trim();
        const key = document.getElementById('ce-apikey').value.trim();
        if (!url) { showToast('⚠️ 请填写 API 地址', 'error'); return; }
        if (!key) { showToast('⚠️ 请填写 API Key', 'error'); return; }
        let baseUrl = url.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
        if (!baseUrl) baseUrl = url;
        showToast('⏳ 获取模型列表中...', 'info');
        try {
            const response = await proxyFetch(`${baseUrl}/models`, 'GET', {
                'Authorization': `Bearer ${key}`,
            }, null, false);
            const data = await response.json();
            let models = [];
            if (data.data && Array.isArray(data.data)) {
                models = data.data.map(m => m.id || m);
            } else if (data.models && Array.isArray(data.models)) {
                models = data.models.map(m => m.id || m);
            } else if (Array.isArray(data)) {
                models = data.map(m => m.id || m);
            }
            const datalist = document.getElementById('ce-model-list');
            datalist.innerHTML = '';
            if (models.length > 0) {
                const uniqueModels = [...new Set(models)];
                uniqueModels.forEach(modelId => {
                    const option = document.createElement('option');
                    option.value = modelId;
                    datalist.appendChild(option);
                });
                showToast(`✅ 获取到 ${uniqueModels.length} 个模型`, 'success');
            } else {
                showToast('⚠️ 未获取到模型列表，请手动输入', 'error');
            }
        } catch (err) {
            showToast(`⚠️ 获取模型列表失败: ${err.message}，请手动输入`, 'error');
        }
    });

    // 填充 UI
    populateUI();
}

function populateUI() {
    document.getElementById('ce-apiurl').value = settings.apiUrl;
    document.getElementById('ce-apikey').value = settings.apiKey;
    document.getElementById('ce-model').value = settings.model;
    document.getElementById('ce-temperature').value = settings.temperature;
    document.getElementById('ce-context').value = settings.contextLength;
    document.getElementById('ce-max-tokens').value = settings.maxTokens;
    document.getElementById('ce-stream').checked = settings.stream;
}

// ---------- 可拖动图标 ----------
function createDraggableButton() {
    if (buttonCreated) return;
    if (document.getElementById('ce-draggable-btn')) {
        buttonCreated = true;
        return;
    }

    const button = document.createElement('div');
    button.id = 'ce-draggable-btn';
    button.innerHTML = '📝';
    button.title = '角色提取器';

    Object.assign(button.style, {
        position: 'fixed',
        bottom: '120px',
        right: '30px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: '#5b7cfa',
        color: '#fff',
        fontSize: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(91, 124, 250, 0.6)',
        cursor: 'grab',
        zIndex: '9999',
        userSelect: 'none',
        border: '2px solid rgba(255,255,255,0.3)',
        fontFamily: 'sans-serif',
        lineHeight: '1',
        transition: 'transform 0.2s, box-shadow 0.2s',
    });

    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 6px 24px rgba(91, 124, 250, 0.8)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 4px 16px rgba(91, 124, 250, 0.6)';
    });

    button.addEventListener('click', () => {
        const panel = document.getElementById('ce-panel');
        if (!panel) return;
        if (panel.style.display === 'block') {
            panel.style.display = 'none';
            panelVisible = false;
        } else {
            panel.style.display = 'block';
            panelVisible = true;
            panel.style.top = '50%';
            panel.style.left = '50%';
            panel.style.transform = 'translate(-50%, -50%)';
        }
    });

    // 拖拽
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    button.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        button.style.cursor = 'grabbing';
        const rect = button.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origLeft = rect.left;
        origTop = rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = origLeft + dx;
        let newTop = origTop + dy;
        const maxX = window.innerWidth - button.offsetWidth;
        const maxY = window.innerHeight - button.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxX));
        newTop = Math.max(0, Math.min(newTop, maxY));
        button.style.left = newLeft + 'px';
        button.style.top = newTop + 'px';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            button.style.cursor = 'grab';
        }
    });

    document.body.appendChild(button);
    buttonCreated = true;
    console.log('[角色提取器] ✅ 图标已创建');
}

// ---------- 入口 ----------
jQuery(async () => {
    try {
        console.log('[角色提取器] 加载中...');
        loadSettings();
        createPanel();
        createDraggableButton();
        console.log('[角色提取器] ✅ 加载完成');
    } catch (e) {
        console.error('[角色提取器] ❌ 加载失败:', e);
    }
});

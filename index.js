// ================================================================
// 📝 角色提取器 (char-tiqu-baocun) - 对齐酒馆 OpenAI 格式
// ================================================================

import { getContext } from '../../../extensions.js';

// ---------- 默认设置 ----------
const DEFAULT_SETTINGS = {
    apiType: 'custom_openai',
    apiUrl: '',
    apiKey: '',
    model: '', // 尝试一个常见模型
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

// ---------- 获取酒馆后端代理地址 ----------
function getProxyBase() {
    return window.location.origin;
}

// ---------- 通过代理发送请求（完全对齐 OpenAI 格式） ----------
async function proxyFetch(targetUrl, method, headers, body, isStream = false) {
    // 确保 body 是字符串（如果是对象则序列化），但 /api/proxy 也接受对象
    // 我们直接传递对象，让代理处理序列化
    const proxyUrl = `${getProxyBase()}/api/proxy`;
    const payload = {
        targetUrl: targetUrl,
        method: method,
        headers: headers || {},
        body: body, // 直接传对象，代理会 JSON.stringify
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

// ---------- UI ----------
function getPanelHTML() { /* ... 和之前一样，省略以节省篇幅 ... */ }

function createPanel() { /* ... 和之前一样，但绑定事件会调用新的测试逻辑 ... */ }

// 注意：由于篇幅，我保留之前的 UI 函数，但这里只展示关键改动部分。

// ---------- 测试连接（使用代理，body 为对象） ----------
testBtn.addEventListener('click', async () => {
    const url = document.getElementById('ce-apiurl').value.trim();
    const key = document.getElementById('ce-apikey').value.trim();
    const model = document.getElementById('ce-model').value.trim() || 'gemini-2.0-flash';

    if (!url) { showToast('⚠️ 请填写 API 地址', 'error'); return; }
    if (!key) { showToast('⚠️ 请填写 API Key', 'error'); return; }

    showToast('⏳ 测试连接中...', 'info');
    try {
        // 构造 OpenAI 格式的请求体（对象）
        const requestBody = {
            model: model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 5,
            temperature: parseFloat(document.getElementById('ce-temperature').value) || 0.3,
        };

        const response = await proxyFetch(
            url,
            'POST',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            requestBody, // 直接传对象
            false
        );

        const data = await response.json();
        const modelUsed = data.model || model;
        showToast(`✅ 连接成功！模型: ${modelUsed}`, 'success');
    } catch (err) {
        showToast(`❌ 连接失败: ${err.message}`, 'error');
    }
});

// ---------- 获取模型列表（同样使用代理） ----------
fetchModelsBtn.addEventListener('click', async () => {
    const url = document.getElementById('ce-apiurl').value.trim();
    const key = document.getElementById('ce-apikey').value.trim();

    if (!url) { showToast('⚠️ 请填写 API 地址', 'error'); return; }
    if (!key) { showToast('⚠️ 请填写 API Key', 'error'); return; }

    let baseUrl = url.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
    if (!baseUrl) baseUrl = url;

    showToast('⏳ 获取模型列表中...', 'info');
    try {
        const response = await proxyFetch(
            `${baseUrl}/models`,
            'GET',
            { 'Authorization': `Bearer ${key}` },
            null, // GET 请求无 body
            false
        );
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

// 其余函数（面板渲染、图标、拖拽等）保持不变，与之前相同。
// 由于篇幅限制，这里省略，但最终提供完整代码。

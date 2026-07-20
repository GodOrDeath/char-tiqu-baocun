// ================================================================
// 📝 角色提取器 (char-tiqu-baocun) - UI + 设置面板
// 功能：点击图标弹出设置面板，配置 OpenAI 格式 API
// ================================================================

import { getContext } from '../../../extensions.js';

// ---------- 默认设置 ----------
const DEFAULT_SETTINGS = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 2000,
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

// ---------- 创建 UI 面板 HTML ----------
function getPanelHTML() {
    return `
        <div id="ce-panel" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 99999;
            background: #1e1e2a;
            border-radius: 16px;
            width: 480px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 12px 48px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.08);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: #e0e0e0;
            padding: 0;
            display: none;
        ">
            <!-- 标题栏 -->
            <div style="
                padding: 18px 24px 14px 24px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">📝</span>
                    <span style="font-size: 18px; font-weight: 600;">角色提取器设置</span>
                </div>
                <button id="ce-close-panel" style="
                    background: transparent;
                    border: none;
                    color: #888;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">✕</button>
            </div>

            <!-- 内容区 -->
            <div style="padding: 20px 24px 24px 24px;">
                <!-- API 配置卡片 -->
                <div style="
                    background: rgba(255,255,255,0.04);
                    border-radius: 10px;
                    padding: 16px 18px;
                    margin-bottom: 16px;
                    border: 1px solid rgba(255,255,255,0.06);
                ">
                    <div style="font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 14px; letter-spacing: 0.3px;">
                        🔌 API 配置
                    </div>

                    <!-- API 类型（固定为 OpenAI 格式，显示提示） -->
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 12px; color: #bbb; margin-bottom: 4px;">API 类型</label>
                        <div style="
                            background: rgba(255,255,255,0.05);
                            border: 1px solid rgba(255,255,255,0.08);
                            border-radius: 6px;
                            padding: 8px 12px;
                            font-size: 13px;
                            color: #ccc;
                        ">
                            ✅ 自定义 OpenAI (兼容)
                        </div>
                    </div>

                    <!-- Base URL -->
                    <div style="margin-bottom: 12px;">
                        <label for="ce-apiurl" style="display: block; font-size: 12px; color: #bbb; margin-bottom: 4px;">自定义端点（基础 URL）</label>
                        <input type="text" id="ce-apiurl" placeholder="https://api.openai.com/v1/chat/completions" style="
                            width: 100%;
                            padding: 8px 12px;
                            background: rgba(255,255,255,0.07);
                            border: 1px solid rgba(255,255,255,0.12);
                            border-radius: 6px;
                            color: #e0e0e0;
                            font-size: 13px;
                            box-sizing: border-box;
                            transition: border 0.2s;
                        " onfocus="this.style.borderColor='#5b7cfa'" onblur="this.style.borderColor='rgba(255,255,255,0.12)'">
                    </div>

                    <!-- API Key -->
                    <div style="margin-bottom: 12px;">
                        <label for="ce-apikey" style="display: block; font-size: 12px; color: #bbb; margin-bottom: 4px;">API Key</label>
                        <input type="password" id="ce-apikey" placeholder="sk-..." style="
                            width: 100%;
                            padding: 8px 12px;
                            background: rgba(255,255,255,0.07);
                            border: 1px solid rgba(255,255,255,0.12);
                            border-radius: 6px;
                            color: #e0e0e0;
                            font-size: 13px;
                            box-sizing: border-box;
                            transition: border 0.2s;
                        " onfocus="this.style.borderColor='#5b7cfa'" onblur="this.style.borderColor='rgba(255,255,255,0.12)'">
                    </div>

                    <!-- 模型 -->
                    <div style="margin-bottom: 12px;">
                        <label for="ce-model" style="display: block; font-size: 12px; color: #bbb; margin-bottom: 4px;">选择或输入模型</label>
                        <input type="text" id="ce-model" placeholder="gpt-3.5-turbo" style="
                            width: 100%;
                            padding: 8px 12px;
                            background: rgba(255,255,255,0.07);
                            border: 1px solid rgba(255,255,255,0.12);
                            border-radius: 6px;
                            color: #e0e0e0;
                            font-size: 13px;
                            box-sizing: border-box;
                            transition: border 0.2s;
                        " onfocus="this.style.borderColor='#5b7cfa'" onblur="this.style.borderColor='rgba(255,255,255,0.12)'">
                    </div>

                    <!-- 温度 -->
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                        <label for="ce-temperature" style="font-size: 12px; color: #bbb; min-width: 60px;">温度</label>
                        <input type="number" id="ce-temperature" min="0" max="1" step="0.05" style="
                            flex: 1;
                            padding: 8px 12px;
                            background: rgba(255,255,255,0.07);
                            border: 1px solid rgba(255,255,255,0.12);
                            border-radius: 6px;
                            color: #e0e0e0;
                            font-size: 13px;
                            box-sizing: border-box;
                        ">
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px;">
                    <button id="ce-save-btn" style="
                        padding: 8px 20px;
                        background: #5b7cfa;
                        color: #fff;
                        border: none;
                        border-radius: 6px;
                        font-weight: 500;
                        font-size: 13px;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#4a6ae0'" onmouseout="this.style.background='#5b7cfa'">
                        💾 保存设置
                    </button>
                    <button id="ce-test-btn" style="
                        padding: 8px 20px;
                        background: rgba(255,255,255,0.08);
                        color: #ccc;
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 6px;
                        font-weight: 500;
                        font-size: 13px;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        🔍 测试连接
                    </button>
                    <button id="ce-reset-btn" style="
                        padding: 8px 20px;
                        background: rgba(255,80,80,0.12);
                        color: #f77;
                        border: none;
                        border-radius: 6px;
                        font-weight: 500;
                        font-size: 13px;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,80,80,0.2)'" onmouseout="this.style.background='rgba(255,80,80,0.12)'">
                        ↺ 重置默认
                    </button>
                </div>

                <!-- Toast 消息 -->
                <div id="ce-toast" style="
                    margin-top: 14px;
                    display: none;
                    padding: 10px 14px;
                    border-radius: 6px;
                    background: rgba(91, 124, 250, 0.12);
                    border: 1px solid rgba(91, 124, 250, 0.2);
                    color: #b8c8ff;
                    font-size: 13px;
                "></div>
            </div>
        </div>
    `;
}

// ---------- 创建 UI 面板 ----------
function createPanel() {
    if (document.getElementById('ce-panel')) return;
    const panelHTML = getPanelHTML();
    const div = document.createElement('div');
    div.innerHTML = panelHTML;
    document.body.appendChild(div.firstElementChild);

    // 绑定事件
    const panel = document.getElementById('ce-panel');
    const closeBtn = document.getElementById('ce-close-panel');
    const saveBtn = document.getElementById('ce-save-btn');
    const testBtn = document.getElementById('ce-test-btn');
    const resetBtn = document.getElementById('ce-reset-btn');

    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
        panelVisible = false;
    });

    // 点击面板外部关闭
    document.addEventListener('mousedown', (e) => {
        if (panelVisible && panel.style.display === 'block') {
            if (!panel.contains(e.target) && e.target.id !== 'ce-draggable-btn') {
                panel.style.display = 'none';
                panelVisible = false;
            }
        }
    });

    // 保存设置
    saveBtn.addEventListener('click', () => {
        settings.apiUrl = document.getElementById('ce-apiurl').value.trim() || DEFAULT_SETTINGS.apiUrl;
        settings.apiKey = document.getElementById('ce-apikey').value.trim();
        settings.model = document.getElementById('ce-model').value.trim() || DEFAULT_SETTINGS.model;
        settings.temperature = parseFloat(document.getElementById('ce-temperature').value) || 0.3;
        saveSettings();
        showToast('✅ 设置已保存', 'success');
    });

    // 测试连接
    testBtn.addEventListener('click', async () => {
        const url = document.getElementById('ce-apiurl').value.trim();
        const key = document.getElementById('ce-apikey').value.trim();
        const model = document.getElementById('ce-model').value.trim() || 'gpt-3.5-turbo';
        if (!url) {
            showToast('⚠️ 请先填写 API 地址', 'error');
            return;
        }
        showToast('⏳ 测试连接中...', 'info');
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(key ? { 'Authorization': `Bearer ${key}` } : {}),
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 5,
                })
            });
            if (resp.ok) {
                showToast('✅ 连接成功！', 'success');
            } else {
                const text = await resp.text();
                showToast(`❌ 连接失败 (${resp.status})`, 'error');
            }
        } catch (e) {
            showToast(`❌ 连接异常: ${e.message}`, 'error');
        }
    });

    // 重置默认
    resetBtn.addEventListener('click', () => {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            populateUI();
            showToast('↺ 已重置为默认设置', 'success');
        }
    });

    // 填充 UI 当前值
    populateUI();
}

function populateUI() {
    document.getElementById('ce-apiurl').value = settings.apiUrl;
    document.getElementById('ce-apikey').value = settings.apiKey;
    document.getElementById('ce-model').value = settings.model;
    document.getElementById('ce-temperature').value = settings.temperature;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('ce-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.background = type === 'success' ? 'rgba(100,220,100,0.12)' :
                             type === 'error' ? 'rgba(255,80,80,0.12)' :
                             'rgba(91,124,250,0.12)';
    toast.style.borderColor = type === 'success' ? 'rgba(100,220,100,0.2)' :
                              type === 'error' ? 'rgba(255,80,80,0.2)' :
                              'rgba(91,124,250,0.2)';
    toast.style.color = type === 'success' ? '#8f8' :
                        type === 'error' ? '#f88' :
                        '#b8c8ff';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

// ---------- 创建可拖动图标 ----------
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
        lineHeight: '1'
    });

    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 6px 20px rgba(91, 124, 250, 0.8)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 4px 16px rgba(91, 124, 250, 0.6)';
    });

    // 点击切换面板
    button.addEventListener('click', () => {
        const panel = document.getElementById('ce-panel');
        if (!panel) return;
        if (panel.style.display === 'block') {
            panel.style.display = 'none';
            panelVisible = false;
        } else {
            panel.style.display = 'block';
            panelVisible = true;
            // 确保面板在视口内
            panel.style.top = '50%';
            panel.style.left = '50%';
            panel.style.transform = 'translate(-50%, -50%)';
        }
    });

    // 拖拽逻辑
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

// ---------- 插件入口 ----------
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

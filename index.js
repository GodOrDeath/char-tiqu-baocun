// ================================================================
// 📝 角色提取器 (char-tiqu-baocun) - 最终稳定版
// 使用 window.eventSource 监听消息，无需额外导入
// ================================================================

import { getContext } from '../../../extensions.js';

// 从全局获取 eventSource（SillyTavern 会暴露）
const eventSource = window.eventSource;
const event_types = window.event_types;

// ---------- 默认设置 ----------
const DEFAULT_SETTINGS = {
    enabled: true,
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',// ================================================================
// 📝 角色提取器 (char-tiqu-baocun)
// 基于 SillyTavern UI Extensions 官方规范
// ================================================================

// 1. 导入核心 API
import { getContext } from '../../../extensions.js';

// 2. 插件主入口
jQuery(async () => {
    console.log('[角色提取器] 插件正在加载...');

    // 获取 SillyTavern 核心上下文
    const context = getContext();
    if (!context) {
        console.error('[角色提取器] 无法获取 SillyTavern 上下文');
        return;
    }

    // 创建一个可拖动的浮动按钮
    createDraggableButton();
    
    console.log('[角色提取器] ✅ 插件加载完成');
});

// 3. 创建可拖动按钮的函数
function createDraggableButton() {
    // 检查按钮是否已存在，避免重复创建
    if (document.getElementById('ce-draggable-btn')) {
        return;
    }

    // 创建按钮元素
    const button = document.createElement('div');
    button.id = 'ce-draggable-btn';
    button.innerHTML = '📝';
    button.title = '角色提取器';
    
    // 设置按钮样式 (使其可拖动并浮动在界面上)
    Object.assign(button.style, {
        position: 'fixed',
        bottom: '100px',
        right: '20px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: '#5b7cfa',
        color: '#fff',
        fontSize: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: 'grab',
        zIndex: '9999',
        userSelect: 'none',
        transition: 'box-shadow 0.2s',
        border: 'none',
        fontFamily: 'sans-serif'
    });

    // 添加悬停效果
    button.addEventListener('mouseenter', () => {
        button.style.boxShadow = '0 6px 16px rgba(91, 124, 250, 0.5)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });

    // 添加点击事件：显示一个简单的消息
    button.addEventListener('click', () => {
        alert('📝 角色提取器已加载！\n\n后续将在这里实现角色提取功能。');
    });

    // --- 实现拖拽功能 ---
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    button.addEventListener('mousedown', (e) => {
        // 只响应左键点击
        if (e.button !== 0) return;
        
        isDragging = true;
        button.style.cursor = 'grabbing';
        
        // 计算鼠标相对于按钮左上角的偏移
        const rect = button.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // 防止文本被选中
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        // 计算新位置，确保按钮不超出视口
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        
        // 边界限制
        const maxX = window.innerWidth - button.offsetWidth;
        const maxY = window.innerHeight - button.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        button.style.left = newX + 'px';
        button.style.top = newY + 'px';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            button.style.cursor = 'grab';
        }
    });

    // 将按钮添加到页面
    document.body.appendChild(button);
    console.log('[角色提取器] 已创建可拖动按钮');
}
    model: 'gpt-3.5-turbo',
    maxMessages: 20,
    temperature: 0.3,
    overwrite: false,
    autoOpen: true,
};

let settings = { ...DEFAULT_SETTINGS };
let isExtracting = false;
let context = null;
let lastMessageCount = 0;
let isListening = false;

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

function showToast(message, type = 'info') {
    const $toast = $('#ce-toast');
    if (!$toast.length) return;
    $toast.text(message)
        .removeClass('ce-toast-success ce-toast-error')
        .addClass(type === 'success' ? 'ce-toast-success' : type === 'error' ? 'ce-toast-error' : '')
        .show();
    clearTimeout($toast.data('timer'));
    $toast.data('timer', setTimeout(() => $toast.fadeOut(300), 4000));
}

// ---------- 获取内置 HTML ----------
function getSettingsHTML() {
    return `
        <div id="ce-settings-container" style="padding:16px 20px; color:#e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <h3 style="margin:0; font-size:18px; font-weight:600;">📝 角色提取器</h3>
                <button id="ce-close-panel" style="background:transparent; border:none; color:#888; font-size:20px; cursor:pointer; padding:0 8px;">✕</button>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:8px;">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:14px; user-select:none;">
                    <span style="font-weight:500;">启用插件</span>
                    <input type="checkbox" id="ce-enabled" style="width:18px; height:18px; accent-color:#5b7cfa; cursor:pointer;">
                </label>
                <span id="ce-status-text" style="font-size:13px; color:#6f8; font-weight:500;">● 已启用</span>
            </div>
            <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:8px; margin-bottom:12px;">
                <div style="font-size:13px; font-weight:600; color:#aaa; margin-bottom:10px;">🔌 API 配置</div>
                <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:12px; color:#bbb; margin-bottom:3px;">API 地址</label>
                    <input type="text" id="ce-apiurl" style="width:100%; padding:6px 10px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:12px; color:#bbb; margin-bottom:3px;">API Key</label>
                    <input type="password" id="ce-apikey" style="width:100%; padding:6px 10px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:#bbb; margin-bottom:3px;">模型名称</label>
                    <input type="text" id="ce-model" style="width:100%; padding:6px 10px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:8px; margin-bottom:12px;">
                <div style="font-size:13px; font-weight:600; color:#aaa; margin-bottom:10px;">⚙️ 提取设置</div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <label style="font-size:12px; color:#bbb; min-width:110px;">分析最近消息数</label>
                    <input type="number" id="ce-maxmessages" min="5" max="100" style="flex:1; padding:6px 10px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
                    <span style="font-size:12px; color:#777;">条</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <label style="font-size:12px; color:#bbb; min-width:110px;">AI 温度</label>
                    <input type="number" id="ce-temperature" min="0" max="1" step="0.05" style="flex:1; padding:6px 10px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:8px; margin-bottom:14px;">
                <div style="font-size:13px; font-weight:600; color:#aaa; margin-bottom:10px;">📋 世界书写入设置</div>
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:#ccc; cursor:pointer; margin-bottom:4px;">
                    <input type="checkbox" id="ce-overwrite" style="accent-color:#5b7cfa;"> 遇到同名角色时覆盖已有条目
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:#ccc; cursor:pointer;">
                    <input type="checkbox" id="ce-auto-open" checked style="accent-color:#5b7cfa;"> 写入后自动打开世界书面板
                </label>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="ce-save-btn" style="padding:8px 20px; background:#5b7cfa; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:500;">💾 保存设置</button>
                <button id="ce-test-btn" style="padding:8px 20px; background:rgba(255,255,255,0.1); color:#ccc; border:none; border-radius:6px; cursor:pointer;">🔍 测试连接</button>
                <button id="ce-reset-btn" style="padding:8px 20px; background:rgba(255,80,80,0.15); color:#f77; border:none; border-radius:6px; cursor:pointer;">↺ 重置默认</button>
            </div>
            <div id="ce-toast" style="margin-top:12px; display:none; padding:8px 12px; border-radius:6px; background:rgba(91,124,250,0.15); border:1px solid rgba(91,124,250,0.25); color:#b8c8ff; font-size:13px;"></div>
        </div>
    `;
}

// ---------- 渲染设置面板 ----------
function renderSettings() {
    const containerId = 'ce-ext-container';
    let $container = $(`#${containerId}`);
    if (!$container.length) {
        $container = $(`
            <div id="${containerId}" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:9999; background:#1e1e2a; border-radius:12px; width:480px; max-height:80vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.1);">
            </div>
        `);
        $('body').append($container);
    }

    $container.html(getSettingsHTML());
    bindUIEvents();
    populateSettings();
    updateStatusDisplay();

    addToExtensionsMenu(() => {
        if ($container.is(':visible')) {
            $container.hide();
        } else {
            $container.show();
        }
    });

    $(document).off('click.ce').on('click.ce', function(e) {
        if ($container.is(':visible') &&
            !$(e.target).closest('#ce-ext-container').length &&
            !$(e.target).closest('.ce-wand-item').length) {
            $container.hide();
        }
    });
}

// ---------- 添加到扩展菜单 ----------
function addToExtensionsMenu(onClick) {
    const inject = () => {
        const $menu = $('#extensionsMenu .list-group');
        if (!$menu.length) return false;
        if ($menu.find('.ce-wand-item').length) return true;

        const $item = $(`
            <a href="#" class="list-group-item list-group-item-action ce-wand-item" data-extension-id="char-tiqu-baocun">
                📝 角色提取器
            </a>
        `);

        $item.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onClick === 'function') onClick();
            const $parent = $(this).closest('.dropdown');
            if ($parent.length) $parent.removeClass('open');
        });

        $menu.prepend($item);
        console.log('[角色提取器] ✅ 已添加到扩展菜单');
        return true;
    };

    if (inject()) return;

    const observer = new MutationObserver(() => {
        if (inject()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        observer.disconnect();
        if (!inject()) {
            console.warn('[角色提取器] ⚠️ 未找到扩展菜单，启用浮动按钮');
            addFloatingButton(onClick);
        }
    }, 5000);
}

function addFloatingButton(onClick) {
    if ($('#ce-float-btn').length) return;
    const $btn = $(`
        <button id="ce-float-btn" style="position:fixed; bottom:80px; right:20px; z-index:9999; 
                background:#5b7cfa; color:#fff; border:none; border-radius:50%; width:48px; height:48px; 
                font-size:22px; cursor:pointer; box-shadow:0 4px 16px rgba(91,124,250,0.4);
                display:flex; align-items:center; justify-content:center;">
            📝
        </button>
    `);
    $('body').append($btn);
    $btn.on('click', onClick);
}

// ---------- UI 事件绑定 ----------
function bindUIEvents() {
    $('#ce-close-panel').off('click').on('click', function() {
        $('#ce-ext-container').hide();
    });

    $('#ce-save-btn').off('click').on('click', () => {
        settings.enabled = $('#ce-enabled').prop('checked');
        settings.apiUrl = $('#ce-apiurl').val().trim() || DEFAULT_SETTINGS.apiUrl;
        settings.apiKey = $('#ce-apikey').val().trim();
        settings.model = $('#ce-model').val().trim() || DEFAULT_SETTINGS.model;
        settings.maxMessages = parseInt($('#ce-maxmessages').val()) || 20;
        settings.temperature = parseFloat($('#ce-temperature').val()) || 0.3;
        settings.overwrite = $('#ce-overwrite').prop('checked');
        settings.autoOpen = $('#ce-auto-open').prop('checked');
        saveSettings();
        updateStatusDisplay();
        showToast('✅ 设置已保存', 'success');
    });

    $('#ce-test-btn').off('click').on('click', async () => {
        const url = $('#ce-apiurl').val().trim();
        const key = $('#ce-apikey').val().trim();
        const model = $('#ce-model').val().trim() || 'gpt-3.5-turbo';
        if (!url) {
            showToast('⚠️ 请先填写 API 地址', 'error');
            return;
        }
        showToast('⏳ 正在测试连接...', 'info');
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': key ? `Bearer ${key}` : '',
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

    $('#ce-reset-btn').off('click').on('click', () => {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            populateSettings();
            updateStatusDisplay();
            showToast('↺ 已重置为默认设置', 'success');
        }
    });

    $('#ce-enabled').off('change').on('change', function() {
        updateStatusDisplay();
    });
}

function populateSettings() {
    $('#ce-enabled').prop('checked', settings.enabled);
    $('#ce-apiurl').val(settings.apiUrl);
    $('#ce-apikey').val(settings.apiKey);
    $('#ce-model').val(settings.model);
    $('#ce-maxmessages').val(settings.maxMessages);
    $('#ce-temperature').val(settings.temperature);
    $('#ce-overwrite').prop('checked', settings.overwrite);
    $('#ce-auto-open').prop('checked', settings.autoOpen);
}

function updateStatusDisplay() {
    const $hint = $('#ce-status-text');
    if ($hint.length) {
        const isEnabled = $('#ce-enabled').prop('checked');
        $hint.text(isEnabled ? '● 已启用' : '○ 已禁用')
            .toggleClass('ce-disabled', !isEnabled);
    }
}

// ---------- 提取 API ----------
async function extractCharacters(conversationText) {
    const systemPrompt = `你是一个专业的角色信息提取助手。从对话中提取所有新出现的角色信息，以JSON数组输出。每个角色对象包含以下字段：
- name: 角色姓名（必填）
- age: 年龄
- gender: 性别
- background: 背景故事
- height: 身高
- weight: 体重
- body_type: 体型描述
- special_features: 特殊身体特征（可选）
- appearance: 相貌特点
- clothing: 衣着风格
- personality: 性格特点
- hobbies: 兴趣爱好
- skills: 特殊技能/能力

如果信息不足，字段值可留空字符串。只输出JSON数组，不要多余文字。`;
    const userPrompt = `请从以下对话中提取角色信息：\n\n${conversationText}`;
    const requestBody = {
        model: settings.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: settings.temperature || 0.3,
        max_tokens: 2000,
    };
    try {
        const response = await fetch(settings.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {}),
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
        }
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) content = jsonMatch[1].trim();
        const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) content = arrayMatch[0];
        const characters = JSON.parse(content);
        if (!Array.isArray(characters)) throw new Error('返回结果不是数组');
        return characters.filter(c => c.name && c.name.trim());
    } catch (e) {
        console.error('[角色提取器] 提取失败:', e);
        return [];
    }
}

// ---------- 格式化角色信息 ----------
function formatCharacterEntry(character) {
    const {
        name = '未知角色',
        age = '',
        gender = '',
        background = '',
        height = '',
        weight = '',
        body_type = '',
        special_features = '',
        appearance = '',
        clothing = '',
        personality = '',
        hobbies = '',
        skills = ''
    } = character;
    let entry = `${name.trim()}\n`;
    entry += `【个人信息】\n\n年龄： ${age || '未知'}\n性别： ${gender || '未知'}\n\n`;
    entry += `【背景故事】\n\n${background || '暂无信息'}\n\n`;
    entry += `【外形特征】\n\n身高： ${height || '未知'}\n体重： ${weight || '未知'}\n体型描述： ${body_type || '未知'}\n`;
    if (special_features) entry += `(可选) 特殊身体特征： ${special_features}\n`;
    entry += `相貌特点： ${appearance || '未知'}\n衣着风格： ${clothing || '未知'}\n\n`;
    entry += `【性格特点】\n\n${personality || '暂无信息'}\n\n`;
    entry += `【兴趣爱好】\n\n${hobbies || '暂无信息'}\n\n`;
    entry += `【特殊技能/能力】\n\n${skills || '暂无信息'}`;
    return entry;
}

// ---------- 写入世界书 ----------
function writeToWorldbook(characters) {
    const wi = window.world_info;
    if (!wi) {
        console.warn('[角色提取器] ⚠️ 世界书未加载');
        showToast('⚠️ 请先打开世界书面板', 'error');
        return;
    }
    const entries = wi.entries || [];
    let writtenCount = 0;
    characters.forEach(character => {
        const name = character.name?.trim();
        if (!name) return;
        let existingIndex = -1;
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].keys && entries[i].keys.includes(name)) {
                existingIndex = i;
                break;
            }
        }
        const formattedText = formatCharacterEntry(character);
        if (existingIndex >= 0) {
            if (settings.overwrite) {
                entries[existingIndex].content = formattedText;
                console.log(`[角色提取器] 🔄 更新世界书条目: ${name}`);
                writtenCount++;
            } else {
                console.log(`[角色提取器] ⏭️ 跳过已存在的角色: ${name}`);
            }
        } else {
            const newEntry = {
                uid: Date.now() + Math.random() * 1000,
                keys: [name],
                content: formattedText,
                enabled: true,
                selective: false,
                priority: 0,
                depth: 4,
            };
            entries.push(newEntry);
            console.log(`[角色提取器] ✨ 新建世界书条目: ${name}`);
            writtenCount++;
        }
    });
    if (typeof wi.save === 'function') wi.save();
    else if (typeof wi.saveWorldInfo === 'function') wi.saveWorldInfo();
    else $(document).trigger('worldInfoUpdated');

    if (writtenCount > 0) {
        showToast(`✅ 已${settings.overwrite ? '更新' : '写入'} ${writtenCount} 个角色到世界书`, 'success');
        if (settings.autoOpen) {
            const $wiBtn = $('#worldInfoButton');
            if ($wiBtn.length && !$wiBtn.hasClass('active')) $wiBtn.click();
        }
    } else {
        showToast('ℹ️ 未发现新角色', 'info');
    }
}

// ---------- 核心：处理新消息 ----------
async function handleNewMessage() {
    if (!settings.enabled) return;
    if (isExtracting) return;
    if (!window.world_info) {
        console.warn('[角色提取器] ⚠️ 世界书未加载，跳过提取');
        return;
    }
    if (!context) {
        context = getContext();
        if (!context) return;
    }
    const chat = context.chat;
    if (!chat?.messages) return;
    const messages = chat.messages;
    if (messages.length === 0) return;

    // 最后一条消息必须是 AI 的
    const last = messages[messages.length - 1];
    if (!last || last.is_user) return;

    // 避免重复处理：检查消息数量是否变化
    if (messages.length === lastMessageCount) return;
    lastMessageCount = messages.length;

    const recent = messages.slice(-settings.maxMessages);
    const conversationText = recent
        .map(msg => `${msg.name || 'User'}: ${msg.text || ''}`)
        .join('\n');

    if (conversationText.trim().length < 20) return;

    isExtracting = true;
    try {
        const characters = await extractCharacters(conversationText);
        if (characters && characters.length > 0) {
            writeToWorldbook(characters);
        }
    } catch (e) {
        console.error('[角色提取器] 提取过程出错:', e);
    } finally {
        isExtracting = false;
    }
}

// ---------- 设置监听器 ----------
function setupListener() {
    context = getContext();
    if (!context) {
        console.error('[角色提取器] ❌ 无法获取 SillyTavern 上下文');
        return;
    }
    lastMessageCount = context.chat?.messages?.length || 0;

    // 首选：使用 window.eventSource
    if (eventSource && event_types) {
        console.log('[角色提取器] 📡 使用 window.eventSource 监听 MESSAGE_RECEIVED');
        eventSource.on(event_types.MESSAGE_RECEIVED, async (index) => {
            // 当新消息到达时触发
            if (!settings.enabled) return;
            if (isExtracting) return;
            const chat = context.chat;
            if (!chat?.messages) return;
            const messages = chat.messages;
            if (messages.length === 0) return;
            // 检查最后一条是否是 AI 的，且消息数量增加了
            const last = messages[messages.length - 1];
            if (last && !last.is_user && messages.length > lastMessageCount) {
                lastMessageCount = messages.length;
                await handleNewMessage();
            } else {
                // 如果是用户消息，只更新计数
                lastMessageCount = messages.length;
            }
        });
        console.log('[角色提取器] ✅ eventSource 监听已启动');
        return;
    }

    // 备用方案：轮询
    console.log('[角色提取器] 📡 eventSource 不可用，使用轮询方案（每2秒）');
    setInterval(() => {
        if (!settings.enabled) return;
        if (isExtracting) return;
        if (!context) return;
        const chat = context.chat;
        if (!chat?.messages) return;
        const messages = chat.messages;
        if (messages.length === 0) return;
        if (messages.length <= lastMessageCount) return;
        const last = messages[messages.length - 1];
        if (last && !last.is_user) {
            lastMessageCount = messages.length;
            handleNewMessage();
        } else {
            lastMessageCount = messages.length;
        }
    }, 2000);
    console.log('[角色提取器] ✅ 轮询监听已启动');
}

// ---------- 插件入口 ----------
jQuery(async () => {
    try {
        loadSettings();
        context = getContext();
        renderSettings();
        setupListener();
        console.log('[角色提取器] ✅ 插件已加载');
    } catch (e) {
        console.error('[角色提取器] ❌ 加载失败:', e);
        $('body').append(`<div style="position:fixed; bottom:10px; right:10px; background:#c0392b; color:#fff; padding:8px 16px; border-radius:4px; z-index:99999; font-size:14px;">⚠️ 角色提取器加载失败: ${e.message}</div>`);
        setTimeout(() => $('body').find('div:last').remove(), 10000);
    }
});

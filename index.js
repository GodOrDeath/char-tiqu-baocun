// ================================================================
// 📝 角色提取器 (char-tiqu-baocun)
// 功能：每轮AI回复后自动分析对话，提取角色信息并写入世界书
// 基于 SillyTavern UI Extensions 规范开发
// ================================================================

import { getContext } from '../../../extensions.js';

// ---------- 默认设置 ----------
const DEFAULT_SETTINGS = {
    enabled: true,
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    maxMessages: 20,
    temperature: 0.3,
    overwrite: false,
    autoOpen: true,
};

let settings = { ...DEFAULT_SETTINGS };
let isExtracting = false;

// ---------- 工具函数 ----------
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

// ---------- 渲染设置面板 ----------
async function renderSettings() {
    // 使用 import.meta.url 获取当前脚本所在目录
    const basePath = new URL('.', import.meta.url).href;
    const htmlUrl = new URL('settings.html', basePath).href;

    let html = '';
    try {
        const resp = await fetch(htmlUrl);
        if (resp.ok) html = await resp.text();
    } catch (e) { /* fallback */ }

    if (!html) {
        // 如果 settings.html 加载失败，使用内联备用模板
        html = getFallbackSettingsHTML();
    }

    // 找到扩展的容器并注入
    const containerId = 'ce-ext-container';
    let $container = $(`#${containerId}`);
    if (!$container.length) {
        // 在扩展菜单中创建条目
        const $menu = $('#extensionsMenu .extensionsMenu');
        if ($menu.length) {
            const $item = $(`
                <div class="extension" data-extension-id="char-tiqu-baocun" 
                     style="display:flex; align-items:center; gap:8px; padding:4px 0;">
                    <span style="font-weight:500;">📝 角色提取器</span>
                    <button id="ce-toggle-btn" class="menu_button" 
                            style="background:transparent; border:none; color:#aaa; cursor:pointer; font-size:14px; padding:2px 8px;">
                        ⚙️
                    </button>
                </div>
            `);
            $menu.append($item);
            $container = $(`<div id="${containerId}" style="display:none; padding:8px 4px;"></div>`);
            $item.after($container);
        } else {
            // 后备：浮动按钮
            const $btn = $(`<button id="ce-float-btn" style="position:fixed; bottom:80px; right:20px; z-index:9999; 
                            background:#5b7cfa; color:#fff; border:none; border-radius:50%; width:48px; height:48px; 
                            font-size:22px; cursor:pointer; box-shadow:0 4px 16px rgba(91,124,250,0.4);">
                            📝</button>`);
            $('body').append($btn);
            $container = $(`<div id="${containerId}" style="display:none; position:fixed; bottom:140px; right:20px; 
                            z-index:9998; background:#1e1e2a; border-radius:12px; width:420px; max-height:70vh; 
                            overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.06);">
                          </div>`);
            $('body').append($container);
            $btn.on('click', () => $container.slideToggle(200));
        }
    }

    // 注入 HTML
    $container.html(html).show();

    // 绑定 UI 事件
    bindUIEvents();

    // 填充当前设置值
    populateSettings();

    // 更新状态显示
    updateStatusDisplay();

    // 绑定 toggle 按钮
    $('#ce-toggle-btn').off('click').on('click', () => {
        $container.slideToggle(200);
    });
}

// ---------- 备用 HTML ----------
function getFallbackSettingsHTML() {
    return `
        <div id="ce-settings-container" style="padding:12px 16px; color:#e0e0e0;">
            <h3 style="margin:0 0 12px 0;">📝 角色提取器</h3>
            <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <input type="checkbox" id="ce-enabled"> 启用插件
            </label>
            <div style="margin-bottom:8px;">
                <label style="display:block; font-size:12px; color:#999;">API 地址</label>
                <input type="text" id="ce-apiurl" style="width:100%; padding:6px; background:#2a2a3a; border:1px solid #444; border-radius:4px; color:#e0e0e0;">
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block; font-size:12px; color:#999;">API Key</label>
                <input type="password" id="ce-apikey" style="width:100%; padding:6px; background:#2a2a3a; border:1px solid #444; border-radius:4px; color:#e0e0e0;">
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block; font-size:12px; color:#999;">模型</label>
                <input type="text" id="ce-model" style="width:100%; padding:6px; background:#2a2a3a; border:1px solid #444; border-radius:4px; color:#e0e0e0;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:12px; color:#999;">分析最近消息数</label>
                <input type="number" id="ce-maxmessages" style="width:100%; padding:6px; background:#2a2a3a; border:1px solid #444; border-radius:4px; color:#e0e0e0;">
            </div>
            <button id="ce-save-btn" style="padding:6px 16px; background:#5b7cfa; color:#fff; border:none; border-radius:4px; cursor:pointer;">💾 保存</button>
            <div id="ce-toast" style="margin-top:10px; display:none; padding:8px; border-radius:4px; background:#2a2a3a;"></div>
        </div>
    `;
}

// ---------- 绑定 UI 事件 ----------
function bindUIEvents() {
    // 保存按钮
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

    // 测试连接按钮
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
                showToast(`❌ 连接失败 (${resp.status}): ${text.slice(0, 100)}`, 'error');
            }
        } catch (e) {
            showToast(`❌ 连接异常: ${e.message}`, 'error');
        }
    });

    // 重置按钮
    $('#ce-reset-btn').off('click').on('click', () => {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            populateSettings();
            updateStatusDisplay();
            showToast('↺ 已重置为默认设置', 'success');
        }
    });

    // 启用开关实时更新状态
    $('#ce-enabled').off('change').on('change', function() {
        updateStatusDisplay();
    });
}

// ---------- 填充设置值 ----------
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

// ---------- 更新状态显示 ----------
function updateStatusDisplay() {
    const $hint = $('#ce-status-text');
    if ($hint.length) {
        const isEnabled = $('#ce-enabled').prop('checked');
        $hint.text(isEnabled ? '● 已启用' : '○ 已禁用')
            .toggleClass('ce-disabled', !isEnabled);
    }
}

// ---------- 调用 API 提取角色 ----------
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

        // 去除 Markdown 代码块
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            content = jsonMatch[1].trim();
        }

        // 尝试提取 JSON 数组
        const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
            content = arrayMatch[0];
        }

        const characters = JSON.parse(content);
        if (!Array.isArray(characters)) {
            throw new Error('返回结果不是数组');
        }
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
    entry += `【个人信息】\n\n`;
    entry += `年龄： ${age || '未知'}\n`;
    entry += `性别： ${gender || '未知'}\n\n`;
    entry += `【背景故事】\n\n${background || '暂无信息'}\n\n`;
    entry += `【外形特征】\n\n`;
    entry += `身高： ${height || '未知'}\n`;
    entry += `体重： ${weight || '未知'}\n`;
    entry += `体型描述： ${body_type || '未知'}\n`;
    if (special_features) {
        entry += `(可选) 特殊身体特征： ${special_features}\n`;
    }
    entry += `相貌特点： ${appearance || '未知'}\n`;
    entry += `衣着风格： ${clothing || '未知'}\n\n`;
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

        // 查找是否已存在同名条目
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

    // 保存世界书
    if (typeof wi.save === 'function') {
        wi.save();
    } else if (typeof wi.saveWorldInfo === 'function') {
        wi.saveWorldInfo();
    } else {
        $(document).trigger('worldInfoUpdated');
    }

    if (writtenCount > 0) {
        showToast(`✅ 已${settings.overwrite ? '更新' : '写入'} ${writtenCount} 个角色到世界书`, 'success');

        // 自动打开世界书面板
        if (settings.autoOpen) {
            const $wiBtn = $('#worldInfoButton');
            if ($wiBtn.length && !$wiBtn.hasClass('active')) {
                $wiBtn.click();
            }
        }
    } else {
        showToast('ℹ️ 未发现新角色', 'info');
    }
}

// ---------- 监听聊天消息 ----------
function setupListener() {
    const context = getContext();
    if (!context) {
        console.error('[角色提取器] ❌ 无法获取 SillyTavern 上下文');
        return;
    }

    // 监听消息事件
    context.on('message', async (message) => {
        if (!settings.enabled) return;
        if (!message.isNew || !message.isAi) return;
        if (isExtracting) return;

        // 检查是否已有世界书
        if (!window.world_info) {
            console.warn('[角色提取器] ⚠️ 世界书未加载，跳过提取');
            return;
        }

        isExtracting = true;
        try {
            const chat = context.chat;
            if (!chat?.messages) return;

            const messages = chat.messages;
            const recent = messages.slice(-settings.maxMessages);
            const conversationText = recent
                .map(msg => `${msg.name || 'User'}: ${msg.text || ''}`)
                .join('\n');

            if (conversationText.trim().length < 20) {
                // 对话太短，跳过
                isExtracting = false;
                return;
            }

            const characters = await extractCharacters(conversationText);
            if (characters && characters.length > 0) {
                writeToWorldbook(characters);
            }
        } catch (e) {
            console.error('[角色提取器] 提取过程出错:', e);
        } finally {
            isExtracting = false;
        }
    });

    console.log('[角色提取器] ✅ 消息监听已启动');
}

// ---------- 插件入口 ----------
jQuery(async () => {
    loadSettings();
    await renderSettings();
    setupListener();
    console.log('[角色提取器] ✅ 插件已加载');
});

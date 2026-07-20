// ================================================================
// 📝 角色提取器 (char-tiqu-baocun)
// 基于 SillyTavern UI Extensions 官方开发规范
// 文档：https://docs.sillytavern.app/for-contributors/writing-extensions/
// ================================================================

// 1. 导入官方API（推荐方式）
import { getContext } from '../../../extensions.js';
import { eventSource, event_types } from '../../../script.js';

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
let context = null;

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

// ---------- 渲染设置面板（注入到DOM） ----------
async function renderSettings() {
    const basePath = new URL('.', import.meta.url).href;
    const htmlUrl = new URL('settings.html', basePath).href;

    let html = '';
    try {
        const resp = await fetch(htmlUrl);
        if (resp.ok) html = await resp.text();
    } catch (e) { /* fallback */ }

    if (!html) {
        html = getFallbackSettingsHTML();
    }

    // 创建设置面板容器（固定悬浮窗）
    const containerId = 'ce-ext-container';
    let $container = $(`#${containerId}`);
    if (!$container.length) {
        $container = $(`
            <div id="${containerId}" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:9999; background:#1e1e2a; border-radius:12px; width:480px; max-height:80vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.1);">
            </div>
        `);
        $('body').append($container);
    }

    $container.html(html);
    bindUIEvents();
    populateSettings();
    updateStatusDisplay();

    // ---------- 官方推荐：通过扩展菜单添加入口 ----------
    // 直接操作 DOM，将菜单项添加到 #extensionsMenu .list-group 的顶部
    addToExtensionsMenu(() => {
        if ($container.is(':visible')) {
            $container.hide();
        } else {
            $container.show();
        }
    });

    // 点击面板外部关闭
    $(document).off('click.ce').on('click.ce', function(e) {
        if ($container.is(':visible') &&
            !$(e.target).closest('#ce-ext-container').length &&
            !$(e.target).closest('.ce-wand-item').length) {
            $container.hide();
        }
    });
}

// ---------- 官方推荐：添加到扩展菜单（魔法棒） ----------
function addToExtensionsMenu(onClick) {
    // 使用官方推荐的查找方式：等待 #extensionsMenu 下的 .list-group
    const findMenu = () => {
        // 官方文档示例中，扩展菜单使用 #extensionsMenu .list-group
        const $menu = $('#extensionsMenu .list-group');
        if ($menu.length) {
            // 检查是否已添加
            if ($menu.find('.ce-wand-item').length) return true;

            // 创建菜单项（使用与官方扩展一致的样式）
            const $item = $(`
                <a href="#" class="list-group-item list-group-item-action ce-wand-item" data-extension-id="char-tiqu-baocun">
                    📝 角色提取器
                </a>
            `);

            $item.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof onClick === 'function') onClick();
                // 尝试关闭下拉菜单（如果有）
                const $parent = $(this).closest('.dropdown');
                if ($parent.length) {
                    $parent.removeClass('open');
                }
            });

            // 插入到顶部
            $menu.prepend($item);
            console.log('[角色提取器] ✅ 已添加到扩展菜单');
            return true;
        }
        return false;
    };

    // 立即尝试
    if (findMenu()) return;

    // 如果菜单还没加载，使用 MutationObserver 监听
    const observer = new MutationObserver(() => {
        if (findMenu()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 5秒后停止观察并启用浮动按钮作为备选
    setTimeout(() => {
        observer.disconnect();
        if (!findMenu()) {
            console.warn('[角色提取器] ⚠️ 未找到扩展菜单，启用浮动按钮');
            addFloatingButton(onClick);
        }
    }, 5000);
}

// ---------- 浮动按钮备用 ----------
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

// ---------- 备用 HTML ----------
function getFallbackSettingsHTML() {
    return `
        <div id="ce-settings-container" style="padding:16px 20px; color:#e0e0e0; font-family: sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <h3 style="margin:0; font-size:18px;">📝 角色提取器</h3>
                <button id="ce-close-panel" style="background:transparent; border:none; color:#888; font-size:20px; cursor:pointer;">✕</button>
            </div>
            <label style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                <input type="checkbox" id="ce-enabled"> 启用插件
            </label>
            <div style="margin-bottom:10px;">
                <label style="display:block; font-size:12px; color:#999; margin-bottom:4px;">API 地址</label>
                <input type="text" id="ce-apiurl" style="width:100%; padding:8px 10px; background:#2a2a3a; border:1px solid #444; border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block; font-size:12px; color:#999; margin-bottom:4px;">API Key</label>
                <input type="password" id="ce-apikey" style="width:100%; padding:8px 10px; background:#2a2a3a; border:1px solid #444; border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block; font-size:12px; color:#999; margin-bottom:4px;">模型</label>
                <input type="text" id="ce-model" style="width:100%; padding:8px 10px; background:#2a2a3a; border:1px solid #444; border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="display:block; font-size:12px; color:#999; margin-bottom:4px;">分析最近消息数</label>
                <input type="number" id="ce-maxmessages" style="width:100%; padding:8px 10px; background:#2a2a3a; border:1px solid #444; border-radius:6px; color:#e0e0e0; box-sizing:border-box;">
            </div>
            <div style="display:flex; gap:10px;">
                <button id="ce-save-btn" style="padding:8px 20px; background:#5b7cfa; color:#fff; border:none; border-radius:6px; cursor:pointer;">💾 保存</button>
                <button id="ce-test-btn" style="padding:8px 20px; background:rgba(255,255,255,0.1); color:#ccc; border:none; border-radius:6px; cursor:pointer;">🔍 测试</button>
            </div>
            <div id="ce-toast" style="margin-top:12px; display:none; padding:10px; border-radius:6px; background:rgba(91,124,250,0.15); border:1px solid rgba(91,124,250,0.25); color:#b8c8ff;"></div>
        </div>
    `;
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

// ---------- 官方推荐：事件监听 ----------
function setupListener() {
    if (!context) {
        context = getContext();
        if (!context) {
            console.error('[角色提取器] ❌ 无法获取 SillyTavern 上下文');
            return;
        }
    }

    // 官方推荐使用 eventSource 监听 MESSAGE_RECEIVED 事件
    eventSource.on(event_types.MESSAGE_RECEIVED, async (messageIndex) => {
        if (!settings.enabled) return;
        if (isExtracting) return;
        if (!window.world_info) {
            console.warn('[角色提取器] ⚠️ 世界书未加载，跳过提取');
            return;
        }

        // 获取最新消息
        const chat = context.chat;
        if (!chat?.messages) return;
        const messages = chat.messages;
        // messageIndex 是最后一条消息的索引（可能是AI的回复）
        const lastMsg = messages[messageIndex];
        if (!lastMsg || !lastMsg.is_user) return; // 确保是AI回复

        // 提取最近N条消息（包括刚收到的）
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
    });

    console.log('[角色提取器] ✅ 消息监听已启动 (使用 eventSource)');
}

// ---------- 插件入口 ----------
jQuery(async () => {
    loadSettings();
    context = getContext();
    await renderSettings();
    setupListener();
    console.log('[角色提取器] ✅ 插件已加载');
});

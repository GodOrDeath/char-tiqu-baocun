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
let settingsPanelVisible = false;

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

    // 创建设置面板容器
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

    // ---------- 核心修复：将插件添加到魔法棒菜单 ----------
    addToMagicWandMenu(() => {
        if ($container.is(':visible')) {
            $container.hide();
            settingsPanelVisible = false;
        } else {
            $container.show();
            settingsPanelVisible = true;
        }
    });

    // 点击面板外部关闭
    $(document).off('click.ce').on('click.ce', function(e) {
        if ($container.is(':visible') &&
            !$(e.target).closest('#ce-ext-container').length &&
            !$(e.target).closest('.ce-wand-item').length &&
            !$(e.target).closest('#extensionsMenuButton').length) {
            $container.hide();
            settingsPanelVisible = false;
        }
    });
}

// ================================================================
// ⭐ 核心修复：可靠的魔法棒菜单注入
// ================================================================
function addToMagicWandMenu(onClick) {
    // 定义注入函数
    const injectMenuItem = () => {
        // 尝试多种方式找到魔法棒菜单的列表容器
        // 方式1：通过 #extensionsMenu 查找 .list-group
        let $menu = $('#extensionsMenu .list-group');
        if (!$menu.length) {
            // 方式2：通过 #extensionsMenu 查找 .dropdown-menu
            $menu = $('#extensionsMenu .dropdown-menu');
        }
        if (!$menu.length) {
            // 方式3：直接查找 .extensionsMenu 下的列表
            $menu = $('.extensionsMenu .list-group');
        }
        if (!$menu.length) {
            // 方式4：查找任何可能包含扩展菜单项的容器
            $menu = $('.extensionsMenu .dropdown-menu, .extensionsMenu > div');
        }
        if (!$menu.length) {
            // 方式5：最通用的方式 - 查找 id 包含 extensionsMenu 的元素下的列表
            $menu = $('[id*="extensionsMenu"] .list-group, [id*="extensionsMenu"] .dropdown-menu');
        }

        // 如果找到菜单容器
        if ($menu.length) {
            // 检查是否已添加，避免重复
            if ($menu.find('.ce-wand-item').length) {
                return true;
            }

            // 创建菜单项，风格与现有项保持一致
            const $item = $(`
                <a href="#" class="list-group-item list-group-item-action ce-wand-item" 
                   data-extension-id="char-tiqu-baocun" 
                   style="display:flex; align-items:center; gap:10px; padding:6px 14px; color:#e0e0e0; text-decoration:none; cursor:pointer;">
                    <span style="font-size:16px;">📝</span>
                    <span>角色提取器</span>
                </a>
            `);

            $item.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof onClick === 'function') onClick();
                // 尝试关闭下拉菜单
                const $dropdown = $(this).closest('.dropdown-menu, .dropdown');
                if ($dropdown.length) {
                    // 有些版本的SillyTavern使用data-toggle
                    const $btn = $dropdown.siblings('[data-toggle="dropdown"], .dropdown-toggle');
                    if ($btn.length && $btn.attr('aria-expanded') === 'true') {
                        $btn.dropdown('toggle');
                    }
                }
            });

            // 将菜单项追加到容器中
            $menu.append($item);
            console.log('[角色提取器] ✅ 已添加到魔法棒菜单');
            return true;
        }

        return false;
    };

    // 立即尝试注入
    if (injectMenuItem()) {
        return;
    }

    // 如果菜单尚未加载，等待并重试
    let attempts = 0;
    const maxAttempts = 20; // 最多尝试10秒 (20 * 500ms)
    const interval = setInterval(() => {
        attempts++;
        if (injectMenuItem() || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts >= maxAttempts) {
                console.warn('[角色提取器] ⚠️ 未能找到魔法棒菜单，尝试备用入口');
                // 备用方案：在界面右上角添加浮动按钮
                addFloatingButton(onClick);
            }
        }
    }, 500);

    // 另外，使用 MutationObserver 监听 DOM 变化，以便在菜单动态加载时注入
    const observer = new MutationObserver(() => {
        if (injectMenuItem()) {
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 5秒后如果还没注入成功，停止观察
    setTimeout(() => {
        observer.disconnect();
    }, 5000);
}

// ---------- 备用方案：浮动按钮 ----------
function addFloatingButton(onClick) {
    // 检查是否已存在
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
    console.log('[角色提取器] ✅ 已添加浮动按钮作为备用入口');
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

// ---------- 绑定 UI 事件 ----------
function bindUIEvents() {
    $('#ce-close-panel').off('click').on('click', function() {
        $('#ce-ext-container').hide();
        settingsPanelVisible = false;
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

        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            content = jsonMatch[1].trim();
        }

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

    if (typeof wi.save === 'function') {
        wi.save();
    } else if (typeof wi.saveWorldInfo === 'function') {
        wi.saveWorldInfo();
    } else {
        $(document).trigger('worldInfoUpdated');
    }

    if (writtenCount > 0) {
        showToast(`✅ 已${settings.overwrite ? '更新' : '写入'} ${writtenCount} 个角色到世界书`, 'success');
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

    context.on('message', async (message) => {
        if (!settings.enabled) return;
        if (!message.isNew || !message.isAi) return;
        if (isExtracting) return;

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

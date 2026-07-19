import { eventSource, event_types, worldInfo, saveWorldInfo, chat_metadata, characters, saveCharacter, extension_settings, saveSettingsDebounced } from '../../../../script.js';

const EXTENSION_NAME = '自创角色存入';
const TAG_PREFIX = 'auto_dynamic';
const EXTENSION_ID = 'auto-char-worldbook';

// 默认设置
const defaultSettings = {
    openai: {
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
        contextMessages: 2,
        maxTokens: 1500,
    }
};

if (!extension_settings[EXTENSION_ID]) {
    extension_settings[EXTENSION_ID] = defaultSettings;
}

function getSettings() {
    return extension_settings[EXTENSION_ID];
}

function saveSettings() {
    saveSettingsDebounced();
}

const messageChanges = {};

function getCurrentCharName() {
    return chat_metadata?.char_name || '';
}

function getOrCreateWorldBookForChar(charName) {
    let bookName = `${charName}自创新角色.world.json`;
    let book = worldInfo.find(w => w.name === bookName);
    if (!book) {
        book = {
            name: bookName,
            entries: {},
            keysecondary: false,
            recursive: true,
            selective: false,
            characterFilters: [charName],
        };
        worldInfo.push(book);
        saveWorldInfo();
        console.log(`[${EXTENSION_NAME}] Created world book: ${bookName}`);
    }
    return book;
}

function clearAutoEntriesForChar(charName) {
    let bookName = `${charName}自创新角色.world.json`;
    let book = worldInfo.find(w => w.name === bookName);
    if (!book) return;
    const staticKeys = [`${TAG_PREFIX}_USER`, `${TAG_PREFIX}_${charName}`];
    const keysToDelete = [];
    for (const key in book.entries) {
        if (key.startsWith(TAG_PREFIX) && !staticKeys.includes(key)) {
            keysToDelete.push(key);
        }
    }
    if (keysToDelete.length > 0) {
        keysToDelete.forEach(k => delete book.entries[k]);
        saveWorldInfo();
        console.log(`[${EXTENSION_NAME}] Cleared ${keysToDelete.length} entries for ${charName}.`);
    }
}

function safeSetVariable(key, value) {
    const context = window.SillyTavern?.getContext?.();
    if (!context) return;
    if (typeof context.setVariable === 'function') {
        context.setVariable(key, value);
    } else {
        console.warn(`[${EXTENSION_NAME}] setVariable not available, cannot set ${key}`);
    }
}

function safeGetVariable(key) {
    const context = window.SillyTavern?.getContext?.();
    if (!context) return undefined;
    if (typeof context.getVariable === 'function') {
        return context.getVariable(key);
    }
    return undefined;
}

function rollbackChanges(changes) {
    changes.forEach(change => {
        if (change.oldValue === undefined) {
            const context = window.SillyTavern?.getContext?.();
            if (context?.deleteVariable) {
                context.deleteVariable(change.varKey);
            } else {
                safeSetVariable(change.varKey, '');
            }
        } else {
            safeSetVariable(change.varKey, change.oldValue);
        }
    });
    console.log(`[${EXTENSION_NAME}] Rolled back ${changes.length} variable changes.`);
}

function ensureStaticEntries(charName) {
    const book = getOrCreateWorldBookForChar(charName);
    const context = window.SillyTavern?.getContext?.();

    const userKey = `${TAG_PREFIX}_USER`;
    if (!book.entries[userKey]) {
        const userName = chat_metadata?.user_name || context?.name1 || 'User';
        const userDesc = context?.userDescription || '';
        safeSetVariable('USER_NAME', userName);
        safeSetVariable('USER_DESC', userDesc);

        book.entries[userKey] = {
            key: userKey,
            content: `【当前用户】\n姓名：{{getvar::USER_NAME}}\n描述：{{getvar::USER_DESC}}`,
            comment: 'Auto-generated: USER',
            constant: false,
            selective: false,
            order: 1,
            position: 'after_char',
            disable: false,
            excludeRecursion: false,
            primary: [userKey],
            secondary: [],
            selectiveList: [],
            addMemo: true,
        };
        console.log(`[${EXTENSION_NAME}] Created static USER entry.`);
    }

    const charKey = `${TAG_PREFIX}_${charName}`;
    if (!book.entries[charKey]) {
        const char = characters.find(c => c.name === charName);
        const desc = char?.data?.description || char?.description || '';
        safeSetVariable(`${charName}_描述`, desc);

        book.entries[charKey] = {
            key: charKey,
            content: `【当前角色】\n姓名：${charName}\n描述：{{getvar::${charName}_描述}}`,
            comment: 'Auto-generated: Current Character',
            constant: false,
            selective: false,
            order: 2,
            position: 'after_char',
            disable: false,
            excludeRecursion: false,
            primary: [charKey],
            secondary: [],
            selectiveList: [],
            addMemo: true,
        };
        console.log(`[${EXTENSION_NAME}] Created static Character entry for ${charName}.`);
    }

    saveWorldInfo();
}

function processCharacterBlock(charBlock, isNew) {
    const charNameMain = getCurrentCharName();
    if (!charNameMain) return [];

    const lines = charBlock.split('\n');
    const newCharName = lines[1]?.trim();
    if (!newCharName) return [];

    const changes = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const kvMatch = line.match(/^(.+?)[：:]\s*(.*)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim();
            const value = kvMatch[2].trim();
            if (key && value) {
                const varKey = `${newCharName}_${key.replace(/\s+/g, '_')}`;
                const oldValue = safeGetVariable(varKey);
                if (oldValue !== value) {
                    safeSetVariable(varKey, value);
                    changes.push({ varKey, oldValue });
                }
            }
        }
    }

    if (isNew) {
        const entryKey = `${TAG_PREFIX}_${newCharName}`;
        const book = getOrCreateWorldBookForChar(charNameMain);
        if (!book.entries[entryKey]) {
            let templateLines = [];
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                const kvMatch = line.match(/^(.+?)[：:]\s*(.*)$/);
                if (kvMatch) {
                    const key = kvMatch[1].trim();
                    if (key) {
                        const varKey = `${newCharName}_${key.replace(/\s+/g, '_')}`;
                        templateLines.push(`${key}：{{getvar::${varKey}}}`);
                        continue;
                    }
                }
                templateLines.push(line);
            }
            const entryContent = templateLines.join('\n');

            let nextOrder = 3;
            if (book.entries && Object.keys(book.entries).length > 0) {
                const orders = Object.values(book.entries).map(e => e.order || 0);
                nextOrder = Math.max(3, Math.max(...orders) + 1);
            }

            book.entries[entryKey] = {
                key: entryKey,
                content: entryContent,
                comment: `Auto-generated: ${newCharName}`,
                constant: false,
                selective: false,
                order: nextOrder,
                position: 'after_char',
                disable: false,
                excludeRecursion: false,
                primary: [entryKey],
                secondary: [],
                selectiveList: [],
                addMemo: true,
            };

            saveWorldInfo();
            console.log(`[${EXTENSION_NAME}] Created entry for "${newCharName}" with variables at order ${nextOrder}.`);
        } else {
            console.log(`[${EXTENSION_NAME}] Entry for "${newCharName}" already exists, skipping creation.`);
        }
    } else {
        console.log(`[${EXTENSION_NAME}] Updated variables for "${newCharName}" (${changes.length} changes).`);
    }

    return changes;
}

function processApiResponse(text, uuid) {
    const allChanges = [];
    const newRegex = /<newcharacter>([\s\S]*?)<\/newcharacter>/g;
    let newMatch;
    while ((newMatch = newRegex.exec(text)) !== null) {
        const changes = processCharacterBlock(newMatch[1].trim(), true);
        allChanges.push(...changes);
    }
    const updateRegex = /<updatecharacter>([\s\S]*?)<\/updatecharacter>/g;
    let updateMatch;
    while ((updateMatch = updateRegex.exec(text)) !== null) {
        const changes = processCharacterBlock(updateMatch[1].trim(), false);
        allChanges.push(...changes);
    }
    if (allChanges.length > 0 && uuid) {
        messageChanges[uuid] = allChanges;
    }
}

async function analyzeAndProcessMessage(messageId) {
    const settings = getSettings().openai;
    if (!settings.apiKey || !settings.baseUrl || !settings.model) {
        console.warn('[自创角色存入] API未配置，跳过自动分析');
        return;
    }

    const context = window.SillyTavern?.getContext?.();
    if (!context) return;

    const msg = context.chat[messageId];
    if (!msg || msg.is_system || msg.is_user) return;

    const chat = context.chat;
    const msgIndex = chat.findIndex(m => m.uuid === messageId);
    if (msgIndex === -1) return;

    const contextCount = Math.max(1, settings.contextMessages || 2);
    const startIndex = Math.max(0, msgIndex - contextCount + 1);
    const contextMessages = chat.slice(startIndex, msgIndex + 1)
        .filter(m => !m.is_system)
        .map(m => ({
            role: m.is_user ? 'user' : 'assistant',
            content: m.mes
        }));

    const url = `${settings.baseUrl}/chat/completions`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
    };

    const systemPrompt = `你是一个角色提取助手。请分析以下故事文本，识别其中首次登场的全新角色（不是已有的主角或用户，也不是之前已经出现过的角色）。对于每个新角色，输出一个XML块，严格按照以下格式：
<newcharacter>
角色姓名
【个人信息】
年龄：...
性别：...
【背景故事】
...
【外形特征】
身高：...
体重：...
体型描述：...
(可选) 特殊身体特征：...
相貌特点：...
衣着风格：...
【性格特点】
...
【兴趣爱好】
...
【特殊技能/能力】
...
</newcharacter>
如果故事中没有新角色，则只输出一个单词 NONE。
注意：只提取首次出现的全新角色，不要包含用户或旁白。`;

    const body = JSON.stringify({
        model: settings.model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...contextMessages
        ],
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
    });

    try {
        const response = await fetch(url, { method: 'POST', headers, body });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        const text = data.choices[0]?.message?.content?.trim();
        if (!text || text === 'NONE') return;
        processApiResponse(text, messageId);
    } catch (error) {
        console.error('[自创角色存入] 分析请求失败:', error);
    }
}

async function bindWorldBookToChar(charName) {
    const charIndex = characters.findIndex(c => c.name === charName);
    if (charIndex === -1) return;
    const bookName = `${charName}自创新角色.world.json`;
    const char = characters[charIndex];
    if (char.data?.worldBook === bookName) return;

    char.data = char.data || {};
    char.data.worldBook = bookName;
    await saveCharacter(char, charIndex);
    console.log(`[${EXTENSION_NAME}] Bound world book "${bookName}" to "${charName}".`);
}

async function onNewMessage(messageId) {
    const context = window.SillyTavern?.getContext?.();
    if (!context) return;
    const message = context.chat[messageId];
    if (!message || message.is_system || message.is_user) return;

    if (messageChanges[messageId]) {
        rollbackChanges(messageChanges[messageId]);
        delete messageChanges[messageId];
    }

    await analyzeAndProcessMessage(messageId);
}

function onMessageDeleted(messageId) {
    const context = window.SillyTavern?.getContext?.();
    if (!context) return;
    const currentUuids = new Set(context.chat.map(msg => msg.uuid));
    for (const uuid in messageChanges) {
        if (!currentUuids.has(uuid)) {
            rollbackChanges(messageChanges[uuid]);
            delete messageChanges[uuid];
            console.log(`[${EXTENSION_NAME}] Rolled back changes for deleted message ${uuid}`);
        }
    }
}

function onMessageUpdated(messageId) {
    onNewMessage(messageId);
}

function onNewChat() {
    const charName = getCurrentCharName();
    if (!charName) return;
    clearAutoEntriesForChar(charName);
    ensureStaticEntries(charName);
    bindWorldBookToChar(charName);
    for (const uuid in messageChanges) {
        delete messageChanges[uuid];
    }
    console.log(`[${EXTENSION_NAME}] New chat started, cleared dynamic entries.`);
}

function onCharLoaded() {
    const charName = getCurrentCharName();
    if (!charName) return;
    ensureStaticEntries(charName);
    bindWorldBookToChar(charName);
}

// 事件注册
eventSource.on(event_types.MESSAGE_RECEIVED, onNewMessage);
eventSource.on(event_types.MESSAGE_SENT, onNewMessage);
eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
eventSource.on(event_types.MESSAGE_UPDATED, onMessageUpdated);
eventSource.on(event_types.NEW_CHAT, onNewChat);
eventSource.on(event_types.CHARACTER_LOADED, onCharLoaded);

// 斜杠命令
if (window.SillyTavern?.getContext()?.addSlashCommand) {
    window.SillyTavern.getContext().addSlashCommand('clear-auto-worldbook', () => {
        const charName = getCurrentCharName();
        if (!charName) return 'No character loaded.';
        clearAutoEntriesForChar(charName);
        return `Cleared all dynamic NPC entries for "${charName}".`;
    });
    window.SillyTavern.getContext().addSlashCommand('delete-auto-worldbook', () => {
        const charName = getCurrentCharName();
        if (!charName) return 'No character loaded.';
        const bookName = `${charName}自创新角色.world.json`;
        const index = worldInfo.findIndex(w => w.name === bookName);
        if (index !== -1) {
            worldInfo.splice(index, 1);
            saveWorldInfo();
            return `Deleted world book "${bookName}".`;
        }
        return `World book "${bookName}" not found.`;
    });
}

// ========== 设置面板（API配置） ==========
function generateSettingsHtml() {
    const settings = getSettings().openai;
    return `
    <div class="auto-char-worldbook-settings">
        <h4>OpenAI 配置（自动分析正文生成新角色）</h4>
        <div class="flex-container flexGap5 marginBot10">
            <label>API Key：</label>
            <input type="text" class="text_pole" id="auto_char_wb_api_key" value="${settings.apiKey}" placeholder="sk-..." autocomplete="off">
        </div>
        <div class="flex-container flexGap5 marginBot10">
            <label>Base URL：</label>
            <input type="text" class="text_pole" id="auto_char_wb_base_url" value="${settings.baseUrl}" placeholder="https://api.openai.com/v1">
        </div>
        <div class="flex-container flexGap5 marginBot10">
            <label>模型：</label>
            <input type="text" class="text_pole" id="auto_char_wb_model" value="${settings.model}" placeholder="gpt-3.5-turbo">
        </div>
        <div class="flex-container flexGap5 marginBot10">
            <label>温度 (0-2)：</label>
            <input type="number" class="text_pole" id="auto_char_wb_temperature" value="${settings.temperature}" step="0.1" min="0" max="2" style="width:80px;">
        </div>
        <div class="flex-container flexGap5 marginBot10">
            <label>上下文消息数：</label>
            <input type="number" class="text_pole" id="auto_char_wb_context_msgs" value="${settings.contextMessages}" min="1" max="20" style="width:80px;">
        </div>
        <div class="flex-container flexGap5 marginBot10">
            <label>最大输出 (tokens)：</label>
            <input type="number" class="text_pole" id="auto_char_wb_max_tokens" value="${settings.maxTokens}" min="100" max="4096" style="width:100px;">
        </div>
        <div class="flex-container flexGap5 marginTop10">
            <button class="menu_button" id="auto_char_wb_save">保存设置</button>
        </div>
    </div>
    `;
}

function attachSettingsListeners() {
    $('#auto_char_wb_save').on('click', () => {
        const settings = getSettings();
        settings.openai.apiKey = $('#auto_char_wb_api_key').val();
        settings.openai.baseUrl = $('#auto_char_wb_base_url').val();
        settings.openai.model = $('#auto_char_wb_model').val();
        settings.openai.temperature = parseFloat($('#auto_char_wb_temperature').val()) || 0.3;
        settings.openai.contextMessages = parseInt($('#auto_char_wb_context_msgs').val()) || 2;
        settings.openai.maxTokens = parseInt($('#auto_char_wb_max_tokens').val()) || 1500;
        saveSettings();
        toastr.success('OpenAI 设置已保存');
    });
}

// 手动注入设置面板（不再使用 registerExtension）
jQuery(() => {
    const container = $('#extensions_settings');
    if (container.find('.auto-char-worldbook-settings-section').length === 0) {
        const html = `
        <div class="auto-char-worldbook-settings-section">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>自创角色存入 · API 配置</b>
                    <span class="inline-drawer-icon fa-solid fa-circle-chevron-down"></span>
                </div>
                <div class="inline-drawer-content" style="padding: 10px;">
                    ${generateSettingsHtml()}
                </div>
            </div>
        </div>
        `;
        container.append(html);
        attachSettingsListeners();
    }
});

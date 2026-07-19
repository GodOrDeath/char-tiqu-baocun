import { SlashCommandParser } from '../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../slash-commands/SlashCommand.js';
import { getContext } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../utils.js';

const extensionName = 'ai-char-extractor';

const defaultSettings = {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 1000,
    contextTokens: 4000
};

let extensionSettings = {};

const targetFormat = `角色姓名
【个人信息】
年龄： [年龄]
性别： [性别]
【背景故事】
[角色的背景、家族、经历、来历、志向等摘要]
【外形特征】
身高： [身高]
体重： [体重]
体型描述： [体型]
(可选) 特殊身体特征： [特征]
相貌特点： [相貌]
衣着风格： [衣着]
【性格特点】
[性格核心描述]
【兴趣爱好】
[兴趣爱好列举]
【特殊技能/能力】
[掌握的技术能力]`;

jQuery(async () => {
    console.log('[AI提取器] 插件初始化开始');
    
    const context = getContext();
    if (!context.extension_settings[extensionName]) {
        context.extension_settings[extensionName] = { ...defaultSettings };
    }
    extensionSettings = context.extension_settings[extensionName];

    console.log('[AI提取器] 配置已加载:', extensionSettings);

    // 1. 加载设置界面 - 改进的路径解析
    try {
        // 使用绝对路径加载 settings.html
        const settingsHtml = `
<div class="ai-char-extractor-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>AI 角色设定提取器 (API 设置)</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label for="ai_ext_api_url">API 地址 (需包含 /v1)</label>
            <input type="text" id="ai_ext_api_url" class="text_pole" placeholder="https://api.openai.com/v1" />

            <label for="ai_ext_api_key">API 密钥 (API Key)</label>
            <input type="password" id="ai_ext_api_key" class="text_pole" placeholder="sk-..." />

            <label for="ai_ext_model">模型名称 (Model)</label>
            <input type="text" id="ai_ext_model" class="text_pole" placeholder="gpt-4o-mini" />

            <hr style="margin: 10px 0; border: 0.5px solid #444;" />

            <label for="ai_ext_temperature">温度 (Temperature)</label>
            <small style="display:block; opacity: 0.7; margin-bottom: 5px;">数值越低（0.1~0.5）提取越精确，越高越发散。</small>
            <input type="number" id="ai_ext_temperature" class="text_pole" step="0.1" min="0" max="2" value="0.1" />

            <label for="ai_ext_max_tokens" style="margin-top: 10px;">最大回复长度 (Max Output Tokens)</label>
            <input type="number" id="ai_ext_max_tokens" class="text_pole" step="100" min="100" max="8192" value="1000" />

            <label for="ai_ext_context_length" style="margin-top: 10px;">上下文截断长度 (估算 Token)</label>
            <small style="display:block; opacity: 0.7; margin-bottom: 5px;">控制发送给 AI 的原卡片文本量上限，防报错拦截。（按 1 Token ≈ 2个汉字 粗略换算）</small>
            <input type="number" id="ai_ext_context_length" class="text_pole" step="500" min="500" max="128000" value="4000" />
        </div>
    </div>
</div>`;
        
        $('#extensions_settings').append(settingsHtml);
        console.log('[AI提取器] 设置面板已内联加载');
    } catch (e) {
        console.error("[AI提取器] 设置界面加载失败:", e);
    }

    const bindSetting = (id, key, isNumber = false) => {
        const $element = $(`#${id}`);
        if ($element.length === 0) {
            console.warn(`[AI提取器] 找不到设置元素: #${id}`);
            return;
        }
        $element.val(extensionSettings[key]).on('input', function () {
            extensionSettings[key] = isNumber ? Number($(this).val()) : $(this).val();
            saveSettingsDebounced();
            console.log(`[AI提取器] 设置已更新 ${key}:`, extensionSettings[key]);
        });
    };
    
    bindSetting('ai_ext_api_url', 'apiUrl');
    bindSetting('ai_ext_api_key', 'apiKey');
    bindSetting('ai_ext_model', 'model');
    bindSetting('ai_ext_temperature', 'temperature', true);
    bindSetting('ai_ext_max_tokens', 'maxTokens', true);
    bindSetting('ai_ext_context_length', 'contextTokens', true);

    // 2. 核心提取逻辑
    const executeExtraction = async () => {
        const charId = context.characterId;
        console.log('[AI提取器] 开始提取，角色ID:', charId);
        
        if (charId === undefined || !context.characters || !context.characters[charId]) {
            console.error('[AI提取器] 角色数据不可用');
            toastr.error('请先进入一个角色的聊天界面！');
            return;
        }
        if (!extensionSettings.apiUrl || !extensionSettings.apiKey) {
            console.error('[AI提取器] API配置缺失');
            toastr.error('请先在顶部的扩展面板(积木图标)配置 API 密钥！');
            return;
        }

        const char = context.characters[charId];
        let rawText = `角色：${char.name}\n设定：\n${char.description}\n性格：\n${char.personality}\n场景：\n${char.scenario}`;

        const maxAllowedChars = Math.floor((extensionSettings.contextTokens || 4000) * 2);
        if (rawText.length > maxAllowedChars) {
            rawText = rawText.substring(0, maxAllowedChars) + "\n\n...(截断)";
        }

        console.log('[AI提取器] 原始文本长度:', rawText.length);
        toastr.info(`正在联系 AI 分析【${char.name}】...`);

        // 按钮进入加载状态
        $('#btn_ai_extract_char').css('opacity', '0.5').css('pointer-events', 'none').html('<i class="fa-solid fa-spinner fa-spin"></i> 提取中...');

        try {
            const prompt = `你是一个精准的文本分析助手。请��结下方角色设定，填入对应项，若无该项则填"未提及"。\n\n【遵循的模板】：\n${targetFormat}\n\n【原始角色设定】：\n${rawText}`;

            console.log('[AI提取器] 发送请求到:', extensionSettings.apiUrl);
            
            const response = await fetch(`${extensionSettings.apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${extensionSettings.apiKey}`
                },
                body: JSON.stringify({
                    model: extensionSettings.model || "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "返回内容必须纯文本格式，禁止包含 markdown 代码块和前言后语。" },
                        { role: "user", content: prompt }
                    ],
                    temperature: extensionSettings.temperature,
                    max_tokens: extensionSettings.maxTokens
                })
            });

            console.log('[AI提取器] API响应状态:', response.status);

            if (!response.ok) {
                const errData = await response.json();
                console.error('[AI提取器] API错误:', errData);
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiResult = data.choices[0].message.content.trim();
            console.log('[AI提取器] 提取成功，结果长度:', aiResult.length);

            await SlashCommandParser.executeSlashCommands(`/sys ${aiResult.replace(/\n/g, '\\n')}`);
            toastr.success('提取完成！已发送系统消息。');

        } catch (err) {
            console.error('[AI提取器] 完整错误:', err);
            toastr.error(`分析失败: ${err.message}`);
        } finally {
            // 恢复按钮状态
            $('#btn_ai_extract_char').css('opacity', '1').css('pointer-events', 'auto').html('<i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 5px;"></i> AI提取');
        }
    };

    // 3. 动态寻找UI目标并生成按钮
    const createBottomButton = () => {
        if ($('#btn_ai_extract_char').length > 0) {
            return true;
        }

        const extractBtn = $(`
            <div id="btn_ai_extract_char"
                 class="menu_button interactable"
                 title="点击由AI提取当前角色的设定表"
                 style="display: inline-flex; align-items: center; justify-content: center; margin: 0 5px; padding: 6px 12px; border-radius: 10px; cursor: pointer; color: var(--SmartThemeBodyColor); background-color: var(--SmartThemeQuoteColor); transition: all 0.2s;">
                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 5px;"></i> AI提取
            </div>
        `);
        extractBtn.on('click', executeExtraction);

        console.log('[AI提取器] 尝试注入按钮到UI...');

        // 优先级顺序查找容器
        const containers = [
            { selector: '#quick-replies-container', method: 'prepend', name: '#quick-replies-container' },
            { selector: '#extension_prompt_roles', method: 'append', name: '#extension_prompt_roles' },
            { selector: '.chat-tools-container', method: 'prepend', name: '.chat-tools-container' },
            { selector: '#send_controls', method: 'prepend', name: '#send_controls' },
            { selector: '.control_menu', method: 'append', name: '.control_menu' },
            { selector: '.bottom_menu_bar', method: 'prepend', name: '.bottom_menu_bar' }
        ];

        for (const container of containers) {
            if ($(container.selector).length > 0) {
                $(container.selector).eq(0)[container.method](extractBtn);
                console.log(`[AI提取器] ✓ 按钮已注入到 ${container.name}`);
                return true;
            }
        }
        
        console.warn('[AI提取器] ⚠ 找不到合适的UI容器，尝试其他方法...');
        return false;
    };

    // 智能轮询注入UI
    let attempts = 0;
    const maxAttempts = 20;
    const tryInject = setInterval(() => {
        const injected = createBottomButton();
        if (injected) {
            clearInterval(tryInject);
            console.log('[AI提取器] ✓ UI注入成功');
        } else if (attempts >= maxAttempts) {
            clearInterval(tryInject);
            console.error(`[AI提取器] ✗ ${maxAttempts}次尝试后仍未找到UI容器`);
        }
        attempts++;
    }, 500);

    // 4. 斜杠命令 (/exportchar)
    const exportCharCommand = new SlashCommand('exportchar', executeExtraction, [], '调用 AI 阅读并提取面板信息', true, true);
    SlashCommandParser.addCommandObject(exportCharCommand);
    console.log('[AI提取器] ✓ 已注册斜杠命令: /exportchar');
    console.log('[AI提取器] 插件初始化完成！');
});

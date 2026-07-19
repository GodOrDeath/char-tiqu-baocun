import { SlashCommandParser } from '../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../slash-commands/SlashCommand.js';
import { getContext } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../utils.js';

const extensionName = 'ai-char-extractor';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 包含新增参数的默认设置
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
    const context = getContext();
    if (!context.extension_settings[extensionName]) {
        context.extension_settings[extensionName] = { ...defaultSettings };
    }
    extensionSettings = context.extension_settings[extensionName];

    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $('#extensions_settings').append(settingsHtml);

    // 绑定文本框事件
    const bindSetting = (id, key, isNumber = false) => {
        $(`#${id}`).val(extensionSettings[key]).on('input', function () {
            extensionSettings[key] = isNumber ? Number($(this).val()) : $(this).val();
            saveSettingsDebounced();
        });
    };

    bindSetting('ai_ext_api_url', 'apiUrl');
    bindSetting('ai_ext_api_key', 'apiKey');
    bindSetting('ai_ext_model', 'model');
    bindSetting('ai_ext_temperature', 'temperature', true);
    bindSetting('ai_ext_max_tokens', 'maxTokens', true);
    bindSetting('ai_ext_context_length', 'contextTokens', true);

    const exportCharCommand = new SlashCommand('exportchar', async () => {
        const charId = context.characterId;

        if (charId === undefined || !context.characters || !context.characters[charId]) {
            toastr.error('请先进入一个角色的聊天界面！');
            return;
        }

        if (!extensionSettings.apiUrl || !extensionSettings.apiKey) {
            toastr.error('请先在扩展面板配置 API URL 和 API Key！');
            return;
        }

        const char = context.characters[charId];
        let rawText = `角色名称：${char.name}\n\n描述设定：\n${char.description}\n\n附加性格设定：\n${char.personality}\n\n初始场景：\n${char.scenario}`;

        // 【上下文长度截断处理】
        // 粗略换算：1 token 约等于 2 个汉字或字母
        const maxAllowedChars = Math.floor((extensionSettings.contextTokens || 4000) * 2);
        if (rawText.length > maxAllowedChars) {
            rawText = rawText.substring(0, maxAllowedChars) + "\n\n...(由于上下文长度限制，多余部分已被截断)";
            toastr.warning(`角色长文本已按照 ${extensionSettings.contextTokens} token 上限截断。`);
        }

        toastr.info(`正在请求 AI 分析【${char.name}】的设定...`);

        try {
            const prompt = `你是一个精准的文本分析助手。请总结下方给出的角色设定，严格按照我要求的格式提取信息。如果无某项信息填“未提及”。\n\n【必须遵循的模板】：\n${targetFormat}\n\n【角色设定内容】：\n${rawText}`;

            const response = await fetch(`${extensionSettings.apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${extensionSettings.apiKey}`
                },
                body: JSON.stringify({
                    model: extensionSettings.model || "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "作为一个 TRPG 角色阅读器，请直接输出纯文本模板内容，禁止包含任何 Markdown 代码块（如 ```）及多余对话语。" },
                        { role: <q>"user"</q>, content: prompt }
                    ],
                    temperature: extensionSettings.temperature || 0.1,  // 应用温度设置
                    max_tokens: extensionSettings.maxTokens || 1000     // 应用最大输出长度
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiResult = data.choices[0].message.content.trim();

            const safeOutput = aiResult.replace(/\n/g, '\\n');
            await SlashCommandParser.executeSlashCommands(`/sys ${safeOutput}`);
            toastr.success('提取完成！已生成系统消息。');

        } catch (err) {
            console.error('抽取失败:', err);
            toastr.error(`生成失败: ${err.message}`);
        }

    }, [], '调用独立的 API 阅读并提取面板信息', true, true);

    SlashCommandParser.addCommandObject(exportCharCommand);
});

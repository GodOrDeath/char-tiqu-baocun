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
    const context = getContext();
    if (!context.extension_settings[extensionName]) {
        context.extension_settings[extensionName] = { ...defaultSettings };
    }
    extensionSettings = context.extension_settings[extensionName];

    // 1. 加载后台 API 设置界面 (仍然放在扩展设置中, 避免污染底布空间)
    try {
        const htmlUrl = import.meta.url.replace('index.js', 'settings.html');
        const settingsHtml = await $.get(htmlUrl);
        $('#extensions_settings').append(settingsHtml);
    } catch (e) {
        console.error("设置界面HTML加载失败:", e);
    }

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

    // 2. 核心提取逻辑
    const executeExtraction = async () => {
        const charId = context.characterId;
        if (charId === undefined || !context.characters || !context.characters[charId]) {
            toastr.error('请先进入一个角色的聊天界面！');
            return;
        }
        if (!extensionSettings.apiUrl || !extensionSettings.apiKey) {
            toastr.error('请先在顶部的扩展面板(积木图标)配置 API 密钥！');
            return;
        }

        const char = context.characters[charId];
        let rawText = `角色：${char.name}\n设定：\n${char.description}\n性格：\n${char.personality}\n场景：\n${char.scenario}`;

        const maxAllowedChars = Math.floor((extensionSettings.contextTokens || 4000) * 2);
        if (rawText.length > maxAllowedChars) {
            rawText = rawText.substring(0, maxAllowedChars) + "\n\n...(截断)";
        }

        toastr.info(`正在联系 AI 分析【${char.name}】...`);

        // 将按钮变为 "提取中" 动画状态
        $('#btn_ai_extract_char').css('opacity', '0.5').css('pointer-events', 'none').html('<i class="fa-solid fa-spinner fa-spin"></i> 正在提取...');

        try {
            const prompt = `你是一个精准的文本分析助手。请总结下方角色设定，填入对应项，若无该项则填“未提及”。\n\n【遵循的模板】：\n${targetFormat}\n\n【角色设定内容】：\n${rawText}`;

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

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiResult = data.choices[0].message.content.trim();

            await SlashCommandParser.executeSlashCommands(`/sys ${aiResult.replace(/\n/g, '\\n')}`);
            toastr.success('提取完成！已发送系统消息。');

        } catch (err) {
            console.error('API 报错:', err);
            toastr.error(`分析失败: ${err.message}`);
        } finally {
            // 恢复按钮状态
            $('#btn_ai_extract_char').css('opacity', '1').css('pointer-events', 'auto').html('<i class="fa-solid fa-wand-magic-sparkles"></i> AI提取设定');
        }
    };

    // 3. 在下方输入区域动态生成“提取”按钮
    // 采用挂载到发送行旁边的更稳定的 DOM
    const createBottomButton = () => {
        // 如果按钮已经存在，就不重复创建
        if ($('#btn_ai_extract_char').length > 0) return;

        // 创建一个好看的带有魔法棒图标的按钮
        const extractBtn = $(`
            <div id="btn_ai_extract_char"
                 class="menu_button interactable"
                 title="点击由AI提取当前角色的设定表"
                 style="display: flex; align-items: center; justify-content: center; margin: 0 5px; padding: 0 10px; border-radius: 5px; cursor: pointer; color: var(--SmartThemeBodyColor);">
                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 5px;"></i> AI提取设定
            </div>
        `);

        // 绑定刚才的核心逻辑，一点就运行
        extractBtn.on('click', executeExtraction);

        // 强行插入到聊天打字框下方的操作栏（酒馆里的快速菜单区域或者加号面板旁边）
        // 这里提供双重保险：先找聊天栏下面的控制区，找不到就放发送按钮旁边
        if ($('#chat_input_extensions').length > 0) {
            $('#chat_input_extensions').append(extractBtn);
        } else if ($('.chat-tools-container').length > 0) {
            $('.chat-tools-container').append(extractBtn);
        } else {
            // 万能备用方案：塞进选项框区域
            $('#send_plus_menu').append(extractBtn);
            // 或者放在聊天输入框外面
            $('#send_form').append(extractBtn);
        }
    };

    // 酒馆加载完成后插入按钮
    setTimeout(createBottomButton, 1000);

    // 4. 作为补充，仍然保留命令行 `/exportchar` 以防万一
    const exportCharCommand = new SlashCommand('exportchar', executeExtraction, [], '调用 AI 阅读并提取面板信息', true, true);
    SlashCommandParser.addCommandObject(exportCharCommand);
});

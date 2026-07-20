import { SlashCommandParser } from '../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../slash-commands/SlashCommand.js';
import { getContext } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../utils.js';

const extensionName = 'char-tiqu-baocun';

const defaultSettings = {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 1000,
    contextTokens: 4000,
    autoSaveToSystemPrompt: true,
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
    console.log('[角色提取器] 插件初始化开始');
    
    const context = getContext();
    if (!context.extension_settings[extensionName]) {
        context.extension_settings[extensionName] = { ...defaultSettings };
    }
    extensionSettings = context.extension_settings[extensionName];

    // 创建UI容器
    const setupUI = () => {
        if ($('#char-tiqu-ui').length > 0) return;
        
        const html = `
            <div id="char-tiqu-ui" style="padding: 15px; display: none; background: var(--SmartThemeQuoteColor); border-radius: 10px; margin: 10px 0;">
                <h3 style="margin: 0 0 15px 0; color: var(--SmartThemeBodyColor); display: flex; align-items: center;">
                    <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 8px;"></i>
                    AI 角色设定提取器
                </h3>
                
                <div style="background: var(--SmartThemeBodyColor); padding: 15px; border-radius: 8px;">
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: white;">API 地址</label>
                        <input type="text" id="char_api_url" class="text_pole" placeholder="https://api.openai.com/v1" style="width: 100%; padding: 8px; box-sizing: border-box; border-radius: 5px;" />
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: white;">API 密钥</label>
                        <input type="password" id="char_api_key" class="text_pole" placeholder="sk-..." style="width: 100%; padding: 8px; box-sizing: border-box; border-radius: 5px;" />
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: white;">模型名称</label>
                        <input type="text" id="char_model" class="text_pole" placeholder="gpt-4o-mini" style="width: 100%; padding: 8px; box-sizing: border-box; border-radius: 5px;" />
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: white;">温度 (0.0-2.0，越低越精确)</label>
                        <input type="number" id="char_temperature" class="text_pole" step="0.1" min="0" max="2" style="width: 100%; padding: 8px; box-sizing: border-box; border-radius: 5px;" />
                    </div>
                    
                    <button id="char_test_btn" class="menu_button" style="width: 100%; padding: 10px; margin-bottom: 8px; cursor: pointer; border-radius: 5px; background-color: #4CAF50!important; color: white; border: none;">
                        🧪 测试连接
                    </button>
                    
                    <button id="char_extract_btn" class="menu_button" style="width: 100%; padding: 10px; cursor: pointer; border-radius: 5px; background-color: #2196F3!important; color: white; border: none; font-weight: bold;">
                        ✨ 提取角色设定
                    </button>
                </div>
                
                <div id="char_result" style="background: var(--SmartThemeBodyColor); padding: 12px; border-radius: 8px; max-height: 400px; overflow-y: auto; display: none; margin-top: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: white;">📄 提取结果</h4>
                    <div id="char_result_text" style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6; color: #ddd; max-height: 350px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
        
        $('#extensions_settings').append(html);
        
        // 绑定事件
        $('#char_test_btn').on('click', handleTestConnection);
        $('#char_extract_btn').on('click', handleExtraction);
        
        // 加载设置
        loadSettings();
        console.log('[角色提取器] UI已创建');
    };
    
    const loadSettings = () => {
        $('#char_api_url').val(extensionSettings.apiUrl || '');
        $('#char_api_key').val(extensionSettings.apiKey || '');
        $('#char_model').val(extensionSettings.model || 'gpt-4o-mini');
        $('#char_temperature').val(extensionSettings.temperature || 0.1);
    };
    
    const saveSettings = async () => {
        extensionSettings.apiUrl = $('#char_api_url').val();
        extensionSettings.apiKey = $('#char_api_key').val();
        extensionSettings.model = $('#char_model').val();
        extensionSettings.temperature = parseFloat($('#char_temperature').val()) || 0.1;
        saveSettingsDebounced();
    };
    
    const handleTestConnection = async () => {
        const apiUrl = $('#char_api_url').val();
        const apiKey = $('#char_api_key').val();
        const model = $('#char_model').val();
        
        if (!apiUrl || !apiKey) {
            toastr.error('❌ 请填写API地址和密钥');
            return;
        }
        
        try {
            toastr.info('🔄 正在测试连接...');
            const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 10
                })
            });
            
            if (response.ok) {
                toastr.success('✅ API连接成功！');
                await saveSettings();
            } else {
                const error = await response.json();
                toastr.error('❌ 连接失败: ' + (error.error?.message || `HTTP ${response.status}`));
            }
        } catch (err) {
            toastr.error('❌ 错误: ' + err.message);
        }
    };
    
    const handleExtraction = async () => {
        const context = getContext();
        const charId = context.characterId;
        
        if (charId === undefined || !context.characters || !context.characters[charId]) {
            toastr.error('❌ 请先进入一个角色的聊天界面！');
            return;
        }
        
        const apiUrl = $('#char_api_url').val();
        const apiKey = $('#char_api_key').val();
        const model = $('#char_model').val();
        
        if (!apiUrl || !apiKey) {
            toastr.error('❌ 请先配置API！');
            return;
        }
        
        try {
            const char = context.characters[charId];
            toastr.info(`🔄 正在提取【${char.name}】的信息...`);
            
            $('#char_extract_btn').css('opacity', '0.5').css('pointer-events', 'none').html('⏳ 提取中...');
            
            // 组织文本
            const rawText = `角色：${char.name}\n设定：\n${char.description || ''}\n性格：\n${char.personality || ''}\n场景：\n${char.scenario || ''}`;
            const maxAllowedChars = Math.floor((extensionSettings.contextTokens || 4000) * 2);
            const truncatedText = rawText.length > maxAllowedChars ? rawText.substring(0, maxAllowedChars) + "\n\n...(截断)" : rawText;

            const prompt = `你是一个精准的文本分析助手。请总结下方角色设定，填入对应项，若无该项则填"未提及"。\n\n【遵循的模板】：\n${targetFormat}\n\n【原始角色设定】：\n${truncatedText}`;

            const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: '返回内容必须纯文本格式，禁止包含 markdown 代码块和前言后语。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: extensionSettings.temperature || 0.1,
                    max_tokens: extensionSettings.maxTokens || 1000
                })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiResult = data.choices[0].message.content.trim();
            
            // 显示结果
            $('#char_result_text').text(aiResult);
            $('#char_result').slideDown();
            toastr.success('✅ 提取完成！');
            
            // 自动保存到系统提示词
            if (extensionSettings.autoSaveToSystemPrompt) {
                try {
                    await SlashCommandParser.executeSlashCommands(`/sys ${aiResult.replace(/\n/g, '\\n')}`);
                    toastr.info('ℹ️ 已保存到系统提示词');
                } catch (err) {
                    console.warn('[角色提取器] 保存系统提示词失败:', err);
                }
            }
        } catch (err) {
            console.error('[角色提取器] 提取失败:', err);
            toastr.error('❌ 提取失败: ' + err.message);
        } finally {
            $('#char_extract_btn').css('opacity', '1').css('pointer-events', 'auto').html('✨ 提取角色设定');
        }
    };
    
    setupUI();
    
    // 创建菜单按钮
    const createMenuButton = () => {
        if ($('#char-tiqu-menu-btn').length > 0) return true;
        
        const menuBtn = $(`
            <div id="char-tiqu-menu-btn" class="menu_button interactable" 
                 title="打开AI角色设定提取器" 
                 style="display: inline-flex; align-items: center; justify-content: center; margin: 0 5px; padding: 8px 14px; border-radius: 8px; cursor: pointer; background-color: var(--SmartThemeQuoteColor)!important;">
                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 5px;"></i>角色提取
            </div>
        `);
        
        menuBtn.on('click', () => {
            $('#char-tiqu-ui').slideToggle();
        });
        
        // 尝试添加到导航栏或其他位置
        if ($('.topbar').length > 0) {
            $('.topbar').append(menuBtn);
            return true;
        } else if ($('#send_controls').length > 0) {
            $('#send_controls').prepend(menuBtn);
            return true;
        } else if ($('.control-menu').length > 0) {
            $('.control-menu').append(menuBtn);
            return true;
        }
        return false;
    };
    
    // 轮询创建菜单按钮
    let attempts = 0;
    const tryCreateButton = setInterval(() => {
        if (createMenuButton() || attempts > 20) {
            clearInterval(tryCreateButton);
            if (attempts > 20) {
                console.warn('[角色提取器] ⚠️ 菜单按钮创建失败，但功能仍可通过命令使用');
            }
        }
        attempts++;
    }, 500);
    
    // 创建斜杠命令
    const extractCommand = new SlashCommand(
        'charextract',
        () => handleExtraction(),
        [],
        '打开AI角色设定提取器',
        true,
        true
    );
    SlashCommandParser.addCommandObject(extractCommand);
    
    console.log('[角色提取器] ✅ 插件初始化完成！');
    console.log('[角色提取器] 📝 使用命令: /charextract');
});

// char-tiqu-baocun - 提取当前角色卡并保存
// 专为 SillyTavern 1.18.0 优化

(function () {
    'use strict';

    // 1. 等待 SillyTavern 上下文
    const getContext = async () => {
        while (!window.SillyTavern || typeof window.SillyTavern.getContext !== 'function') {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        return window.SillyTavern.getContext();
    };

    // 2. 主初始化函数
    const init = async () => {
        try {
            const context = await getContext();
            console.log('[char-tiqu-baocun] 上下文获取成功', context);

            const { characters, toastr, menu } = context;

            // 定义菜单项
            const menuItem = {
                id: 'char-tiqu-baocun-save',
                // 这里可以使用 Emoji 或 FontAwesome 图标
                label: '💾 保存当前角色卡',
                action: async () => {
                    // 获取当前角色 ID
                    const currentCharId = characters.getCurrentCharacterId();
                    if (!currentCharId) {
                        toastr.warning('没有选中的角色卡，请先加载一个角色。');
                        return;
                    }

                    // 获取角色对象
                    const character = characters.getCharacter(currentCharId);
                    if (!character) {
                        toastr.error('无法获取角色数据，请重试。');
                        return;
                    }

                    // 构造导出数据（与导入格式兼容）
                    const charData = {
                        name: character.name,
                        description: character.description,
                        personality: character.personality,
                        scenario: character.scenario,
                        first_mes: character.first_mes,
                        mes_example: character.mes_example,
                        creator: character.creator || '未知',
                        ...character.data // 包含额外字段
                    };

                    // 生成 JSON 并下载
                    const json = JSON.stringify(charData, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${charData.name || 'character'}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    toastr.success(`角色 "${charData.name}" 已保存！`);
                }
            };

            // 检查是否已存在相同 ID 的菜单项，避免重复注册
            if (menu && typeof menu.addDropdownItem === 'function') {
                // 检查当前已注册的菜单项（某些版本可能没有直接暴露，但我们仍可尝试）
                // 为防止重复，我们可以先移除旧的再添加（安全起见）
                // 或者直接添加，因为 addDropdownItem 内部可能去重
                menu.addDropdownItem(menuItem);
                console.log('[char-tiqu-baocun] ✅ 菜单项已通过官方 API 注册到魔法棒');
            } else {
                console.warn('[char-tiqu-baocun] ⚠️ 官方 API 不可用，尝试降级方案');
                // 降级：手动插入 DOM
                const injectMenuItem = () => {
                    const dropdown = document.querySelector('#extensions-menu .dropdown-menu') ||
                                     document.querySelector('#extensions-dropdown .dropdown-menu') ||
                                     document.querySelector('.extensions-menu .dropdown-menu');
                    if (dropdown) {
                        // 检查是否已存在相同文本的项
                        const existing = dropdown.querySelector('a[data-extension-id="char-tiqu-baocun-save"]');
                        if (existing) return;

                        const li = document.createElement('li');
                        const a = document.createElement('a');
                        a.href = '#';
                        a.className = 'dropdown-item';
                        a.dataset.extensionId = 'char-tiqu-baocun-save';
                        a.innerHTML = menuItem.label;
                        a.addEventListener('click', (e) => {
                            e.preventDefault();
                            menuItem.action();
                        });
                        li.appendChild(a);
                        dropdown.appendChild(li);
                        console.log('[char-tiqu-baocun] ✅ 菜单项已手动添加到 DOM');
                    } else {
                        // 重试
                        setTimeout(injectMenuItem, 1000);
                    }
                };
                injectMenuItem();
            }

            // 可选：监听角色切换等事件，但本例不需要

        } catch (err) {
            console.error('[char-tiqu-baocun] 初始化失败:', err);
        }
    };

    // 3. 执行初始化
    init();

})();

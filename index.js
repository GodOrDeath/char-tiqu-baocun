// char-tiqu-baocun - 提取当前角色卡并保存（DOM注入版）
console.log('[char-tiqu-baocun] 扩展加载中...');

(async function () {
    'use strict';

    // 等待酒馆核心就绪（可选，用于获取 characters API）
    const waitForContext = () => {
        return new Promise((resolve) => {
            const check = () => {
                if (window.SillyTavern && window.SillyTavern.getContext) {
                    resolve(window.SillyTavern.getContext());
                } else {
                    setTimeout(check, 300);
                }
            };
            check();
        });
    };

    const context = await waitForContext();
    const { characters, toastr } = context;

    // 定义保存操作
    const saveCharacter = async () => {
        const charId = characters.getCurrentCharacterId();
        if (!charId) {
            toastr.warning('请先加载一个角色');
            return;
        }
        const character = characters.getCharacter(charId);
        if (!character) {
            toastr.error('无法获取角色数据');
            return;
        }
        // 构造导出数据
        const charData = {
            name: character.name,
            description: character.description,
            personality: character.personality,
            scenario: character.scenario,
            first_mes: character.first_mes,
            mes_example: character.mes_example,
            creator: character.creator || '',
            ...character.data
        };
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
        toastr.success(`角色 "${charData.name}" 已保存`);
    };

    // ---------- 核心：向魔法棒下拉菜单插入菜单项（模仿 v17.json） ----------
    const addMenuItem = () => {
        // 查找魔法棒下拉菜单容器（酒馆 1.18.0 中通常为 #extensionsMenu）
        const menu = document.getElementById('extensionsMenu');
        if (!menu) {
            // 如果还没出现，稍后重试（最多重试5次）
            let attempts = 0;
            const retry = () => {
                if (attempts++ < 5) {
                    setTimeout(() => {
                        const m = document.getElementById('extensionsMenu');
                        if (m) {
                            // 如果找到，执行添加
                            insertItem(m);
                        } else {
                            retry();
                        }
                    }, 500);
                } else {
                    console.error('[char-tiqu-baocun] 找不到 #extensionsMenu，放弃插入');
                }
            };
            retry();
            return;
        }
        insertItem(menu);
    };

    const insertItem = (menu) => {
        // 检查是否已存在（避免重复添加）
        if (document.getElementById('char-tiqu-baocun-menu-item')) {
            console.log('[char-tiqu-baocun] 菜单项已存在，不再重复添加');
            return;
        }

        // 创建菜单项（使用与 v17.json 相同的类名和结构）
        const btn = document.createElement('div');
        btn.id = 'char-tiqu-baocun-menu-item';
        btn.className = 'list-group-item flex-container flexGap5 interactable';
        // 使用 FontAwesome 软盘图标 + 文字（也可以改为 Emoji）
        btn.innerHTML = `
            <div class="fa-fw fa-regular fa-floppy-disk extensionsMenuExtensionButton"></div>
            <span>保存当前角色卡</span>
        `;
        // 绑定点击事件
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveCharacter();
        });
        menu.appendChild(btn);
        console.log('[char-tiqu-baocun] ✅ 菜单项已添加到魔法棒');
    };

    // 执行插入
    addMenuItem();

    // 可选：如果以后魔法棒重新渲染（极少发生），可以监听事件重新插入，但大多数情况不需要
})();

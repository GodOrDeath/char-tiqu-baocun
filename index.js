// char-tiqu-baocun - 提取当前角色卡并保存

(async function () {
    // 等待SillyTavern上下文准备就绪
    const waitForContext = () => {
        return new Promise((resolve) => {
            const check = () => {
                if (window.SillyTavern && window.SillyTavern.getContext) {
                    resolve(window.SillyTavern.getContext());
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    };

    const context = await waitForContext();

    // 获取必要的API
    const { eventSource, event_types, characters, saveSettingsDebounced } = context;

    // 定义菜单项
    const menuItem = {
        id: 'char-tiqu-baocun-save',
        label: '💾 保存当前角色卡',
        action: async () => {
            // 获取当前角色ID
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

            // 构建要保存的数据（保留所有字段）
            const charData = {
                name: character.name,
                description: character.description,
                personality: character.personality,
                scenario: character.scenario,
                first_mes: character.first_mes,
                mes_example: character.mes_example,
                creator: character.creator || '未知',
                // 其他可选字段
                ...character.data
            };

            // 转换成JSON字符串
            const json = JSON.stringify(charData, null, 2);

            // 创建下载链接
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

    // 注册到魔法棒菜单（Dropdown菜单）
    // 方法1：通过 context.menu 添加（如果存在）
    if (context.menu && context.menu.addDropdownItem) {
        context.menu.addDropdownItem(menuItem);
    } else {
        // 方法2：使用 eventSource 监听扩展加载完成，然后手动添加
        // 这里演示用较通用的方式：添加一个全局按钮（但最好还是用魔法棒）
        // 我们直接模拟添加魔法棒菜单项（SillyTavern 1.12+ 支持）
        // 更可靠的方式是使用 context.extensionManager 的注册
        // 因为各个版本可能不同，这里采用一种兼容写法
        const addToMenu = () => {
            // 查找魔法棒下拉菜单的容器
            const dropdown = document.querySelector('#extensions-menu .dropdown-menu');
            if (dropdown) {
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'dropdown-item';
                link.innerHTML = menuItem.label;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuItem.action();
                });
                item.appendChild(link);
                dropdown.appendChild(item);
            } else {
                // 如果没找到，延迟重试
                setTimeout(addToMenu, 500);
            }
        };
        addToMenu();
    }

    console.log('[char-tiqu-baocun] 扩展已加载，菜单项已添加到魔法棒。');
})();

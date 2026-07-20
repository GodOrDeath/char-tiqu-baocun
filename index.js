// ============================================================
// 角色提取保存 扩展 - 纯 DOM 注入，无任何导入依赖
// 使用轮询确保菜单加载完成，避免加载失败
// ============================================================

console.log('[角色提取保存] 扩展加载中...');

(function () {
    'use strict';

    // 获取主窗口对象（扩展脚本运行在 iframe 中，需取父级）
    const win = window.parent || window;
    const doc = win.document;

    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    function injectButton() {
        attempts++;
        const menu = doc.getElementById('extensionsMenu');

        if (!menu) {
            if (attempts < MAX_ATTEMPTS) {
                setTimeout(injectButton, 300);
            } else {
                console.warn('[角色提取保存] 未找到 extensionsMenu，超时放弃');
            }
            return;
        }

        // 防止重复添加
        if (menu.querySelector('[data-ctb="true"]')) {
            return;
        }

        // 创建菜单项
        const item = doc.createElement('div');
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.style.cursor = 'pointer';
        item.setAttribute('data-ctb', 'true');

        // 图标 + 文字
        item.innerHTML = `
            <div class="fa-fw fa-solid fa-save extensionsMenuExtensionButton"></div>
            <span>角色提取保存</span>
        `;

        // 点击事件（你可以在这里换成你真正的功能）
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            alert('✅ 角色提取保存功能已触发！');
        });

        menu.appendChild(item);
        console.log('[角色提取保存] ✅ 按钮已成功注入魔法棒菜单');
    }

    // 开始尝试注入
    injectButton();
})();

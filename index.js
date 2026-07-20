// ================================================================
// 📝 角色提取器 (char-tiqu-baocun) - 调试版
// ================================================================

import { getContext } from '../../../extensions.js';

console.log('[角色提取器] 脚本已加载，正在初始化...');

// 全局标志，防止重复创建
let buttonCreated = false;

jQuery(async () => {
    try {
        console.log('[角色提取器] jQuery ready 触发');
        const context = getContext();
        if (!context) {
            console.error('[角色提取器] ❌ 无法获取 SillyTavern 上下文');
            return;
        }
        console.log('[角色提取器] ✅ 上下文获取成功');

        // 延迟一小段时间确保 DOM 已完全渲染
        setTimeout(() => {
            createDraggableButton();
        }, 500);
    } catch (e) {
        console.error('[角色提取器] ❌ 初始化失败:', e);
    }
});

function createDraggableButton() {
    if (buttonCreated) {
        console.log('[角色提取器] 按钮已存在，跳过创建');
        return;
    }
    if (document.getElementById('ce-draggable-btn')) {
        console.log('[角色提取器] 按钮元素已存在于DOM，跳过');
        buttonCreated = true;
        return;
    }

    console.log('[角色提取器] 正在创建可拖动按钮...');

    const button = document.createElement('div');
    button.id = 'ce-draggable-btn';
    button.innerHTML = '📝';
    button.title = '角色提取器';

    // 使用更醒目的样式，并设置明确的初始位置
    Object.assign(button.style, {
        position: 'fixed',
        bottom: '120px',
        right: '30px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: '#5b7cfa',
        color: '#fff',
        fontSize: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(91, 124, 250, 0.6)',
        cursor: 'grab',
        zIndex: '99999',  // 确保在最上层
        userSelect: 'none',
        border: '2px solid rgba(255,255,255,0.3)',
        fontFamily: 'sans-serif',
        lineHeight: '1'
    });

    // 悬停效果
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 6px 20px rgba(91, 124, 250, 0.8)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 4px 16px rgba(91, 124, 250, 0.6)';
    });

    // 点击事件
    button.addEventListener('click', () => {
        alert('📝 角色提取器已加载！\n\n后续将实现角色提取功能。');
    });

    // --- 拖拽逻辑 ---
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    button.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        button.style.cursor = 'grabbing';
        const rect = button.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origLeft = rect.left;
        origTop = rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = origLeft + dx;
        let newTop = origTop + dy;
        // 边界约束
        const maxX = window.innerWidth - button.offsetWidth;
        const maxY = window.innerHeight - button.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxX));
        newTop = Math.max(0, Math.min(newTop, maxY));
        button.style.left = newLeft + 'px';
        button.style.top = newTop + 'px';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            button.style.cursor = 'grab';
        }
    });

    // 将按钮添加到 body
    document.body.appendChild(button);
    buttonCreated = true;
    console.log('[角色提取器] ✅ 按钮已添加到页面');
}

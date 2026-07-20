// char-tiqu-baocun 扩展 - 稳定版
console.log("[char-tiqu] 扩展脚本开始执行");

(function() {
    "use strict";

    // 尝试添加按钮，最多尝试 20 次（10 秒）
    let attempts = 0;
    const maxAttempts = 20;

    function tryAddButton() {
        attempts++;
        console.log(`[char-tiqu] 尝试添加按钮 (${attempts}/${maxAttempts})`);

        try {
            // 获取魔法棒菜单容器
            const menu = document.getElementById("extensionsMenu");
            if (!menu) {
                console.warn("[char-tiqu] 未找到 extensionsMenu，等待...");
                if (attempts < maxAttempts) {
                    setTimeout(tryAddButton, 500);
                } else {
                    console.error("[char-tiqu] 超时：无法找到 extensionsMenu");
                }
                return;
            }

            // 检查是否已经添加过，避免重复
            if (menu.querySelector("[data-ctb]")) {
                console.log("[char-tiqu] 按钮已存在，跳过");
                return;
            }

            // 创建菜单项
            const item = document.createElement("div");
            item.className = "list-group-item flex-container flexGap5 interactable";
            item.style.cursor = "pointer";
            item.setAttribute("data-ctb", "true"); // 标记，防止重复添加
            item.innerHTML = `
                <div class="fa-fw fa-solid fa-save extensionsMenuExtensionButton"></div>
                <span>角色提取保存</span>
            `;

            // 点击事件（你可以替换成你需要的功能）
            item.addEventListener("click", () => {
                alert("Hello from char-tiqu-baocun!");
            });

            menu.appendChild(item);
            console.log("[char-tiqu] ✅ 按钮已成功添加到魔法棒！");
        } catch (err) {
            console.error("[char-tiqu] 添加按钮时发生错误:", err);
        }
    }

    // 开始尝试
    tryAddButton();
})();

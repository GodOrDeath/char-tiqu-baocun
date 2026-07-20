// 极简扩展：只在魔法棒菜单中添加一个按钮
import { eventSource, event_types } from "../../../script.js";

function addButtonToMagicWand() {
    const menu = document.getElementById("extensionsMenu");
    if (!menu) {
        console.warn("[char-tiqu] extensionsMenu not found");
        return;
    }

    // 创建菜单项
    const item = document.createElement("div");
    item.className = "list-group-item flex-container flexGap5 interactable";
    item.style.cursor = "pointer";
    item.innerHTML = `
        <div class="fa-fw fa-solid fa-save extensionsMenuExtensionButton"></div>
        <span>角色提取保存</span>
    `;

    // 点击事件（你可以改成你需要的功能）
    item.addEventListener("click", () => {
        alert("Hello from char-tiqu-baocun!");
    });

    menu.appendChild(item);
    console.log("[char-tiqu] 按钮已添加到魔法棒");
}

// 等待酒馆完全加载后再添加
eventSource.on(event_types.APP_READY, addButtonToMagicWand);

// ============================================================
// char-tiqu-baocun · 角色提取保存 (SillyTavern 扩展)
// 功能：在魔法棒菜单中添加“角色提取保存”按钮，点击弹出浮动面板，
//       显示当前角色卡的完整数据，支持下载 JSON 和复制到剪贴板。
// 依赖：SillyTavern 核心 API (getContext, eventSource, 等)
// ============================================================

import { eventSource, event_types } from "../../../script.js";
import { getContext, extension_settings, saveSettingsDebounced } from "../extensions.js";

const MODULE_NAME = "char-tiqu-baocun";

// 初始化扩展设置（如果尚未初始化）
if (!extension_settings[MODULE_NAME]) {
    extension_settings[MODULE_NAME] = {};
}

// ========== 工具函数 ==========

function getCharacterData() {
    const context = getContext();
    const charId = context.characterId;
    if (charId === undefined || charId === null) {
        toastr.warning("请先选择一个角色卡（群聊模式不支持）");
        return null;
    }
    const char = context.characters[charId];
    if (!char) {
        toastr.error("未找到角色卡数据");
        return null;
    }
    return {
        id: charId,
        name: char.data?.name || "未命名",
        data: char.data,
        extensions: char.data?.extensions || {},
        avatar: char.avatar,
    };
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "character.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            toastr.success("已复制到剪贴板");
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand("copy");
        toastr.success("已复制到剪贴板");
    } catch (e) {
        toastr.error("复制失败，请手动选择文本");
    }
    document.body.removeChild(ta);
}

// ========== UI 创建与逻辑 ==========

const PANEL_ID = "ctb-panel";
const PANEL_CSS = `
#${PANEL_ID} {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 30000;
  width: min(440px, 94vw);
  max-height: min(85vh, calc(100dvh - 20px));
  display: flex;
  flex-direction: column;
  background: var(--SmartThemeBlurTintColor, rgba(24,24,28,0.96));
  color: var(--SmartThemeBodyColor, #ddd);
  border: 1px solid var(--SmartThemeBorderColor, #555);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  overflow: hidden;
}
#${PANEL_ID}.ctb-hidden { display: none; }
#${PANEL_ID} .ctb-head {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
  cursor: move;
  touch-action: none;
  user-select: none;
}
#${PANEL_ID} .ctb-head span {
  flex: 1;
  font-weight: 600;
}
#${PANEL_ID} .ctb-head button {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  padding: 0 4px;
}
#${PANEL_ID} .ctb-head button:hover { opacity: 1; }
#${PANEL_ID} .ctb-body {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}
#${PANEL_ID} .ctb-body pre {
  background: rgba(0,0,0,0.3);
  padding: 8px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  max-height: 360px;
  overflow: auto;
  margin: 0 0 12px 0;
}
#${PANEL_ID} .ctb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
#${PANEL_ID} .ctb-actions button {
  flex: 1;
  min-width: 80px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: var(--SmartThemeQuoteColor, #4a6fa5);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
#${PANEL_ID} .ctb-actions button:hover { filter: brightness(1.15); }
#${PANEL_ID} .ctb-info {
  opacity: 0.7;
  font-size: 12px;
  margin-bottom: 8px;
}
`;

// 创建面板 DOM
function createPanel() {
    // 如果已存在，移除旧面板
    const oldPanel = document.getElementById(PANEL_ID);
    if (oldPanel) oldPanel.remove();

    // 注入样式
    if (!document.getElementById("ctb-style")) {
        const style = document.createElement("style");
        style.id = "ctb-style";
        style.textContent = PANEL_CSS;
        document.head.appendChild(style);
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "ctb-hidden";
    panel.innerHTML = `
        <div class="ctb-head">
            <span>📦 角色提取保存</span>
            <button data-act="close">✕</button>
        </div>
        <div class="ctb-body">
            <div class="ctb-info" id="ctb-char-name"></div>
            <pre id="ctb-json-preview"></pre>
            <div class="ctb-actions">
                <button data-act="download">⬇ 下载 JSON</button>
                <button data-act="copy">📋 复制数据</button>
                <button data-act="refresh">⟳ 刷新</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    return panel;
}

// 渲染数据
function renderPanel(panel) {
    const charData = getCharacterData();
    const nameEl = document.getElementById("ctb-char-name");
    const previewEl = document.getElementById("ctb-json-preview");
    if (!charData) {
        nameEl.textContent = "⚠️ 未获取到角色卡";
        previewEl.textContent = "";
        panel.dataset.json = "";
        panel.dataset.filename = "";
        return;
    }
    nameEl.textContent = `角色：${charData.name} (ID: ${charData.id})`;
    const jsonStr = JSON.stringify(charData, null, 2);
    previewEl.textContent = jsonStr;
    panel.dataset.json = jsonStr;
    panel.dataset.filename = `${charData.name || "character"}.json`;
}

// 面板位置记忆
const POS_KEY = "ctb_panel_pos";
function clampPanel(panel) {
    const r = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left;
    let top = r.top;
    left = Math.min(Math.max(left, 8), vw - r.width - 8);
    top = Math.min(Math.max(top, 8), vh - r.height - 8);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
}
function placePanel(panel) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) {}
    if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        panel.style.left = `${saved.left}px`;
        panel.style.top = `${saved.top}px`;
    } else {
        const r = panel.getBoundingClientRect();
        panel.style.left = `${Math.max(8, (window.innerWidth - r.width) / 2)}px`;
        panel.style.top = `${Math.max(8, (window.innerHeight - r.height) / 2)}px`;
    }
    clampPanel(panel);
}
function savePanelPos(panel) {
    try {
        const r = panel.getBoundingClientRect();
        localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
    } catch (e) {}
}

// 初始化拖动
function initDrag(panel) {
    const head = panel.querySelector(".ctb-head");
    head.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        const r = panel.getBoundingClientRect();
        const offX = e.clientX - r.left;
        const offY = e.clientY - r.top;
        const onMove = (ev) => {
            panel.style.left = `${ev.clientX - offX}px`;
            panel.style.top = `${ev.clientY - offY}px`;
        };
        const onUp = () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);
            clampPanel(panel);
            savePanelPos(panel);
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
        e.preventDefault();
    });
}

// 切换显示
let panelInstance = null;
function togglePanel() {
    if (!panelInstance) {
        panelInstance = createPanel();
        initDrag(panelInstance);
        // 绑定内部事件
        panelInstance.addEventListener("click", (e) => {
            const target = e.target.closest("[data-act]");
            if (!target) return;
            const act = target.dataset.act;
            if (act === "close") {
                panelInstance.classList.add("ctb-hidden");
            } else if (act === "refresh") {
                renderPanel(panelInstance);
                toastr.info("已刷新角色数据");
            } else if (act === "download") {
                const json = panelInstance.dataset.json;
                const filename = panelInstance.dataset.filename || "character.json";
                if (json) {
                    downloadJSON(JSON.parse(json), filename);
                    toastr.success("下载中...");
                } else {
                    toastr.warning("无可下载的数据");
                }
            } else if (act === "copy") {
                const json = panelInstance.dataset.json;
                if (json) {
                    copyToClipboard(json);
                } else {
                    toastr.warning("无数据可复制");
                }
            }
        });
        // 窗口大小变化时调整位置
        window.addEventListener("resize", () => {
            if (!panelInstance.classList.contains("ctb-hidden")) clampPanel(panelInstance);
        });
    }
    const opening = panelInstance.classList.contains("ctb-hidden");
    panelInstance.classList.toggle("ctb-hidden");
    if (opening) {
        renderPanel(panelInstance);
        placePanel(panelInstance);
    }
}

// ========== 添加魔法棒菜单项 ==========

function addExtensionButton() {
    const menu = document.getElementById("extensionsMenu");
    if (!menu) {
        console.warn("[char-tiqu] 未找到扩展菜单，稍后重试...");
        // 可能在 APP_READY 之前调用，延迟重试
        return;
    }
    // 检查是否已添加，防止重复
    if (document.getElementById("ctb-menu-item")) return;

    const item = document.createElement("div");
    item.id = "ctb-menu-item";
    item.className = "list-group-item flex-container flexGap5 interactable";
    item.style.cursor = "pointer";
    item.innerHTML = `
        <div class="fa-fw fa-solid fa-save extensionsMenuExtensionButton"></div>
        <span>角色提取保存</span>
    `;
    item.addEventListener("click", togglePanel);
    menu.appendChild(item);
}

// ========== 初始化 ==========

// 监听 APP_READY 事件确保 UI 已经加载
eventSource.on(event_types.APP_READY, () => {
    addExtensionButton();
    console.log(`[${MODULE_NAME}] 扩展已加载。`);
});

// 如果 APP_READY 已经触发（比如热重载），直接添加
if (document.getElementById("extensionsMenu")) {
    addExtensionButton();
}

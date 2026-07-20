import { extension_settings, loadExtensionSettings } from "../../../scripts/extensions.js";
import { saveSettingsDebounced } from "../../../scripts/settings.js";

const EXT_NAME = "char-tiqu-baocun";
const PANEL_ID = "charTiquBaocunDrawer";
// 默认配置
const DEFAULT_SETTINGS = {
    apiBaseUrl: "http://127.0.0.1:8000/api",
    apiKey: "",
    apiTimeout: 15000,
    autoConnect: false
};

// 初始化本地配置
function initSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    loadExtensionSettings();
}

// 状态提示文本
function setStatus(text, type = "normal") {
    const statusEl = document.getElementById("charTiquStatus");
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.padding = "8px 10px";
    statusEl.style.borderRadius = "6px";
    statusEl.style.margin = "10px 0";
    statusEl.style.fontSize = "13px";
    statusEl.style.background = "transparent";
    statusEl.style.border = "none";
    if (type === "success") {
        statusEl.style.background = "rgba(46, 125, 50, 0.15)";
        statusEl.style.border = "1px solid #2e7d32";
    } else if (type === "error") {
        statusEl.style.background = "rgba(198, 40, 40, 0.15)";
        statusEl.style.border = "1px solid #c62828";
    } else if (type === "loading") {
        statusEl.style.background = "rgba(255, 152, 0, 0.15)";
        statusEl.style.border = "1px solid #ff9800";
    }
}

// API连通测试
async function testApiConnection() {
    const cfg = extension_settings[EXT_NAME];
    const baseUrl = cfg.apiBaseUrl.trim();
    const apiKey = cfg.apiKey.trim();
    const timeout = cfg.apiTimeout;

    if (!baseUrl) {
        setStatus("错误：请填写 API 基础地址", "error");
        return false;
    }
    setStatus("正在连接 API 服务...", "loading");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const headers = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        const res = await fetch(`${baseUrl}/health`, {
            method: "GET",
            headers,
            signal: controller.signal
        });
        clearTimeout(timer);

        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            setStatus(`API 连接成功！服务返回：${JSON.stringify(data)}`, "success");
            return true;
        } else {
            setStatus(`API 连接失败，HTTP状态码：${res.status}`, "error");
            return false;
        }
    } catch (err)
        clearTimeout(timer);
        if (err.name === "AbortError") {
            setStatus(`连接超时(${timeout}ms)，检查API地址`, "error");
        } else {
            setStatus(`连接异常：${err.message}`, "error");
        }
        return false;
    }
}

// 渲染右下角悬浮抽屉面板（点击魔法棒菜单弹出）
function renderDrawerPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
        // 存在则切换显示隐藏
        panel.style.display = panel.style.display === "none" ? "block" : "none";
        return;
    }

    const cfg = extension_settings[EXT_NAME];
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    // 悬浮抽屉样式，对齐anima-rag弹窗
    panel.style.position = "fixed";
    panel.style.bottom = "60px";
    panel.style.right = "20px";
    panel.style.width = "420px";
    panel.style.maxHeight = "80vh";
    panel.style.overflowY = "auto";
    panel.style.background = "var(--bg-secondary)";
    panel.style.borderRadius = "10px";
    panel.style.padding = "16px";
    panel.style.border = "1px solid var(--border-color)";
    panel.style.color = "var(--text-primary)";
    panel.style.zIndex = "9999";
    panel.style.fontFamily = "'Segoe UI', Roboto, sans-serif";

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">角色提取保存 - CharTiquBaocun</h3>
            <button id="ctbCloseDrawer" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">✕</button>
        </div>

        <div style="margin-bottom:12px;">
            <div style="font-size:15px;font-weight:600;margin:14px 0 8px 0;padding-bottom:6px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:6px;">
                🔌 API 服务连接配置
            </div>

            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
                <label style="font-size:14px;">API 基础地址</label>
                <input
                    id="ctbApiUrl"
                    value="${cfg.apiBaseUrl}"
                    placeholder="http://127.0.0.1:8000/api"
                    style="width:100%;box-sizing:border-box;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;color:var(--text-primary);font-size:14px;"
                >
                <div style="font-size:12px;color:var(--text-muted);">角色后端服务根接口地址，末尾不要带斜杠</div>
            </div>

            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
                <label style="font-size:14px;">API Key 密钥</label>
                <input
                    id="ctbApiKey"
                    value="${cfg.apiKey}"
                    placeholder="留空代表无需鉴权"
                    style="width:100%;box-sizing:border-box;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;color:var(--text-primary);font-size:14px;"
                >
                <div style="font-size:12px;color:var(--text-muted);">Bearer Token 鉴权密钥</div>
            </div>

            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
                <label style="font-size:14px;">请求超时时间 (ms)</label>
                <input
                    id="ctbTimeout"
                    type="number"
                    min="3000"
                    value="${cfg.apiTimeout}"
                    style="width:100%;box-sizing:border-box;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;color:var(--text-primary);font-size:14px;"
                >
            </div>

            <div style="display:flex;align-items:center;gap:10px;margin:8px 0;">
                <button
                    id="ctbTestConn"
                    style="padding:8px 14px;border-radius:6px;border:none;cursor:pointer;font-size:14px;background:#4285f4;color:white;"
                    onmouseover="this.style.opacity=0.85"
                    onmouseout="this.style.opacity=1"
                >测试API连接</button>
                <button
                    id="ctbSaveCfg"
                    style="padding:8px 14px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;font-size:14px;background:var(--bg-tertiary);color:var(--text-primary);"
                >保存配置</button>
            </div>

            <div id="charTiquStatus"></div>
        </div>

        <div style="margin-bottom:12px;">
            <div style="font-size:15px;font-weight:600;margin:14px 0 8px 0;padding-bottom:6px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:6px;">
                📦 角色提取与保存（开发中）
            </div>
            <div style="font-size:12px;color:var(--text-muted);">API连通后可拉取远程角色卡，本地保存至SillyTavern角色库，功能待扩展</div>
        </div>
    `;

    document.body.appendChild(panel);
    bindDrawerEvents(panel);
}

// 弹窗交互绑定
function bindDrawerEvents(panel) {
    const cfg = extension_settings[EXT_NAME];
    const urlInput = panel.querySelector("#ctbApiUrl");
    const keyInput = panel.querySelector("#ctbApiKey");
    const timeoutInput = panel.querySelector("#ctbTimeout");
    const testBtn = panel.querySelector("#ctbTestConn");
    const saveBtn = panel.querySelector("#ctbSaveCfg");
    const closeBtn = panel.querySelector("#ctbCloseDrawer");

    closeBtn.addEventListener("click", () => panel.remove());
    saveBtn.addEventListener("click", () => {
        cfg.apiBaseUrl = urlInput.value.trim();
        cfg.apiKey = keyInput.value.trim();
        cfg.apiTimeout = Number(timeoutInput.value);
        saveSettingsDebounced();
        setStatus("配置已本地保存！", "success");
    });
    testBtn.addEventListener("click", testApiConnection);
}

// 【关键修复1】监听APP_READY事件，ST完全加载后再注册菜单（原版anima-rag写法）
function registerSidebarMenu() {
    try {
        // addMenuItem 标准三参数：FontAwesome图标类名, 菜单显示文字, 点击回调
        window.SillyTavern.addMenuItem(
            "fa-solid fa-folder-open", // 文件夹图标，和截图Anima图标体系统一
            "角色提取保存",
            renderDrawerPanel
        );
        console.log(`[${EXT_NAME}] ✅ 魔法棒侧边菜单注册成功`);
    } catch (err) {
        console.error(`[${EXT_NAME}] ❌ 菜单注册失败：`, err);
    }
}

// ST标准扩展加载入口
async function loadExtension() {
    initSettings();
    // 【关键修复2】等待ST核心APP就绪再注册菜单，杜绝时机问题
    if (window.SillyTavern) {
        window.SillyTavern.on("APP_READY", registerSidebarMenu);
    } else {
        // 兜底延迟重试
        setTimeout(() => {
            if (window.SillyTavern) window.SillyTavern.on("APP_READY", registerSidebarMenu);
        }, 1000);
    }
    console.log(`[${EXT_NAME}] 扩展初始化完成，等待APP就绪注册菜单`);
}

// 扩展卸载
function unloadExtension() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
    console.log(`[${EXT_NAME}] 扩展已卸载`);
}

// ST必须导出生命周期函数
export { loadExtension, unloadExtension };

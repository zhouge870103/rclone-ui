# Rclone UI 内部二开 · 开发调试指南（中文）

本文面向公司内部二次开发人员，说明如何在 **Windows** 上搭建环境、开发调试、打包，以及二开时需要改动的关键点。

> 界面文字保持英文（应用未集成 i18n 框架），本文仅作为中文开发文档维护。

---

## 1. 技术栈概览

这是一个 **Tauri 2** 桌面应用（Rust 原生壳 + Web 前端），不是 Electron。应用本身是 `rclone` 的图形外壳：调用本地 rclone 二进制，并通过 rclone 的 rc（远程控制）HTTP API 通信。

| 层 | 技术 | 目录 |
|---|---|---|
| 前端 UI | React 18 + Vite 6 + TypeScript + HeroUI + Tailwind | `src/` |
| 后端（原生） | Rust + Tauri 2 | `src-tauri/` |
| 外部脚本 | `main.ts` 经 esbuild 打包为 `public/out.js` | `main.ts`、`scripts/buildExternal.js` |

关键配置文件：
- `src-tauri/tauri.conf.json` —— 应用标识、窗口、打包、更新器、插件
- `src-tauri/Cargo.toml` —— Rust 依赖
- `package.json` —— 前端依赖与脚本
- `biome.json` —— 代码规范（Biome）

---

## 2. 环境准备（Windows）

需要三样东西：

```powershell
# 1. Node.js 20+（安装前端依赖）
#    官网下载 LTS 版即可

# 2. Rust 工具链（编译 Tauri 后端）
winget install Rustlang.Rustup
rustup default stable-msvc

# 3. Visual Studio C++ 生成工具（Tauri 在 Windows 需要 MSVC 链接器）
#    安装时勾选 "使用 C++ 的桌面开发" 工作负载
#    WebView2 运行时 Windows 11 已自带，无需单独装
```

安装前端依赖：

```powershell
npm install
```

---

## 3. 日常开发调试

一条命令启动开发模式：

```powershell
npm run tauri dev
```

它会自动完成（见 `tauri.conf.json` 的 `beforeDevCommand`）：

1. 执行 `npm run dev` —— 先用 `buildExternal.js` 打包 `out.js`，再启动 Vite 开发服务器（`http://localhost:1420`）
2. 编译 Rust 后端（**首次 5–15 分钟**，之后增量编译很快）
3. 打开应用窗口

### 调试技巧

- **前端**：在应用窗口按 `F12` 或右键「检查」打开 DevTools；改 `.tsx` 支持热更新（HMR），立即生效。
- **Rust 后端**：改 `src-tauri/` 代码会触发重新编译并重启应用；用 `log::info!(...)` 输出日志到运行 `tauri dev` 的终端。
- **托盘应用**：主窗口是 1×1 隐藏窗口（`tauri.conf.json` 的 `windows` 配置），实际功能窗口通过系统托盘图标打开。调试时留意托盘图标。

---

## 4. 构建打包（出安装包给同事）

```powershell
npm run build:windows      # 或直接 npm run tauri build
```

产物位置：`src-tauri/target/release/bundle/`（NSIS 安装器 `.exe`）。

---

## 5. 二开改造清单

### 5.1 已完成的前置改造

以下改造已在本仓库完成（内部版）：

1. **已关闭应用自动更新**
   - 删除前端启动时的 `checkVersion` / `installUpdate`（`main.ts`）与设置页的"检查更新"UI（`GeneralSection.tsx`）。
   - 移除 Rust 侧 `tauri_plugin_updater` 插件、`tauri.conf.json` 的 `updater` 配置与 `createUpdaterArtifacts`，以及 `capabilities/default.json` 的 updater 权限。
   - 移除依赖 `@tauri-apps/plugin-updater`、`tauri-plugin-updater`。

2. **已关闭 Sentry 遥测**
   - 前端新增 `lib/sentry.ts` 空实现，所有 `Sentry.captureException(...)` 调用点改为导入它，不再向外发送数据；移除 `main.ts` 的 Sentry 初始化。
   - 移除 Rust 侧 `sentry::init` / `tauri_plugin_sentry` 插件及 minidump，`capabilities/default.json` 的 sentry 权限。
   - 移除依赖 `@sentry/browser`、`tauri-plugin-sentry-api`、`sentry`、`tauri-plugin-sentry`。

3. **已全量解锁 Pro / 许可证**
   - `store/persisted.ts` 中 `licenseValid` 默认值与迁移逻辑恒为 `true`，`main.ts` 的 `validateInstance` 不再联网校验。
   - 原有十余处 `licenseValid` 功能门控（多源 Copy/Move、文件预览、自动挂载、通知目标数、远程数量上限等）因此全部放开，门控代码保留但不再生效。
   - 设置页 `LicenseSection` 仍保留（可编辑许可证，但已无实际作用）。

### 5.2 仍需按需处理

1. **修改应用标识**
   `tauri.conf.json` 的 `identifier`（现为 `com.rclone.ui`）、`productName`、`icon` 图标，避免与官方版安装冲突。

2. **Windows 签名命令**
   `bundle.windows.signCommand` 指向官方 Azure 签名服务，内部构建需删除或替换为公司证书（或留空走无签名）。

---

## 6. 代码规范

项目使用 Biome。提交前执行：

```powershell
npx biome check --write
```

---

## 7. 常见问题

- **首次 `tauri dev` 卡在 Compiling 很久** —— 正常，Rust 首次全量编译较慢，耐心等待，后续增量编译只需几秒。
- **提示缺少链接器 / `link.exe`** —— 未装 Visual Studio C++ 生成工具，补装「使用 C++ 的桌面开发」工作负载。
- **应用启动后看不到窗口** —— 这是托盘应用，主窗口默认隐藏，点系统托盘图标打开功能窗口。
- **rclone 相关功能报错** —— 应用依赖本地 rclone 二进制，检查 Settings → Binary 中配置的 rclone 路径是否正确。

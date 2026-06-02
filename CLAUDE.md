# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

日报守卫 (DailyReport Guard) — 基于 Tauri v2 的 macOS 桌面应用，对接钉钉开放平台 API 防止日报漏写。

## 关键文件

- `AGENTS.md` — **必读**。完整的技术栈、命令、架构、开发约定、Skill 使用规范
- `CONTEXT.md` — 领域术语表（日报、工作日、缺失、预警、确认 等概念定义）
- `docs/design/technical-plan.md` — 完整技术方案

## 技术栈速查

| 层 | 技术 |
|---|------|
| 框架 | Tauri v2 (Rust + WebView) |
| 前端 | React 18 + TypeScript 5 + Vite 6 |
| 后端 | Rust edition 2021 |
| 数据库 | SQLite via rusqlite (bundled feature) |
| 状态管理 | React Context + useReducer（无第三方库） |

## 关键命令

```bash
# 开发模式
npx tauri dev

# TypeScript 检查
npx tsc --noEmit

# Rust 检查
cargo check --manifest-path src-tauri/Cargo.toml

# 前端构建
npm run build

# 生产打包
npx tauri build
```

## 架构要点

**数据流**：React `invoke()` → Tauri IPC → Rust Command (`commands/`) → 调用 `engine/` / `dingtalk/` / `holiday/` 模块 → 结果写入 SQLite (`db/`) → 返回 JSON → 前端 `dispatch()` 更新 Context → UI 重渲染

**Rust 全局状态**：`lib.rs` 通过 `app.manage(AppState { db, token_cache })` 注册，commands 通过 `State<'_, AppState>` 获取

**前后端通信**：仅通过 `#[tauri::command]` 函数（在 `commands/` 目录），前端用 `invoke()` 调用。command 需在 `lib.rs` 的 `generate_handler![]` 中注册

**日历视图状态**：`src/types/index.ts` 中 `DayStatus` 类型驱动所有颜色/图标渲染：`submitted`(绿✅) / `missing`(红❌) / `warning`(橙⚠️) / `future`(灰) / `non_workday`(灰)

## 开发必须遵循的 Skill 使用规则

详见 `AGENTS.md`，核心要求：

1. **Tauri/Rust/React 代码** → 调用 `tauri-v2` skill
2. **新功能开发前** → 调用 `grill-me` skill 明确需求
3. **领域概念变更** → 调用 `grill-with-docs` skill 并更新 `CONTEXT.md`
4. **核心逻辑实现** → 调用 `tdd` skill 先写测试
5. **功能完成后** → 调用 `verify` skill 验证
6. **Bug 修复** → 调用 `diagnose` skill

## 代码约定

- 英文标识符 + 关键逻辑中文注释
- Rust 每个 `mod.rs` 头部 `// ============================================================` 格式
- React 组件用内联样式（`styles` 对象），不引入第三方 UI 库
- 显式引用 chrono traits（`Datelike`、`Timelike`），Tauri v2 必须 `use tauri::Manager`

## 编译保证

- 提交前 `npx tsc --noEmit` 零错误 + `cargo check --manifest-path src-tauri/Cargo.toml` 零错误
- 所有钉钉 API 调用必须有重试逻辑；网络请求必须有超时
- 不在日志中打印完整 `app_secret`

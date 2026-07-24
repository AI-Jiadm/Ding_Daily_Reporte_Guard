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

## Issue 解决工作流

当用户说"解决 issue #N"或"修复 issue #N"时，严格遵循以下流程。

### 1. 读取 Issue

```bash
gh issue view <N> --json title,body,labels,comments
```

理解问题描述、复现步骤、预期结果。如果 issue 信息不足，通过 `gh issue comment` 追问。

### 2. 认领并开始

在开始修复前，必须在 issue 下回复认领：

```bash
gh issue comment <N> --body "> 开始处理此问题，正在分析中..."
```

### 3. 创建修复分支

分支命名规范：`fix/issue-<N>-<简短描述>`

```bash
git checkout -b fix/issue-<N>-<描述>
```

### 4. 诊断与修复

- Bug → 调用 `diagnose` skill（reproduce → minimise → hypothesise → instrument → fix）
- 新功能 → 调用 `grill-me` + `tauri-v2` skill
- 核心逻辑改动 → 调用 `tdd` skill

### 5. 编译验证

```bash
npx tsc --noEmit && cargo check --manifest-path src-tauri/Cargo.toml
```

必须零错误。

### 6. 提交并创建 PR

```bash
git add -A
git commit -m "fix: <简短描述> (closes #<N>)"
git push origin fix/issue-<N>-<描述>
```

然后用 `gh pr create` 创建 PR：

```bash
gh pr create \
  --title "<描述> (fixes #<N>)" \
  --body "$(cat <<'EOF'
## 修复内容

<具体改了什么、为什么这样改>

## 关联 Issue

Closes #<N>

## 验证

- [ ] npx tsc --noEmit 通过
- [ ] cargo check 通过
EOF
)"
```

### 7. 评论修复完成

PR 创建后，在 issue 下回复：

```bash
gh issue comment <N> --body "> 已提交修复 PR: $(gh pr view --json url -q .url)

**修复方案：**

<简要说明修复思路和改动点>

请查看 PR 了解详情。"
```

### 注意事项

- 所有 `gh` 命令都通过 Bash tool 执行
- 如果 `gh auth status` 失败，提示用户先执行 `gh auth login`
- 修复完成后调用 `verify` skill 确认改动生效

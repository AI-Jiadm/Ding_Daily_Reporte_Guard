# AGENTS.md — 日报守卫 (DailyReport Guard)

## 项目简介

日报守卫是一个基于 Tauri v2 的 macOS 桌面应用，用于防止钉钉日报漏写。通过对接钉钉开放平台 API，自动检查当月工作日的日报提交状态，发现缺失时通过钉钉工作通知提醒。

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 18 + TypeScript 5 + Vite 6 |
| 后端 | Rust (edition 2021) |
| 状态管理 | React Context + useReducer |
| 数据库 | SQLite via rusqlite (bundled) |
| HTTP 客户端 | reqwest (Rust) |
| 日期处理 | chrono (Rust) |
| 节假日数据 | timor.tech API |
| 目标平台 | macOS (后续可扩展) |

## 常用命令

### 开发

```bash
# 启动 Tauri 开发模式（同时启动 Vite + Rust 后端）
npx tauri dev

# 仅启动前端 Vite 开发服务器（1420 端口）
npm run dev

# TypeScript 类型检查
npx tsc --noEmit

# 前端生产构建
npm run build
```

### Rust / 后端

```bash
# Rust 编译检查（快速，不生成二进制）
cargo check --manifest-path src-tauri/Cargo.toml

# Rust 编译
cargo build --manifest-path src-tauri/Cargo.toml

# Rust 编译（release）
cargo build --release --manifest-path src-tauri/Cargo.toml

# 运行 Rust 测试
cargo test --manifest-path src-tauri/Cargo.toml
```

### Tauri / 打包

```bash
# Tauri 生产构建（生成 .dmg/.app）
npx tauri build

# Tauri 调试构建（跳过签名）
npx tauri build --debug

# 查看 Tauri CLI 版本
npx tauri --version
```

### 代码质量

```bash
# Rust lint (需要安装 clippy)
cargo clippy --manifest-path src-tauri/Cargo.toml

# Rust 格式化 (需要安装 rustfmt)
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

# 前端 lint (ESLint 暂未配置，后续添加)
# npm run lint
```

## 项目结构

```
ding-daily-report/
├── AGENTS.md                    # 本文档 — AI Agent 开发指南
├── CONTEXT.md                   # 领域术语表（日报、工作日、缺失等定义）
├── docs/design/
│   └── technical-plan.md        # 完整技术方案
├── src/                         # React 前端
│   ├── main.tsx                 # React 入口
│   ├── App.tsx                  # 顶层路由（配置向导 vs 主界面）
│   ├── index.css                # 全局样式 + CSS 变量
│   ├── vite-env.d.ts            # Vite 类型声明
│   ├── types/index.ts           # 所有 TypeScript 类型定义
│   ├── context/AppContext.tsx    # React Context + useReducer 全局状态
│   ├── pages/
│   │   ├── SetupWizard.tsx      # 首次配置向导（3步：凭据→模板→确认）
│   │   └── CalendarView.tsx     # 主界面（日历网格 + 汇总条 + 立即检查）
│   └── components/
│       ├── Calendar.tsx         # 月历网格组件（7列，含空白填充）
│       ├── DayCell.tsx          # 日期单元格（根据 DayStatus 渲染颜色/图标）
│       ├── DayDetail.tsx        # 日期详情弹窗（点击格子后显示）
│       └── SummaryBar.tsx       # 底部汇总条（缺失天数/已写比例/上次检查时间）
├── src-tauri/                   # Tauri/Rust 后端
│   ├── Cargo.toml               # Rust 依赖声明
│   ├── tauri.conf.json          # Tauri 配置（窗口、托盘、打包）
│   ├── build.rs                 # Tauri 构建脚本
│   ├── capabilities/default.json # Tauri v2 权限配置
│   ├── icons/                   # 应用图标（占位，待替换）
│   └── src/
│       ├── main.rs              # Rust 入口
│       ├── lib.rs               # Tauri Builder 配置、AppState 注册、插件挂载
│       ├── db/mod.rs            # SQLite 数据库层（Config + DailyStatus + ReportRecords + HolidayCache）
│       ├── dingtalk/
│       │   ├── mod.rs
│       │   ├── auth.rs          # access_token 管理（内存缓存、自动续期、过期前5分钟刷新）
│       │   ├── report.rs        # 钉钉日志 API（模板列表、statistics 查询）
│       │   └── notify.rs        # 工作通知发送（markdown 消息）
│       ├── holiday/mod.rs       # 节假日数据（timor.tech API + 周一至周五降级）
│       ├── engine/
│       │   ├── mod.rs
│       │   ├── workday.rs       # 工作日判定函数
│       │   └── checker.rs       # 检查引擎（全量刷新、重试、预警/确认区分）
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── config.rs        # Tauri commands: save_config, load_config, test_connection, fetch_templates
│       │   ├── check.rs         # Tauri commands: run_check, get_current_status
│       │   └── report.rs        # Tauri commands: get_monthly_summary
│       └── scheduler.rs         # 定时任务（每小时检查，17:30 预警，09:30 确认）
├── package.json                 # 前端依赖
├── tsconfig.json                # TypeScript 配置
├── tsconfig.node.json           # Vite 配置文件 TypeScript 配置
├── vite.config.ts               # Vite 构建配置
└── index.html                   # HTML 入口
```

## 领域术语

详见 `CONTEXT.md`。关键概念速查：

| 术语 | 含义 |
|------|------|
| 日报 | 钉钉日志应用中的日报，按月模板提交 |
| 工作日 | 中国法定工作日（周一至周五 + 调休补班，排除法定假日） |
| 缺失 (missing) | 过去工作日未提交日报（红色 ❌） |
| 预警 (warning) | 今天还没写日报（橙色 ⚠️，仅提醒，不算缺失） |
| 已写 (submitted) | 当日已提交日报（绿色 ✅） |
| 工作通知 | 钉钉企业内部应用推送的通知消息 |
| 检查引擎 | 工作日列表 vs 已提交列表 → 差集 = 缺失 |

## 开发约定

### 代码风格

- **标识符语言**：变量名、函数名、类型名使用英文（如 `run_check`、`DayStatus`）
- **注释语言**：关键逻辑和模块头使用中文注释，辅助理解
- **Rust 模块注释**：每个 `mod.rs` 文件头部使用 `// =====...=====` 格式的模块说明
- **React 组件**：函数组件 + Hooks，无需第三方 UI 库，使用内联样式（`styles` 对象）

### 架构约定

- **前端状态管理**：`AppContext.tsx` 中的 `useReducer` 是唯一全局状态源。组件通过 `useAppState()` hook 获取 `{ state, dispatch }`
- **前后端通信**：通过 `invoke()` 调用 Tauri Rust commands。command 函数在 `lib.rs` 中注册，实现在 `commands/` 目录下
- **数据库访问**：Rust 后端通过 `rusqlite` 直接操作 SQLite（不使用 tauri-plugin-sql 的 JS API）。所有 SQL 操作封装在 `db/mod.rs` 的 `Database` 结构体中
- **全局状态**：`AppState`（含 `Database` + `TokenCache`）通过 `app.manage()` 注册为 Tauri managed state，commands 通过 `State<'_, AppState>` 参数获取
- **组件目录**：页面级组件放 `pages/`，可复用组件放 `components/`

### 数据流

```
用户操作 → React invoke() → Tauri IPC → Rust Command
                                         ↓
                              Command 读取 AppState (DB + TokenCache)
                                         ↓
                              调用 engine / dingtalk / holiday 模块
                                         ↓
                              结果写入 SQLite + 返回 JSON 给前端
                                         ↓
                              前端 dispatch() 更新 Context State → UI 重渲染
```

### 颜色编码

| 状态 | 颜色 | 色值 |
|------|------|------|
| submitted | 绿 | `#52c41a` |
| missing | 红 | `#ff4d4f` |
| warning | 橙 | `#fa8c16` |
| future / non_workday | 灰 | `#d9d9d9` |
| primary | 蓝 | `#1677ff` |

---

## AI Agent 开发指引

### 必须使用的 Skills

在开发本项目的特定领域代码时，**必须调用对应的 skill** 以确保代码质量和领域最佳实践：

| 场景 | 必须调用的 Skill | 说明 |
|------|-----------------|------|
| **Tauri 配置、Rust commands、IPC、权限、打包** | `tauri-v2` | Tauri v2 专有 API（invoke、emit、capabilities、tray-icon），避免使用 v1 模式 |
| **Rust 后端开发**（dingtalk/、engine/、db/、scheduler/） | `tauri-v2` | `#[tauri::command]`、`State<>`、`Manager` trait 等 Tauri Rust API |
| **React 前端开发**（pages/、components/、hooks/） | `tauri-v2` | `invoke()`、`@tauri-apps/api/core`、事件监听等前端 API |

### 需求澄清与质量保障

| 场景 | 必须调用的 Skill | 说明 |
|------|-----------------|------|
| **新功能开发前** | `grill-me` | 向用户深入访谈需求，明确边界条件、交互细节、异常处理，直到共识达成 |
| **新功能开发前（涉及领域概念变更）** | `grill-with-docs` | 当新需求可能修改 CONTEXT.md 中的术语定义或引入新领域概念时使用 |
| **Bug 定位与修复** | `diagnose` | 遵循 reproduce → minimise → hypothesise → instrument → fix → regression-test 循环 |
| **实现核心逻辑** | `tdd` | 检查引擎、工作日判定、token 管理等核心逻辑必须先写测试再写实现 |
| **功能开发完成** | `verify` | 运行应用验证功能是否按预期工作 |

### 开发工作流

以下是一个典型功能开发的推荐流程：

```
1. grill-me        → 与用户明确需求、边界、交互细节
2. grill-with-docs → （如涉及领域变更）更新 CONTEXT.md
3. tdd             → 为核心逻辑编写测试（Rust 侧）
4. [编码实现]       → 调用 tauri-v2 skill 编写前后端代码
5. verify          → 运行应用验证功能
6. code-review     → 代码审查（修正冗余、简化逻辑）
```

### 质量要求

- **类型安全**：前端修改后必须通过 `npx tsc --noEmit`；后端修改后必须通过 `cargo check`
- **编译通过**：前端修改后 `npm run build` 必须成功；Tauri 打包前 `cargo check` 必须零错误
- **测试覆盖**：检查引擎（`engine/checker.rs`）、工作日判定（`engine/workday.rs`）、token 管理（`dingtalk/auth.rs`）等核心模块必须有单元测试
- **错误处理**：所有钉钉 API 调用必须有重试逻辑（至少 3 次）；所有网络请求必须有超时设置；用户可见的错误信息必须用中文
- **安全注意**：AppKey/AppSecret 仅存储在本地 SQLite（用户自己电脑）。不要在任何日志中打印完整 AppSecret。不要将凭据硬编码在代码中。

### 技术栈版本约束

- **Tauri**: v2.x（使用 `tauri::Manager` trait、`tauri-plugin-sql` v2、v2 权限系统）
- **React**: 18.x（函数组件 + Hooks，不使用 Class 组件）
- **TypeScript**: 5.x（strict 模式）
- **Rust**: edition 2021，稳定版工具链
- **chrono**: 0.4.x（使用 `Datelike`、`Timelike` traits）
- **rusqlite**: 0.31.x（bundled feature）

### 已知未完成项（技术债）

以下功能框架已搭建但需要后续完善，开发时应优先补齐：

1. **调度器通知接入** — `scheduler.rs` 的定时检查循环已实现，但检查结果尚未调用 `notify::send_work_notice` 发送钉钉消息
2. **模板 API JSON 解析** — `dingtalk/report.rs` 中的 `fetch_templates` 和 `get_statistics` 函数需要根据钉钉 API 实际返回格式完善 `serde_json::Value` 字段解析
3. **托盘图标动态切换** — 需要实现根据缺失状态切换托盘图标（绿色正常 / 红色缺失 / 黄色错误）
4. **agent_id 配置** — `dingtalk/notify.rs` 中的 `agent_id` 当前硬编码为 0，需要从钉钉应用配置中获取
5. **节假日缓存写入** — `holiday/mod.rs` 的 `fetch_holiday_data` 需要将结果写入 `db::holiday_cache` 表

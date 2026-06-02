# 日报守卫 (DailyReport Guard) — 技术方案

## 1. 项目概览

| 项目 | 说明 |
|------|------|
| **名称** | 日报守卫 (DailyReport Guard) |
| **定位** | 个人使用的 macOS 桌面应用，防止钉钉日报漏写被扣钱 |
| **技术栈** | Tauri v2 + React + TypeScript（前端）+ Rust（后端） |
| **部署形态** | macOS 应用 (.app / .dmg)，系统托盘常驻 |

### v1 功能范围

- 配置钉钉企业内部应用凭证（AppKey / AppSecret / userid）
- 拉取钉钉日志模板列表，选择盯的模板
- 自动检查当前月每天日报提交状态，找出缺失工作日
- 日历视图展示（绿色=已写，红色=缺失，橙色=今日预警，灰色=未来/非工作日）
- 双时间点自动通知（下午 17:30 预警 + 次日 09:30 确认）
- 系统托盘常驻，托盘图标反映缺失状态
- 启动时全量检查 + 每小时一次自动检查
- 缺失时通过钉钉工作通知推送消息

### v2 功能范围（暂不实现）

- 在应用内写日报并同步到钉钉

---

## 2. 领域概念

详见 [CONTEXT.md](../CONTEXT.md)。

关键概念：日报、工作日、缺失、预警、确认、已写、工作通知、检查引擎。

---

## 3. 架构设计

### 3.1 整体架构

```
┌──────────────────────────────────────┐
│            Tauri App (macOS)           │
│  ┌────────────┐  ┌──────────────────┐ │
│  │  前端 (React)  │  │  后端 (Rust)      │ │
│  │  - 配置向导   │◄─┤  - dingtalk/     │ │
│  │  - 日历视图   │  │  - holiday/      │ │
│  │  - 设置页面   │IPC│  - engine/       │ │
│  │  - 托盘管理   │──┤  - db/           │ │
│  └────────────┘  │  - commands/     │ │
│                  │  - scheduler.rs  │ │
│                  └──────────────────┘ │
└──────────────────────────────────────┘
         │                  │
         ▼                  ▼
   ┌──────────┐    ┌──────────────┐
   │  SQLite   │    │ 外部 API       │
   │  (本地DB)  │    │ - 钉钉 Open API │
   └──────────┘    │ - timor.tech   │
                   └──────────────┘
```

### 3.2 Rust 后端模块

```
src-tauri/src/
├── main.rs          # 入口，注册 commands + 托盘
├── dingtalk/
│   ├── mod.rs       # 统一导出
│   ├── auth.rs      # access_token 管理（获取、缓存、续期）
│   ├── report.rs    # 模板列表、statistics 查询
│   └── notify.rs    # 工作通知发送
├── holiday/
│   └── mod.rs       # 节假日 API + 降级逻辑
├── engine/
│   ├── mod.rs       # 检查引擎入口
│   ├── workday.rs   # 工作日判定
│   └── checker.rs   # 缺失检查逻辑
├── db/
│   └── mod.rs       # SQLite 初始化、读写
├── commands/
│   ├── mod.rs
│   ├── config.rs    # 配置管理 commands
│   ├── check.rs     # 检查触发 commands
│   └── report.rs    # 日报数据 commands
└── scheduler.rs     # 定时任务调度
```

### 3.3 React 前端组件

```
src/
├── App.tsx           # 顶层路由：配置向导 vs 主界面
├── context/
│   └── AppContext.tsx # React Context + useReducer
├── pages/
│   ├── SetupWizard.tsx      # 首次配置向导
│   ├── CalendarView.tsx     # 主界面：日历 + 汇总
│   ├── SettingsPage.tsx     # 设置页面
│   └── DayDetail.tsx        # 某天详情（弹窗/侧栏）
├── components/
│   ├── Calendar.tsx         # 月历组件
│   ├── DayCell.tsx          # 日期单元格
│   ├── SummaryBar.tsx       # 底部汇总条
│   ├── StatusBadge.tsx      # 状态标记（✅❌⚠️）
│   └── ConnectionTest.tsx   # 连接测试按钮
├── hooks/
│   ├── useCheckStatus.ts    # 检查状态 hook
│   └── useTrayBadge.ts      # 托盘角标 hook
└── types/
    └── index.ts             # TypeScript 类型定义
```

---

## 4. 数据模型

### 4.1 SQLite 表设计

```sql
-- 应用配置
CREATE TABLE config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- config 表存储: app_key, app_secret, userid, selected_template_ids (JSON array),
--               check_hour_pm (默认 1730), check_hour_am (默认 0930)

-- 检查记录（当前月，每次全量刷新）
CREATE TABLE daily_status (
    date        TEXT PRIMARY KEY,  -- 'YYYY-MM-DD'
    is_workday  INTEGER NOT NULL,  -- 0/1
    has_report  INTEGER NOT NULL,  -- 0/1
    checked_at  TEXT NOT NULL,     -- ISO 8601
    status      TEXT NOT NULL      -- 'submitted' | 'missing' | 'warning' | 'future' | 'non_workday'
);

-- 日志提交记录（从 API 同步的原始数据）
CREATE TABLE report_records (
    report_id   TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    stat_date   TEXT NOT NULL,  -- 'YYYY-MM-DD'
    created_at  TEXT,           -- ISO 8601
    synced_at   TEXT NOT NULL   -- ISO 8601
);
```

### 4.2 TypeScript 前端类型

```typescript
type DayStatus = 'submitted' | 'missing' | 'warning' | 'future' | 'non_workday';

interface DayInfo {
  date: string;          // 'YYYY-MM-DD'
  status: DayStatus;
  isWorkday: boolean;
  hasReport: boolean;
  templateName?: string;
}

interface CheckSummary {
  month: string;         // '2026-06'
  totalWorkdays: number;
  submitted: number;
  missing: number;
  missingDates: string[];
  lastCheckedAt: string;
}

interface AppConfig {
  appKey: string;
  appSecret: string;
  userId: string;
  selectedTemplateIds: string[];
  isConfigured: boolean;
}

interface Template {
  id: string;
  name: string;
  icon?: string;
}
```

---

## 5. API 对接

### 5.1 钉钉 API

| 功能 | 网关 | 接口 | 频率 |
|------|------|------|------|
| 获取 access_token | oapi.dingtalk.com | `GET /gettoken?appkey=&appsecret=` | 启动 + 每 1.9h 续期 |
| 日志模板列表 | api.dingtalk.com | `GET /v1.0/report/templates` | 配置时拉一次 |
| 日志统计 | api.dingtalk.com | `POST /v1.0/report/statistics` | 每次检查时调用 |
| 发工作通知 | oapi.dingtalk.com | `POST /topapi/message/corpconversation/asyncsend_v2` | 发现缺失时调用 |

**access_token 管理策略**：
- 有效期 7200 秒（2h）
- 缓存到内存，过期前 5 分钟自动续期
- 提供 `get_token()` 接口，内部处理缓存和续期
- 前端无感

**statistics API 调用参数**：
```json
{
  "report_id": "<模板ID>",
  "userid": "<用户ID>",
  "start_time": 1717200000,
  "end_time": 1719792000
}
```
- 返回仅包含有提交的日期（has_report 的日期），缺失日期不在返回列表中
- 检查引擎需要自己对比"本月工作日列表"与"返回的有提交日期列表"

### 5.2 节假日 API (timor.tech)

```
GET http://timor.tech/api/holiday/year/{year}
```
- 免费，无需注册
- 返回全年数据，包含假期和调休补班信息
- 缓存到本地（SQLite 或内存），每年年初拉取一次新数据
- 降级策略：API 不可用时降级为周一至周五

---

## 6. 检查引擎逻辑

### 6.1 一次完整的检查流程

```
1. 加载配置（AppKey/AppSecret/userid/template_ids）
2. 获取/续期 access_token
3. 调用钉钉 API 获取本月所有有提交的日期列表
4. 调用节假日 API 获取本月工作日列表
5. 对比：工作日列表 - 已提交日期列表 = 缺失日期列表
6. 区分：
   - 今天 且 当前时间 < 17:30 → 'warning'（橙色）
   - 昨天及以前 → 'missing'（红色）
   - 已提交 → 'submitted'（绿色）
   - 未来 → 'future'（灰色）
   - 非工作日 → 'non_workday'（灰色）
7. 更新 SQLite 中的 daily_status 表（全量覆盖）
8. 更新前端状态
9. 如果是定时器触发的检查：
   - 17:30 检查 → 今天没写则发"预警"工作通知
   - 09:30 检查 → 昨天没写则发"确认"工作通知
```

### 6.2 触发时机

| 触发条件 | 行为 |
|----------|------|
| 应用启动 | 立即执行全量检查（不发通知） |
| 定时器（每小时） | 执行全量检查，17:30 和 09:30 额外发通知 |
| 用户手动点击"立即检查" | 执行全量检查（不发通知） |
| 从托盘恢复窗口 | 刷新界面数据（不发通知） |

### 6.3 工作日判定

```
1. 从 timor.tech 获取 year 年的节假日数据
2. 缓存数据，每年年初刷新
3. 降级：API 失败时回退到周一至周五
4. 判定函数：is_workday(date) -> bool
```

---

## 7. 通知消息模板

### 7.1 下午预警（17:30）

```
📋 日报提醒
今天（6月2日 周二）的日报还没提交哦～
本月已缺失: 0天
快去写日报吧！
```

### 7.2 次日确认（09:30）

```
⚠️ 日报缺失提醒
昨天（6月2日 周二）的日报未提交
本月已缺失: 1天（6月2日）
请尽快补交！
```

### 7.3 不发通知的情况
- 没有缺失时不发
- 应用启动检查时不发
- 用户手动检查时不发

---

## 8. 交互设计

### 8.1 窗口行为
- 关闭窗口 → 最小化到系统托盘（不退出）
- 通过托盘右键菜单退出应用
- macOS Dock 图标与应用窗口独立

### 8.2 托盘行为
- 正常状态：绿色 ✓ 图标
- 有缺失：红色 ⚠️ 图标 + tooltip 显示缺失天数
- API 失败：黄色 ⚠️ 图标 + tooltip "上次检查失败：原因（时间）"
- 右键菜单：
  - 显示主窗口
  - 立即检查
  - 退出

### 8.3 日历视图
- 月历布局（周一至周日）
- 颜色编码：✅绿=已写 / ❌红=缺失 / ⚠️橙=今日预警 / 🔒灰=未来及非工作日
- 底部汇总条：缺失天数 + 日期 + 已写/总工作日比例
- 点击某天 → 弹出详情（已写：提交时间/模板名；缺失：红色提示）

### 8.4 配置向导
- Step 1: 输入 AppKey + AppSecret + userid → 测试连接
- Step 2: 拉取模板列表 → 勾选要盯的模板
- Step 3: 确认检查时间（v1 硬编码显示 17:30 / 09:30）→ 完成

---

## 9. 技术选型细节

| 决策项 | 选择 | 理由 |
|--------|------|------|
| Tauri 版本 | v2 | 新项目标准，官方推荐 |
| 前端框架 | React + TypeScript | 用户选择 |
| 状态管理 | React Context + useReducer | 轻量，无需额外依赖 |
| 数据存储 | SQLite via rusqlite | Tauri 官方支持，结构化查询方便 |
| 节假日数据 | timor.tech API | 免费、无需注册、接口简洁 |
| 凭据存储 | SQLite 明文 | v1 个人使用，威胁模型简单 |
| 代码语言 | 英文标识符 + 关键代码中文注释 | 生态兼容 + 国内可读性 |
| 打包目标 | macOS .dmg | macOS 优先 |

---

## 10. 依赖清单（估）

### Rust (Cargo.toml)
- `tauri` v2
- `tauri-plugin-sql` (SQLite)
- `tauri-plugin-shell`
- `reqwest` (HTTP client)
- `serde` / `serde_json`
- `rusqlite` (or via tauri-plugin-sql)
- `tokio` (async runtime)
- `chrono` (日期处理)
- `log` + `env_logger`

### 前端 (package.json)
- `react` + `react-dom`
- `typescript`
- `@tauri-apps/api` v2
- `@tauri-apps/plugin-sql`
- Vite (构建工具)

---

## 11. 风险与降级

| 风险 | 降级策略 |
|------|----------|
| 钉钉 API 不可用 | 重试 3 次后跳过，托盘图标显示警告，下次检查恢复 |
| 节假日 API 不可用 | 降级为周一至周五，不区分调休 |
| 应用不在运行时错过通知 | 启动时全量检查弥补，托盘图标状态反映缺失 |
| access_token 过期 | 自动续期机制，无效时重新获取 |
| AppKey/Secret 配置错误 | 启动时检测，弹窗提示 |

---

## 12. 开发顺序

| 阶段 | 内容 | 估时 |
|------|------|------|
| 1 | 初始化 Tauri v2 项目骨架 | - |
| 2 | Rust: db 模块（SQLite 建表 + 读写） | - |
| 3 | Rust: dingtalk::auth（token 管理） | - |
| 4 | Rust: dingtalk::report（模板列表 + statistics） | - |
| 5 | Rust: holiday 模块（节假日判定） | - |
| 6 | Rust: engine（检查引擎） | - |
| 7 | Rust: dingtalk::notify（工作通知） | - |
| 8 | Rust: commands 层 + scheduler | - |
| 9 | 前端: 配置向导页面 | - |
| 10 | 前端: 日历视图 + 汇总条 | - |
| 11 | 前端: 托盘图标 + 窗口管理 | - |
| 12 | 集成测试 + 打包 macOS .dmg | - |

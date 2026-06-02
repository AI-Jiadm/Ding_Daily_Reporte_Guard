# 日报守卫 (DailyReport Guard)

防止钉钉日报漏写被扣钱的 macOS 桌面应用。对接钉钉开放平台 API，自动检查当月工作日日报提交状态，发现缺失时通过钉钉工作通知提醒。

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 (Rust + WebView) |
| 前端 | React 18 + TypeScript 5 + Vite 6 |
| 后端 | Rust edition 2021 |
| 数据库 | SQLite via rusqlite (bundled) |
| HTTP | reqwest (Rust) |
| 日期 | chrono (Rust) |
| 节假日 | NateScarlet/holiday-cn (GitHub raw) |
| 图标 | 日志.svg (根目录) → sharp → PNG/ICNS/ICO |
| 目标 | macOS (Windows 可交叉编译) |

## 快速开始

### 环境要求

- Node.js ≥ 18
- Rust 稳定版 (通过 rustup 安装)
- macOS: Xcode Command Line Tools (`xcode-select --install`)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npx tauri dev
```

这会同时启动 Vite 前端开发服务器 (端口 1420) 和 Tauri Rust 后端。

### 仅前端开发

```bash
npm run dev        # 启动 Vite 服务器
npx tsc --noEmit   # TypeScript 类型检查
```

### Rust 编译检查

```bash
cargo check --manifest-path src-tauri/Cargo.toml   # 快速检查
cargo build --manifest-path src-tauri/Cargo.toml    # 编译
```

### 运行测试

```bash
# Rust 单元测试（15 个）
cargo test --manifest-path src-tauri/Cargo.toml

# 前端类型检查
npx tsc --noEmit
```

## 构建安装包

### macOS

```bash
npx tauri build
```

输出位置：
- `.app`: `src-tauri/target/release/bundle/macos/日报守卫.app`
- `.dmg`: `src-tauri/target/release/bundle/dmg/日报守卫_0.1.0_x64.dmg` (~6.7 MB)

**注意**：由于没有 Apple 开发者证书，`.dmg` 是未签名的。用户首次打开需要**右键 → 打开**绕过 Gatekeeper。

### Windows

在 Windows 机器上：

```bash
git clone git@github.com:AI-Jiadm/Ding_Daily_Reporte_Guard.git
cd Ding_Daily_Reporte_Guard
npm install
npx tauri build
```

输出：`.msi` 在 `src-tauri/target/release/bundle/msi/`

### 版本号

修改 `src-tauri/tauri.conf.json` 中的 `version` 字段。

## 项目结构

```
ding-daily-report/
├── README.md                    # 本文档
├── AGENTS.md                    # AI Agent 开发指南
├── CLAUDE.md                    # Claude Code 上下文
├── CONTEXT.md                   # 领域术语表
├── 日志.svg                     # 应用图标源文件
├── docs/design/
│   └── technical-plan.md        # 完整技术方案
├── src/                         # React 前端
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 路由（配置向导 vs 主界面）
│   ├── index.css                # 全局样式 + CSS 变量 + 深色模式
│   ├── types/index.ts           # TypeScript 类型定义
│   ├── context/AppContext.tsx    # React Context + useReducer
│   ├── pages/
│   │   ├── SetupWizard.tsx      # 首次配置向导
│   │   └── CalendarView.tsx     # 主日历页面
│   └── components/
│       ├── Calendar.tsx         # 月历网格
│       ├── DayCell.tsx          # 日期单元格（全背景着色）
│       ├── DayDetail.tsx        # 日期详情弹窗
│       ├── SummaryBar.tsx       # 底部汇总条
│       └── SettingsModal.tsx    # 设置面板
├── src-tauri/                   # Rust 后端
│   ├── Cargo.toml               # Rust 依赖
│   ├── tauri.conf.json          # Tauri 配置
│   ├── capabilities/default.json # 权限配置
│   ├── icons/                   # 应用图标（32~512px, .icns, .ico）
│   └── src/
│       ├── main.rs              # 入口
│       ├── lib.rs               # Tauri Builder + AppState 注册
│       ├── db/mod.rs            # SQLite 层（4 张表）
│       ├── dingtalk/
│       │   ├── auth.rs          # access_token 缓存与续期
│       │   ├── report.rs        # 模板列表 + 日志查询 API
│       │   └── notify.rs        # 工作通知发送（待接入）
│       ├── holiday/mod.rs       # 节假日数据 + 降级
│       ├── engine/
│       │   ├── workday.rs       # 工作日判定
│       │   └── checker.rs       # 检查引擎
│       ├── commands/
│       │   ├── config.rs        # 配置 CRUD + 连接测试 + 保存重启
│       │   ├── check.rs         # 检查触发 + 状态查询
│       │   └── report.rs        # 月度汇总
│       └── scheduler.rs         # 定时检查（每小时/17:30/9:30）
├── package.json                 # 前端依赖
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## 配置 & 首次使用

1. 在钉钉开放平台创建**企业内部应用**，获取 AppKey 和 AppSecret
2. 确保应用已开启**工作通知**权限
3. 启动应用 → 输入 AppKey、AppSecret、你的钉钉 UserID
4. 点击"测试连接" → 选择日报模板 → 完成配置
5. 配置保存在本地 SQLite 数据库中，下次启动自动加载

### 数据库位置

macOS: `~/Library/Application Support/com.dailyreport.guard/dailyreport.db`

## 钉钉 API 清单

| 功能 | 接口 | 网关 |
|------|------|------|
| 获取 access_token | `GET /gettoken` | `oapi.dingtalk.com` |
| 日志模板列表 | `POST /topapi/report/template/listbyuserid` | `oapi.dingtalk.com` |
| 日志列表 | `POST /topapi/report/list` | `oapi.dingtalk.com` |
| 工作通知 | `POST /topapi/message/corpconversation/asyncsend_v2` | `oapi.dingtalk.com` |

## 核心功能

### 检查引擎

每次检查的执行流程：
1. 加载配置（AppKey/AppSecret/UserID/模板名称）
2. 获取/续期 access_token
3. 调用钉钉 API 获取本月日志提交列表
4. 调用节假日 API 获取本月工作日列表
5. 对比得出缺失日期
6. 更新 SQLite + 前端状态

### 日历状态颜色

| 单元格样式 | 含义 |
|-----------|------|
| 淡绿背景 + 绿色数字 + ✓ | 已提交 |
| **红色背景 + 红粗体 + 底部红条 + "缺失"** | 缺失 |
| 橙黄背景 + 橙色粗体 + 底部橙条 + "待写" | 今天还没写 |
| 灰淡 | 未来/非工作日 |

### 通知时机

| 时间 | 类型 |
|------|------|
| 每天 17:30 | 预警通知（今天还没写） |
| 次日 09:30 | 确认通知（昨天最终没写） |
| 启动时 | 全量检查（仅界面，不发通知） |
| 每小时 | 自动检查 |

> **注意**: 通知功能（`dingtalk/notify.rs` + `scheduler.rs`）框架已搭建，但调度器尚未接入通知发送。当前检查结果仅在界面上展示。

## 法定节假日数据

### 数据源

[NateScarlet/holiday-cn](https://github.com/NateScarlet/holiday-cn) — GitHub 开源项目，CI 每日自动更新国务院发布的节假日安排。

### 获取方式

```bash
# 直接拉取某年的节假日 JSON
curl https://raw.githubusercontent.com/NateScarlet/holiday-cn/refs/heads/master/2026.json
```

### 数据格式

```json
{
  "year": 2026,
  "days": [
    { "name": "元旦",       "date": "2026-01-01", "isOffDay": true  },
    { "name": "春节",       "date": "2026-02-17", "isOffDay": true  },
    { "name": "春节补班",   "date": "2026-02-14", "isOffDay": false }
  ]
}
```

| 字段 | 含义 |
|------|------|
| `isOffDay: true` | 法定休息日（放假），**不是**工作日 |
| `isOffDay: false` | 调休补班日（周末上班），**是**工作日 |
| 未收录的日期 | 按周一至周五常规判断（周一到五 = 工作日） |

### 降级策略

如果 GitHub raw 不可达（网络不通 / 限流），自动降级为**周一至周五 = 工作日**的简单判断，不阻断正常使用。

### 代码位置

- `src-tauri/src/holiday/mod.rs` — API 拉取 + 解析 + 降级逻辑 + 单元测试
- `src-tauri/src/engine/workday.rs` — 工作日判定函数

### 每年更新

holiday-cn 项目会在国务院发布下一年节假日安排后自动更新。应用会在每年第一次检查时自动拉取新年数据。如果 GitHub raw 不可达，使用降级模式。无需手动更新。

## 图标更新

修改 `日志.svg` 后，重新生成所有尺寸：

```bash
node -e "
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('日志.svg');
const sizes = [
  ['src-tauri/icons/32x32.png', 32],
  ['src-tauri/icons/128x128.png', 128],
  ['src-tauri/icons/128x128@2x.png', 256],
  ['src-tauri/icons/icon.png', 512],
];
(async () => {
  for (const [path, size] of sizes) {
    await sharp(svg).resize(size, size).png().toFile(path);
  }
  console.log('PNGs done');
})();
"
```

`.icns` 需要 macOS `iconutil`，`.ico` 需要 PIL：

```bash
# .icns (先创建 iconset 目录，生成各种尺寸PNG，然后 iconutil -c icns)
# .ico
python3 -c "
from PIL import Image
img = Image.open('src-tauri/icons/icon.png')
img.save('src-tauri/icons/icon.ico', format='ICO', sizes=[(s,s) for s in [16,24,32,48,64,128,256]])
"
```

## Git 仓库

```
git@github.com:AI-Jiadm/Ding_Daily_Reporte_Guard.git
```

`.gitignore` 已排除: `node_modules/`, `src-tauri/target/`, `dist/`, `.DS_Store`

## 已知限制 & 后续计划

- [ ] 调度器未接入钉钉通知发送（检查结果仅在界面上展示）
- [ ] 无 Apple 开发者证书（.dmg 未签名，需右键打开）
- [ ] v1 只支持监控一个模板
- [ ] 不支持在应用内写日报并同步到钉钉
- [ ] 节假日数据需有网络连接（降级为周一至周五）

## 相关文档

- `AGENTS.md` — AI Agent 开发规范 & Skill 使用指南
- `CONTEXT.md` — 领域术语定义
- `docs/design/technical-plan.md` — 完整技术方案

# 日报守卫 — 技术学习指南

> 本文档帮助你快速理解 Rust、Tauri v2、React 的基础知识，以及它们在本项目中是如何协同工作的。

---

## 目录

1. [Rust 快速入门](#1-rust-快速入门)
   - 1.1 [为什么用 Rust？](#11-为什么用-rust)
   - 1.2 [Rust 工具链：Cargo](#12-rust-工具链cargo)
   - 1.3 [变量、常量、可变性](#13-变量常量可变性)
   - 1.4 [基本数据类型](#14-基本数据类型)
   - 1.5 [字符串：String vs &str](#15-字符串string-vs-str)
   - 1.6 [所有权（Ownership）— 最核心的概念](#16-所有权ownership--rust-最核心的概念)
   - 1.7 [控制流](#17-控制流)
   - 1.8 [结构体、枚举、Match](#18-结构体struct枚举enummatch)
   - 1.9 [错误处理：Result + ?](#19-错误处理result--运算符)
   - 1.10 [常用集合类型](#110-常用集合类型)
   - 1.11 [迭代器与闭包](#111-迭代器与闭包)
   - 1.12 [模块系统（mod）](#112-模块系统mod)
   - 1.13 [属性宏和派生宏](#113-属性宏和派生宏)
   - 1.14 [并发：Arc + Mutex/RwLock + async/await](#114-并发arc--mutexrwlock--asyncawait)
   - 1.15 [Rust 易混淆概念速查](#115-rust-易混淆概念速查)
2. [Tauri v2 框架入门](#2-tauri-v2-框架入门)
   - 2.1 [Tauri 是什么？](#21-tauri-是什么)
   - 2.2 [从零搭建一个 Tauri v2 项目](#22-从零搭建一个-tauri-v2-项目)
   - 2.3 [Tauri 的两端：前端进程 vs 后端进程](#23-tauri-的两端前端进程-vs-后端进程)
   - 2.4 [核心概念：tauri::command（IPC 通信）](#24-核心概念tauricommandipc-通信)
   - 2.5 [参数序列化：Rust ↔ JSON](#25-参数序列化rust--json-自动转换)
   - 2.6 [应用生命周期（Builder 链式调用）](#26-应用生命周期builder-链式调用)
   - 2.7 [全局状态管理（State 注入）](#27-全局状态管理state-注入)
   - 2.8 [插件系统（Plugin）](#28-插件系统plugin)
   - 2.9 [权限与能力系统（Capabilities）](#29-权限与能力系统capabilities--v2-新增)
   - 2.10 [事件系统（Event）](#210-事件系统event--后端主动推送消息给前端)
   - 2.11 [配置文件详解：tauri.conf.json](#211-配置文件详解tauriconfjson)
   - 2.12 [Tauri 开发调试技巧](#212-tauri-开发调试技巧)
   - 2.13 [Tauri 前端 API 速查](#213-tauri-前端-api-速查)
   - 2.14 [多窗口和系统托盘](#214-多窗口和系统托盘)
   - 2.15 [Tauri 核心概念速查](#215-tauri-核心概念速查)
3. [React 快速入门](#3-react-快速入门)
4. [项目实战：三者如何结合](#4-项目实战三者如何结合)
5. [动手修改指南](#5-动手修改指南)
6. [学习资源推荐](#6-学习资源推荐)

---

## 1. Rust 快速入门

### 1.1 为什么用 Rust？

Rust 是一门**系统编程语言**，和 C++ 同级，但它有独特优势：

- **内存安全**：编译期消除空指针、悬垂指针、数据竞争（不需要垃圾回收 GC）
- **高性能**：和 C/C++ 同级别性能，零成本抽象
- **强大的类型系统**：编译器帮你检查大部分错误

在本项目中，Rust 负责所有**后端逻辑**：数据库操作、钉钉 API 调用、节假日数据拉取、日报检查引擎。

### 1.2 Rust 工具链：Cargo

Cargo 是 Rust 的**包管理器和构建系统**（类比 Node.js 的 npm + 构建脚本）。

```bash
# 创建新项目
cargo new my-project          # 生成 src/main.rs + Cargo.toml

# 构建
cargo build                   # 开发构建（debug 模式，快但不优化）
cargo build --release         # 生产构建（优化，慢但运行时快）

# 运行
cargo run                     # 编译 + 运行

# 检查（不生成二进制，仅检查能否编译通过）
cargo check                   # 比 cargo build 快得多

# 运行测试
cargo test                    # 运行所有单元测试和集成测试

# 添加依赖
cargo add serde               # 自动写入 Cargo.toml
```

**Cargo.toml** — 项目的清单文件（类比 `package.json`）：

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2021"               # Rust 语言版本

[dependencies]
serde = { version = "1", features = ["derive"] }  # 带 feature 的依赖
tokio = { version = "1", features = ["full"] }     # 异步运行时
```

**✅ 本项目中的例子** (`src-tauri/Cargo.toml`)：

```toml
[package]
name = "dailyreport-guard"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
rusqlite = { version = "0.31", features = ["bundled"] }  # bundled = 内置 SQLite
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }      # HTTP 客户端
tokio = { version = "1", features = ["full"] }           # 异步运行时
chrono = { version = "0.4", features = ["serde"] }       # 日期时间
log = "0.4"
env_logger = "0.11"
```

### 1.3 变量、常量、可变性

Rust 的变量默认**不可变**（immutable），这是和其他语言最大的不同：

```rust
// 不可变绑定（默认）
let x = 5;                     // x 不可变，不能重新赋值
// x = 6;                      // ❌ 编译错误！

// 可变绑定
let mut y = 5;                 // mut 关键字表示可变
y = 6;                         // ✅ 可以

// 常量（编译期求值，必须标注类型）
const MAX_SIZE: usize = 100;   // 常量名全大写，类型必须显式标注

// 变量遮蔽（Shadowing）—— 用 let 重新声明同名变量
let z = 5;
let z = z + 1;                 // z = 6，这是新变量，遮蔽了旧的
let z = "hello";               // 类型也可以不同！
```

**为什么默认不可变？** 因为并发安全——如果没人能改这个值，就不会有数据竞争。编译器会阻止你无意中修改数据。

### 1.4 基本数据类型

```rust
// ---- 整数 ----
let a: i8 = 127;               // 有符号 8 位  (-128 ~ 127)
let b: u8 = 255;               // 无符号 8 位  (0 ~ 255)
let c: i32 = 42;               // 有符号 32 位（默认整数类型）
let d: i64 = 9999999999;       // 有符号 64 位（时间戳常用）
let e: usize = 100;            // 指针大小（数组索引/长度用，32位机器=u32，64位=u64）

// ---- 浮点数 ----
let f: f32 = 3.14;             // 单精度
let g: f64 = 3.1415926535;     // 双精度（默认浮点类型）

// ---- 布尔 ----
let h: bool = true;
let i = false;                 // 类型推断

// ---- 字符（4 字节 Unicode）----
let j: char = 'A';
let k = '中';                  // Rust 的 char 是 Unicode，一个中文也是一个 char

// ---- 元组（Tuple）—— 固定长度的异构集合 ----
let tup: (i32, f64, char) = (500, 6.4, 'A');
let (x, y, z) = tup;           // 解构
let first = tup.0;             // 用 .索引 访问

// ---- 数组（Array）—— 固定长度的同构集合 ----
let arr: [i32; 5] = [1, 2, 3, 4, 5];
let zeros = [0; 100];          // 100 个 0
let third = arr[2];            // 索引访问（会做边界检查）
```

**✅ 本项目中的例子**：

```rust
// db/mod.rs — rusqlite 的 params 宏接收各种基本类型
params![date, *is_workday as i32, *has_report as i32, checked_at, status]

// checker.rs — 整数运算
let expected_start = NaiveDate::from_ymd_opt(2026, 6, 1)   // i32 参数
```

### 1.5 字符串：`String` vs `&str`

Rust 有两种字符串类型，这是初学者最容易困惑的地方：

| | `String` | `&str` |
|---|---------|--------|
| 本质 | 堆上分配的**可变**字符串 | 字符串**切片**（引用/视图） |
| 拥有数据？ | 是 | 否（借用） |
| 来源 | `String::from("hi")` `"hi".to_string()` `format!("...")` | 字面量 `"hi"`、`&s[0..3]`、借用 `&s` |
| 可修改？ | 是 `s.push_str("!")` | 否 |

```rust
// 创建 String
let mut s1 = String::from("hello");
let s2 = "world".to_string();
let s3 = format!("{} {}", s1, s2);   // "hello world"

// 修改 String
s1.push_str(", world");              // s1 = "hello, world"
s1.push('!');                        // s1 = "hello, world!"

// String → &str（自动解引用）
fn greet(name: &str) {               // 接收 &str
    println!("Hello, {}", name);
}
greet(&s1);                          // &String → &str（自动转换，称为 Deref）
greet("Alice");                      // 字面量直接就是 &str

// &str → String
let owned = "hello".to_string();
let owned2 = String::from("hello");
let owned3: String = "hello".into();
```

**✅ 本项目中的例子** (`commands/config.rs:22-24`)：

```rust
state.db.set_config("app_key", &app_key)?;
//                   ^^^^^^^^^^  ^^^^^^^^
//                   字面量&str   借用 String → 自动转 &str
```

### 1.6 所有权（Ownership）—— Rust 最核心的概念

Rust 没有垃圾回收（GC），没有手动 `malloc/free`，而是通过**所有权规则**在编译期管理内存：

```rust
// 规则1：每个值有且只有一个所有者（owner）
let s1 = String::from("hello");   // s1 拥有这个字符串
let s2 = s1;                       // 所有权从 s1 转移给了 s2（move）
// println!("{}", s1);            // ❌ 编译错误！s1 已经失效（use after move）

// 规则2：离开作用域时自动释放
{
    let s = String::from("world");
    // s 在这里还活着
}  // ← s 离开作用域，自动调用 drop()，内存释放

// 规则3：引用（借用）— 不转移所有权
let s1 = String::from("hello");
let len = calculate_length(&s1);   // 传递引用（借用 s1）
println!("{} has length {}", s1, len);  // ✅ s1 仍然可用

fn calculate_length(s: &String) -> usize {
    // s 只是借用的引用，离开作用域不会释放数据
    s.len()
}
```

**只读借用 `&T` vs 可变借用 `&mut T`**：

```rust
let mut s = String::from("hello");

// 可以有多个只读借用
let r1 = &s;
let r2 = &s;                     // ✅ 可以
println!("{} {}", r1, r2);

// 可变借用：有且只能有一个
let r3 = &mut s;                 // ✅
r3.push_str(" world");
// let r4 = &mut s;              // ❌ 不能同时有两个可变借用
// println!("{}", r1);           // ❌ 在 r3 使用前，r1 不能再用

// 核心：同一时刻，要么一个可变引用，要么任意多个只读引用
```

**✅ 本项目中的例子** (`commands/config.rs:70-72`)：

```rust
pub async fn load_config(state: State<'_, AppState>) -> Result<...> {
    // State<'_, AppState> — 借用（不获取所有权）
    // Tauri 框架拥有 AppState，command 只是暂时借用
    let user_id = state.db.get_config("user_id")?   // &state 的只读借用
```

**Copy 类型**：简单类型（整数、布尔、char、元组(如果元素都是Copy的)）自动复制，不发生 move：

```rust
let x = 5;
let y = x;                       // x 是 i32，自动复制（Copy trait）
println!("{}", x);               // ✅ 仍然可用

// Copy 类型包括：i8~i64、u8~u64、f32、f64、bool、char、tuple(如果全部 Copy)
// 非 Copy 类型：String、Vec、自定义 struct（除非 derive(Copy)）
```

### 1.7 控制流

```rust
// ---- if / else ----
let n = 5;
if n < 0 {
    println!("负数");
} else if n > 0 {
    println!("正数");
} else {
    println!("零");
}

// if 是表达式（有返回值）—— Rust 特色！
let result = if n >= 0 { "非负" } else { "负" };
//            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 两个分支必须返回相同类型

// ---- loop（无限循环）----
let mut count = 0;
loop {
    count += 1;
    if count == 10 { break; }
}

// loop 也能返回值
let result = loop {
    count += 1;
    if count == 20 {
        break count * 2;         // break 带值 = loop 的返回值
    }
};

// ---- while ----
let mut n = 3;
while n > 0 {
    println!("{}", n);
    n -= 1;
}

// ---- for（最常用）----
let arr = [10, 20, 30, 40];
for element in arr.iter() {      // .iter() 返回迭代器（借用元素）
    println!("{}", element);
}

for i in 0..5 {                  // 0..5 = Range
    println!("{}", i);           // 0, 1, 2, 3, 4
}
```

**✅ 本项目中的例子**：

```rust
// db/mod.rs — 批量插入循环
for (date, is_workday, has_report, checked_at, status) in records {
    conn.execute("INSERT INTO ...", params![...])?;
}

// dingtalk/report.rs — 重试循环
for attempt in 1..=max_retries {   // 1..=3 表示包含上界
    match api_call().await {
        Ok(result) => return Ok(result),
        Err(e) => last_error = e,
    }
}

// holiday/mod.rs — 遍历数据源
for (i, url) in urls.iter().enumerate() {  // enumerate 带索引
    // fallback 策略
}
```

### 1.8 结构体（Struct）、枚举（Enum）、Match

#### 结构体

```rust
// 命名结构体
struct User {
    username: String,
    email: String,
    active: bool,
}

let user1 = User {
    email: String::from("a@b.com"),
    username: String::from("alice"),
    active: true,
};

// 元组结构体（无字段名）
struct Color(i32, i32, i32);
let black = Color(0, 0, 0);
println!("{}", black.0);         // 用索引访问

// 单元结构体（无字段，只做标记用）
struct AlwaysValid;
```

**`impl` 块** — 给结构体定义方法：

```rust
impl User {
    // 关联函数（构造函数）— 没有 self，用 Self 指代类型名
    pub fn new(name: &str, email: &str) -> Self {
        Self {
            username: name.to_string(),
            email: email.to_string(),
            active: true,
        }
    }

    // 方法 — 第一个参数是 &self（只读借用）
    pub fn is_active(&self) -> bool {
        self.active
    }

    // 可变借用方法
    pub fn deactivate(&mut self) {
        self.active = false;
    }
}

let u = User::new("alice", "a@b.com");  // 调用关联函数
println!("{}", u.is_active());           // 调用方法
```

**✅ 本项目中的例子** (`db/mod.rs:16-19`)：

```rust
pub struct Database {
    conn: Mutex<Connection>,   // Mutex 保证线程安全
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> { ... }
    pub fn set_config(&self, key: &str, value: &str) -> Result<(), String> { ... }
    pub fn get_config(&self, key: &str) -> Result<Option<String>, String> { ... }
}
```

#### 枚举

Rust 的枚举比大多数语言的枚举强大得多——每个变体可以**携带数据**：

```rust
// 简单枚举
enum TrafficLight { Red, Green, Yellow }
let light = TrafficLight::Red;

// 带数据的枚举（代数数据类型 / ADT）
enum Message {
    Quit,                                  // 无数据
    Move { x: i32, y: i32 },              // 命名字段
    Write(String),                         // 元组字段
    ChangeColor(i32, i32, i32),
}
let msg = Message::Write(String::from("hi"));

// Rust 标准库中的 Option 和 Result —— 没有 null！
enum Option<T> {                    // 可能有值 / 可能没有
    Some(T),
    None,
}

enum Result<T, E> {                 // 可能成功 / 可能失败
    Ok(T),
    Err(E),
}
```

**✅ 本项目中的例子**：

```rust
// commands/check.rs — Option 表示月份可选
pub async fn run_check(
    month: Option<String>,  // None = 默认当前月，Some("2026-05") = 指定月
) -> Result<serde_json::Value, String> {  // Result = 可能出错

// db/mod.rs — 查询可能找不到
pub fn get_config(&self, key: &str) -> Result<Option<String>, String>
//                                          ^^^^^^^^^^^^^^^^^^^^^^^
//                           Ok(None) = 成功但没数据     Ok(Some(v)) = 找到了
```

#### Match 模式匹配

`match` 是 Rust 中最强大的控制流——穷尽所有变体：

```rust
// 匹配枚举
let config_result: Option<String> = db.get_config("app_key")?;
match config_result {
    Some(value) => println!("找到了: {}", value),
    None => println!("没有找到"),
}

// 匹配 Result
match db.get_config("app_key") {
    Ok(Some(value)) => { /* 成功 + 有值 */ }
    Ok(None) => { /* 成功但没数据 */ }
    Err(e) => { /* 出错了 */ }
}

// 通配符 _
let x = 5;
match x {
    1 => println!("一"),
    2 => println!("二"),
    _ => println!("其他"),  // 匹配所有其他值（必须覆盖全部分支！）
}

// if let — match 的语法糖（只关心一种情况时用）
if let Some(value) = config_result {
    println!("找到了: {}", value);
} else {
    println!("没找到");
}
```

**✅ 本项目中的例子** (`db/mod.rs:110-117`)：

```rust
let result = stmt.query_row(params![key], |row| row.get::<_, String>(0));
match result {
    Ok(value) => Ok(Some(value)),                              // 找到了
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),     // 没有这行
    Err(e) => Err(format!("读取配置失败: {}", e)),              // 其他错误
}
```

### 1.9 错误处理：`Result` + `?` 运算符

Rust 没有异常（try/catch），而是用 `Result` + `?` 显式处理错误：

```rust
// 不用 ? 的手动写法（很啰嗦）
fn read_config() -> Result<String, String> {
    let conn = match lock_database() {
        Ok(c) => c,
        Err(e) => return Err(format!("锁失败: {}", e)),
    };
    let value = match query_db(&conn, "key") {
        Ok(v) => v,
        Err(e) => return Err(format!("查询失败: {}", e)),
    };
    Ok(value)
}

// 用 ? 的简洁写法（等价于上面）
fn read_config() -> Result<String, String> {
    let conn = lock_database()
        .map_err(|e| format!("锁失败: {}", e))?;  // ? 遇到 Err 就向上传播
    let value = query_db(&conn, "key")
        .map_err(|e| format!("查询失败: {}", e))?;
    Ok(value)
}
```

`?` 的工作机制：
1. 如果结果是 `Ok(v)` → 提取出 `v`，继续执行
2. 如果结果是 `Err(e)` → 立即 `return Err(e)`，当前函数结束

**什么时候用 `map_err`？** 当错误类型不匹配时：
```rust
let conn = self.conn.lock().map_err(|e| format!("锁定失败: {}", e))?;
//                    ^^^^^^^^

//  self.conn.lock() → Result<MutexGuard, PoisonError>
//  但函数返回 → Result<_, String>
//  所以需要 map_err 把 PoisonError 转成 String
```

### 1.10 常用集合类型

```rust
// ---- Vec（动态数组 / 列表）----
let mut v: Vec<i32> = Vec::new();
v.push(1);                       // 追加
v.push(2);
v.push(3);
println!("{}", v[0]);            // 索引访问（注：越界会 panic）
println!("{:?}", v.get(2));      // 安全访问：返回 Option<&i32>
// Some(3)

let v2 = vec![1, 2, 3];          // vec! 宏创建
for item in &v2 { ... }          // 只读遍历
for item in &mut v2 { ... }      // 可变遍历

// ---- HashMap（键值对）----
use std::collections::HashMap;

let mut map = HashMap::new();
map.insert("key1", "value1");
map.insert("key2", "value2");

let val = map.get("key1");       // 返回 Option<&&str>
match val {
    Some(v) => println!("{}", v),
    None => println!("not found"),
}
```

**✅ 本项目中的例子** (`engine/checker.rs:84-87`)：

```rust
use std::collections::HashMap;
let mut date_info: HashMap<String, (bool, bool)> = HashMap::new();
// date → (has_report, is_backfilled)
for s in &stats {
    date_info.insert(s.stat_date.clone(), (s.has_report, s.is_backfilled));
}
```

### 1.11 迭代器与闭包

```rust
// 迭代器方法链（函数式风格，非常常用）
let nums = vec![1, 2, 3, 4, 5];

// map：转换
let doubled: Vec<i32> = nums.iter().map(|n| n * 2).collect();
// → [2, 4, 6, 8, 10]

// filter：过滤
let evens: Vec<&i32> = nums.iter().filter(|n| **n % 2 == 0).collect();
// → [2, 4]

// find：查找第一个
let first = nums.iter().find(|n| **n > 3);
// → Some(&4)

// any / all：判断
let has_big = nums.iter().any(|n| *n > 10);   // false
let all_positive = nums.iter().all(|n| *n > 0); // true

// 闭包 = 匿名函数 |参数| { 函数体 }
let add_one = |x: i32| x + 1;
println!("{}", add_one(5));      // 6
// 简单闭包省略花括号：|x| x + 1
```

**✅ 本项目中的例子** (`commands/check.rs:122-130`)：

```rust
let workdays: Vec<_> = records.iter().filter(|(_, w, _, _, _)| *w).collect();
//                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                      闭包过滤：保留 is_workday=true 的记录

let submitted = workdays.iter().filter(|(_, _, r, _, _)| *r).count();
//                                                         ^^^^^
//                                      统计 has_report=true 的数量
```

### 1.12 模块系统（mod）

Rust 用 `mod` 组织代码：

```
src-tauri/src/
├── lib.rs            → 声明 mod commands; mod db; mod engine; ...
├── commands/
│   ├── mod.rs        → pub mod check; pub mod config; pub mod report;
│   ├── check.rs
│   ├── config.rs
│   └── report.rs
├── dingtalk/
│   ├── mod.rs        → pub mod auth; pub mod report; pub mod notify;
│   ├── auth.rs
│   ├── report.rs
│   └── notify.rs
```

关键规则：
- 每个 `.rs` 文件是一个模块
- `mod.rs` 声明子模块列表：`pub mod check;`
- `pub` 表示公开（可被外部引用），不加 `pub` 则模块私有
- 顶部用 `use` 引入其他模块的项

```rust
// lib.rs
mod commands;           // 声明 commands 模块（Rust 会找 commands/mod.rs）
mod db;                 // 声明 db 模块（Rust 会找 db/mod.rs）

// commands/mod.rs
pub mod check;          // 公开子模块（允许其他地方 use crate::commands::check）

// commands/check.rs
use crate::AppState;              // 从 crate 根引用
use crate::engine::checker;       // 引用 engine 模块的 checker 子模块
use chrono::{Datelike, Local};   // 从 chrono crate 引用多个项
```

### 1.13 属性宏（#[...]）和派生宏

```rust
// derive — 自动生成 trait 实现
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig { ... }
//      ^^^^^ 自动实现 Debug（可用 {:?} 打印）
//                ^^^^^ 自动实现 Clone（克隆对象）
//                       ^^^^^^^^^^^^^ 自动实现 JSON 序列化/反序列化

// 属性宏 — 控制编译行为
#[tauri::command]          // 将函数标记为 Tauri IPC 命令
#[cfg(test)]               // 条件编译：仅 cargo test 时包含
#[allow(dead_code)]        // 抑制"未使用代码"警告
#[cfg_attr(mobile, tauri::mobile_entry_point)]  // 仅在 mobile 平台生效

// 在测试中使用
#[cfg(test)]
mod tests {
    #[test]
    fn test_something() { ... }
}
```

**✅ 本项目中的例子** — 每个 command 函数前都有 `#[tauri::command]` (`src/commands/check.rs:13-14`)：

```rust
#[tauri::command]
pub async fn run_check(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<serde_json::Value, String> {
```

### 1.14 并发：Arc + Mutex/RwLock + async/await

本项目中 Rust 后端需要处理多个并发场景：前端请求、网络 API 调用、定时任务。

#### 智能指针

```rust
// Box — 堆分配（最简单，单线程）
let b = Box::new(5);

// Rc — 引用计数（单线程多所有者）
use std::rc::Rc;
let a = Rc::new(String::from("hello"));
let b = Rc::clone(&a);   // 引用计数 +1

// Arc — 原子引用计数（多线程版 Rc）
use std::sync::Arc;
let a = Arc::new(String::from("hello"));
let b = Arc::clone(&a);   // 线程安全的引用计数 +1
```

#### 锁

```rust
use std::sync::{Arc, Mutex, RwLock};

// Mutex — 互斥锁（一次只一个线程访问）
let counter = Arc::new(Mutex::new(0));
let c = Arc::clone(&counter);
std::thread::spawn(move || {
    let mut num = c.lock().unwrap();  // 获取锁
    *num += 1;                         // 修改数据
});  // 离开作用域自动释放锁（不需要手动 unlock！）

// RwLock — 读写锁（多读单写，比 Mutex 并发更好）
let cache = Arc::new(RwLock::new(None));
let val = cache.read().await;    // 多个读可以并发
let mut val = cache.write().await;  // 写时独占
```

**✅ 本项目中的例子** (`dingtalk/auth.rs:14-18`)：

```rust
pub struct TokenCache {
    token: Arc<RwLock<Option<String>>>,     // 多个 task 可同时读 token
    expires_at: Arc<RwLock<i64>>,            // 读写锁保护时间戳
    app_key: Arc<RwLock<String>>,
    app_secret: Arc<RwLock<String>>,
}
// 为什么用 RwLock 而不是 Mutex？
// → TokenCache 读多写少（每次 API 调用都要读 token，但只在过期时写）
// → RwLock 允许多个请求同时读 token 缓存，互不阻塞
```

#### async/await

```rust
// async fn → 返回一个 Future（类似 JS 的 Promise）
async fn fetch_user(id: i64) -> Result<User, String> {
    let resp = reqwest::get("...").await?;    // .await = 等待 Future 完成
    let user: User = resp.json().await?;       // .await 不阻塞线程！
    Ok(user)
}

// 并发执行多个 Future
let (user1, user2) = tokio::join!(
    fetch_user(1),
    fetch_user(2),
);  // 同时发起两个请求

// tokio::spawn — 在 Tokio 运行时中启动新任务
tauri::async_runtime::spawn(async move {
    // 后台任务
    scheduler::start(app_handle);
});
```

**✅ 本项目中的例子** (`lib.rs:65-77`)：

```rust
tauri::async_runtime::spawn(async move {
    // 后台加载配置到 token_cache
    if let Ok(Some(app_key)) = db.get_config("app_key") {
        let app_secret = db.get_config("app_secret")...;
        token_cache.set_credentials(app_key, app_secret).await;
    }
    // 启动定时调度器
    scheduler::start(app_handle);
});
```

### 1.15 Rust 易混淆概念速查

| 概念 | 一句话解释 | 类比 |
|------|-----------|------|
| `let` | 声明变量绑定（默认不可变） | `const x = 5` |
| `let mut` | 声明可变变量 | `let x = 5` |
| `&T` | 只读引用（借用） | 只读指针 |
| `&mut T` | 可变引用（独占借用） | 可写指针 |
| `String` | 堆上的可变字符串 | Java `StringBuilder` |
| `&str` | 字符串切片/视图 | Python 的字符串 |
| `Vec<T>` | 动态数组 | Python `list` / JS `Array` |
| `Option<T>` | 可能没有的值（替代 null） | `T | null` |
| `Result<T,E>` | 可能失败的操作（替代 try/catch） | `Either<Ok, Error>` |
| `Some(v)` / `None` | Option 的变体 | `value` / `null` |
| `Ok(v)` / `Err(e)` | Result 的变体 | 正常值 / 异常 |
| `?` | 遇到 Err 就提前 return | 隐式 `throw` |
| `.unwrap()` | 取出值，遇 None/Err 就崩溃 | 不安全取 Optional.get() |
| `Arc<T>` | 多线程安全的引用计数指针 | `shared_ptr<T>` (C++) |
| `Mutex<T>` | 互斥锁（排他访问） | `synchronized` |
| `RwLock<T>` | 读写锁（多读单写） | `ReadWriteLock` |
| `clone()` | 深拷贝 | `deepCopy()` |

Rust 最独特的概念是**所有权系统**，它用三条规则管理内存：

```rust
// 规则1：每个值有且只有一个所有者（owner）
let s1 = String::from("hello");   // s1 拥有这个字符串
let s2 = s1;                       // 所有权转移给 s2
// println!("{}", s1);            // ❌ 编译错误！s1 已经失效

// 规则2：引用（借用） — 不转移所有权
let s1 = String::from("hello");
let s2 = &s1;                      // s2 借用了 s1，不转移所有权
println!("{}", s1);                // ✅ 仍然可用

// 规则3：可变引用有且只能有一个
let mut s = String::from("hello");
let r1 = &mut s;                   // 可变借用
// let r2 = &mut s;                // ❌ 不能同时有两个可变借用
```

**✅ 本项目中的例子** (`src/commands/check.rs:15-16`)：

```rust
pub async fn run_check(
    state: State<'_, AppState>,  // 'state' 借用了 Tauri 管理的 AppState
    month: Option<String>,        // 'month' 拥有了这个字符串
) -> Result<serde_json::Value, String> {
```

- `State<'_, AppState>` 中的 `'_` 是生命周期标注，表示这个引用的存活时间
- `Option<String>` 表示"可能有的字符串"，`None` 表示没有

### 1.3 常用类型速查

| Rust 类型 | 含义 | 本项目中的例子 |
|-----------|------|---------------|
| `String` | 可变长度的字符串 | `"2026-06".to_string()` |
| `&str` | 字符串切片（引用） | `"日报"` — 字面量 |
| `i32` / `i64` | 32位/64位有符号整数 | 年份、时间戳 |
| `bool` | 布尔值 | `true` / `false` |
| `Vec<T>` | 动态数组 | `Vec<String>` — 字符串列表 |
| `Option<T>` | 可能为空的值 | `Option<String>` → `None` 或 `Some("值")` |
| `Result<T, E>` | 可能成功或失败 | `Result<(), String>` → `Ok(())` 或 `Err("错误")` |

**✅ 本项目中的例子** (`src/db/mod.rs:104-117`)：

```rust
pub fn get_config(&self, key: &str) -> Result<Option<String>, String> {
    //                   ^^^^       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                   参数借用      返回：成功→Option<String>，失败→String错误信息
    let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;
    // ...
    match result {
        Ok(value) => Ok(Some(value)),   // 找到配置 → 返回 Some(值)
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),  // 没找到 → None
        Err(e) => Err(format!("读取配置失败: {}", e)),  // 出错 → 错误信息
    }
}
```

### 1.4 结构体（Struct）与实现（impl）

结构体是自定义数据类型，`impl` 块给它添加方法：

```rust
// 定义结构体（类似其他语言的 class）
#[derive(Debug, Clone)]       // 自动实现 Debug 和 Clone trait
pub struct TokenCache {
    token: Arc<RwLock<Option<String>>>,   // Arc = 多线程共享指针
    expires_at: Arc<RwLock<i64>>,          // RwLock = 读写锁
}

// 为结构体实现方法
impl TokenCache {
    pub fn new() -> Self {  // 'Self' = TokenCache
        Self {
            token: Arc::new(RwLock::new(None)),
            expires_at: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn get_token(&self) -> Result<String, String> {
        // &self 表示方法借用自身（不获取所有权）
        // ...
    }
}
```

**✅ 本项目中的例子** (`src/dingtalk/auth.rs:13-103`)：`TokenCache` 结构体封装了钉钉 access_token 的缓存逻辑。

### 1.5 模式匹配（match）— Rust 的 switch

```rust
match result {
    Ok(value) => Ok(Some(value)),                              // 成功分支
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),     // 特定错误分支
    Err(e) => Err(format!("读取失败: {}", e)),                  // 其他错误分支
}
```

match 要求**穷尽所有可能性**（编译器会检查），这极大减少了运行时 bug。

### 1.6 `?` 运算符 — 错误传播

```rust
// 不用 ? 的写法
let conn = match self.conn.lock() {
    Ok(c) => c,
    Err(e) => return Err(format!("锁定失败: {}", e)),
};

// 用 ? 的写法（等价于上面）
let conn = self.conn.lock().map_err(|e| format!("锁定失败: {}", e))?;
```

`?` 在遇到 `Err` 时立即返回错误，遇 `Ok` 则提取值。这是 Rust 最常用也最容易搞混的语法之一。

### 1.7 属性宏（#[...]）

```rust
#[tauri::command]                    // 标记为 Tauri 命令（前端可调用）
#[derive(Debug, Clone, serde::Serialize)]  // 自动生成代码
#[cfg(test)]                         // 条件编译（仅在测试时包含）
mod tests { ... }
```

**✅ 本项目中的例子** — 每个 command 函数前都有 `#[tauri::command]` (`src/commands/check.rs:13-14`)：

```rust
#[tauri::command]
pub async fn run_check(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<serde_json::Value, String> {
```

---

## 2. Tauri v2 框架入门

### 2.1 Tauri 是什么？

Tauri 是一个**用 Web 技术写 UI、用 Rust 写后端的桌面应用框架**。类比：

| 框架 | 前端 | 后端 | 包体积 |
|------|------|------|--------|
| Electron | HTML/JS/CSS | Node.js | ~120MB |
| **Tauri v2** | HTML/JS/CSS | **Rust** | ~5MB |

Tauri 用操作系统的原生 WebView（macOS 用 WKWebView，Windows 用 WebView2）渲染前端，所以包体积极小。

### 2.2 从零搭建一个 Tauri v2 项目

这是创建一个新 Tauri 项目的标准流程：

```bash
# 方式1：使用 create-tauri-app（推荐）
npm create tauri-app@latest my-app

# 交互式选择：
# → 框架：React / Vue / Svelte / Vanilla
# → 语言：TypeScript / JavaScript
# → 包管理器：npm / yarn / pnpm

# 方式2：在已有前端项目中添加 Tauri
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install @tauri-apps/cli@latest @tauri-apps/api@latest
npx tauri init
# → 交互式配置：App name, Window title, dev server URL, frontend dist, etc.

# 开发运行
npx tauri dev                   # 同时启动 Vite + Rust 后端

# 生产打包
npx tauri build                 # 生成 .dmg（macOS）/ .msi（Windows）/ .deb（Linux）
```

初始化后生成的标准项目结构：

```
my-app/
├── src/                    # 前端代码（React/Vue/Svelte/...）
│   ├── main.tsx            # 前端入口
│   ├── App.tsx             # 根组件
│   └── App.css
├── src-tauri/              # Rust 后端
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置（核心配置文件）
│   ├── build.rs            # 构建脚本
│   ├── capabilities/       # 权限声明（v2 新增）
│   │   └── default.json
│   ├── icons/              # 应用图标
│   └── src/
│       ├── main.rs         # Rust 入口
│       └── lib.rs          # 应用核心（Builder 链式调用）
├── public/
├── package.json
├── vite.config.ts
└── index.html
```

### 2.3 Tauri 的两端：前端进程 vs 后端进程

Tauri 应用由两个独立进程组成，它们通过 IPC（进程间通信）对话：

```
┌──────────────────────────────────────────────────────┐
│              WebView 进程（前端）                       │
│  你的 React/Vue 代码运行在这里                         │
│  类似在浏览器中运行，但不能访问所有浏览器 API           │
│                                                       │
│  可以做什么：                                          │
│  - DOM 操作、CSS 样式、动画                           │
│  - 调用 @tauri-apps/api 中的 invoke()                 │
│  - 大部分 Web API（fetch, localStorage, canvas...）    │
│                                                       │
│  不能做什么（需要授权）：                               │
│  - 直接访问文件系统（需要用 Tauri API）                 │
│  - 执行系统命令（需要用 Tauri plugin）                  │
│  - 访问数据库（需要通过 Rust command）                  │
│                                                       │
│  调用后端 ←→ invoke(), emit()                         │
└──────────────────────────────────────────────────────┘
                        ↕ IPC 通信
┌──────────────────────────────────────────────────────┐
│              Rust 进程（后端）                          │
│  拥有完整的系统权限                                    │
│                                                       │
│  可以做什么：                                          │
│  - 文件系统读写                                       │
│  - 数据库操作（SQLite、PostgreSQL...）                 │
│  - 网络请求（调用任意 HTTP API）                       │
│  - 系统操作（进程管理、通知、托盘图标...）              │
│                                                       │
│  接收前端请求 ←→ #[tauri::command] 函数               │
└──────────────────────────────────────────────────────┘
```

### 2.4 核心概念：tauri::command（IPC 通信）

`#[tauri::command]` 是 Tauri 中最关键的概念。标记这个属性后，Rust 函数就可以被前端通过 `invoke()` 调用。

#### 后端：定义 Command

```rust
// 最简单的 command — 无参数，返回 String
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

// 带全局状态的 command
#[tauri::command]
fn get_user(state: State<'_, AppState>, id: i64) -> Result<User, String> {
    let user = state.db.find_user(id)?;   // 使用注入的 AppState
    Ok(user)
}

// 异步 command（推荐 — 不阻塞主线程）
#[tauri::command]
async fn fetch_data(state: State<'_, AppState>) -> Result<Data, String> {
    let resp = reqwest::get("https://api.example.com/data")
        .await
        .map_err(|e| e.to_string())?;
    let data: Data = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

// 带 AppHandle 的 command（需要操作用户界面时） 
#[tauri::command]
async fn restart_app(app: AppHandle) {
    app.restart();  // 重启应用
}
```

#### 后端：注册 Command

**所有 command 必须在 `lib.rs` 的 `generate_handler![]` 中注册**，否则前端无法调用：

```rust
// lib.rs
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,              // ← 注册 commands::greet
            get_user,           // ← 注册 commands::get_user
            fetch_data,         // ← 注册 commands::fetch_data
            commands::check::run_check,         // 子模块的 command 需要用完整路径
            commands::config::save_config,
            commands::config::load_config,
            commands::report::submit_report,
        ])
        .run(tauri::generate_context!())
        .expect("启动失败");
}
```

**✅ 本项目中的例子** (`src-tauri/src/lib.rs:82-96`)：

```rust
.invoke_handler(tauri::generate_handler![
    commands::config::save_config,
    commands::config::load_config,
    commands::config::test_connection,
    commands::config::fetch_templates,
    commands::config::get_template_fields,
    commands::config::save_settings_and_restart,
    commands::config::sync_holidays,
    commands::config::get_holiday_list,
    commands::check::run_check,
    commands::check::get_current_status,
    commands::report::get_monthly_summary,
    commands::report::fetch_report_content,
    commands::report::submit_report,
])
```

#### 前端：调用 Command

```typescript
import { invoke } from "@tauri-apps/api/core";

// 基本调用 — 泛型标注返回类型
const greeting = await invoke<string>("greet", { name: "Alice" });
// → "Hello, Alice!"

// 带对象的调用
await invoke("save_config", {
    appKey: "dingxxx",
    appSecret: "secret123",
    userId: "user456",
    selectedTemplateIds: ["tpl001"],
    selectedTemplateName: "日报",
});

// 泛型标注复杂返回类型
interface CheckResponse {
    summary: { month: string; totalWorkdays: number; submitted: number; missing: number };
    days: DayInfo[];
}
const result = await invoke<CheckResponse>("run_check", { month: "2026-06" });

// 无参数的调用
const config = await invoke<AppConfig>("load_config");

// 错误处理
try {
    await invoke("run_check", { month: "2026-06" });
} catch (error) {
    console.error("检查失败:", error);
    // error 就是 Rust 返回的 Err(String) 中的字符串
}
```

**✅ 本项目中的例子** (`src/pages/CalendarView.tsx:36-42`)：

```tsx
const handleCheck = async () => {
    dispatch({ type: "SET_CHECKING", isChecking: true });
    try {
        const result = await invoke<CheckResponse>("run_check", {
            month: state.currentMonth,
        });
        dispatch({ type: "SET_CHECK_RESULT", days: result.days, summary: result.summary });
    } catch (e) {
        dispatch({ type: "SET_ERROR", error: String(e) });
    } finally {
        dispatch({ type: "SET_CHECKING", isChecking: false });
    }
};
```

### 2.5 参数序列化：Rust ↔ JSON 自动转换

Tauri 自动处理 Rust 类型与 JSON 之间的转换（通过 serde）：

```
前端 TypeScript                         后端 Rust
─────────────                          ─────────
string                  →→→            String
number                  →→→            i32 / i64 / f64  （由 Rust 参数类型决定）
boolean                 →→→            bool
null / undefined        →→→            Option<T>（前端不传或传 null）
Array                   →→→            Vec<T>
Object                  →→→            struct（需要 #[derive(Deserialize)]）
                        ←←←
String                  →→→            string
serde_json::Value       →→→            any（动态 JSON）
Result<T, String>       →→→            T 或 throw Error
```

关键点：
- **参数名用 camelCase**（前端）对应 Rust 的 **snake_case**（后端），Tauri 自动转换
- **`Option<T>`** 参数表示"可不传"，前端不传该字段 → Rust 收到 `None`
- **`Result<T, String>`** 返回值：`Ok(val)` → 前端得到 `val`；`Err(msg)` → 前端 `catch(e)` 得到 `msg`
- **`serde_json::Value`** 可以用来返回动态 JSON 结构（不需要预先定义 struct）

**✅ 本项目中的例子** (`commands/config.rs:164-169`)：

```rust
#[tauri::command]
pub async fn save_settings_and_restart(
    app: AppHandle,                      // Tauri 自动注入（不是前端传的）
    state: State<'_, AppState>,          // Tauri 自动注入
    app_key: String,                     // 前端传: appKey: "dingxxx"
    app_secret: String,                  // 前端传: appSecret: "secret"
    user_id: String,
    selected_template_id: String,
    selected_template_name: String,
) -> Result<(), String> {
```

### 2.6 应用生命周期（Builder 链式调用）

Tauri 应用通过 `tauri::Builder` 的链式调用构建：

```rust
pub fn run() {
    // 1. 初始化日志
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    ).init();

    // 2. 构建 Tauri 应用
    tauri::Builder::default()
        // ---- 插件 ----
        .plugin(tauri_plugin_shell::init())      // 让前端执行 shell 命令
        .plugin(tauri_plugin_sql::Builder::default().build())  // SQL 插件
        .plugin(tauri_plugin_process::init())     // 进程管理（重启等）

        // ---- 初始化 ----
        .setup(|app| {
            // 这里运行在 Rust 端，在前端加载之前
            // 典型用途：初始化数据库、创建目录、加载配置

            let app_data_dir = app.path().app_data_dir()?;
            let db = Database::new(app_data_dir)?;

            app.manage(AppState { db: Arc::new(db) });
            // ↑ 注册全局状态

            Ok(())
        })

        // ---- 注册 Commands ----
        .invoke_handler(tauri::generate_handler![
            commands::check::run_check,
            commands::config::save_config,
            // ... 所有 command 函数
        ])

        // ---- 启动 ----
        .run(tauri::generate_context!())
        .expect("启动失败");
}
```

**顺序很重要**：`plugin()` → `setup()` → `invoke_handler()` → `run()`

**✅ 本项目中的例子** (`src/lib.rs:34-99`) 完全遵循了这个模式。

### 2.7 全局状态管理（State 注入）

Tauri 通过 `app.manage()` 注册全局状态，通过 `State<'_, T>` 注入给 command：

```rust
// 1. 定义状态结构体
pub struct AppState {
    pub db: Arc<Database>,
    pub token_cache: Arc<TokenCache>,
}

// 2. 注册（在 setup 中）
app.manage(AppState {
    db: Arc::new(database),
    token_cache: Arc::new(TokenCache::new()),
});

// 3. 在 command 中获取（Tauri 自动注入）
#[tauri::command]
pub async fn load_config(
    state: State<'_, AppState>,  // ← Tauri 通过类型自动匹配
) -> Result<serde_json::Value, String> {
    state.db.get_config("app_key")?   // 使用数据库
}

// 也可以注入多个状态
#[tauri::command]
fn do_something(
    app_state: State<'_, AppState>,    // 应用状态
    window: tauri::Window,              // 当前窗口
    app_handle: AppHandle,              // 应用句柄
) -> Result<(), String> {
    // ...
}
```

**Tauri 可注入的类型**：

| 注入类型 | 用途 |
|----------|------|
| `State<'_, T>` | 你通过 `app.manage()` 注册的自定义状态 |
| `AppHandle` | 应用句柄（管理窗口、托盘、全局事件） |
| `tauri::Window` | 当前窗口（设置标题、大小、焦点） |

**✅ 本项目中的例子** — 每个 command 都使用 `State<'_, AppState>` 获取数据库和 token 缓存：

```rust
// commands/check.rs:14-15
pub async fn run_check(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<serde_json::Value, String> {
    // state.db — 数据库操作
    // state.token_cache — 钉钉 API 调用
```

### 2.8 插件系统（Plugin）

Tauri v2 的插件是可选的 Rust + JS 包，扩展应用能力：

```rust
// 注册插件（在 lib.rs 的 Builder 链中）
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())              // shell 命令执行
    .plugin(tauri_plugin_sql::Builder::default().build())  // SQL 数据库
    .plugin(tauri_plugin_process::init())             // 进程管理（重启）
    .plugin(tauri_plugin_notification::init())        // 系统通知
    .plugin(tauri_plugin_dialog::init())              // 文件对话框
    .plugin(tauri_plugin_fs::init())                  // 文件系统
    // ...
```

**✅ 本项目使用了 3 个插件**：

| 插件 | 用途 |
|------|------|
| `tauri_plugin_shell` | 预留 shell 命令执行能力 |
| `tauri_plugin_sql` | 备用 SQL 查询通道（本项目主要用 rusqlite） |
| `tauri_plugin_process` | `AppHandle::restart()` 重启应用能力 |

### 2.9 权限与能力系统（Capabilities）— v2 新增

Tauri v2 引入了显式的权限声明系统。在 `src-tauri/capabilities/` 目录下声明哪些 API 可用：

```json
// src-tauri/capabilities/default.json
{
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "默认权限集",
    "windows": ["main"],
    "permissions": [
        "core:default",            // Tauri 核心 IPC 功能
        "shell:allow-open",        // 允许用系统默认程序打开 URL
        "process:allow-restart",   // 允许重启应用
        "sql:default"              // SQL 插件权限
    ]
}
```

**如果你调用了一个未授权的 API，Tauri 会在运行时拒绝并报错。** 这是 Tauri v2 的安全模型核心。

### 2.10 事件系统（Event）— 后端主动推送消息给前端

除了前端 `invoke` → 后端响应外，Tauri 还支持**后端主动向后端推送事件**：

```rust
// 后端：emit 发射事件
use tauri::Emitter;

#[tauri::command]
async fn start_task(app: AppHandle) -> Result<(), String> {
    // 发射进度事件
    app.emit("task-progress", serde_json::json!({
        "percent": 50,
        "message": "处理中..."
    }))?;  // Emitter trait 需要 use tauri::Emitter;

    Ok(())
}
```

```typescript
// 前端：listen 监听事件
import { listen } from "@tauri-apps/api/event";

// 监听后端发射的事件
const unlisten = await listen("task-progress", (event) => {
    console.log("进度:", event.payload);
    // event.payload = { percent: 50, message: "处理中..." }
});

// 组件卸载时取消监听
unlisten();
```

### 2.11 配置文件详解：tauri.conf.json

这是 Tauri 的**核心配置文件**，控制应用的一切行为：

```json
{
    // ---- 基本信息 ----
    "productName": "日报守卫",            // 应用名称
    "version": "0.1.0",                  // 版本号
    "identifier": "com.dailyreport.guard", // 唯一标识符（反向域名）

    // ---- 构建配置 ----
    "build": {
        "beforeDevCommand": "npm run dev",    // 开发模式启动前：启动 Vite
        "beforeBuildCommand": "npm run build", // 打包前：构建前端
        "devUrl": "http://localhost:1420",     // 开发时前端地址
        "frontendDist": "../dist"              // 生产时前端产物目录
    },

    // ---- 应用配置 ----
    "app": {
        "withGlobalTauri": true,           // 使 @tauri-apps/api 全局可用

        // 窗口配置
        "windows": [{
            "title": "日报守卫",
            "width": 900,                  // 初始宽度
            "height": 750,                 // 初始高度
            "resizable": true,             // 可调整大小
            "center": true,                // 屏幕居中
            "minWidth": 600,               // 最小宽度
            "minHeight": 500               // 最小高度
        }],

        // 系统托盘
        "trayIcon": {
            "iconPath": "icons/icon.png",
            "iconAsTemplate": false        // macOS: 是否作为模板图标
        },

        // 安全策略
        "security": {
            "csp": null                    // 内容安全策略（null = 默认安全）
        }
    },

    // ---- 打包配置 ----
    "bundle": {
        "active": true,
        "targets": "all",                  // 所有平台格式
        "icon": [                          // 各尺寸图标
            "icons/32x32.png",
            "icons/128x128.png",
            "icons/icon.icns",             // macOS 图标
            "icons/icon.ico"               // Windows 图标
        ]
    }
}
```

**✅ 本项目中的例子** (`src-tauri/tauri.conf.json`)：

```json
{
  "productName": "日报守卫",
  "version": "0.1.0",
  "identifier": "com.dailyreport.guard",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [{
      "title": "日报守卫",
      "width": 900,
      "height": 750,
      "resizable": true,
      "center": true,
      "minWidth": 600,
      "minHeight": 500
    }],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": false
    },
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 2.12 Tauri 开发调试技巧

```bash
# 查看详细日志
RUST_LOG=debug npx tauri dev         # Rust 端 debug 级别日志
RUST_LOG=info npx tauri dev          # Rust 端 info 级别日志（默认）

# 仅检查 Rust 代码能否编译（不启动应用）
cargo check --manifest-path src-tauri/Cargo.toml

# 仅检查前端 TypeScript
npx tsc --noEmit

# 查看 Cargo 依赖树
cargo tree --manifest-path src-tauri/Cargo.toml

# 清理构建缓存
cargo clean --manifest-path src-tauri/Cargo.toml
rm -rf src-tauri/target
```

**前端调试**：
- 开发模式下，右键 WebView → 检查元素 → 打开开发者工具（和浏览器调试一样）
- `console.log()` 输出到终端（`npx tauri dev` 的终端窗口）
- 网络请求通过 Rust 发出（`reqwest`），不在浏览器 Network 面板中显示

**Rust 端打印日志**（前端不可见，只在终端中显示）：

```rust
log::info!("日报守卫启动中...");
log::debug!("模板列表原始响应: {}", json_str);  // 仅在 RUST_LOG=debug 时可见
log::warn!("节假日数据源不可用，降级为周一至周五");
log::error!("保存配置失败: {}", e);
```

### 2.13 Tauri 前端 API 速查

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";

// IPC 调用后端
const result = await invoke<ReturnType>("command_name", { arg: "value" });

// 监听后端事件
const unlisten = await listen<PayloadType>("event-name", (event) => {
    console.log(event.payload);
});
unlisten();  // 取消监听

// 前端发射事件（后端可以监听）
await emit("frontend-event", { data: "hello" });
```

### 2.14 多窗口和系统托盘

Tauri 支持多窗口和系统托盘，本项目使用了托盘图标：

```rust
// 系统托盘 + 菜单
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

// 在 setup 中创建托盘
TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .tooltip("日报守卫")
    .on_tray_icon_event(|tray, event| {
        if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
            // 点击托盘图标时显示窗口
        }
    })
    .build(app)?;
```

### 2.15 Tauri 核心概念速查

| 概念 | 一句话解释 | 在这个项目中 |
|------|-----------|-------------|
| `#[tauri::command]` | 标记 Rust 函数为前端可调用的 IPC 端点 | 每个 command 文件中的函数 |
| `invoke("name", {args})` | 前端调用后端 command | 所有 `.tsx` 文件中随处可见 |
| `tauri::Builder` | 应用的构建器（链式配置 plugins/setup/commands） | `lib.rs:38-97` |
| `.plugin(...)` | 注册 Tauri 插件 | `lib.rs:39-41` |
| `.setup(\|app\| {...})` | 初始化回调（前端加载前执行） | `lib.rs:42-78` |
| `app.manage(state)` | 注册全局状态 | `lib.rs:58-61` |
| `State<'_, T>` | command 中获取全局状态 | 每个 command 函数参数 |
| `AppHandle` | 应用句柄（窗口/托盘/事件管理） | `lib.rs:64` |
| `generate_handler![]` | 注册所有 command 函数 | `lib.rs:82-96` |
| `generate_context!()` | 读取 tauri.conf.json 生成应用上下文 | `lib.rs:97` |
| `emit("event", payload)` | 后端发射事件给前端 | — |
| `tauri.conf.json` | 核心配置文件 | `src-tauri/tauri.conf.json` |
| Capabilities | v2 的权限声明系统 | `src-tauri/capabilities/` |

---

## 3. React 快速入门

### 3.1 React 是什么？

React 是一个**声明式 UI 库**。你描述"UI 应该长什么样"（基于当前数据），React 负责高效更新 DOM。

核心理念：
- **组件化**：UI 拆分为独立、可复用的小块
- **单向数据流**：数据从父组件流向子组件
- **声明式**：`UI = f(state)`，状态变了 UI 自动更新

### 3.2 JSX — 在 JavaScript 中写 HTML

JSX 是 JavaScript 的语法扩展，看起来像 HTML：

```tsx
// JSX 本质上是函数调用
<div style={{ color: "red" }}>Hello</div>
// 等价于
React.createElement("div", { style: { color: "red" } }, "Hello");
```

注意：JSX 中 `{}` 表示嵌入 JavaScript 表达式，双层 `{}` 表示"嵌入一个对象字面量"。

**✅ 本项目中的例子** (`src/components/DayCell.tsx:71-92`)：

```tsx
return (
  <div onClick={/* ... */} style={cellStyle}>
    {status === "missing" && <div style={bar} />}   {/* 条件渲染 */}
    <span style={numStyle}>{dayNum}</span>
  </div>
);
```

### 3.3 组件 — 函数返回 JSX

React 组件就是一个**返回 JSX 的函数**：

```tsx
// 函数组件（现代写法）
interface DayCellProps {
  day: DayInfo;        // 输入参数（props）
  isSelected: boolean;
}

export default function DayCell({ day, isSelected }: DayCellProps) {
  const dayNum = parseInt(day.date.split("-")[2], 10);
  // 组件内部可以有自己的逻辑
  return <div>{dayNum}</div>;  // 返回要渲染的 UI
}
```

**本项目中的组件树**：

```
App
├── AppProvider (Context 提供者)
│   └── AppInner
│       ├── SetupWizard (首次配置向导)
│       └── CalendarView (主页面)
│           ├── Calendar
│           │   └── DayCell (每个日期格子)
│           ├── DayDetail (日期详情弹窗)
│           ├── SummaryBar (底部汇总条)
│           └── SettingsModal (设置面板)
```

### 3.4 Hooks — 给函数组件增加"超能力"

Hooks 是 React 最重要的概念之一。它们是 `useXxx` 开头的函数。

#### useState — 组件内部状态

```tsx
const [count, setCount] = useState(0);  // 初始值 0
//      ^^^^^  ^^^^^^^^
//      当前值   更新函数

// 读取
<span>{count}</span>

// 更新（触发重渲染）
setCount(count + 1);
```

**✅ 本项目中的例子** (`src/components/SettingsModal.tsx:16-18`)：

```tsx
const [appKey, setAppKey] = useState(config.appKey);
// 文本框输入时更新
<input value={appKey} onChange={e => setAppKey(e.target.value)} />
```

#### useEffect — 副作用（网络请求、订阅等）

```tsx
// 第二个参数 [] 表示只在组件挂载时执行一次
useEffect(() => {
    async function loadConfig() {
        const config = await invoke<AppConfig>("load_config");
        // ...
    }
    loadConfig();
}, []);  // ← 依赖数组

// 第二个参数 [day.date] 表示 day.date 变化时重新执行
useEffect(() => {
    // 获取日报内容
    fetchContent();
}, [day.date]);
```

#### useMemo — 缓存计算结果

```tsx
const monthLabel = useMemo(() => {
    // 只有 state.currentMonth 变化时才重新计算
    const [y, m] = state.currentMonth.split("-").map(Number);
    return `${y}年${m}月`;
}, [state.currentMonth]);
```

#### useReducer — 复杂状态管理

当状态逻辑复杂时，用 `useReducer` 替代多个 `useState`：

```tsx
// 定义 reducer（状态转换函数）
function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case "SET_CHECK_RESULT":
            return { ...state, days: action.days, summary: action.summary };
        case "SET_ERROR":
            return { ...state, lastError: action.error };
        default:
            return state;
    }
}

// 使用
const [state, dispatch] = useReducer(appReducer, initialState);

// 触发状态变更（不直接改 state，而是 dispatch 一个 action）
dispatch({ type: "SET_CHECK_RESULT", days: result.days, summary: result.summary });
```

**✅ 本项目使用 useReducer 管理全局状态** (`src/context/AppContext.tsx:28-55`)。

### 3.5 React Context — 全局状态共享

Context 让数据不需要通过 props 逐层传递：

```tsx
// 1. 创建 Context
const AppContext = createContext<AppContextType>({ state, dispatch });

// 2. 提供数据（在组件树顶层）
<AppContext.Provider value={{ state, dispatch }}>
    {children}  {/* 所有子组件都能访问 */}
</AppContext.Provider>

// 3. 消费数据（在任意子组件中）
const { state, dispatch } = useContext(AppContext);
```

**✅ 本项目中的例子** (`src/context/AppContext.tsx`) — 完整实现了 Provider + useReducer + Hook 模式。

### 3.6 TypeScript 类型

本项目使用 TypeScript，给 JavaScript 加上了类型标注：

```typescript
// 联合类型（union type）
type DayStatus = "submitted" | "missing" | "warning" | "future" | "non_workday";

// 接口（interface）
interface DayInfo {
    date: string;
    status: DayStatus;
    isWorkday: boolean;
    hasReport: boolean;
}

// 泛型（generic）
const config = await invoke<AppConfig>("load_config");  // 指定返回类型
```

---

## 4. 项目实战：三者如何结合

### 4.1 完整数据流

用一个具体场景说明数据如何在三层间流动：

**场景：用户点击"检查"按钮，查看本月日报状态**

```
第1步：前端事件触发
   CalendarView.tsx: handleCheck()
   → dispatch({ type: "SET_CHECKING", isChecking: true })
   → UI 显示 "检查中..."

第2步：前端调用后端
   CalendarView.tsx: invoke("run_check", { month: "2026-06" })
   → 通过 Tauri IPC 发送 JSON 到 Rust

第3步：Rust 处理业务逻辑
   commands/check.rs: run_check()
   → 读取数据库配置（db.get_config）
   → 获取节假日数据（holiday::get_or_fetch_holiday_data）
   → 调用钉钉 API（dingtalk/report.rs → 拉取本月日志列表）
   → 执行检查引擎（engine/checker.rs → 对比工作日与已提交）
   → 将结果写入数据库（db.update_daily_status）
   → 返回 JSON 给前端

第4步：前端更新 UI
   CalendarView.tsx: dispatch({ type: "SET_CHECK_RESULT", ... })
   → state.days 和 state.summary 更新
   → Calendar 组件重新渲染 → 每个 DayCell 更新颜色
   → SummaryBar 更新统计数据
```

### 4.2 关键文件对照表

| 功能 | 前端文件 | 后端文件 |
|------|----------|----------|
| 应用入口 | `src/main.tsx` → `src/App.tsx` | `src-tauri/src/main.rs` → `lib.rs` |
| 类型定义 | `src/types/index.ts` | 各 `.rs` 文件中的 struct |
| 配置管理 | `SetupWizard.tsx` + `SettingsModal.tsx` | `commands/config.rs` |
| 日报检查 | `CalendarView.tsx` → `invoke("run_check")` | `commands/check.rs` |
| 检查引擎 | — | `engine/checker.rs` + `engine/workday.rs` |
| 节假日 | 日历中的颜色标记 | `holiday/mod.rs` |
| 钉钉 API | — | `dingtalk/auth.rs` + `report.rs` + `notify.rs` |
| 数据库 | — | `db/mod.rs` (SQLite via rusqlite) |
| 状态管理 | `context/AppContext.tsx` (useReducer) | — |
| 定时任务 | — | `scheduler.rs` |
| UI 组件 | `components/*.tsx` | — |

### 4.3 关键技术要点

#### IPC 通信约定

- 前端始终通过 `invoke("函数名", { 参数 })` 调用后端
- 后端函数必须注册在 `lib.rs` 的 `generate_handler![]` 中
- 返回值自动序列化：Rust struct → serde_json → JSON → TypeScript 类型
- 错误处理：Rust 返回 `Err(String)` → 前端 `catch (e)` 捕获

#### 异步处理

两端都是异步的，但语法不同：

| | Rust | TypeScript |
|---|------|-----------|
| 关键字 | `async fn` / `.await` | `async function` / `await` |
| 运行时 | Tokio | 浏览器事件循环 |
| 错误 | `Result<T, E>` + `?` | `try/catch` |

#### 数据库设计

```
config 表         — 键值对存储（AppKey, AppSecret, UserID等）
daily_status 表   — 每日检查结果缓存（日期, 是否工作日, 是否已提交, 状态）
report_records 表 — 从钉钉同步的提交记录
holiday_cache 表  — 节假日数据缓存（日期, 是否假期, 名称）
```

### 4.4 项目目录结构总览

```
ding-daily-report/
├── src/                          # 前端（React + TypeScript）
│   ├── main.tsx                  # 前端入口（ReactDOM.createRoot）
│   ├── App.tsx                   # 根组件（路由：配置页 / 日历页）
│   ├── types/index.ts            # 全局类型定义
│   ├── context/AppContext.tsx     # 全局状态（useReducer + Context）
│   ├── pages/
│   │   ├── SetupWizard.tsx       # 首次配置向导（3步骤）
│   │   └── CalendarView.tsx      # 日历主页面
│   └── components/
│       ├── Calendar.tsx          # 月历网格
│       ├── DayCell.tsx           # 单个日期格子
│       ├── DayDetail.tsx         # 日期详情弹窗（查看/编辑）
│       ├── SummaryBar.tsx        # 底部状态汇总条
│       └── SettingsModal.tsx     # 设置面板
│
├── src-tauri/                    # 后端（Rust）
│   ├── Cargo.toml                # Rust 依赖管理（类似 package.json）
│   ├── tauri.conf.json           # Tauri 配置（窗口、打包、安全策略）
│   ├── build.rs                  # 构建脚本
│   └── src/
│       ├── main.rs               # Rust 入口（调用 lib.rs::run）
│       ├── lib.rs                # 应用核心（注册 plugins、commands、state）
│       ├── scheduler.rs          # 定时检查调度器
│       ├── commands/             # Tauri Commands（前端可调用）
│       │   ├── mod.rs            # 模块声明
│       │   ├── check.rs          # 日报检查
│       │   ├── config.rs         # 配置管理
│       │   └── report.rs         # 日报内容获取/提交
│       ├── engine/               # 业务引擎
│       │   ├── mod.rs
│       │   ├── checker.rs        # 检查引擎（对比工作日与已提交）
│       │   └── workday.rs        # 工作日判定
│       ├── dingtalk/             # 钉钉 API 对接
│       │   ├── mod.rs
│       │   ├── auth.rs           # access_token 管理
│       │   ├── report.rs         # 日志模板/列表/创建/更新
│       │   └── notify.rs         # 工作通知发送
│       ├── db/
│       │   └── mod.rs            # SQLite 数据库操作
│       └── holiday/
│           └── mod.rs            # 节假日数据管理
│
├── package.json                  # Node.js 依赖
├── vite.config.ts                # Vite 构建配置
├── tsconfig.json                 # TypeScript 配置
└── index.html                    # HTML 入口
```

---

## 5. 动手修改指南

### 5.1 如果你想修改 UI

以**修改日期格子的颜色**为例，你只需要改前端：

1. 打开 `src/components/DayCell.tsx`
2. 找到 `STATUS_LABELS` 和相关条件判断
3. 修改 `cellStyle.background` 的颜色值
4. 运行 `npx tauri dev` 看效果

### 5.2 如果你想增加新功能

以**增加一个"导出报表"按钮**为例：

1. **前端**：在 `CalendarView.tsx` 添加按钮 + 点击处理函数
2. **前端**：`invoke("export_report", { month: "2026-06" })`
3. **后端**：在 `commands/` 下新建 `export.rs` 或在现有文件中添加函数
4. **后端**：给函数加 `#[tauri::command]`
5. **后端**：在 `lib.rs` 的 `generate_handler![]` 中注册
6. **后端**：在 `commands/mod.rs` 中添加 `pub mod export;`

### 5.3 如果你想调用新的钉钉 API

1. 在 `src-tauri/src/dingtalk/` 下添加对应函数
2. 参考 `report.rs` 中的现有模式：构造 URL → 发请求 → 解析响应 → 错误处理
3. 在 `commands/` 中封装为 Tauri command
4. 在 `generate_handler![]` 中注册

---

## 6. 学习资源推荐

### Rust

| 资源 | 说明 |
|------|------|
| [The Rust Book](https://doc.rust-lang.org/book/) | 官方教程（中文版：[Rust 程序设计语言](https://kaisery.github.io/trpl-zh-cn/)） |
| [Rust by Example](https://doc.rust-lang.org/rust-by-example/) | 通过例子学 Rust |
| [Rustlings](https://github.com/rust-lang/rustlings) | 交互式小练习 |

**优先学什么**：
1. 第 1-6 章（变量、类型、函数、控制流）
2. 第 4 章（所有权）— **最重要，多读几遍**
3. 第 5 章（结构体）
4. 第 6 章（枚举和模式匹配）
5. 第 9 章（错误处理）
6. 第 10 章（泛型和 trait）
7. 第 16 章（并发）

### Tauri v2

| 资源 | 说明 |
|------|------|
| [Tauri 官方文档](https://v2.tauri.app/) | 必读 |
| [Tauri Concepts](https://v2.tauri.app/concepts/) | 核心概念 |
| [Tauri 调用 Rust](https://v2.tauri.app/develop/calling-rust/) | IPC 通信详解 |

### React + TypeScript

| 资源 | 说明 |
|------|------|
| [React 官方教程](https://react.dev/learn) | 新的官方教程（中文：[React 中文文档](https://zh-hans.react.dev/)） |
| [TypeScript 官方手册](https://www.typescriptlang.org/docs/handbook/) | 重点看 Basic Types、Interfaces、Functions |

**优先学什么**：
1. Describing the UI（组件、JSX、props）
2. Adding Interactivity（useState、事件处理）
3. Managing State（useReducer、Context）
4. Escape Hatches（useEffect、useMemo）

---

## 附录：快速参考卡片

### Rust 常用语法

```rust
// 变量
let x = 5;              // 不可变
let mut y = 5;          // 可变
let s = format!("{}-{}", y, x);  // 字符串格式化

// 函数
fn add(a: i32, b: i32) -> i32 { a + b }  // 最后一行不加分号 = 返回值

// 结构体
struct Point { x: i32, y: i32 }
let p = Point { x: 1, y: 2 };

// 枚举
enum Status { Active, Inactive }
let s = Status::Active;

// Option
let maybe: Option<String> = Some("hello".into());
match maybe {
    Some(v) => println!("{}", v),
    None => println!("nothing"),
}

// Result
fn may_fail() -> Result<(), String> {
    do_something().map_err(|e| format!("失败: {}", e))?;
    Ok(())
}
```

### React 常用模式

```tsx
// 条件渲染
{isLoading && <Spinner />}
{error ? <Error msg={error} /> : <Content />}

// 列表渲染
{items.map(item => <Item key={item.id} data={item} />)}

// 事件处理
<button onClick={() => handleClick(id)}>点击</button>
<input value={text} onChange={e => setText(e.target.value)} />

// Tauri invoke 模式
const result = await invoke<ReturnType>("command_name", { arg1, arg2 });
```

---

> **建议的学习路径**：先用 `npx tauri dev` 把项目跑起来，然后对照着本文档读代码。从 `src/App.tsx` 和 `src-tauri/src/lib.rs` 两个入口开始，顺着调用链往下看。遇到不理解的概念回到本文档对应章节查阅。

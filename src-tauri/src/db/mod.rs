// ============================================================
// SQLite 数据库层
// - 使用 rusqlite 直接操作数据库
// - 数据库文件存储在 Tauri app data 目录下
// ============================================================

use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

/// 数据库管理器（全局单例）
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// 创建数据库管理器实例
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        // 确保目录存在
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;

        let db_path = app_data_dir.join("dailyreport.db");
        log::info!("数据库路径: {}", db_path.display());

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("打开数据库失败: {}", e))?;

        // 启用 WAL 模式以支持并发读写
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("设置 WAL 模式失败: {}", e))?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        db.initialize_tables()?;
        Ok(db)
    }

    /// 创建所有必要的表
    fn initialize_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;

        // 配置表：键值对存储
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );"
        ).map_err(|e| format!("创建 config 表失败: {}", e))?;

        // 每日状态表：缓存最近的检查结果
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS daily_status (
                date        TEXT PRIMARY KEY,  -- 'YYYY-MM-DD'
                is_workday  INTEGER NOT NULL,  -- 0/1
                has_report  INTEGER NOT NULL,  -- 0/1
                checked_at  TEXT NOT NULL,     -- ISO 8601
                status      TEXT NOT NULL      -- submitted|missing|warning|future|non_workday
            );"
        ).map_err(|e| format!("创建 daily_status 表失败: {}", e))?;

        // 日报提交记录：从 API 同步的原始数据
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS report_records (
                report_id   TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                stat_date   TEXT NOT NULL,
                created_at  TEXT,
                synced_at   TEXT NOT NULL
            );"
        ).map_err(|e| format!("创建 report_records 表失败: {}", e))?;

        // 节假日数据缓存
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS holiday_cache (
                date        TEXT PRIMARY KEY,  -- 'YYYY-MM-DD'
                is_holiday  INTEGER NOT NULL,  -- 1=假期, 0=调休补班(工作日)
                name        TEXT,
                updated_at  TEXT NOT NULL
            );"
        ).map_err(|e| format!("创建 holiday_cache 表失败: {}", e))?;

        log::info!("数据库表初始化完成");
        Ok(())
    }

    // =====================================================
    // 配置读写
    // =====================================================

    /// 保存单个配置项
    pub fn set_config(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        ).map_err(|e| format!("保存配置失败: {}", e))?;
        Ok(())
    }

    /// 读取单个配置项
    pub fn get_config(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT value FROM config WHERE key = ?1")
            .map_err(|e| format!("查询配置失败: {}", e))?;

        let result = stmt.query_row(params![key], |row| row.get::<_, String>(0));
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("读取配置失败: {}", e)),
        }
    }

    // =====================================================
    // 每日状态读写
    // =====================================================

    /// 批量更新每日状态（全量覆盖当月数据）
    pub fn update_daily_status(
        &self,
        records: &[(String, bool, bool, String, String)], // (date, is_workday, has_report, checked_at, status)
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;

        for (date, is_workday, has_report, checked_at, status) in records {
            conn.execute(
                "INSERT INTO daily_status (date, is_workday, has_report, checked_at, status)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(date) DO UPDATE SET
                    is_workday = excluded.is_workday,
                    has_report = excluded.has_report,
                    checked_at = excluded.checked_at,
                    status = excluded.status",
                params![date, *is_workday as i32, *has_report as i32, checked_at, status],
            ).map_err(|e| format!("更新每日状态失败 ({}): {}", date, e))?;
        }

        Ok(())
    }

    /// 查询指定月份的每日状态
    pub fn get_monthly_status(
        &self,
        month: &str, // 'YYYY-MM'
    ) -> Result<Vec<(String, bool, bool, String, String)>, String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;
        let pattern = format!("{}%", month);

        let mut stmt = conn
            .prepare(
                "SELECT date, is_workday, has_report, checked_at, status
                 FROM daily_status
                 WHERE date LIKE ?1
                 ORDER BY date ASC",
            )
            .map_err(|e| format!("查询月度状态失败: {}", e))?;

        let rows = stmt
            .query_map(params![pattern], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, bool>(1)?,
                    row.get::<_, bool>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| format!("映射查询结果失败: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("读取行数据失败: {}", e))?);
        }

        Ok(results)
    }

    // =====================================================
    // 节假日数据缓存
    // =====================================================

    /// 批量保存节假日数据
    pub fn save_holiday_cache(
        &self,
        holidays: &[(String, bool, String)], // (date, is_holiday, name)
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;
        let now = chrono::Utc::now().to_rfc3339();

        for (date, is_holiday, name) in holidays {
            conn.execute(
                "INSERT INTO holiday_cache (date, is_holiday, name, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(date) DO UPDATE SET
                    is_holiday = excluded.is_holiday,
                    name = excluded.name,
                    updated_at = excluded.updated_at",
                params![date, *is_holiday as i32, name, now],
            ).map_err(|e| format!("保存节假日缓存失败 ({}): {}", date, e))?;
        }

        Ok(())
    }

    /// 从缓存中查询节假日数据
    pub fn get_holiday_cache(
        &self,
        year: i32,
    ) -> Result<Vec<(String, bool, String)>, String> {
        let conn = self.conn.lock().map_err(|e| format!("锁定数据库失败: {}", e))?;
        let pattern = format!("{}-%", year);

        let mut stmt = conn
            .prepare(
                "SELECT date, is_holiday, name
                 FROM holiday_cache
                 WHERE date LIKE ?1
                 ORDER BY date ASC",
            )
            .map_err(|e| format!("查询节假日缓存失败: {}", e))?;

        let rows = stmt
            .query_map(params![pattern], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, bool>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| format!("映射节假日数据失败: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("读取节假日数据失败: {}", e))?);
        }

        Ok(results)
    }
}

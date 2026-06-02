// ============================================================
// 节假日数据获取
// - 数据源：NateScarlet/holiday-cn (GitHub)
//   raw.githubusercontent.com/NateScarlet/holiday-cn/refs/heads/master/{year}.json
// - 降级策略：API 不可用时降级为周一至周五
// ============================================================

use chrono::{Datelike, NaiveDate, Weekday};
use std::collections::HashMap;

/// 节假日数据
#[derive(Debug, Clone)]
pub struct HolidayData {
    /// 日期 → 是否为工作日
    /// 仅存储「特殊日期」（节假日和调休补班），
    /// 未收录的日期按周一至周五常规判断
    workday_overrides: HashMap<String, bool>,
    /// 数据年份
    pub year: i32,
}

impl HolidayData {
    /// 从 holiday-cn 响应创建
    fn from_holiday_cn(year: i32, days: &[HolidayDay]) -> Self {
        let mut workday_overrides = HashMap::new();
        for day in days {
            // isOffDay = true  → 放假（非工作日）
            // isOffDay = false → 补班（是工作日）
            workday_overrides.insert(day.date.clone(), !day.is_off_day);
        }
        Self {
            workday_overrides,
            year,
        }
    }

    /// 创建空的降级数据（仅周一至周五）
    fn fallback(year: i32) -> Self {
        Self {
            workday_overrides: HashMap::new(),
            year,
        }
    }

    /// 判断指定日期是否为工作日
    ///
    /// 判定顺序：
    /// 1. 日期在 holiday-cn 数据中且 isOffDay=false → 是工作日（补班）
    /// 2. 日期在 holiday-cn 数据中且 isOffDay=true  → 非工作日（放假）
    /// 3. 日期不在数据中 → 周一至周五为工作日
    pub fn is_workday(&self, date: NaiveDate) -> bool {
        let date_str = date.format("%Y-%m-%d").to_string();

        // 先查 API 数据中的特殊日期
        if let Some(&is_workday) = self.workday_overrides.get(&date_str) {
            return is_workday;
        }

        // 常规：周一至周五为工作日
        matches!(
            date.weekday(),
            Weekday::Mon | Weekday::Tue | Weekday::Wed | Weekday::Thu | Weekday::Fri
        )
    }
}

/// holiday-cn 单日数据
#[derive(Debug, serde::Deserialize)]
struct HolidayDay {
    date: String,
    #[serde(rename = "isOffDay")]
    is_off_day: bool,
    #[allow(dead_code)]
    name: String,
}

/// holiday-cn API 响应顶层结构
#[derive(Debug, serde::Deserialize)]
struct HolidayCnResponse {
    year: i32,
    days: Vec<HolidayDay>,
}

/// 从 holiday-cn (GitHub/NateScarlet) 拉取指定年份的节假日数据
///
/// API 响应格式:
/// ```json
/// {
///   "year": 2026,
///   "days": [
///     { "name": "元旦", "date": "2026-01-01", "isOffDay": true },
///     { "name": "春节", "date": "2026-02-17", "isOffDay": true },
///     { "name": "春节补班", "date": "2026-02-14", "isOffDay": false }
///   ]
/// }
/// ```
///
/// isOffDay = true  → 法定放假（不是工作日）
/// isOffDay = false → 调休补班（是工作日）
pub async fn fetch_holiday_data(year: i32) -> Result<HolidayData, String> {
    let url = format!(
        "https://raw.githubusercontent.com/NateScarlet/holiday-cn/refs/heads/master/{}.json",
        year
    );

    log::info!("正在从 holiday-cn 拉取 {} 年节假日数据...", year);

    let client = reqwest::Client::new();
    let resp = match client
        .get(&url)
        .header("User-Agent", "DailyReportGuard/0.1")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("获取节假日数据失败（网络错误）: {}，降级为周一至周五", e);
            return Ok(HolidayData::fallback(year));
        }
    };

    // 检查 HTTP 状态码
    if !resp.status().is_success() {
        log::warn!(
            "节假日 API 返回 HTTP {}，降级为周一至周五",
            resp.status().as_u16()
        );
        return Ok(HolidayData::fallback(year));
    }

    // 获取响应文本（不直接解析 JSON，避免 reqwest 自动解析失败）
    let text = match resp.text().await {
        Ok(t) => t,
        Err(e) => {
            log::warn!("读取节假日响应失败: {}，降级为周一至周五", e);
            return Ok(HolidayData::fallback(year));
        }
    };

    // 解析 JSON
    let parsed: HolidayCnResponse = match serde_json::from_str(&text) {
        Ok(p) => p,
        Err(e) => {
            log::warn!(
                "解析节假日 JSON 失败: {}。前 200 字符: {}，降级为周一至周五",
                e,
                &text[..text.len().min(200)]
            );
            return Ok(HolidayData::fallback(year));
        }
    };

    let holiday_data = HolidayData::from_holiday_cn(year, &parsed.days);
    log::info!(
        "已加载 {} 年节假日数据，共 {} 条特殊日期",
        year,
        holiday_data.workday_overrides.len()
    );
    Ok(holiday_data)
}

/// 获取指定年份的缓存或有数据。优先缓存，失败时自动拉取。
pub async fn get_or_fetch_holiday_data(
    year: i32,
) -> Result<HolidayData, String> {
    // 直接拉取（缓存优化可以后续加）
    fetch_holiday_data(year).await
}

// ============================================================
// 单元测试
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    /// 模拟 holiday-cn 2026 年数据片段
    fn sample_holiday_cn_response() -> HolidayCnResponse {
        HolidayCnResponse {
            year: 2026,
            days: vec![
                // 元旦放假
                HolidayDay {
                    name: "元旦".into(),
                    date: "2026-01-01".into(),
                    is_off_day: true,
                },
                // 春节放假
                HolidayDay {
                    name: "春节".into(),
                    date: "2026-02-17".into(),
                    is_off_day: true,
                },
                // 春节补班（周日上班）
                HolidayDay {
                    name: "春节补班".into(),
                    date: "2026-02-14".into(),
                    is_off_day: false,
                },
            ],
        }
    }

    #[test]
    fn test_holiday_cn_parsing() {
        let response = sample_holiday_cn_response();
        let data = HolidayData::from_holiday_cn(2026, &response.days);

        // 元旦（周四）→ 放假，不是工作日
        assert!(!data.is_workday(NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()));

        // 春节（周二）→ 放假，不是工作日
        assert!(!data.is_workday(NaiveDate::from_ymd_opt(2026, 2, 17).unwrap()));

        // 补班（周六 2月14日）→ 是工作日
        assert!(data.is_workday(NaiveDate::from_ymd_opt(2026, 2, 14).unwrap()));
    }

    #[test]
    fn test_regular_workday() {
        let response = sample_holiday_cn_response();
        let data = HolidayData::from_holiday_cn(2026, &response.days);

        // 普通周一（6月1日）→ 不在特殊日期中，是工作日
        assert!(data.is_workday(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()));

        // 普通周二 → 工作日
        assert!(data.is_workday(NaiveDate::from_ymd_opt(2026, 6, 2).unwrap()));
    }

    #[test]
    fn test_regular_weekend() {
        let response = sample_holiday_cn_response();
        let data = HolidayData::from_holiday_cn(2026, &response.days);

        // 普通周六 → 不是工作日
        assert!(!data.is_workday(NaiveDate::from_ymd_opt(2026, 6, 6).unwrap()));

        // 普通周日 → 不是工作日
        assert!(!data.is_workday(NaiveDate::from_ymd_opt(2026, 6, 7).unwrap()));
    }

    #[test]
    fn test_fallback_uses_weekday_only() {
        let data = HolidayData::fallback(2026);

        // 周一 → 工作日
        assert!(data.is_workday(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()));

        // 周日 → 非工作日
        assert!(!data.is_workday(NaiveDate::from_ymd_opt(2026, 6, 7).unwrap()));

        // 元旦（特殊节日）→ 降级模式下仍然是工作日（因为周四是工作日）
        assert!(data.is_workday(NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()));
    }
}

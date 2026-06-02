// ============================================================
// 检查引擎：对比工作日列表与已提交记录，找出缺失日期
// ============================================================

use chrono::{Datelike, Local, NaiveDate, Utc};
use crate::dingtalk::auth::TokenCache;
use crate::dingtalk::report::{self, ReportStat};
use crate::holiday::HolidayData;
use crate::engine::workday;

/// 单日检查结果
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayResult {
    pub date: String,        // 'YYYY-MM-DD'
    pub status: String,      // 'submitted' | 'missing' | 'warning' | 'future' | 'non_workday'
    pub is_workday: bool,
    pub has_report: bool,
}

/// 检查汇总
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckSummary {
    pub month: String,
    pub total_workdays: usize,
    pub submitted: usize,
    pub missing: usize,
    pub missing_dates: Vec<String>,
    pub last_checked_at: String,
}

/// 执行一次全量检查
///
/// # Arguments
/// * `token` - 钉钉 access_token 缓存
/// * `holiday_data` - 节假日数据
/// * `template_id` - 日志模板 report_code
/// * `template_name` - 日志模板名称（用于 API 查询）
/// * `user_id` - 用户 ID
/// * `month` - 当前检查月 'YYYY-MM'
pub async fn run_full_check(
    token: &TokenCache,
    holiday_data: &HolidayData,
    template_id: &str,
    template_name: &str,
    user_id: &str,
    month: &str,
) -> Result<(Vec<DayResult>, CheckSummary), String> {
    let today = Local::now().date_naive();

    // 1. 获取本月所有工作日
    let workdays = workday::get_month_workdays(month, holiday_data);

    // 2. 计算 API 时间范围
    //    start: 当月 1 日 00:00:00.000
    //    end:   本月/上月 → 当前时刻（跨月补填能被查到）
    //           更早月份 → 月末 23:59:59.999
    let (start_ms, month_end_ms) = month_timestamps_ms(month)?;
    let end_ms = {
        let current_month = format!("{}-{:02}", today.year(), today.month());
        let prev_year = today.year() - if today.month() == 1 { 1 } else { 0 };
        let prev_month = if today.month() == 1 { 12 } else { today.month() - 1 };
        let prev_month_str = format!("{}-{:02}", prev_year, prev_month);
        if month == current_month || month == prev_month_str {
            Utc::now().timestamp_millis()
        } else {
            month_end_ms
        }
    };
    log::info!(
        "检查 {}: start_ms={}, end_ms={} ({})",
        month, start_ms, end_ms,
        if end_ms == month_end_ms { "月末" } else { "现在" }
    );

    // 3. 调用钉钉日志列表 API（重试 3 次）
    let stats = call_reports_with_retry(
        token, user_id, template_name, start_ms, end_ms,
    )
    .await?;

    // 4. 构建 已提交/补交 映射
    use std::collections::HashMap;
    let mut date_info: HashMap<String, (bool, bool)> = HashMap::new();
    // date → (has_report, is_backfilled)
    for s in &stats {
        date_info.insert(s.stat_date.clone(), (s.has_report, s.is_backfilled));
    }

    // 5. 遍历所有工作日，生成每日状态
    let mut results = Vec::new();
    let mut missing_dates = Vec::new();
    let mut submitted_count = 0;

    for day in &workdays {
        let date_str = day.format("%Y-%m-%d").to_string();
        let (has_report, is_backfilled) = date_info
            .get(&date_str)
            .map(|(h, b)| (*h, *b))
            .unwrap_or((false, false));

        let status = if has_report && is_backfilled {
            submitted_count += 1;
            "backfilled"
        } else if has_report {
            submitted_count += 1;
            "submitted"
        } else if workday::is_future(*day, today) {
            "future"
        } else if workday::is_today(*day, today) {
            // 今天还没写 → 预警状态
            "warning"
        } else {
            // 昨天及以前没写 → 缺失
            missing_dates.push(date_str.clone());
            "missing"
        };

        results.push(DayResult {
            date: date_str,
            status: status.to_string(),
            is_workday: true,
            has_report,
        });
    }

    let missing_count = missing_dates.len();
    let workday_count = workdays.len();

    let summary = CheckSummary {
        month: month.to_string(),
        total_workdays: workday_count,
        submitted: submitted_count,
        missing: missing_count,
        missing_dates,
        last_checked_at: Local::now().to_rfc3339(),
    };

    log::info!(
        "检查完成: {} 月, {} 个工作日, {} 已写, {} 缺失 (模板: {})",
        month,
        workday_count,
        submitted_count,
        missing_count,
        template_id,
    );
    Ok((results, summary))
}

/// 调用日志列表 API，带重试逻辑
async fn call_reports_with_retry(
    token: &TokenCache,
    user_id: &str,
    template_name: &str,
    start_time_ms: i64,
    end_time_ms: i64,
) -> Result<Vec<ReportStat>, String> {
    let max_retries = 3;
    let mut last_error = String::new();

    for attempt in 1..=max_retries {
        match report::get_reports(
            token,
            user_id,
            template_name,
            start_time_ms,
            end_time_ms,
        )
        .await
        {
            Ok(stats) => return Ok(stats),
            Err(e) => {
                log::warn!("日志列表 API 第 {} 次调用失败: {}", attempt, e);
                last_error = e;
                if attempt < max_retries {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
            }
        }
    }

    Err(format!(
        "日志列表 API 调用失败（已重试 {} 次）: {}",
        max_retries, last_error
    ))
}

/// 获取月份的时间范围（毫秒时间戳）
/// 返回 (本月第一天 00:00:00, 本月最后一天 23:59:59.999)
fn month_timestamps_ms(month: &str) -> Result<(i64, i64), String> {
    let date_str = format!("{}-01", month);
    let first_day = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("解析月份失败: {}", e))?;

    // 本月第一天 00:00:00 UTC
    let start = first_day
        .and_hms_opt(0, 0, 0)
        .ok_or("时间构造失败")?;
    let start_ms = start.and_utc().timestamp_millis();

    // 下个月第一天 00:00:00 UTC
    let next_month = if first_day.month() == 12 {
        NaiveDate::from_ymd_opt(first_day.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(first_day.year(), first_day.month() + 1, 1)
    }
    .ok_or("时间构造失败")?;
    let end = next_month
        .and_hms_opt(0, 0, 0)
        .ok_or("时间构造失败")?;
    // 月末 = 下月初 - 1 毫秒
    let end_ms = end.and_utc().timestamp_millis() - 1;

    Ok((start_ms, end_ms))
}

// ============================================================
// 单元测试
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_month_timestamps_current_month() {
        // 2026-06 → 6月有30天
        let (start, end) = month_timestamps_ms("2026-06").unwrap();
        // 2026-06-01 00:00:00 UTC
        let expected_start = NaiveDate::from_ymd_opt(2026, 6, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis();
        // 2026-06-30 23:59:59.999 UTC
        let expected_end = NaiveDate::from_ymd_opt(2026, 7, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis()
            - 1;

        assert_eq!(start, expected_start);
        assert_eq!(end, expected_end);
    }

    #[test]
    fn test_month_timestamps_past_month() {
        // 2026-05 → 5月有31天
        let (start, end) = month_timestamps_ms("2026-05").unwrap();
        let expected_start = NaiveDate::from_ymd_opt(2026, 5, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis();
        let expected_end = NaiveDate::from_ymd_opt(2026, 6, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis()
            - 1;

        assert_eq!(start, expected_start);
        assert_eq!(end, expected_end);
    }

    #[test]
    fn test_month_timestamps_december() {
        // 跨年：2025-12
        let (start, end) = month_timestamps_ms("2025-12").unwrap();
        let expected_start = NaiveDate::from_ymd_opt(2025, 12, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis();
        let expected_end = NaiveDate::from_ymd_opt(2026, 1, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis()
            - 1;

        assert_eq!(start, expected_start);
        assert_eq!(end, expected_end);
    }
}

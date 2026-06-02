use crate::AppState;
use serde_json::json;
use tauri::State;

// ============================================================
// 日报数据相关 Tauri Commands
// ============================================================

/// 获取指定月份的检查汇总（从数据库缓存读取）
#[tauri::command]
pub async fn get_monthly_summary(
    state: State<'_, AppState>,
    month: String,
) -> Result<serde_json::Value, String> {
    log::info!("查询月度汇总: {}", month);

    let records = state.db.get_monthly_status(&month)?;

    let days: Vec<serde_json::Value> = records
        .iter()
        .map(|(date, is_workday, has_report, checked_at, status)| {
            json!({
                "date": date,
                "isWorkday": is_workday,
                "hasReport": has_report,
                "checkedAt": checked_at,
                "status": status,
            })
        })
        .collect();

    let workdays: Vec<_> = records.iter().filter(|(_, w, _, _, _)| *w).collect();
    let total = workdays.len();
    let submitted = workdays.iter().filter(|(_, _, r, _, _)| *r).count();
    let missing_dates: Vec<_> = records
        .iter()
        .filter(|(_, _, _, _, s)| s == "missing")
        .map(|(d, _, _, _, _)| d.clone())
        .collect();

    Ok(json!({
        "month": month,
        "summary": {
            "totalWorkdays": total,
            "submitted": submitted,
            "missing": missing_dates.len(),
            "missingDates": missing_dates,
            "lastCheckedAt": records.first().map(|(_, _, _, c, _)| c.clone()),
        },
        "days": days,
    }))
}

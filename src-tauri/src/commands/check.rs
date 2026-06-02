use crate::AppState;
use crate::engine::checker;
use crate::holiday;
use chrono::{Datelike, Local};
use serde_json::json;
use tauri::State;

// ============================================================
// 检查相关 Tauri Commands
// ============================================================

/// 手动触发一次全量检查（可指定月份）
#[tauri::command]
pub async fn run_check(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<serde_json::Value, String> {
    // 默认检查当前月
    let target_month = month.unwrap_or_else(|| {
        Local::now().format("%Y-%m").to_string()
    });
    log::info!("手动触发检查: {}", target_month);

    // 检查是否已配置
    let is_configured = state
        .db
        .get_config("is_configured")?
        .map(|v| v == "true")
        .unwrap_or(false);

    if !is_configured {
        return Err("应用尚未配置，请先完成配置向导".into());
    }

    // 读取配置
    let user_id = state
        .db
        .get_config("user_id")?
        .ok_or("用户 ID 未配置")?;

    let template_id = state
        .db
        .get_config("selected_template_ids")?
        .and_then(|v| serde_json::from_str::<Vec<String>>(&v).ok())
        .and_then(|ids| ids.into_iter().next())
        .ok_or("未选择日报模板")?;

    let template_name = state
        .db
        .get_config("selected_template_name")?
        .unwrap_or_else(|| "日报".to_string());

    // 根据目标月份确定节假日数据的年份
    let target_year = target_month
        .split('-')
        .next()
        .and_then(|y| y.parse::<i32>().ok())
        .unwrap_or_else(|| Local::now().year());

    let holiday_data = holiday::fetch_holiday_data(target_year).await?;

    // 执行检查
    let (day_results, summary) = checker::run_full_check(
        &state.token_cache,
        &holiday_data,
        &template_id,
        &template_name,
        &user_id,
        &target_month,
    )
    .await?;

    // 将结果保存到数据库
    let records: Vec<(String, bool, bool, String, String)> = day_results
        .iter()
        .map(|d| {
            (
                d.date.clone(),
                d.is_workday,
                d.has_report,
                summary.last_checked_at.clone(),
                d.status.clone(),
            )
        })
        .collect();

    state.db.update_daily_status(&records)?;

    // 返回给前端
    Ok(json!({
        "summary": summary,
        "days": day_results,
    }))
}

/// 获取缓存的检查状态（从数据库读取，不发起网络请求）
#[tauri::command]
pub async fn get_current_status(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<serde_json::Value, String> {
    let target_month = month.unwrap_or_else(|| {
        Local::now().format("%Y-%m").to_string()
    });

    let records = state.db.get_monthly_status(&target_month)?;

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

    // 计算汇总
    let workdays: Vec<_> = records.iter().filter(|(_, w, _, _, _)| *w).collect();
    let total = workdays.len();
    let submitted = workdays.iter().filter(|(_, _, r, _, _)| *r).count();
    let missing_dates: Vec<_> = records
        .iter()
        .filter(|(_, _, _, _, s)| s == "missing")
        .map(|(d, _, _, _, _)| d.clone())
        .collect();

    Ok(json!({
        "summary": {
            "month": target_month,
            "totalWorkdays": total,
            "submitted": submitted,
            "missing": missing_dates.len(),
            "missingDates": missing_dates,
            "lastCheckedAt": records.first().map(|(_, _, _, c, _)| c.clone()),
        },
        "days": days,
    }))
}

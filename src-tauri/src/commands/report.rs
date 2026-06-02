use crate::AppState;
use serde_json::json;
use tauri::State;

// ============================================================
// 日报数据相关 Tauri Commands
// ============================================================

/// 获取指定日期的日报详细内容
#[tauri::command]
pub async fn fetch_report_content(
    state: State<'_, AppState>,
    date: String,
) -> Result<serde_json::Value, String> {
    log::info!("获取日报内容: {}", date);

    let user_id = state
        .db
        .get_config("user_id")?
        .ok_or("用户 ID 未配置")?;

    let template_name = state
        .db
        .get_config("selected_template_name")?
        .unwrap_or_else(|| "日报".to_string());

    match crate::dingtalk::report::get_report_for_date(
        &state.token_cache,
        &user_id,
        &template_name,
        &date,
    )
    .await?
    {
        Some(detail) => Ok(json!({
            "found": true,
            "createTime": detail.create_time,
            "creatorName": detail.creator_name,
            "templateName": detail.template_name,
            "contents": detail.contents.iter().map(|c| json!({
                "key": c.key,
                "value": c.value,
            })).collect::<Vec<_>>(),
        })),
        None => Ok(json!({
            "found": false,
            "message": "该日期未找到日报内容",
        })),
    }
}

/// 提交（创建）日报
#[tauri::command]
pub async fn submit_report(
    state: State<'_, AppState>,
    date: String,       // 'YYYY-MM-DD'
    content: String,    // 工作内容
) -> Result<(), String> {
    log::info!("提交日报: {} ({} 字)", date, content.chars().count());

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

    crate::dingtalk::report::create_report(
        &state.token_cache,
        &template_id,
        &template_name,
        &user_id,
        &date,
        &content,
    )
    .await
}

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

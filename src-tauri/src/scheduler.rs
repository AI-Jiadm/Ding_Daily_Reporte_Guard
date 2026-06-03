// ============================================================
// 定时任务调度器
// - 每小时执行一次检查
// - 在 17:30 触发预警通知
// - 在 09:30 触发确认通知
// ============================================================

use crate::engine::checker;
use crate::holiday;
use crate::{set_tray_alert, set_tray_normal, AppState};
use chrono::{Datelike, Local, Timelike};
use tauri::{AppHandle, Manager};

/// 启动定时检查调度器
pub fn start(app: AppHandle) {
    log::info!("定时检查调度器已启动");

    tauri::async_runtime::spawn(async move {
        loop {
            // 每小时执行一次
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;

            let now = Local::now();
            let hour = now.hour();
            let minute = now.minute();

            // 检查是否在通知时间窗口内
            let is_pm_warning = hour == 17 && minute >= 25 && minute <= 35;
            let is_am_confirm = hour == 9 && minute >= 25 && minute <= 35;

            if !is_pm_warning && !is_am_confirm {
                continue;
            }

            log::info!(
                "定时检查触发: {:02}:{:02} (预警={}, 确认={})",
                hour, minute, is_pm_warning, is_am_confirm
            );

            // 读取配置状态
            let state = match app.try_state::<AppState>() {
                Some(s) => s,
                None => continue,
            };

            let is_configured = state
                .db
                .get_config("is_configured")
                .ok()
                .flatten()
                .map(|v| v == "true")
                .unwrap_or(false);

            if !is_configured {
                continue;
            }

            // 读取必要配置
            let (user_id, template_id, template_name) = {
                let uid = match state.db.get_config("user_id").ok().flatten() {
                    Some(v) => v,
                    None => continue,
                };
                let tid = match state
                    .db
                    .get_config("selected_template_ids")
                    .ok()
                    .flatten()
                    .and_then(|v| serde_json::from_str::<Vec<String>>(&v).ok())
                    .and_then(|ids| ids.into_iter().next())
                {
                    Some(v) => v,
                    None => continue,
                };
                let tname = state
                    .db
                    .get_config("selected_template_name")
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "日报".to_string());
                (uid, tid, tname)
            };

            let target_month = now.format("%Y-%m").to_string();
            let target_year = now.year();

            // 获取节假日数据
            let holiday_data = match holiday::get_or_fetch_holiday_data(&state.db, target_year).await {
                Ok(h) => h,
                Err(e) => {
                    log::warn!("定时检查: 获取节假日数据失败: {}", e);
                    continue;
                }
            };

            // 执行检查
            match checker::run_full_check(
                &state.token_cache,
                &holiday_data,
                &template_id,
                &template_name,
                &user_id,
                &target_month,
            )
            .await
            {
                Ok((day_results, _summary)) => {
                    // 保存检查结果到数据库
                    let records: Vec<(String, bool, bool, String, String)> = day_results
                        .iter()
                        .map(|d| {
                            (
                                d.date.clone(),
                                d.is_workday,
                                d.has_report,
                                now.format("%Y-%m-%d %H:%M:%S").to_string(),
                                d.status.clone(),
                            )
                        })
                        .collect();
                    if let Err(e) = state.db.update_daily_status(&records) {
                        log::warn!("定时检查: 保存结果失败: {}", e);
                    }

                    // 根据是否有缺失切换托盘图标
                    let has_missing = day_results.iter().any(|d| d.status == "missing");
                    if has_missing {
                        set_tray_alert(&app);
                        log::info!("定时检查: 发现缺失日报，托盘图标切换为告警态");
                    } else {
                        set_tray_normal(&app);
                        log::info!("定时检查: 日报已全部提交，托盘图标正常");
                    }
                }
                Err(e) => {
                    log::warn!("定时检查: 执行失败: {}", e);
                }
            }
        }
    });
}

// ============================================================
// 日报守卫 - Rust 后端入口
// ============================================================

mod commands;
mod db;
mod dingtalk;
mod engine;
mod holiday;
mod scheduler;

use db::Database;
use dingtalk::auth::TokenCache;
use log::info;
use std::sync::Arc;
use tauri::Manager;

/// 应用配置结构（前端传递）
#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct AppConfig {
    pub app_key: String,
    pub app_secret: String,
    pub user_id: String,
    pub selected_template_ids: Vec<String>,
}

/// 应用全局状态（Tauri 管理的 state）
pub struct AppState {
    pub db: Arc<Database>,
    pub token_cache: Arc<TokenCache>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    info!("日报守卫启动中...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 获取 app data 目录
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("无法获取 app data 目录");

            // 初始化数据库
            let database = Database::new(app_data_dir)
                .expect("数据库初始化失败");
            let db = Arc::new(database);

            // 初始化 token 缓存
            let token_cache = Arc::new(TokenCache::new());

            // 注册全局状态
            app.manage(AppState {
                db: db.clone(),
                token_cache: token_cache.clone(),
            });

            // 从数据库加载凭据并设置到 token_cache
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(Some(app_key)) = db.get_config("app_key") {
                    let app_secret = db.get_config("app_secret")
                        .ok()
                        .flatten()
                        .unwrap_or_default();
                    token_cache.set_credentials(app_key, app_secret).await;
                    info!("已从数据库加载钉钉凭据");
                }

                // 启动定时检查调度器
                scheduler::start(app_handle);
            });

            info!("日报守卫启动完成");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::save_config,
            commands::config::load_config,
            commands::config::test_connection,
            commands::config::fetch_templates,
            commands::config::save_settings_and_restart,
            commands::check::run_check,
            commands::check::get_current_status,
            commands::report::get_monthly_summary,
        ])
        .run(tauri::generate_context!())
        .expect("启动日报守卫时出错");
}

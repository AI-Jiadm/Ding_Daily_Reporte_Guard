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
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

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

/// 托盘图标状态（用于动态切换正常/告警图标）
pub struct TrayState {
    pub normal_icon: Image<'static>,
    pub alert_icon: Image<'static>,
}

/// 编译期嵌入正常/告警托盘图标
const NORMAL_ICON_BYTES: &[u8] = include_bytes!("../icons/icon.png");
const ALERT_ICON_BYTES: &[u8] = include_bytes!("../icons/icon-alert.png");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    info!("日报守卫启动中...");

    // 预加载正常/告警托盘图标
    let normal_icon = Image::from_bytes(NORMAL_ICON_BYTES)
        .expect("无法加载托盘图标 icon.png");
    let alert_icon = Image::from_bytes(ALERT_ICON_BYTES)
        .expect("无法加载告警托盘图标 icon-alert.png");

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

            // ========== 构建托盘菜单 ==========
            let show_item = MenuItemBuilder::with_id("show", "显示窗口")
                .build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出")
                .build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            // ========== 构建托盘图标 ==========
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(normal_icon.clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false) // 左键不弹菜单，直接用 on_tray_icon_event 处理
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键点击托盘图标 → 显示窗口
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 注册托盘状态（供后续图标切换使用）
            app.manage(TrayState {
                normal_icon,
                alert_icon,
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
        // 拦截窗口关闭 → 隐藏到托盘而非退出
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::save_config,
            commands::config::load_config,
            commands::config::test_connection,
            commands::config::fetch_templates,
            commands::config::get_template_fields,
            commands::config::save_settings_and_restart,
            commands::config::lookup_userid,
            commands::config::reset_config,
            commands::config::sync_holidays,
            commands::config::get_holiday_list,
            commands::check::run_check,
            commands::check::get_current_status,
            commands::report::get_monthly_summary,
            commands::report::fetch_report_content,
            commands::report::submit_report,
        ])
        .run(tauri::generate_context!())
        .expect("启动日报守卫时出错");
}

/// 切换托盘图标为告警态（有缺失日报时调用）
pub fn set_tray_alert(app: &tauri::AppHandle) {
    if let (Some(tray), Some(state)) = (
        app.tray_by_id("main-tray"),
        app.try_state::<TrayState>(),
    ) {
        let _ = tray.set_icon(Some(state.alert_icon.clone()));
    }
}

/// 切换托盘图标为正常态（无缺失日报时调用）
pub fn set_tray_normal(app: &tauri::AppHandle) {
    if let (Some(tray), Some(state)) = (
        app.tray_by_id("main-tray"),
        app.try_state::<TrayState>(),
    ) {
        let _ = tray.set_icon(Some(state.normal_icon.clone()));
    }
}

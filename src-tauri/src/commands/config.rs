use crate::AppState;
use serde_json::json;
use tauri::State;

// ============================================================
// 配置管理相关 Tauri Commands
// ============================================================

/// 保存应用配置到数据库
#[tauri::command]
pub async fn save_config(
    state: State<'_, AppState>,
    app_key: String,
    app_secret: String,
    user_id: String,
    selected_template_ids: Vec<String>,
    selected_template_name: String,
) -> Result<(), String> {
    // 保存到数据库
    state.db.set_config("app_key", &app_key)?;
    state.db.set_config("app_secret", &app_secret)?;
    state.db.set_config("user_id", &user_id)?;
    state.db.set_config(
        "selected_template_ids",
        &serde_json::to_string(&selected_template_ids).unwrap_or_default(),
    )?;
    state.db.set_config("selected_template_name", &selected_template_name)?;
    state.db.set_config("is_configured", "true")?;

    // 更新 token 缓存中的凭据
    state.token_cache.set_credentials(app_key, app_secret).await;

    log::info!(
        "配置已保存: user_id={}, template={}",
        user_id,
        selected_template_name
    );
    Ok(())
}

/// 从数据库加载应用配置
#[tauri::command]
pub async fn load_config(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let is_configured = state
        .db
        .get_config("is_configured")?
        .map(|v| v == "true")
        .unwrap_or(false);

    let selected_template_ids: Vec<String> = state
        .db
        .get_config("selected_template_ids")?
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default();

    Ok(json!({
        "appKey": state.db.get_config("app_key")?.unwrap_or_default(),
        "appSecret": state.db.get_config("app_secret")?.unwrap_or_default(),
        "userId": state.db.get_config("user_id")?.unwrap_or_default(),
        "selectedTemplateIds": selected_template_ids,
        "isConfigured": is_configured,
    }))
}

/// 测试钉钉连接（验证 AppKey/AppSecret 是否有效）并拉取模板列表
#[tauri::command]
pub async fn test_connection(
    _state: State<'_, AppState>,
    app_key: String,
    app_secret: String,
    user_id: String,
) -> Result<serde_json::Value, String> {
    // 临时设置凭据并尝试获取 token
    let temp_cache = crate::dingtalk::auth::TokenCache::new();
    temp_cache
        .set_credentials(app_key.clone(), app_secret.clone())
        .await;

    match temp_cache.get_token().await {
        Ok(_token) => {
            log::info!("连接测试成功，拉取模板列表...");
            // 用刚输入的 user_id 拉取模板列表
            match crate::dingtalk::report::fetch_templates(&temp_cache, &user_id).await {
                Ok(templates) => Ok(json!({
                    "success": true,
                    "message": format!("连接成功，获取到 {} 个日志模板", templates.len()),
                    "templates": templates,
                })),
                Err(e) => Ok(json!({
                    "success": true,
                    "message": format!("连接成功，但拉取模板列表失败: {}", e),
                    "templates": [],
                })),
            }
        }
        Err(e) => Ok(json!({
            "success": false,
            "message": format!("连接失败: {}", e),
        })),
    }
}

/// 拉取钉钉日志模板列表（需要已保存的配置）
#[tauri::command]
pub async fn fetch_templates(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let user_id = state
        .db
        .get_config("user_id")?
        .ok_or("用户 ID 未配置")?;

    let templates =
        crate::dingtalk::report::fetch_templates(&state.token_cache, &user_id).await?;
    Ok(templates
        .into_iter()
        .map(|t| {
            json!({
                "id": t.id,
                "name": t.name,
                "icon": t.icon,
            })
        })
        .collect())
}

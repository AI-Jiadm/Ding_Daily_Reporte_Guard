// ============================================================
// 钉钉 access_token 管理
// - 使用旧版网关 oapi.dingtalk.com/gettoken
// - 有效期 7200 秒，过期前 5 分钟自动续期
// - 内存缓存，避免每次调用都刷新
// ============================================================

use std::sync::Arc;
use tokio::sync::RwLock;

/// access_token 缓存
#[derive(Clone)]
pub struct TokenCache {
    token: Arc<RwLock<Option<String>>>,
    expires_at: Arc<RwLock<i64>>, // Unix 时间戳
    app_key: Arc<RwLock<String>>,
    app_secret: Arc<RwLock<String>>,
}

impl TokenCache {
    pub fn new() -> Self {
        Self {
            token: Arc::new(RwLock::new(None)),
            expires_at: Arc::new(RwLock::new(0)),
            app_key: Arc::new(RwLock::new(String::new())),
            app_secret: Arc::new(RwLock::new(String::new())),
        }
    }

    /// 设置凭据
    pub async fn set_credentials(&self, app_key: String, app_secret: String) {
        *self.app_key.write().await = app_key;
        *self.app_secret.write().await = app_secret;
        // 凭据变更时清空旧 token
        *self.token.write().await = None;
        *self.expires_at.write().await = 0;
    }

    /// 获取有效的 access_token，过期时自动刷新
    pub async fn get_token(&self) -> Result<String, String> {
        // TODO: 检查缓存是否有效，无效则调用钉钉 API 刷新
        let cached = self.token.read().await;
        if let Some(ref token) = *cached {
            let expires = *self.expires_at.read().await;
            let now = chrono::Utc::now().timestamp();
            // 提前 5 分钟刷新
            if expires > now + 300 {
                return Ok(token.clone());
            }
        }
        drop(cached);

        // 需要刷新 token
        self.refresh_token().await
    }

    /// 调用钉钉 API 获取新 token
    async fn refresh_token(&self) -> Result<String, String> {
        let app_key = self.app_key.read().await.clone();
        let app_secret = self.app_secret.read().await.clone();

        if app_key.is_empty() || app_secret.is_empty() {
            return Err("AppKey 或 AppSecret 未配置".into());
        }

        let url = format!(
            "https://oapi.dingtalk.com/gettoken?appkey={}&appsecret={}",
            app_key, app_secret
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await.map_err(|e| {
            format!("获取 access_token 失败: {}", e)
        })?;

        let body: serde_json::Value = resp.json().await.map_err(|e| {
            format!("解析 access_token 响应失败: {}", e)
        })?;

        // 检查 errcode
        if body["errcode"].as_i64().unwrap_or(-1) != 0 {
            return Err(format!(
                "钉钉 API 错误: {}",
                body["errmsg"].as_str().unwrap_or("未知错误")
            ));
        }

        let token = body["access_token"]
            .as_str()
            .ok_or("access_token 字段缺失")?
            .to_string();

        let expires_in = body["expires_in"].as_i64().unwrap_or(7200);

        // 更新缓存
        let now = chrono::Utc::now().timestamp();
        *self.token.write().await = Some(token.clone());
        *self.expires_at.write().await = now + expires_in;

        log::info!("access_token 已刷新，有效期 {} 秒", expires_in);
        Ok(token)
    }
}

// ============================================================
// 钉钉工作通知发送
// - 接口：POST /topapi/message/corpconversation/asyncsend_v2
// - 渠道：工作通知，用户在工作助手中查看
// ============================================================

use crate::dingtalk::auth::TokenCache;

/// 发送工作通知消息
///
/// # Arguments
/// * `token` - access_token 缓存
/// * `user_id` - 接收消息的用户 ID
/// * `title` - 消息标题
/// * `content` - 消息正文（支持 markdown）
pub async fn send_work_notice(
    token: &TokenCache,
    user_id: &str,
    title: &str,
    content: &str,
) -> Result<(), String> {
    let access_token = token.get_token().await?;
    let url = format!(
        "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token={}",
        access_token
    );

    let body = serde_json::json!({
        "agent_id": 0, // TODO: 需要从配置中获取 agent_id
        "userid_list": user_id,
        "msg": {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": content,
            }
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("发送工作通知失败: {}", e))?;

    let result: serde_json::Value = resp.json().await.map_err(|e| {
        format!("解析工作通知响应失败: {}", e)
    })?;

    if result["errcode"].as_i64().unwrap_or(-1) != 0 {
        return Err(format!(
            "工作通知发送失败: {}",
            result["errmsg"].as_str().unwrap_or("未知错误")
        ));
    }

    log::info!("工作通知已发送给 {}", user_id);
    Ok(())
}

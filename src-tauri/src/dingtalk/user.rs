// ============================================================
// 钉钉用户信息 API
// - 根据手机号获取 userid：POST /topapi/v2/user/getbymobile
// - 使用旧版网关，access_token 通过 query string 传递
// ============================================================

use crate::dingtalk::auth::TokenCache;
use serde::Deserialize;

/// 根据手机号查询用户结果
#[derive(Debug, Clone, Deserialize)]
pub struct UserIdResult {
    /// 员工的 userid
    pub userid: Option<String>,
    /// 专属账号的 userid 列表
    pub exclusive_account_userid_list: Option<Vec<String>>,
}

/// 根据手机号获取员工的 userid
///
/// 钉钉 API: POST /topapi/v2/user/getbymobile
/// 文档: https://open.dingtalk.com/document/orgapp/obtain-the-userid-of-your-mobile-phone-number
///
/// 参数:
/// - token: TokenCache，用于获取 access_token
/// - mobile: 手机号（如 "13800138000"）
///
/// 返回: UserIdResult { userid, exclusive_account_userid_list }
pub async fn get_userid_by_mobile(
    token: &TokenCache,
    mobile: &str,
) -> Result<UserIdResult, String> {
    let access_token = token.get_token().await?;
    let url = format!(
        "https://oapi.dingtalk.com/topapi/v2/user/getbymobile?access_token={}",
        access_token
    );

    let body = serde_json::json!({
        "mobile": mobile,
        "support_exclusive_account_search": true,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let full_body: serde_json::Value = resp.json().await.map_err(|e| {
        format!("解析响应失败: {}", e)
    })?;

    // 检查 errcode
    let errcode = full_body["errcode"].as_i64().unwrap_or(-1);
    if errcode != 0 {
        let errmsg = full_body["errmsg"]
            .as_str()
            .unwrap_or("未知错误");

        // 根据错误码给出中文提示
        let hint = match errcode {
            60121 => "该手机号未找到对应的钉钉用户".to_string(),
            60011 => "权限不足，请在钉钉开放平台配置通讯录权限".to_string(),
            _ => format!("钉钉 API 错误 (errcode={}): {}", errcode, errmsg),
        };
        return Err(hint);
    }

    let userid = full_body["result"]["userid"]
        .as_str()
        .map(|s| s.to_string());

    let exclusive_list: Vec<String> = full_body["result"]["exclusive_account_userid_list"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    // 合并所有 userid（去重，主 userid 排在最前）
    let mut all_ids: Vec<String> = Vec::new();
    if let Some(ref uid) = userid {
        all_ids.push(uid.clone());
    }
    for id in &exclusive_list {
        if !all_ids.contains(id) {
            all_ids.push(id.clone());
        }
    }

    if all_ids.is_empty() {
        return Err("未找到该手机号对应的钉钉用户，请确认手机号是否正确".into());
    }

    Ok(UserIdResult {
        userid,
        exclusive_account_userid_list: if exclusive_list.is_empty() {
            None
        } else {
            Some(exclusive_list)
        },
    })
}

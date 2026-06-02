// ============================================================
// 钉钉日志 API 对接
// - 模板列表：POST oapi.dingtalk.com/topapi/report/template/listbyuserid
// - 日志列表：POST oapi.dingtalk.com/topapi/report/list
// - 以上接口均使用旧版网关，access_token 通过 query string 传递
// ============================================================

use crate::dingtalk::auth::TokenCache;

/// 日志模板信息
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, PartialEq)]
pub struct Template {
    pub id: String,    // report_code（钉钉日志模板唯一标识）
    pub name: String,  // 模板名称，如 "日报"
    pub icon: Option<String>,
}

/// 日志提交记录
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct ReportStat {
    pub stat_date: String,       // 'YYYY-MM-DD'（提交时间对应的日期）
    pub has_report: bool,
    pub report_count: i32,
    pub report_ids: Vec<String>,
}

// ============================================================
// API 调用
// ============================================================

/// 拉取企业下的日志模板列表
///
/// 钉钉 API: POST /topapi/report/template/listbyuserid
/// 文档: https://open.dingtalk.com/document/orgapp/obtains-the-list-of-visible-log-templates-based-on-the
pub async fn fetch_templates(
    token: &TokenCache,
    user_id: &str,
) -> Result<Vec<Template>, String> {
    let access_token = token.get_token().await?;
    let url = format!(
        "https://oapi.dingtalk.com/topapi/report/template/listbyuserid?access_token={}",
        access_token
    );

    let body = serde_json::json!({
        "userid": user_id,
        "offset": 0,
        "size": 100,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("拉取模板列表失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("模板列表接口返回 HTTP {}: {}", status, text));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| {
        format!("解析模板列表响应失败: {}", e)
    })?;

    log::debug!(
        "模板列表原始响应: {}",
        serde_json::to_string_pretty(&result).unwrap_or_default()
    );

    // 检查钉钉错误码
    let errcode = result["errcode"].as_i64().unwrap_or(-1);
    if errcode != 0 {
        let errmsg = result["errmsg"].as_str().unwrap_or("未知错误");
        return Err(format!("钉钉 API 错误 (errcode={}): {}", errcode, errmsg));
    }

    parse_template_list_response(&result)
}

/// 查询指定用户在指定时间段内的日报提交记录
///
/// 钉钉 API: POST /topapi/report/list
/// 文档: https://open.dingtalk.com/document/isvapp/obtains-a-list-of-the-logs-that-are-sent-by
pub async fn get_reports(
    token: &TokenCache,
    user_id: &str,
    template_name: &str,
    start_time: i64,   // 毫秒时间戳
    end_time: i64,     // 毫秒时间戳
) -> Result<Vec<ReportStat>, String> {
    let access_token = token.get_token().await?;
    let url = format!(
        "https://oapi.dingtalk.com/topapi/report/list?access_token={}",
        access_token
    );

    let body = serde_json::json!({
        "userid": user_id,
        "template_name": template_name,
        "start_time": start_time,
        "end_time": end_time,
        "cursor": 0,
        "size": 100,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("查询日志列表失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("日志列表接口返回 HTTP {}: {}", status, text));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| {
        format!("解析日志列表响应失败: {}", e)
    })?;

    log::debug!(
        "日志列表原始响应: {}",
        serde_json::to_string_pretty(&result).unwrap_or_default()
    );

    // 检查钉钉错误码
    let errcode = result["errcode"].as_i64().unwrap_or(-1);
    if errcode != 0 {
        let errmsg = result["errmsg"].as_str().unwrap_or("未知错误");
        return Err(format!("钉钉 API 错误 (errcode={}): {}", errcode, errmsg));
    }

    parse_report_list_response(&result)
}

// ============================================================
// 响应解析（提取为独立函数以支持单元测试）
// ============================================================

/// 解析模板列表 API 响应
///
/// 响应格式:
/// ```json
/// {
///   "errcode": 0,
///   "result": {
///     "template_list": [
///       { "name": "日报", "report_code": "abc123", "icon_url": "https://..." },
///       ...
///     ],
///     "next_cursor": 50
///   }
/// }
/// ```
fn parse_template_list_response(body: &serde_json::Value) -> Result<Vec<Template>, String> {
    let template_list = body
        .get("result")
        .and_then(|r| r.get("template_list"))
        .and_then(|v| v.as_array())
        .ok_or_else(|| {
            format!(
                "模板列表响应格式异常，缺少 result.template_list。原始响应: {}",
                serde_json::to_string(body).unwrap_or_default()
            )
        })?;

    let mut templates = Vec::new();
    for item in template_list {
        let name = item["name"].as_str().unwrap_or("").to_string();
        // 钉钉模板标识字段为 report_code（不是 template_id）
        let id = item["report_code"].as_str().unwrap_or("").to_string();
        let icon = item["icon_url"].as_str().map(|s| s.to_string());

        if name.is_empty() || id.is_empty() {
            log::warn!("跳过无效模板条目: {:?}", item);
            continue;
        }

        templates.push(Template { id, name, icon });
    }

    log::info!("成功解析 {} 个日志模板", templates.len());
    Ok(templates)
}

/// 解析日志列表 API 响应，按日期聚合为 ReportStat
///
/// 响应格式:
/// ```json
/// {
///   "errcode": 0,
///   "result": {
///     "data_list": [
///       {
///         "create_time": 1605680704000,  // 毫秒时间戳
///         "template_name": "日报",
///         ...
///       }
///     ],
///     "has_more": false
///   }
/// }
/// ```
fn parse_report_list_response(body: &serde_json::Value) -> Result<Vec<ReportStat>, String> {
    let data_list = body
        .get("result")
        .and_then(|r| r.get("data_list"))
        .and_then(|v| v.as_array())
        .ok_or_else(|| {
            format!(
                "日志列表响应格式异常，缺少 result.data_list。原始响应: {}",
                serde_json::to_string(body).unwrap_or_default()
            )
        })?;

    // 按日期分组统计
    use std::collections::HashMap;
    let mut date_map: HashMap<String, (i32, Vec<String>)> = HashMap::new();

    for item in data_list {
        let create_time_ms = item["create_time"].as_i64().unwrap_or(0);
        if create_time_ms == 0 {
            continue;
        }

        // 毫秒时间戳 → YYYY-MM-DD
        let date_str = timestamp_ms_to_date(create_time_ms);

        let entry = date_map.entry(date_str).or_insert((0, vec![]));
        entry.0 += 1; // count
    }

    let mut stats: Vec<ReportStat> = date_map
        .into_iter()
        .map(|(date, (count, ids))| ReportStat {
            stat_date: date,
            has_report: count > 0,
            report_count: count,
            report_ids: ids,
        })
        .collect();

    // 按日期排序
    stats.sort_by(|a, b| a.stat_date.cmp(&b.stat_date));

    log::info!("成功解析 {} 天的日志记录", stats.len());
    Ok(stats)
}

// ============================================================
// 工具函数
// ============================================================

/// 毫秒时间戳 → YYYY-MM-DD 字符串
fn timestamp_ms_to_date(ms: i64) -> String {
    let secs = ms / 1000;
    // 用 chrono 将 Unix 时间戳转为日期
    chrono::DateTime::from_timestamp(secs, ((ms % 1000) * 1_000_000) as u32)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| {
            log::warn!("无效时间戳: {}", ms);
            String::from("unknown")
        })
}

// ============================================================
// 单元测试
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_template_list_success() {
        // 模拟钉钉 API 真实返回格式
        let body = json!({
            "errcode": 0,
            "errmsg": "ok",
            "result": {
                "template_list": [
                    {
                        "name": "日报",
                        "report_code": "abc123def456",
                        "icon_url": "https://static.dingtalk.com/media/icon1.png"
                    },
                    {
                        "name": "周报",
                        "report_code": "xyz789",
                        "icon_url": null
                    }
                ],
                "next_cursor": 50
            }
        });

        let templates = parse_template_list_response(&body).unwrap();
        assert_eq!(templates.len(), 2);
        assert_eq!(templates[0].name, "日报");
        assert_eq!(templates[0].id, "abc123def456");
        assert_eq!(
            templates[0].icon,
            Some("https://static.dingtalk.com/media/icon1.png".into())
        );
        assert_eq!(templates[1].name, "周报");
        assert_eq!(templates[1].id, "xyz789");
        assert_eq!(templates[1].icon, None);
    }

    #[test]
    fn test_parse_template_list_empty() {
        let body = json!({
            "errcode": 0,
            "result": {
                "template_list": [],
                "next_cursor": 0
            }
        });

        let templates = parse_template_list_response(&body).unwrap();
        assert!(templates.is_empty());
    }

    #[test]
    fn test_parse_template_list_missing_result() {
        let body = json!({
            "errcode": 1,
            "errmsg": "permission denied"
        });

        let result = parse_template_list_response(&body);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("result.template_list"));
    }

    #[test]
    fn test_parse_report_list_success() {
        let body = json!({
            "errcode": 0,
            "errmsg": "ok",
            "result": {
                "data_list": [
                    {
                        "create_time": 1717200000000u64, // 2024-06-01 00:00:00 UTC
                        "template_name": "日报",
                        "creator_name": "测试"
                    },
                    {
                        "create_time": 1717286400000u64, // 2024-06-02 00:00:00 UTC
                        "template_name": "日报"
                    },
                    {
                        "create_time": 1717286500000u64, // 同一天的另一篇
                        "template_name": "日报"
                    }
                ],
                "has_more": false,
                "next_cursor": 0
            }
        });

        let stats = parse_report_list_response(&body).unwrap();
        // 应该聚合成 2 天（6月1日和6月2日），6月2日有2篇
        assert_eq!(stats.len(), 2);
        // 按日期排序
        assert_eq!(stats[0].stat_date, "2024-06-01");
        assert!(stats[0].has_report);
        assert_eq!(stats[0].report_count, 1);
        assert_eq!(stats[1].stat_date, "2024-06-02");
        assert!(stats[1].has_report);
        assert_eq!(stats[1].report_count, 2);
    }

    #[test]
    fn test_parse_report_list_empty() {
        let body = json!({
            "errcode": 0,
            "result": {
                "data_list": [],
                "has_more": false
            }
        });

        let stats = parse_report_list_response(&body).unwrap();
        assert!(stats.is_empty());
    }

    #[test]
    fn test_parse_report_list_missing_result() {
        let body = json!({
            "errcode": 1,
            "errmsg": "invalid userid"
        });

        let result = parse_report_list_response(&body);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("result.data_list"));
    }

    #[test]
    fn test_timestamp_ms_to_date() {
        // 2024-06-15 10:30:00 UTC = 1718447400000 ms
        let date = timestamp_ms_to_date(1718447400000);
        assert_eq!(date, "2024-06-15");
    }

    #[test]
    fn test_timestamp_ms_to_date_invalid() {
        let date = timestamp_ms_to_date(0);
        // 0 毫秒 = Unix epoch = 取决于时区，可能是 1970-01-01
        // 我们不关心具体值，只要求不 panic
        assert!(!date.is_empty());
    }
}

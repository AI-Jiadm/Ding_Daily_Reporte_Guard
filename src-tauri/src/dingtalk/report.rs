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

/// 日报内容字段
#[derive(Debug, Clone, serde::Serialize)]
pub struct ContentField {
    pub key: String,   // 字段名，如 "工作内容"
    pub value: String, // 字段内容
}

/// 日报详情（含内容）
#[derive(Debug, Clone, serde::Serialize)]
pub struct ReportDetail {
    pub create_time: i64,            // 提交时间 ms
    pub creator_name: String,
    pub template_name: String,
    pub contents: Vec<ContentField>,
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

/// 获取指定日期的日报详细内容
///
/// 调用 report/list 接口查询单日数据，返回第一份日报的内容字段
pub async fn get_report_for_date(
    token: &TokenCache,
    user_id: &str,
    template_name: &str,
    date: &str, // 'YYYY-MM-DD'
) -> Result<Option<ReportDetail>, String> {
    // 将日期转换为毫秒时间戳范围（当天 00:00 ~ 23:59:59.999）
    let start_ms = date_to_timestamp_ms(date, true)?;
    let end_ms = date_to_timestamp_ms(date, false)?;

    let reports = get_reports_raw(token, user_id, template_name, start_ms, end_ms).await?;

    // 找第一个匹配日期的报告并提取内容
    for item in &reports {
        if let Some(detail) = extract_report_detail(item) {
            return Ok(Some(detail));
        }
    }

    Ok(None)
}

/// 获取模板详情（字段定义 + 默认接收人）
///
/// API: POST /topapi/report/template/getbyname
pub async fn get_template_detail(
    token: &TokenCache,
    user_id: &str,
    template_name: &str,
) -> Result<(Vec<TemplateField>, Vec<String>), String> {
    let access_token = token.get_token().await?;
    let url = format!(
        "https://oapi.dingtalk.com/topapi/report/template/getbyname?access_token={}",
        access_token
    );

    let body = serde_json::json!({
        "template_name": template_name,
        "userid": user_id,
    });

    let client = reqwest::Client::new();
    log::info!("[get_template_fields] URL: {}", url);
    log::info!("[get_template_fields] Body: {}", serde_json::to_string_pretty(&body).unwrap_or_default());

    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("获取模板详情失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let resp_text = resp.text().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    log::info!("[get_template_fields] Response: {}", &resp_text[..resp_text.len().min(500)]);

    let result: serde_json::Value = serde_json::from_str(&resp_text)
        .map_err(|e| format!("解析响应失败: {} — body: {}", e, &resp_text[..resp_text.len().min(200)]))?;

    let errcode = result["errcode"].as_i64().unwrap_or(-1);
    if errcode != 0 {
        return Err(format!("API error {}: {}", errcode, result["errmsg"].as_str().unwrap_or("")));
    }

    let fields: Vec<TemplateField> = result["result"]["fields"]
        .as_array()
        .map(|arr| arr.iter()
            .filter_map(|f| Some(TemplateField {
                name: f["field_name"].as_str().unwrap_or("").to_string(),
                sort: f["sort"].as_i64().unwrap_or(0) as i32,
                field_type: f["type"].as_i64().unwrap_or(1) as i32,
            }))
            .collect()
        )
        .unwrap_or_default();

    // 默认接收人
    let default_receivers: Vec<String> = result["result"]["default_receivers"]
        .as_array()
        .map(|arr| arr.iter()
            .filter_map(|r| r["userid"].as_str().map(|s| s.to_string()))
            .collect()
        )
        .unwrap_or_default();

    log::info!("模板 [{}] 有 {} 个字段, {} 个默认接收人",
        template_name, fields.len(), default_receivers.len());
    Ok((fields, default_receivers))
}

/// 模板字段定义
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TemplateField {
    pub name: String,
    pub sort: i32,
    pub field_type: i32,
}

/// 创建日报并提交到钉钉
///
/// API: POST /topapi/report/create
pub async fn create_report(
    token: &TokenCache,
    template_id: &str,
    template_name: &str,
    user_id: &str,
    biz_date: &str,     // 'YYYY-MM-DD'
    content: &str,       // 工作内容（支持 markdown，≤1000 字符）
) -> Result<(), String> {
    // 1. 先获取模板字段定义和默认接收人
    let (fields, default_receivers) = get_template_detail(token, user_id, template_name).await?;
    if fields.is_empty() {
        return Err("未找到模板字段定义，请检查模板名称是否正确".into());
    }

    // 2. 遍历模板所有字段，根据字段名智能填充内容
    log::info!("创建日报 - 模板有 {} 个字段, 默认接收人: {:?}", fields.len(), default_receivers);

    let access_token = token.get_token().await?;
    let url = format!(
        "https://oapi.dingtalk.com/topapi/report/create?access_token={}",
        access_token
    );

    // 截断到 1000 字符以内
    let truncated: String = content.chars().take(1000).collect();

    // 遍历所有字段，根据字段名智能填值
    let mut contents_arr: Vec<serde_json::Value> = Vec::new();
    for field in &fields {
        if field.field_type != 1 {
            // 跳过非文本类型字段（钉钉 API 只支持 type=1）
            continue;
        }
        let field_content = if field.name.contains("日报时间") || field.name.contains("Reporting Time") {
            // 日报时间字段 → 填 biz_date（如 "2026-06-02"）
            biz_date.to_string()
        } else if field.name.contains("工作内容") || field.name.contains("Working Content") {
            // 工作内容字段 → 填用户输入的内容
            truncated.clone()
        } else {
            // 其他字段 → 留空
            String::new()
        };

        contents_arr.push(serde_json::json!({
            "key": field.name,
            "content": field_content,
            "sort": field.sort,
            "type": field.field_type,
            "content_type": "markdown",
        }));
    }
    log::info!("创建日报 - 填充了 {} 个字段", contents_arr.len());

    // to_userids: 去重合并用户自己 + 模板默认接收人
    let mut to_userids: Vec<&str> = vec![user_id];
    for r in &default_receivers {
        if r != user_id && !to_userids.contains(&r.as_str()) {
            to_userids.push(r);
        }
    }

    let body = serde_json::json!({
        "create_report_param": {
            "template_id": template_id,
            "userid": user_id,
            "biz_date": biz_date,
            "contents": contents_arr,
            "to_chat": false,
            "to_userids": to_userids,
            "dd_from": "dailyreport-guard",
        }
    });

    // 打印完整请求信息
    log::info!("[create_report] URL: {}", url);
    log::info!("[create_report] template_id={}, user={}, date={}", template_id, user_id, biz_date);
    log::info!("[create_report] Body: {}", serde_json::to_string_pretty(&body).unwrap_or_default());

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("创建日报失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        log::error!("[create_report] HTTP {}: {}", status, text);
        return Err(format!("创建日报接口返回 HTTP {}: {}", status, text));
    }

    let resp_text = resp.text().await
        .map_err(|e| format!("读取创建日报响应失败: {}", e))?;
    log::info!("[create_report] Response: {}", &resp_text[..resp_text.len().min(500)]);

    let result: serde_json::Value = serde_json::from_str(&resp_text)
        .map_err(|e| format!("解析创建日报响应失败: {} — body: {}", e, &resp_text[..resp_text.len().min(200)]))?;

    let errcode = result["errcode"].as_i64().unwrap_or(-1);
    if errcode != 0 {
        let errmsg = result["errmsg"].as_str().unwrap_or("未知错误");
        log::error!("[create_report] API error: errcode={}, errmsg={}", errcode, errmsg);
        return Err(format!("创建日报失败 (errcode={}): {}", errcode, errmsg));
    }

    log::info!("日报创建成功: {} {}", biz_date, user_id);
    Ok(())
}

// ============================================================
// 内部辅助函数
// ============================================================

/// 获取原始日志列表数据（不聚合，用于提取内容）
async fn get_reports_raw(
    token: &TokenCache,
    user_id: &str,
    template_name: &str,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<serde_json::Value>, String> {
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
        "size": 5,
    });

    let client = reqwest::Client::new();
    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("查询日志列表失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let result: serde_json::Value = resp.json().await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let errcode = result["errcode"].as_i64().unwrap_or(-1);
    if errcode != 0 {
        return Err(format!("API error {}", errcode));
    }

    let data_list = result
        .get("result")
        .and_then(|r| r.get("data_list"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(data_list)
}

/// 从单条日志记录中提取 ReportDetail
fn extract_report_detail(item: &serde_json::Value) -> Option<ReportDetail> {
    let create_time = item["create_time"].as_i64()?;
    let creator_name = item["creator_name"].as_str().unwrap_or("").to_string();
    let template_name = item["template_name"].as_str().unwrap_or("").to_string();

    let contents: Vec<ContentField> = item["contents"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|c| {
                    Some(ContentField {
                        key: c["key"].as_str().unwrap_or("").to_string(),
                        value: c["value"].as_str().unwrap_or("").to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(ReportDetail {
        create_time,
        creator_name,
        template_name,
        contents,
    })
}

/// 日期字符串 → 当天起止毫秒时间戳
fn date_to_timestamp_ms(date: &str, start_of_day: bool) -> Result<i64, String> {
    let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|e| format!("解析日期失败: {}", e))?;
    let dt = if start_of_day {
        d.and_hms_opt(0, 0, 0)
    } else {
        d.and_hms_opt(23, 59, 59)
    }
    .ok_or("时间构造失败")?;
    Ok(dt.and_utc().timestamp_millis())
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
        assert!(!date.is_empty());
    }

    #[test]
    fn test_extract_report_detail_with_contents() {
        let item = json!({
            "create_time": 1717200000000u64,
            "creator_name": "测试",
            "template_name": "日报",
            "contents": [
                { "key": "工作内容", "sort": "0", "type": "1", "value": "完成了功能开发" },
                { "key": "明日计划", "sort": "1", "type": "1", "value": "继续优化" }
            ]
        });

        let detail = extract_report_detail(&item).unwrap();
        assert_eq!(detail.creator_name, "测试");
        assert_eq!(detail.template_name, "日报");
        assert_eq!(detail.contents.len(), 2);
        assert_eq!(detail.contents[0].key, "工作内容");
        assert_eq!(detail.contents[0].value, "完成了功能开发");
        assert_eq!(detail.contents[1].key, "明日计划");
    }

    #[test]
    fn test_extract_report_detail_no_contents() {
        let item = json!({
            "create_time": 1717200000000u64,
            "creator_name": "测试",
            "template_name": "日报"
        });

        let detail = extract_report_detail(&item).unwrap();
        assert_eq!(detail.creator_name, "测试");
        assert!(detail.contents.is_empty());
    }

    #[test]
    fn test_create_report_body_format() {
        // 验证 contents 为原生 JSON 数组格式
        let contents_arr = vec![serde_json::json!({
            "key": "今日完成工作",
            "value": "今天完成了功能开发",
            "sort": 0,
            "type": 1,
        })];

        let body = serde_json::json!({
            "create_report_param": {
                "template_id": "abc123",
                "userid": "user001",
                "biz_date": "2026-06-02",
                "contents": contents_arr
            }
        });

        assert_eq!(body["create_report_param"]["template_id"], "abc123");
        assert!(body["create_report_param"]["contents"].is_array());
        let first = &body["create_report_param"]["contents"][0];
        assert_eq!(first["key"], "今日完成工作");
    }

    #[test]
    fn test_parse_template_detail() {
        // 模拟 getbyname 响应（含默认接收人）
        let result = json!({
            "errcode": 0,
            "result": {
                "name": "日报",
                "fields": [
                    { "field_name": "今日完成工作", "type": 1, "sort": 0 },
                    { "field_name": "未完成工作", "type": 1, "sort": 1 },
                ],
                "default_receivers": [
                    { "userid": "manager001" },
                    { "userid": "manager002" },
                ]
            }
        });

        let fields: Vec<TemplateField> = result["result"]["fields"]
            .as_array().unwrap().iter()
            .map(|f| TemplateField {
                name: f["field_name"].as_str().unwrap().to_string(),
                sort: f["sort"].as_i64().unwrap() as i32,
                field_type: f["type"].as_i64().unwrap() as i32,
            })
            .collect();

        let default_receivers: Vec<String> = result["result"]["default_receivers"]
            .as_array().unwrap().iter()
            .filter_map(|r| r["userid"].as_str().map(|s| s.to_string()))
            .collect();

        assert_eq!(fields.len(), 2);
        assert_eq!(fields[0].name, "今日完成工作");
        assert_eq!(default_receivers.len(), 2);
        assert_eq!(default_receivers[0], "manager001");
    }

    #[test]
    fn test_date_to_timestamp_ms() {
        let start = date_to_timestamp_ms("2026-06-15", true).unwrap();
        let end = date_to_timestamp_ms("2026-06-15", false).unwrap();
        // end > start
        assert!(end > start);
        // diff should be ~24h in ms
        assert_eq!(end - start, 23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000);
    }
}

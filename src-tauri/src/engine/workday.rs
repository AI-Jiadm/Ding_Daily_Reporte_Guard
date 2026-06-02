// ============================================================
// 工作日判定
// ============================================================

use chrono::{Datelike, NaiveDate};
use crate::holiday::HolidayData;

/// 获取指定月份的所有工作日列表
pub fn get_month_workdays(month: &str, holiday_data: &HolidayData) -> Vec<NaiveDate> {
    // 解析月份字符串 'YYYY-MM'
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return vec![];
    }

    let year: i32 = parts[0].parse().unwrap_or(0);
    let month_num: u32 = parts[1].parse().unwrap_or(0);

    let mut workdays = Vec::new();
    let mut date = match NaiveDate::from_ymd_opt(year, month_num, 1) {
        Some(d) => d,
        None => return vec![],
    };

    // 遍历当月每一天
    while date.month() == month_num {
        if holiday_data.is_workday(date) {
            workdays.push(date);
        }
        date = date.succ_opt().unwrap_or(date);
    }

    workdays
}

/// 判断某天是否已过去（相对于当前日期）
pub fn is_past(date: NaiveDate, today: NaiveDate) -> bool {
    date < today
}

/// 判断是否为今天
pub fn is_today(date: NaiveDate, today: NaiveDate) -> bool {
    date == today
}

/// 判断是否为未来日期
pub fn is_future(date: NaiveDate, today: NaiveDate) -> bool {
    date > today
}

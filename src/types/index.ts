// ============================================================
// 日报守卫 - TypeScript 类型定义
// ============================================================

/** 每日日报状态 */
export type DayStatus =
  | "submitted"   // 已提交 ✅
  | "missing"     // 缺失 ❌
  | "warning"     // 今日预警 ⚠️
  | "future"      // 未来日期
  | "non_workday"; // 非工作日

/** 单日信息 */
export interface DayInfo {
  date: string;        // 'YYYY-MM-DD'
  status: DayStatus;
  isWorkday: boolean;
  hasReport: boolean;
  templateName?: string;
}

/** 月度检查汇总 */
export interface CheckSummary {
  month: string;           // '2026-06'
  totalWorkdays: number;
  submitted: number;
  missing: number;
  missingDates: string[];
  lastCheckedAt: string;   // ISO 8601
}

/** 应用配置（前端用） */
export interface AppConfig {
  appKey: string;
  appSecret: string;
  userId: string;
  selectedTemplateIds: string[];
  isConfigured: boolean;
}

/** 钉钉日志模板 */
export interface Template {
  id: string;
  name: string;
  icon?: string;
}

/** 检查响应（来自 Rust 后端） */
export interface CheckResponse {
  summary: CheckSummary;
  days: DayInfo[];
}

/** 连接测试结果 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  templates?: Template[];
}

/** 应用全局状态 */
export interface AppState {
  config: AppConfig;
  currentMonth: string;
  days: DayInfo[];
  summary: CheckSummary | null;
  isChecking: boolean;
  lastError: string | null;
  templates: Template[];
}

/** 应用全局 Action（useReducer 用） */
export type AppAction =
  | { type: "SET_CONFIG"; config: Partial<AppConfig> }
  | { type: "SET_CONFIGURED"; isConfigured: boolean }
  | { type: "SET_CHECKING"; isChecking: boolean }
  | { type: "SET_CHECK_RESULT"; days: DayInfo[]; summary: CheckSummary }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_TEMPLATES"; templates: Template[] }
  | { type: "SET_MONTH"; month: string };

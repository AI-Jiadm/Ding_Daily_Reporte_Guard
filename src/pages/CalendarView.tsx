import { useEffect, useMemo, useRef } from "react";
import { useAppState } from "../context/AppContext";
import { invoke } from "@tauri-apps/api/core";
import type { DayInfo, CheckSummary } from "../types";
import Calendar from "../components/Calendar";
import SummaryBar from "../components/SummaryBar";

// ============================================================
// 日历视图主页面
// ============================================================
export default function CalendarView() {
  const { state, dispatch } = useAppState();
  const isFirstMount = useRef(true);

  // 启动时自动检查当前月
  useEffect(() => {
    handleCheck();
  }, []);

  // 切换月份时加载缓存数据（跳过一次 API 调用，直接读本地缓存）
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return; // 首次挂载由上面的 handleCheck 负责
    }
    async function loadCachedStatus() {
      try {
        const result = await invoke<{
          summary: CheckSummary;
          days: DayInfo[];
        }>("get_current_status", { month: state.currentMonth });
        if (result.days && result.days.length > 0) {
          dispatch({
            type: "SET_CHECK_RESULT",
            days: result.days,
            summary: result.summary,
          });
        }
      } catch (_) {
        // 缓存可能为空，忽略
      }
    }
    loadCachedStatus();
  }, [state.currentMonth]);

  const handleCheck = async () => {
    dispatch({ type: "SET_CHECKING", isChecking: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const result = await invoke<{
        summary: CheckSummary;
        days: DayInfo[];
      }>("run_check", { month: state.currentMonth });
      dispatch({
        type: "SET_CHECK_RESULT",
        days: result.days,
        summary: result.summary,
      });
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: String(e) });
    } finally {
      dispatch({ type: "SET_CHECKING", isChecking: false });
    }
  };

  // 切换到上个月
  const goToPrevMonth = () => {
    const [year, month] = state.currentMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1); // 上个月
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    dispatch({ type: "SET_MONTH", month: newMonth });
  };

  // 切换到下个月
  const goToNextMonth = () => {
    const [year, month] = state.currentMonth.split("-").map(Number);
    const date = new Date(year, month, 1); // 下个月
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    dispatch({ type: "SET_MONTH", month: newMonth });
  };

  // 月标签（例如 "2026年 6月"）
  const monthLabel = useMemo(() => {
    const [year, month] = state.currentMonth.split("-").map(Number);
    return `${year}年 ${month}月`;
  }, [state.currentMonth]);

  // 是否为当前月
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return state.currentMonth === cur;
  }, [state.currentMonth]);

  return (
    <div style={styles.container}>
      {/* 顶部栏 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>🛡️ 日报守卫</h1>
          <span style={styles.monthBadge}>{monthLabel}</span>
        </div>
        <div style={styles.headerRight}>
          {/* 月份导航 */}
          <div style={styles.nav}>
            <button style={styles.navBtn} onClick={goToPrevMonth}>
              ←
            </button>
            <span style={styles.navLabel}>{monthLabel}</span>
            <button
              style={styles.navBtn}
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
            >
              →
            </button>
          </div>

          <button
            style={{
              ...styles.checkBtn,
              ...(state.isChecking ? styles.checkBtnDisabled : {}),
            }}
            onClick={handleCheck}
            disabled={state.isChecking}
          >
            {state.isChecking ? "⏳ 检查中..." : "🔍 立即检查"}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {state.lastError && (
        <div style={styles.errorBanner}>
          ⚠️ 检查失败: {state.lastError}
          <button
            style={styles.errorRetryBtn}
            onClick={() => dispatch({ type: "SET_ERROR", error: null })}
          >
            ✕
          </button>
        </div>
      )}

      {/* 日历 */}
      <Calendar days={state.days} month={state.currentMonth} />

      {/* 底部汇总条 */}
      {state.summary && (
        <SummaryBar
          summary={state.summary}
          isChecking={state.isChecking}
        />
      )}
    </div>
  );
}

// ============================================================
// 内联样式
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    maxWidth: 800,
    margin: "0 auto",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 22 },
  monthBadge: {
    padding: "2px 10px",
    background: "#1677ff",
    color: "#fff",
    borderRadius: 10,
    fontSize: 13,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  navBtn: {
    padding: "4px 10px",
    background: "#f5f5f5",
    border: "1px solid #d9d9d9",
    borderRadius: 4,
    fontSize: 14,
    cursor: "pointer",
  },
  navLabel: {
    fontSize: 14,
    fontWeight: 500,
    minWidth: 80,
    textAlign: "center",
  },
  checkBtn: {
    padding: "8px 18px",
    background: "#1677ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 500,
    fontSize: 14,
  },
  checkBtnDisabled: {
    opacity: 0.6,
  },
  errorBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "#fff2f0",
    color: "#ff4d4f",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
    border: "1px solid #ffccc7",
  },
  errorRetryBtn: {
    background: "none",
    border: "none",
    color: "#ff4d4f",
    cursor: "pointer",
    fontSize: 16,
  },
};

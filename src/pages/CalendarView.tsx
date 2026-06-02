import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../context/AppContext";
import { invoke } from "@tauri-apps/api/core";
import type { DayInfo, CheckSummary } from "../types";
import Calendar from "../components/Calendar";
import SummaryBar from "../components/SummaryBar";
import SettingsModal from "../components/SettingsModal";

// ============================================================
// 日历视图主页面 — CC Switch 风格
// macOS 原生感：玻璃态工具栏 + 卡片日历 + 平滑过渡
// ============================================================

export default function CalendarView() {
  const { state, dispatch } = useAppState();
  const isFirstMount = useRef(true);
  const [showSettings, setShowSettings] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    async function loadTemplateName() {
      try {
        const config = await invoke<{ selectedTemplateName?: string }>("load_config");
        if (config.selectedTemplateName) setTemplateName(config.selectedTemplateName);
      } catch (_) {}
    }
    loadTemplateName();
  }, []);

  const handleCheck = async () => {
    dispatch({ type: "SET_CHECKING", isChecking: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const result = await invoke<{ summary: CheckSummary; days: DayInfo[] }>(
        "run_check",
        { month: state.currentMonth },
      );
      dispatch({ type: "SET_CHECK_RESULT", days: result.days, summary: result.summary });
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: String(e) });
    } finally {
      dispatch({ type: "SET_CHECKING", isChecking: false });
    }
  };

  useEffect(() => { handleCheck(); }, []);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    (async () => {
      try {
        const result = await invoke<{ summary: CheckSummary; days: DayInfo[] }>(
          "get_current_status",
          { month: state.currentMonth },
        );
        if (result.days?.length) dispatch({ type: "SET_CHECK_RESULT", days: result.days, summary: result.summary });
      } catch (_) {}
    })();
  }, [state.currentMonth]);

  const goToPrevMonth = () => {
    const [y, m] = state.currentMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    dispatch({ type: "SET_MONTH", month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
  };
  const goToNextMonth = () => {
    const [y, m] = state.currentMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    dispatch({ type: "SET_MONTH", month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
  };

  const monthLabel = useMemo(() => {
    const [y, m] = state.currentMonth.split("-").map(Number);
    const names = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
    return `${y}年${names[m - 1]}`;
  }, [state.currentMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return state.currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, [state.currentMonth]);

  return (
    <div style={s.container}>
      {/* === 顶部工具栏 (CC Switch 风格) === */}
      <header style={s.toolbar}>
        {/* 左侧: 月份导航 */}
        <div style={s.navGroup}>
          <button style={s.navBtn} onClick={goToPrevMonth} title="上个月">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={s.monthTitle}>{monthLabel}</span>
          <button style={{...s.navBtn, opacity: isCurrentMonth ? 0.3 : 1}} onClick={goToNextMonth} disabled={isCurrentMonth} title="下个月">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* 中间: 占位 */}
        <div style={{ flex: 1 }} />

        {/* 右侧: 操作按钮组 */}
        <div style={s.actions}>
          <button
            style={{ ...s.toolBtn, ...(state.isChecking ? { opacity: 0.5 } : {}) }}
            onClick={handleCheck}
            disabled={state.isChecking}
            title="立即检查"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{ fontWeight: 500 }}>
              {state.isChecking ? "检查中" : "检查"}
            </span>
          </button>

          <button style={s.settingsBtn} onClick={() => setShowSettings(true)} title="设置">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* === 错误横幅 === */}
      {state.lastError && (
        <div style={s.errorBanner}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{state.lastError}</span>
          <button style={s.errorClose} onClick={() => dispatch({ type: "SET_ERROR", error: null })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* === 日历卡片 === */}
      <Calendar days={state.days} month={state.currentMonth} onRefresh={handleCheck} />

      {/* === 底部汇总 === */}
      {state.summary && <SummaryBar summary={state.summary} isChecking={state.isChecking} />}

      {/* === 设置弹窗 === */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} config={state.config} templateName={templateName} />
      )}
    </div>
  );
}

// ============================================================
// 内联样式
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s: Record<string, any> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--color-bg)",
  },

  // ---- 工具栏 ----
  toolbar: {
    display: "flex",
    alignItems: "center",
    padding: "10px 20px",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-separator)",
    WebkitAppRegion: "drag",
    flexShrink: 0,
    gap: 12,
  },
  navGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    WebkitAppRegion: "no-drag",
  },
  navBtn: {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--color-text)",
    minWidth: 110,
    textAlign: "center",
    userSelect: "none",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    WebkitAppRegion: "no-drag",
  },
  toolBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    background: "var(--color-primary)",
    color: "#fff",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition-fast)",
  },
  settingsBtn: {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    marginLeft: 2,
  },

  // ---- 错误横幅 ----
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "12px 20px 0",
    padding: "10px 14px",
    background: "var(--color-danger-light)",
    color: "var(--color-danger)",
    borderRadius: "var(--radius-md)",
    fontSize: 13,
    flexShrink: 0,
  },
  errorClose: {
    marginLeft: "auto",
    background: "none",
    color: "inherit",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  },
};

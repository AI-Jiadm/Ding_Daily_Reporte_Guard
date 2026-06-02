import type { DayInfo } from "../types";

// ============================================================
// 日期详情弹窗 — CC Switch 风格 modal
// ============================================================

interface DayDetailProps {
  day: DayInfo;
  onClose: () => void;
}

const STATUS_TEXT: Record<string, { title: string; desc: string; bg: string; fg: string }> = {
  submitted: { title: "已提交", desc: "当日日报已提交", bg: "var(--color-success-light)", fg: "var(--color-success)" },
  missing: { title: "缺失", desc: "该工作日未提交日报", bg: "var(--color-danger-light)", fg: "var(--color-danger)" },
  warning: { title: "待提交", desc: "今天还没写，快去提交", bg: "var(--color-warning-light)", fg: "var(--color-warning)" },
  future: { title: "未来日期", desc: "", bg: "var(--color-surface-secondary)", fg: "var(--color-text-tertiary)" },
  non_workday: { title: "非工作日", desc: "", bg: "var(--color-surface-secondary)", fg: "var(--color-text-tertiary)" },
};

export default function DayDetail({ day, onClose }: DayDetailProps) {
  const info = STATUS_TEXT[day.status] || STATUS_TEXT.future;

  const fmtDate = (ds: string) => {
    const d = new Date(ds + "T00:00:00");
    const w = ["日", "一", "二", "三", "四", "五", "六"];
    return `${ds} 星期${w[d.getDay()]}`;
  };

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>
        {/* 标题 */}
        <div style={st.header}>
          <span style={st.date}>{fmtDate(day.date)}</span>
          <button style={st.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 状态标签 */}
        <div style={{ ...st.badge, background: info.bg, color: info.fg }}>
          {info.title}
        </div>

        {/* 详情 */}
        <div style={st.details}>
          <div style={st.row}>
            <span style={st.label}>状态</span>
            <span>{info.title}</span>
          </div>
          {day.isWorkday && !day.hasReport && day.status !== "future" && day.status !== "non_workday" && (
            <div style={st.row}>
              <span style={st.label}>提交</span>
              <span>未提交</span>
            </div>
          )}
          {day.hasReport && (
            <div style={st.row}>
              <span style={st.label}>提交</span>
              <span style={{ color: "var(--color-success)" }}>已提交</span>
            </div>
          )}
          {day.templateName && (
            <div style={st.row}>
              <span style={st.label}>模板</span>
              <span>{day.templateName}</span>
            </div>
          )}
        </div>

        {/* 提示 */}
        {day.status === "missing" && (
          <div style={{ ...st.tip, background: "var(--color-danger-light)", color: "var(--color-danger)" }}>
            钉钉日志支持补交，补交后下次检查自动更新状态
          </div>
        )}
        {day.status === "warning" && (
          <div style={{ ...st.tip, background: "var(--color-warning-light)", color: "var(--color-warning)" }}>
            建议在 17:30 前完成今天日报，避免忘记
          </div>
        )}
      </div>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.25)",
    backdropFilter: "blur(4px)",
    display: "flex", justifyContent: "center", alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "var(--color-surface)",
    borderRadius: "var(--radius-xl)",
    padding: 24,
    maxWidth: 360, width: "88%",
    boxShadow: "var(--shadow-lg)",
    animation: "fadeIn 200ms ease",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 14,
  },
  date: { fontSize: 16, fontWeight: 600, color: "var(--color-text)" },
  close: {
    background: "none", color: "var(--color-text-tertiary)",
    cursor: "pointer", padding: 2, display: "flex",
  },
  badge: {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    fontSize: 13, fontWeight: 600,
    marginBottom: 16,
  },
  details: {
    display: "flex", flexDirection: "column", gap: 8,
    marginBottom: 16, fontSize: 14,
  },
  row: {
    display: "flex", justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid var(--color-separator)",
  },
  label: { color: "var(--color-text-secondary)", fontWeight: 500 },
  tip: {
    padding: "10px 14px", borderRadius: "var(--radius-sm)",
    fontSize: 12, lineHeight: 1.6,
  },
};

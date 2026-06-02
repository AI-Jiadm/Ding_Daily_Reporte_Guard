import type { CheckSummary } from "../types";

// ============================================================
// 底部汇总条 — 状态色背景 + 无 emoji
// ============================================================

interface SummaryBarProps {
  summary: CheckSummary;
  isChecking: boolean;
}

export default function SummaryBar({ summary, isChecking }: SummaryBarProps) {
  const hasMissing = summary.missing > 0;
  const allClear = !hasMissing && summary.totalWorkdays > 0;

  const bg = hasMissing
    ? "var(--color-danger-light)"
    : allClear
      ? "var(--color-success-light)"
      : "var(--color-surface-secondary)";
  const fg = hasMissing
    ? "var(--color-danger)"
    : allClear
      ? "var(--color-success)"
      : "var(--color-text-secondary)";
  const border = hasMissing
    ? "var(--color-danger)"
    : allClear
      ? "var(--color-success)"
      : "var(--color-border)";

  return (
    <div
      style={{
        ...s.bar,
        background: bg,
        borderTop: `1px solid ${border}30`,
        color: fg,
      }}
    >
      <div style={s.left}>
        {isChecking ? (
          <span style={s.loading}>检查中...</span>
        ) : hasMissing ? (
          <>
            <span style={s.count}>{summary.missing}</span>
            <span>天缺失</span>
            <span style={s.dates}>{summary.missingDates.join("、")}</span>
          </>
        ) : allClear ? (
          <span>
            全部完成 · {summary.submitted}/{summary.totalWorkdays} 工作日
          </span>
        ) : (
          <span>暂无数据</span>
        )}
      </div>
      <div style={s.right}>
        <span style={s.ratio}>
          {summary.totalWorkdays > 0
            ? `${summary.submitted}/${summary.totalWorkdays}`
            : "--"}
        </span>
        {summary.lastCheckedAt && (
          <span style={s.time}>{fmt(summary.lastCheckedAt)}</span>
        )}
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    fontSize: 13,
    flexShrink: 0,
  },
  left: { display: "flex", alignItems: "center", gap: 6 },
  right: { display: "flex", alignItems: "center", gap: 12, fontSize: 12 },
  count: { fontWeight: 700, fontSize: 20, lineHeight: 1 },
  dates: { opacity: 0.7, fontSize: 12 },
  loading: { fontWeight: 500, opacity: 0.7 },
  ratio: { fontWeight: 600, fontSize: 14 },
  time: { color: "var(--color-text-tertiary)", fontSize: 11 },
};

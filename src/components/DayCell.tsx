import type { DayInfo } from "../types";

// ============================================================
// 日期单元格 — 全背景着色，缺失一目了然
// missing  = 红色渐变背景 + 粗体数字
// submitted = 淡绿背景 + 绿色数字
// warning  = 橙黄背景 + 粗体数字（今天还没写）
// future / non_workday = 灰淡
// ============================================================

interface DayCellProps {
  day: DayInfo;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "已写",
  missing: "缺失",
  warning: "待写",
  future: "",
  non_workday: "",
};

export default function DayCell({ day, isSelected, onClick }: DayCellProps) {
  const dayNum = parseInt(day.date.split("-")[2], 10);
  const { status } = day;
  const isDim = status === "future" || status === "non_workday";
  const isInteractive = !isDim;

  // 按状态决定整格样式
  const cellStyle: React.CSSProperties = {
    ...base,
    cursor: isInteractive ? "pointer" : "default",
    outline: isSelected ? `2px solid var(--color-primary)` : "none",
    outlineOffset: -2,
    opacity: isDim ? 0.3 : 1,
  };

  // 动态背景 + 文字色
  if (status === "missing") {
    cellStyle.background = "var(--color-danger-light)";
    cellStyle.border = "1px solid rgba(255,59,48,0.25)";
  } else if (status === "submitted") {
    cellStyle.background = "var(--color-success-light)";
  } else if (status === "warning") {
    cellStyle.background = "var(--color-warning-light)";
    cellStyle.border = "1px solid rgba(255,149,0,0.3)";
  }

  const numStyle: React.CSSProperties = {
    ...num,
    fontWeight: (status === "missing" || status === "warning") ? 700 : 500,
    color: isDim
      ? "var(--color-text-tertiary)"
      : status === "missing"
        ? "var(--color-danger)"
        : status === "submitted"
          ? "var(--color-success)"
          : status === "warning"
            ? "var(--color-warning)"
            : "var(--color-text)",
  };

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      title={`${day.date}  ${STATUS_LABELS[status] || ""}`}
      style={cellStyle}
    >
      {/* 缺失标记: 底部小红条 */}
      {status === "missing" && <div style={bar} />}
      {/* 今天待写标记: 底部橙条 */}
      {status === "warning" && <div style={{ ...bar, background: "var(--color-warning)" }} />}

      <span style={numStyle}>{dayNum}</span>

      {/* 状态文字缩写 */}
      {status === "missing" && <span style={label}>缺失</span>}
      {status === "warning" && <span style={{ ...label, color: "var(--color-warning)" }}>待写</span>}
      {status === "submitted" && <span style={{ ...label, color: "var(--color-success)" }}>✓</span>}
    </div>
  );
}

const base: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  fontSize: 13,
  transition: "all 150ms ease",
  userSelect: "none",
  minHeight: 0,
  minWidth: 0,
  padding: "3px 2px",
  position: "relative",
  overflow: "hidden",
};

const num: React.CSSProperties = {
  fontWeight: 500,
  fontSize: 15,
  lineHeight: 1.2,
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "var(--color-danger)",
  lineHeight: 1,
  marginTop: 1,
};

// 底部小色条，双重强调
const bar: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: 2.5,
  background: "var(--color-danger)",
  borderRadius: "0 0 var(--radius-sm) var(--radius-sm)",
};

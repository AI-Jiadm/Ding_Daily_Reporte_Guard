import type { DayInfo } from "../types";

// ============================================================
// 日期单元格
// 根据日报状态显示不同颜色和图标
// ============================================================

interface DayCellProps {
  day: DayInfo;
  isSelected: boolean;
  onClick: () => void;
}

// 状态 → 样式映射
const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; icon: string; label: string }
> = {
  submitted: { bg: "#f6ffed", color: "#52c41a", icon: "✅", label: "已写" },
  missing: { bg: "#fff2f0", color: "#ff4d4f", icon: "❌", label: "缺失" },
  warning: { bg: "#fff7e6", color: "#fa8c16", icon: "⚠️", label: "待写" },
  future: { bg: "#fafafa", color: "#d9d9d9", icon: "", label: "未来" },
  non_workday: { bg: "#fafafa", color: "#d9d9d9", icon: "", label: "休息" },
};

export default function DayCell({ day, isSelected, onClick }: DayCellProps) {
  const style = STATUS_STYLES[day.status] || STATUS_STYLES.future;
  const dayNum = parseInt(day.date.split("-")[2], 10);

  return (
    <div
      onClick={onClick}
      title={`${day.date} - ${style.label}`}
      style={{
        ...styles.cell,
        background: style.bg,
        border: isSelected
          ? `2px solid var(--color-primary, #1677ff)`
          : "1px solid transparent",
        cursor:
          day.status === "future" || day.status === "non_workday"
            ? "default"
            : "pointer",
        opacity: day.status === "future" || day.status === "non_workday" ? 0.5 : 1,
      }}
    >
      <span style={{ ...styles.dayNum, color: style.color }}>{dayNum}</span>
      {style.icon && <span style={styles.icon}>{style.icon}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cell: {
    aspectRatio: "1",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    fontSize: 14,
    transition: "all 0.15s ease",
    userSelect: "none",
  },
  dayNum: {
    fontWeight: 600,
    fontSize: 16,
  },
  icon: {
    fontSize: 12,
    marginTop: 2,
  },
};

import type { CheckSummary } from "../types";

// ============================================================
// 底部汇总条
// 始终可见，一眼能看到本月缺失情况
// ============================================================

interface SummaryBarProps {
  summary: CheckSummary;
  isChecking: boolean;
}

export default function SummaryBar({ summary, isChecking }: SummaryBarProps) {
  const hasMissing = summary.missing > 0;
  const allClear = summary.missing === 0 && summary.totalWorkdays > 0;
  const noData = summary.totalWorkdays === 0;

  return (
    <div
      style={{
        ...styles.bar,
        ...(hasMissing ? styles.barDanger : {}),
        ...(allClear ? styles.barSuccess : {}),
        ...(noData ? styles.barNeutral : {}),
      }}
    >
      <div style={styles.left}>
        {isChecking && <span style={styles.checking}>⏳ 检查中...</span>}

        {!isChecking && hasMissing && (
          <>
            <span style={styles.alertIcon}>⚠️</span>
            <span style={styles.missingCount}>{summary.missing} 天缺失</span>
            <span style={styles.missingDates}>
              ({summary.missingDates.join("、")})
            </span>
          </>
        )}

        {!isChecking && allClear && (
          <span style={styles.allClearText}>
            🎉 本月全部完成！已写 {summary.submitted}/{summary.totalWorkdays} 个工作日
          </span>
        )}

        {!isChecking && noData && (
          <span style={styles.noDataText}>暂无检查数据，点击"立即检查"</span>
        )}
      </div>

      <div style={styles.right}>
        <span style={styles.progress}>
          {summary.totalWorkdays > 0
            ? `${summary.submitted}/${summary.totalWorkdays}`
            : "—"}
        </span>
        {summary.lastCheckedAt && (
          <span style={styles.checkedTime}>
            上次检查: {formatTime(summary.lastCheckedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// 格式化 ISO 时间为可读格式
function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

// ============================================================
// 内联样式
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    borderRadius: 10,
    fontSize: 14,
    transition: "all 0.3s ease",
  },
  barDanger: {
    background: "#fff2f0",
    border: "1px solid #ffccc7",
    color: "#ff4d4f",
  },
  barSuccess: {
    background: "#f6ffed",
    border: "1px solid #b7eb8f",
    color: "#52c41a",
  },
  barNeutral: {
    background: "#fafafa",
    border: "1px solid #e8e8e8",
    color: "#999",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
  },
  checking: {
    fontWeight: 500,
  },
  alertIcon: { fontSize: 18 },
  missingCount: {
    fontWeight: 700,
    fontSize: 18,
  },
  missingDates: {
    fontSize: 13,
    opacity: 0.8,
  },
  allClearText: { fontWeight: 500 },
  noDataText: { color: "#999" },
  progress: {
    fontWeight: 600,
    fontSize: 14,
  },
  checkedTime: {
    color: "#999",
    fontSize: 11,
  },
};

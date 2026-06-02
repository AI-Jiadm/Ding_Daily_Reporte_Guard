import type { DayInfo } from "../types";

// ============================================================
// 日期详情弹窗
// 点击日历格子后显示当天详情
// ============================================================

interface DayDetailProps {
  day: DayInfo;
  onClose: () => void;
}

const STATUS_TEXT: Record<string, string> = {
  submitted: "已提交 ✅",
  missing: "缺失 ❌ — 该工作日没有提交日报！",
  warning: "待提交 ⚠️ — 今天还没写，快去提交！",
  future: "未来日期",
  non_workday: "非工作日",
};

export default function DayDetail({ day, onClose }: DayDetailProps) {
  const statusText = STATUS_TEXT[day.status] || day.status;

  // 格式化日期为中文
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${dateStr} 周${weekdays[d.getDay()]}`;
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.date}>{formatDate(day.date)}</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            ...styles.statusBadge,
            ...(day.status === "missing" ? styles.statusMissing : {}),
            ...(day.status === "warning" ? styles.statusWarning : {}),
            ...(day.status === "submitted" ? styles.statusSubmitted : {}),
          }}
        >
          {statusText}
        </div>

        <div style={styles.details}>
          {day.isWorkday ? (
            <>
              <p>📋 工作日类型: 法定工作日</p>
              <p>📝 提交状态: {day.hasReport ? "已提交" : "未提交"}</p>
              {day.templateName && <p>📄 模板: {day.templateName}</p>}
            </>
          ) : (
            <p>🔒 非工作日</p>
          )}
        </div>

        {/* 每日小贴士 */}
        {day.status === "missing" && (
          <div style={styles.tip}>
            💡 提示：钉钉日志支持补交。你可以去钉钉补交当天的日报，补交后下次检查会自动更新状态。
          </div>
        )}
        {day.status === "warning" && (
          <div style={{ ...styles.tip, background: "#fff7e6", color: "#fa8c16" }}>
            ⏰ 提醒：建议在 17:30 前完成今天日报，避免忘记！
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 内联样式
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    maxWidth: 380,
    width: "90%",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  date: { fontSize: 18, fontWeight: 600 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    color: "#999",
  },
  statusBadge: {
    padding: "10px 16px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 500,
  },
  statusMissing: {
    background: "#fff2f0",
    color: "#ff4d4f",
    border: "1px solid #ffccc7",
  },
  statusWarning: {
    background: "#fff7e6",
    color: "#fa8c16",
    border: "1px solid #ffd591",
  },
  statusSubmitted: {
    background: "#f6ffed",
    color: "#52c41a",
    border: "1px solid #b7eb8f",
  },
  details: {
    fontSize: 14,
    lineHeight: 2,
    color: "#555",
    marginBottom: 16,
  },
  tip: {
    padding: "10px 14px",
    background: "#fff2f0",
    color: "#ff4d4f",
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.6,
  },
};

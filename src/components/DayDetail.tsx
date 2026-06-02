import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DayInfo } from "../types";

// ============================================================
// 日期详情弹窗 — 查看内容 / 编写日报
// 缺失/待写 → 编辑器模式
// 已写 → 只读查看模式
// ============================================================

interface DayDetailProps {
  day: DayInfo;
  onClose: () => void;
  onSubmitted?: () => void; // 提交后通知父组件刷新
}

interface ContentField {
  key: string;
  value: string;
}

interface ReportContent {
  found: boolean;
  createTime?: number;
  creatorName?: string;
  templateName?: string;
  contents?: ContentField[];
  message?: string;
}

const STATUS_INFO: Record<string, { title: string; bg: string; fg: string }> = {
  submitted: { title: "已提交", bg: "var(--color-success-light)", fg: "var(--color-success)" },
  missing: { title: "缺失", bg: "var(--color-danger-light)", fg: "var(--color-danger)" },
  warning: { title: "待提交", bg: "var(--color-warning-light)", fg: "var(--color-warning)" },
  future: { title: "未来", bg: "var(--color-surface-secondary)", fg: "var(--color-text-tertiary)" },
  non_workday: { title: "休息", bg: "var(--color-surface-secondary)", fg: "var(--color-text-tertiary)" },
};

export default function DayDetail({ day, onClose, onSubmitted }: DayDetailProps) {
  const info = STATUS_INFO[day.status] || STATUS_INFO.future;
  const isEditable = day.status === "missing" || day.status === "warning";

  // 查看模式 state
  const [loading, setLoading] = useState(false);
  const [reportContent, setReportContent] = useState<ReportContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 编辑模式 state
  const [editDate, setEditDate] = useState(day.date);
  const [editContent, setEditContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 已写日 → 加载内容
  useEffect(() => {
    if (day.status !== "submitted") return;
    setLoading(true);
    setLoadError(null);
    invoke<ReportContent>("fetch_report_content", { date: day.date })
      .then((data) => {
        setReportContent(data);
        setLoading(false);
      })
      .catch((e) => {
        setLoadError(String(e));
        setLoading(false);
      });
  }, [day.date, day.status]);

  // 提交日报
  const handleSubmit = async () => {
    if (!editContent.trim()) {
      setSubmitMsg({ text: "请输入工作内容", ok: false });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await invoke("submit_report", {
        date: editDate,
        content: editContent.trim(),
      });
      setSubmitMsg({ text: "提交成功！", ok: true });
      // 短暂延迟后通知刷新
      setTimeout(() => {
        onSubmitted?.();
        onClose();
      }, 800);
    } catch (e) {
      setSubmitMsg({ text: `提交失败: ${e}`, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  // 格式化日期
  const fmtDate = (ds: string) => {
    const d = new Date(ds + "T00:00:00");
    const w = ["日", "一", "二", "三", "四", "五", "六"];
    return `${ds} 星期${w[d.getDay()]}`;
  };

  const fmtTime = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // 提取"工作内容"字段的值
  const workContent = reportContent?.contents
    ?.find((c) => c.key === "工作内容" || c.key.includes("工作"))
    ?.value || reportContent?.contents?.[0]?.value || "";

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
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

        {/* === 已写日：只读查看 === */}
        {day.status === "submitted" && (
          <div style={st.contentArea}>
            {loading && <p style={st.hint}>加载中...</p>}
            {loadError && <p style={{ color: "var(--color-danger)" }}>加载失败: {loadError}</p>}
            {reportContent && !reportContent.found && (
              <p style={st.hint}>该日期暂无日报内容</p>
            )}
            {reportContent?.found && (
              <>
                <div style={st.fieldLabel}>提交时间</div>
                <div style={st.fieldValue}>
                  {reportContent.createTime ? fmtTime(reportContent.createTime) : "--"}
                </div>
                <div style={st.fieldLabel}>工作内容</div>
                <div style={st.contentBox}>{workContent || "（无内容）"}</div>
                {reportContent.contents &&
                  reportContent.contents.filter((c) => c.key !== "工作内容" && !c.key.includes("工作")).length > 0 && (
                    <>
                      <div style={{ ...st.fieldLabel, marginTop: 12 }}>其他字段</div>
                      {reportContent.contents
                        .filter((c) => c.key !== "工作内容" && !c.key.includes("工作"))
                        .map((c, i) => (
                          <div key={i}>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{c.key}: </span>
                            <span style={{ fontSize: 13 }}>{c.value}</span>
                          </div>
                        ))}
                    </>
                  )}
              </>
            )}
          </div>
        )}

        {/* === 缺失/待写：编辑器 === */}
        {isEditable && (
          <div style={st.contentArea}>
            {/* 日期 */}
            <div style={st.fieldLabel}>日报日期</div>
            <input
              style={st.input}
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />

            {/* 内容 */}
            <div style={{ ...st.fieldLabel, marginTop: 14 }}>工作内容</div>
            <textarea
              style={st.textarea}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="写今天的日报内容..."
              rows={6}
              maxLength={1000}
            />
            <div style={st.charCount}>
              {editContent.length}/1000
            </div>

            {/* 消息 */}
            {submitMsg && (
              <div style={{
                ...st.msg,
                background: submitMsg.ok ? "var(--color-success-light)" : "var(--color-danger-light)",
                color: submitMsg.ok ? "var(--color-success)" : "var(--color-danger)",
              }}>
                {submitMsg.text}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              style={{ ...st.submitBtn, opacity: submitting ? 0.5 : 1 }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "提交中..." : "提交日报"}
            </button>
          </div>
        )}

        {/* === 非工作日/未来 === */}
        {day.status !== "submitted" && !isEditable && (
          <div style={st.contentArea}>
            <p style={st.hint}>
              {day.status === "future" ? "未来日期，无需操作" : "非工作日，无需写日报"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
    display: "flex", justifyContent: "center", alignItems: "flex-start",
    paddingTop: "8vh", zIndex: 1000,
  },
  modal: {
    background: "var(--color-surface)",
    borderRadius: "var(--radius-xl)",
    padding: 24,
    maxWidth: 440, width: "90%",
    maxHeight: "80vh", overflow: "auto",
    boxShadow: "var(--shadow-lg)",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12,
  },
  date: { fontSize: 16, fontWeight: 600, color: "var(--color-text)" },
  close: {
    background: "none", color: "var(--color-text-tertiary)",
    cursor: "pointer", padding: 2, display: "flex",
  },
  badge: {
    display: "inline-block", padding: "5px 12px",
    borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
    marginBottom: 16,
  },
  contentArea: { fontSize: 14 },
  hint: { color: "var(--color-text-secondary)", fontSize: 13, textAlign: "center", padding: 16 },
  fieldLabel: {
    fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)",
    marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.3px",
  },
  fieldValue: {
    fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12,
  },
  contentBox: {
    background: "var(--color-surface-secondary)",
    padding: "12px 14px", borderRadius: "var(--radius-sm)",
    fontSize: 14, lineHeight: 1.7, color: "var(--color-text)",
    whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const,
  },
  input: {
    width: "100%", padding: "8px 12px",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
    fontSize: 14, background: "var(--color-surface-secondary)", color: "var(--color-text)",
  },
  textarea: {
    width: "100%", padding: "10px 12px",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
    fontSize: 14, lineHeight: 1.6, fontFamily: "inherit",
    background: "var(--color-surface-secondary)", color: "var(--color-text)",
    resize: "vertical" as const, minHeight: 120,
  },
  charCount: {
    textAlign: "right" as const, fontSize: 11, color: "var(--color-text-tertiary)",
    marginTop: 2, marginBottom: 12,
  },
  msg: {
    padding: "10px 14px", borderRadius: "var(--radius-sm)",
    fontSize: 13, marginBottom: 12,
  },
  submitBtn: {
    width: "100%", padding: "10px 0",
    background: "var(--color-primary)", color: "#fff",
    borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "all 150ms ease",
  },
};

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DayInfo } from "../types";

// ============================================================
// 日期详情弹窗 — CC Switch 风格
// - 查看：已提交日 → 只读展示（提交日期 + 日报时间 + 工作内容 + 备注）
// - 新建：缺失/待写日 → 编辑器（创建新日报）
// ============================================================

interface TemplateField { name: string; sort: number; type: number; }
interface ContentField { key: string; value: string; }
interface ReportContent {
  found: boolean;
  reportId?: string;
  createTime?: number;
  creatorName?: string;
  templateName?: string;
  contents?: ContentField[];
}

interface DayDetailProps { day: DayInfo; onClose: () => void; onSubmitted?: () => void; }

const STATUS_INFO: Record<string, { title: string; bg: string; fg: string }> = {
  submitted: { title: "已提交", bg: "var(--color-success-light)", fg: "var(--color-success)" },
  missing: { title: "缺失", bg: "var(--color-danger-light)", fg: "var(--color-danger)" },
  warning: { title: "待提交", bg: "var(--color-warning-light)", fg: "var(--color-warning)" },
  future: { title: "未来", bg: "var(--color-surface-secondary)", fg: "var(--color-text-tertiary)" },
  non_workday: { title: "休息", bg: "var(--color-surface-secondary)", fg: "var(--color-text-tertiary)" },
};

// ============================================================
// 纯工具函数（组件外部，避免每次渲染重建）
// ============================================================

const fmtDate = (ds: string) => {
  const d = new Date(ds + "T00:00:00");
  return `${ds} 星期${["日","一","二","三","四","五","六"][d.getDay()]}`;
};

const fmtDateTime = (ms: number) => {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
};

/** 判断字段是否为关键字段，返回优先级（越小越靠前），-1 表示非关键 */
const fieldPriority = (key: string): number => {
  if (key.includes("日报时间") || key.includes("Reporting Time")) return 0;
  if (key.includes("工作内容") || key.includes("Working Content")) return 1;
  if (key.includes("备注") || key.includes("Comments")) return 2;
  return -1;
};

// ============================================================
// 组件
// ============================================================

export default function DayDetail({ day, onClose, onSubmitted }: DayDetailProps) {
  const info = STATUS_INFO[day.status] || STATUS_INFO.future;
  const isMissing = day.status === "missing" || day.status === "warning";
  const isSubmitted = day.status === "submitted";

  // ---- 只读模式 state ----
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<ReportContent | null>(null);

  // ---- 编辑器 state ----
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ---- 只读：获取已提交日报内容 ----
  useEffect(() => {
    if (!isSubmitted) return;
    let cancelled = false;

    const fetchContent = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await invoke<ReportContent>("fetch_report_content", { date: day.date });
        if (!cancelled) setReportContent(data);
      } catch (e) {
        if (!cancelled) setLoadError(`加载失败: ${e}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchContent();

    return () => { cancelled = true; };
  }, [day.date, isSubmitted]);

  // ---- 编辑器：加载模板字段 + 预填值 ----
  useEffect(() => {
    if (!isMissing) return;

    (async () => {
      const fs = (await invoke<TemplateField[]>("get_template_fields"))
        .sort((a, b) => a.sort - b.sort);
      setFields(fs);

      const vals: Record<string, string> = {};
      fs.forEach((f) => {
        vals[f.name] = f.name.includes("日报时间") || f.name.includes("Reporting Time")
          ? day.date : "";
      });
      setFieldValues(vals);
    })();
  }, [day.date, isMissing]);

  // ---- 提交 ----
  const handleSubmit = async () => {
    const dateFieldName = fields.find((f) =>
      f.name.includes("日报时间") || f.name.includes("Reporting Time"))?.name;
    const workFieldName = fields.find((f) =>
      f.name.includes("工作内容") || f.name.includes("Working Content"))?.name;

    const dateVal = dateFieldName ? fieldValues[dateFieldName] || "" : "";
    const workVal = workFieldName ? fieldValues[workFieldName] || "" : "";

    if (!dateVal.trim()) { setMsg({ text: "日报时间为必填项", ok: false }); return; }
    if (!workVal.trim()) { setMsg({ text: "工作内容为必填项", ok: false }); return; }

    setSubmitting(true); setMsg(null);
    try {
      await invoke("submit_report", {
        date: dateVal.trim(),
        content: workVal.trim(),
        reportId: null,
      });
      setMsg({ text: "提交成功！", ok: true });
      setTimeout(() => { onSubmitted?.(); onClose(); }, 800);
    } catch (e) {
      setMsg({ text: `提交失败: ${e}`, ok: false });
    } finally { setSubmitting(false); }
  };

  // ---- 只读字段排序：关键字段优先，其余按原始顺序 ----
  const sortedContents = (contents: ContentField[]): ContentField[] => {
    const keyFields: ContentField[] = [];
    const otherFields: ContentField[] = [];
    const seen = new Set<number>();

    // 先收集关键字段（按优先级）
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < contents.length; i++) {
        if (seen.has(i)) continue;
        if (fieldPriority(contents[i].key) === p) {
          keyFields.push(contents[i]);
          seen.add(i);
        }
      }
    }
    // 其余字段
    for (let i = 0; i < contents.length; i++) {
      if (!seen.has(i)) otherFields.push(contents[i]);
    }
    return [...keyFields, ...otherFields];
  };

  // ---- 编辑器字段排序 ----
  const sortedFields = [...fields].sort((a, b) => {
    const aIsDate = a.name.includes("日报时间") || a.name.includes("Reporting Time");
    const bIsDate = b.name.includes("日报时间") || b.name.includes("Reporting Time");
    const aIsWork = a.name.includes("工作内容") || a.name.includes("Working Content");
    const bIsWork = b.name.includes("工作内容") || b.name.includes("Working Content");
    if (aIsDate && !bIsDate) return -1;
    if (!aIsDate && bIsDate) return 1;
    if (aIsWork && !bIsWork) return -1;
    if (!aIsWork && bIsWork) return 1;
    return a.sort - b.sort;
  });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.date}>{fmtDate(day.date)}</span>
          <button style={s.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ ...s.badge, background: info.bg, color: info.fg }}>{info.title}</div>

        {/* ============================================================ */}
        {/* 只读查看（已提交日） */}
        {/* ============================================================ */}
        {isSubmitted && (
          <div>
            {loading && <p style={s.hint}>加载中...</p>}

            {loadError && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ ...s.hint, color: "var(--color-danger)", marginBottom: 10 }}>{loadError}</p>
                <button
                  style={{ ...s.retryBtn }}
                  onClick={() => {
                    setLoading(true);
                    setLoadError(null);
                    invoke<ReportContent>("fetch_report_content", { date: day.date })
                      .then((data) => setReportContent(data))
                      .catch((e) => setLoadError(`加载失败: ${e}`))
                      .finally(() => setLoading(false));
                  }}
                >
                  重试
                </button>
              </div>
            )}

            {!loading && !loadError && reportContent && reportContent.found && reportContent.contents && (
              <>
                {/* 提交日期 */}
                <div style={s.fLabel}>提交日期</div>
                <div style={s.fValue}>
                  {reportContent.createTime ? fmtDateTime(reportContent.createTime) : "--"}
                </div>

                {/* 字段内容：关键字段优先 + 其余字段分隔 */}
                {sortedContents(reportContent.contents).map((c, i, arr) => {
                  const isKey = fieldPriority(c.key) >= 0;
                  // 在第一个非关键字段前插入分隔线
                  const prev = i > 0 ? arr[i - 1] : null;
                  const showDivider = !isKey && prev && fieldPriority(prev.key) >= 0;

                  return (
                    <div key={c.key}>
                      {showDivider && <div style={s.divider} />}
                      <div style={{ ...s.fLabel, marginTop: 10 }}>{c.key}</div>
                      <div style={s.contentBox}>{c.value || "（无内容）"}</div>
                    </div>
                  );
                })}
              </>
            )}

            {!loading && !loadError && reportContent && !reportContent.found && (
              <p style={s.hint}>未找到日报内容</p>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 编辑器（缺失/待写） */}
        {/* ============================================================ */}
        {isMissing && fields.length > 0 && (
          <div>
            {sortedFields.map((f) => {
              const isDate = f.name.includes("日报时间") || f.name.includes("Reporting Time");
              const isWork = f.name.includes("工作内容") || f.name.includes("Working Content");
              const isRemark = f.name.includes("备注") || f.name.includes("Comments");
              const isText = f.type === 1 && !isDate && !isWork;

              if (isDate) {
                return (
                  <div key={f.name} style={{ marginBottom: 14 }}>
                    <div style={s.fLabel}>{f.name} <span style={{ color: "var(--color-danger)" }}>*</span></div>
                    <input style={s.input} type="date" value={fieldValues[f.name] || ""}
                      onChange={(e) => setFieldValues({ ...fieldValues, [f.name]: e.target.value })} />
                  </div>
                );
              }
              if (isWork || isRemark || isText) {
                return (
                  <div key={f.name} style={{ marginBottom: 14 }}>
                    <div style={s.fLabel}>{f.name} {isWork && <span style={{ color: "var(--color-danger)" }}>*</span>}</div>
                    <textarea style={{...s.textarea, minHeight: isWork ? 100 : 60}} value={fieldValues[f.name] || ""}
                      onChange={(e) => setFieldValues({ ...fieldValues, [f.name]: e.target.value })}
                      placeholder={isWork ? "填写日报内容..." : ""} rows={isWork ? 5 : 3} maxLength={1000} />
                    {isWork && <div style={s.charCount}>{(fieldValues[f.name] || "").length}/1000</div>}
                  </div>
                );
              }
              return (
                <div key={f.name} style={{ marginBottom: 8, opacity: 0.45 }}>
                  <div style={s.fLabel}>{f.name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", padding: "4px 0" }}>
                    （不支持编辑）
                  </div>
                </div>
              );
            })}

            {msg && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 12,
                background: msg.ok ? "var(--color-success-light)" : "var(--color-danger-light)",
                color: msg.ok ? "var(--color-success)" : "var(--color-danger)",
              }}>{msg.text}</div>
            )}

            <button style={{ ...s.submitBtn, opacity: submitting ? 0.5 : 1 }}
              onClick={handleSubmit} disabled={submitting}>
              {submitting ? "提交中..." : "提交日报"}
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* 非工作日/未来 — 无内容占位 */}
        {/* ============================================================ */}
        {!isSubmitted && !isMissing && (
          <p style={s.hint}>{day.status === "future" ? "未来日期" : "非工作日，无需写日报"}</p>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",backdropFilter:"blur(4px)",display:"flex",justifyContent:"center",alignItems:"flex-start",paddingTop:"6vh",zIndex:1000 },
  modal: { background:"var(--color-surface)",borderRadius:"var(--radius-xl)",padding:24,maxWidth:460,width:"90%",maxHeight:"85vh",overflow:"auto",boxShadow:"var(--shadow-lg)" },
  header: { display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 },
  date: { fontSize:16,fontWeight:600,color:"var(--color-text)" },
  close: { background:"none",color:"var(--color-text-tertiary)",cursor:"pointer",padding:2,display:"flex" },
  badge: { display:"inline-block",padding:"5px 12px",borderRadius:"var(--radius-sm)",fontSize:13,fontWeight:600,marginBottom:16 },
  hint: { color:"var(--color-text-secondary)",fontSize:13,textAlign:"center",padding:16 },
  fLabel: { fontSize:12,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:5,letterSpacing:"0.3px" },
  fValue: { fontSize:13,color:"var(--color-text-secondary)",marginBottom:10 },
  contentBox: { background:"var(--color-surface-secondary)",padding:"12px 14px",borderRadius:"var(--radius-sm)",fontSize:14,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word" },
  divider: { height:1,background:"var(--color-border)",margin:"14px 0 0",opacity:0.5 },
  input: { width:"100%",padding:"8px 12px",border:"1px solid var(--color-border)",borderRadius:"var(--radius-sm)",fontSize:14,background:"var(--color-surface-secondary)",color:"var(--color-text)" },
  textarea: { width:"100%",padding:"10px 12px",border:"1px solid var(--color-border)",borderRadius:"var(--radius-sm)",fontSize:14,lineHeight:1.6,fontFamily:"inherit",background:"var(--color-surface-secondary)",color:"var(--color-text)",resize:"vertical",minHeight:100 },
  charCount: { textAlign:"right",fontSize:11,color:"var(--color-text-tertiary)",marginTop:2 },
  submitBtn: { width:"100%",padding:"10px 0",background:"var(--color-primary)",color:"#fff",borderRadius:"var(--radius-sm)",fontSize:14,fontWeight:600,cursor:"pointer" },
  retryBtn: { padding:"6px 20px",background:"var(--color-surface-secondary)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-sm)",fontSize:13,cursor:"pointer" },
};

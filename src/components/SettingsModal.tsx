import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Template } from "../types";

// ============================================================
// 设置面板 (CC Switch 风格)
// ============================================================

interface SettingsModalProps {
  onClose: () => void;
  config: AppConfig;
  templateName: string;
}

export default function SettingsModal({ onClose, config, templateName }: SettingsModalProps) {
  const [appKey, setAppKey] = useState(config.appKey);
  const [appSecret, setAppSecret] = useState(config.appSecret);
  const [showSecret, setShowSecret] = useState(false);
  const [userId, setUserId] = useState(config.userId);
  const [selId, setSelId] = useState(config.selectedTemplateIds[0] || "");
  const [selName, setSelName] = useState(templateName);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const mask = (s: string) => s.length <= 8 ? "••••••••" : s.slice(0, 4) + "••••••••" + s.slice(-4);

  const handleFetch = async () => {
    setFetching(true); setMsg(null);
    try {
      await invoke("test_connection", { appKey: appKey.trim(), appSecret: appSecret.trim(), userId: userId.trim() });
      const r = await invoke<Template[]>("fetch_templates");
      setTemplates(r);
      setMsg(r.length ? { text: `获取到 ${r.length} 个模板`, ok: true } : { text: "未找到模板，请检查钉钉后台", ok: false });
    } catch (e) {
      setMsg({ text: `获取失败: ${e}`, ok: false });
    } finally { setFetching(false); }
  };

  const handleSave = async () => {
    if (!appKey.trim() || !appSecret.trim() || !userId.trim()) { setMsg({ text: "请填写所有必填项", ok: false }); return; }
    if (!selId) { setMsg({ text: "请先拉取并选择一个模板", ok: false }); return; }
    setSaving(true); setMsg(null);
    try {
      await invoke("save_settings_and_restart", { appKey: appKey.trim(), appSecret: appSecret.trim(), userId: userId.trim(), selectedTemplateId: selId, selectedTemplateName: selName });
    } catch (e) {
      setMsg({ text: `保存失败: ${e}`, ok: false });
      setSaving(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>设置</h2>
          <button style={s.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={s.body}>
          <Field label="AppKey (Client ID)">
            <input style={i} value={appKey} onChange={e => setAppKey(e.target.value)} />
          </Field>
          <Field label="AppSecret (Client Secret)">
            <div style={{ position: "relative" }}>
              <input style={{...i, paddingRight: 40}} type={showSecret ? "text" : "password"} value={showSecret ? appSecret : mask(appSecret)} onChange={e => showSecret && setAppSecret(e.target.value)} onFocus={() => { if (!showSecret) setShowSecret(true); }} />
              <button style={s.eye} onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
          </Field>
          <Field label="钉钉 UserID">
            <input style={i} value={userId} onChange={e => setUserId(e.target.value)} />
          </Field>
          <Field label="日志模板">
            {selName ? <div style={s.curTpl}>当前: <b>{selName}</b></div> : <div style={s.noTpl}>未选择</div>}
            <button style={{...s.btnSm, opacity: fetching ? 0.5 : 1}} onClick={handleFetch} disabled={fetching}>
              {fetching ? "拉取中..." : "拉取模板列表"}
            </button>
            {templates.length > 0 && (
              <div style={s.tplList}>
                {templates.map(t => (
                  <label key={t.id} style={{...s.tplItem, ...(selId === t.id ? s.tplActive : {})}}>
                    <input type="radio" name="tpl" checked={selId === t.id} onChange={() => { setSelId(t.id); setSelName(t.name); }} style={{marginRight: 8}} />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </Field>
          {msg && (
            <div style={{...s.msg, background: msg.ok ? "var(--color-success-light)" : "var(--color-danger-light)", color: msg.ok ? "var(--color-success)" : "var(--color-danger)" }}>
              {msg.text}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button style={s.btnCancel} onClick={onClose}>取消</button>
          <button style={{...s.btnSave, opacity: saving ? 0.5 : 1}} onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存并重启"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><label style={fl}>{label}</label>{children}</div>;
}

const fl: React.CSSProperties = { display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" };
const i: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: 14, background: "var(--color-surface-secondary)", color: "var(--color-text)" };

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "var(--color-surface)", borderRadius: "var(--radius-xl)", maxWidth: 480, width: "90%", maxHeight: "85vh", overflow: "auto", boxShadow: "var(--shadow-lg)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" },
  title: { fontSize: 18, fontWeight: 600, color: "var(--color-text)" },
  close: { background: "none", color: "var(--color-text-tertiary)", cursor: "pointer", display: "flex", padding: 2 },
  body: { padding: "16px 24px" },
  eye: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", color: "var(--color-text-secondary)", cursor: "pointer", display: "flex", padding: 4 },
  curTpl: { padding: "8px 12px", background: "var(--color-success-light)", borderRadius: "var(--radius-sm)", marginBottom: 8, fontSize: 13 },
  noTpl: { padding: "8px 12px", background: "var(--color-warning-light)", borderRadius: "var(--radius-sm)", marginBottom: 8, fontSize: 13, color: "var(--color-warning)" },
  btnSm: { padding: "6px 14px", background: "var(--color-primary)", color: "#fff", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer", marginBottom: 12 },
  tplList: { border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" },
  tplItem: { display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--color-separator)", cursor: "pointer", fontSize: 13, color: "var(--color-text)" },
  tplActive: { background: "var(--color-primary-light)", borderLeft: "3px solid var(--color-primary)" },
  msg: { padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, marginTop: 8 },
  footer: { display: "flex", justifyContent: "flex-end", gap: 12, padding: "12px 24px 20px", borderTop: "1px solid var(--color-separator)" },
  btnCancel: { padding: "8px 18px", background: "var(--color-surface-secondary)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: 13, cursor: "pointer" },
  btnSave: { padding: "8px 18px", background: "var(--color-primary)", color: "#fff", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
};

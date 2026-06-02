import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Template } from "../types";

// ============================================================
// 设置面板（弹窗）
// - 显示/修改 AppKey、AppSecret（脱敏）、UserID、日志模板
// - 支持模板重新拉取
// - 保存前验证凭据，通过后重启应用
// ============================================================

interface SettingsModalProps {
  onClose: () => void;
  config: AppConfig;
  templateName: string;
}

export default function SettingsModal({
  onClose,
  config,
  templateName,
}: SettingsModalProps) {
  const [appKey, setAppKey] = useState(config.appKey);
  const [appSecret, setAppSecret] = useState(config.appSecret);
  const [showSecret, setShowSecret] = useState(false);
  const [userId, setUserId] = useState(config.userId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    config.selectedTemplateIds[0] || "",
  );
  const [selectedTemplateName, setSelectedTemplateName] =
    useState(templateName);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // 脱敏显示 AppSecret
  const maskSecret = (s: string) => {
    if (s.length <= 8) return "••••••••";
    return s.slice(0, 4) + "••••••••" + s.slice(-4);
  };

  // 拉取模板列表
  const handleFetchTemplates = async () => {
    setFetchingTemplates(true);
    setMessage(null);
    try {
      // 临时设置凭据
      await invoke("test_connection", {
        appKey: appKey.trim(),
        appSecret: appSecret.trim(),
        userId: userId.trim(),
      });
      // 如果连接成功，用当前凭据拉模板
      const result = await invoke<Template[]>("fetch_templates");
      setTemplates(result);
      if (result.length === 0) {
        setMessage({ text: "未找到日志模板，请检查钉钉后台配置", type: "error" });
      } else {
        setMessage({ text: `获取到 ${result.length} 个模板`, type: "success" });
      }
    } catch (e) {
      setMessage({ text: `获取失败: ${e}`, type: "error" });
    } finally {
      setFetchingTemplates(false);
    }
  };

  // 保存并重启
  const handleSaveAndRestart = async () => {
    if (!appKey.trim() || !appSecret.trim() || !userId.trim()) {
      setMessage({ text: "请填写所有必填项", type: "error" });
      return;
    }
    if (!selectedTemplateId) {
      setMessage({ text: "请先拉取并选择一个模板", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await invoke("save_settings_and_restart", {
        appKey: appKey.trim(),
        appSecret: appSecret.trim(),
        userId: userId.trim(),
        selectedTemplateId,
        selectedTemplateName,
      });
      // 这里不会执行到，因为 restart 会立即退出进程
    } catch (e) {
      setMessage({ text: `保存失败: ${e}`, type: "error" });
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div style={styles.header}>
          <h2 style={styles.title}>⚙️ 设置</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.body}>
          {/* AppKey */}
          <div style={styles.field}>
            <label style={styles.label}>AppKey (Client ID)</label>
            <input
              style={styles.input}
              type="text"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
            />
          </div>

          {/* AppSecret（脱敏显示 + 眼睛切换） */}
          <div style={styles.field}>
            <label style={styles.label}>AppSecret (Client Secret)</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...styles.input, paddingRight: 40 }}
                type={showSecret ? "text" : "password"}
                value={showSecret ? appSecret : maskSecret(appSecret)}
                onChange={(e) => {
                  if (showSecret) setAppSecret(e.target.value);
                }}
                onFocus={() => {
                  if (!showSecret) {
                    setShowSecret(true);
                  }
                }}
              />
              <button
                style={styles.eyeBtn}
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? "隐藏" : "显示"}
              >
                {showSecret ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* UserID */}
          <div style={styles.field}>
            <label style={styles.label}>钉钉 UserID</label>
            <input
              style={styles.input}
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>

          {/* 模板 */}
          <div style={styles.field}>
            <label style={styles.label}>日报模板</label>
            {selectedTemplateName ? (
              <div style={styles.currentTemplate}>
                📄 当前: <strong>{selectedTemplateName}</strong>
              </div>
            ) : (
              <div style={styles.noTemplate}>未选择模板</div>
            )}

            <button
              style={{
                ...styles.btnSm,
                ...(fetchingTemplates ? styles.btnDisabled : {}),
              }}
              onClick={handleFetchTemplates}
              disabled={fetchingTemplates}
            >
              {fetchingTemplates ? "拉取中..." : "重新拉取模板列表"}
            </button>

            {/* 模板选择列表 */}
            {templates.length > 0 && (
              <div style={styles.templateList}>
                {templates.map((t) => (
                  <label
                    key={t.id}
                    style={{
                      ...styles.templateItem,
                      ...(selectedTemplateId === t.id
                        ? styles.templateItemActive
                        : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="template"
                      checked={selectedTemplateId === t.id}
                      onChange={() => {
                        setSelectedTemplateId(t.id);
                        setSelectedTemplateName(t.name);
                      }}
                      style={{ marginRight: 8 }}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 消息 */}
          {message && (
            <div
              style={{
                ...styles.msg,
                ...(message.type === "error"
                  ? styles.msgError
                  : styles.msgSuccess),
              }}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div style={styles.footer}>
          <button style={styles.btnCancel} onClick={onClose}>
            取消
          </button>
          <button
            style={{
              ...styles.btnSave,
              ...(saving ? styles.btnDisabled : {}),
            }}
            onClick={handleSaveAndRestart}
            disabled={saving}
          >
            {saving ? "验证并保存中..." : "保存并重启应用"}
          </button>
        </div>
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
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    maxWidth: 500,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px 0",
  },
  title: { fontSize: 18, fontWeight: 600 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#999",
    padding: 4,
  },
  body: {
    padding: "16px 24px",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 500,
    fontSize: 13,
    color: "#555",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d9d9d9",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },
  eyeBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  currentTemplate: {
    padding: "8px 12px",
    background: "#f6ffed",
    borderRadius: 6,
    marginBottom: 8,
    fontSize: 13,
  },
  noTemplate: {
    padding: "8px 12px",
    background: "#fff7e6",
    borderRadius: 6,
    marginBottom: 8,
    fontSize: 13,
    color: "#fa8c16",
  },
  btnSm: {
    padding: "6px 14px",
    background: "#1677ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  templateList: {
    marginTop: 12,
    border: "1px solid #e8e8e8",
    borderRadius: 8,
    overflow: "hidden",
  },
  templateItem: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    fontSize: 13,
  },
  templateItemActive: {
    background: "#f0f5ff",
    borderLeft: "3px solid #1677ff",
  },
  msg: {
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginTop: 8,
  },
  msgError: {
    background: "#fff2f0",
    color: "#ff4d4f",
  },
  msgSuccess: {
    background: "#f6ffed",
    color: "#52c41a",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "12px 24px 20px",
    borderTop: "1px solid #f0f0f0",
  },
  btnCancel: {
    padding: "8px 20px",
    background: "#fff",
    color: "#666",
    border: "1px solid #d9d9d9",
    borderRadius: 6,
    fontSize: 14,
    cursor: "pointer",
  },
  btnSave: {
    padding: "8px 20px",
    background: "#1677ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
};

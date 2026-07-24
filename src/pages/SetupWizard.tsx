import { useState, useEffect } from "react";
import { useAppState } from "../context/AppContext";
import type { Template, AppConfig } from "../types";
import { invoke } from "@tauri-apps/api/core";
import UserLookupModal from "../components/UserLookupModal";

// ============================================================
// 首次配置向导
// Step 1: 输入凭据 → 测试连接
// Step 2: 选择日报模板
// Step 3: 确认完成
// ============================================================

type WizardStep = "credentials" | "templates" | "confirm";

export default function SetupWizard() {
  const { dispatch } = useAppState();
  const [step, setStep] = useState<WizardStep>("credentials");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [userId, setUserId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showLookup, setShowLookup] = useState(false);

  // 启动时尝试加载已保存的凭证，避免重复输入
  useEffect(() => {
    async function loadSavedCreds() {
      try {
        const config = await invoke<AppConfig & { isConfigured: boolean }>(
          "load_config",
        );
        if (config.appKey) setAppKey(config.appKey);
        if (config.appSecret) setAppSecret(config.appSecret);
        if (config.userId) setUserId(config.userId);
        if (config.selectedTemplateIds?.length) {
          setSelectedIds(config.selectedTemplateIds);
        }
      } catch (_) {
        // 首次使用，无已保存数据
      }
    }
    loadSavedCreds();
  }, []);

  // 测试钉钉连接
  const handleTestConnection = async () => {
    if (!appKey.trim() || !appSecret.trim()) {
      setTestResult({ success: false, message: "请输入 AppKey 和 AppSecret" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<{
        success: boolean;
        message: string;
        templates: Template[];
      }>("test_connection", { appKey: appKey.trim(), appSecret: appSecret.trim(), userId: userId.trim() });
      setTestResult({ success: result.success, message: result.message });
      if (result.success && result.templates) {
        setTemplates(result.templates);
      }
    } catch (e) {
      setTestResult({ success: false, message: `调用失败: ${e}` });
    } finally {
      setTesting(false);
    }
  };

  // 前往模板选择步骤
  const goToTemplates = () => {
    if (!userId.trim()) {
      setTestResult({ success: false, message: "请输入你的钉钉 UserID" });
      return;
    }
    if (templates.length === 0) {
      setTestResult({
        success: false,
        message: "请先测试连接以获取模板列表",
      });
      return;
    }
    setTestResult(null);
    setStep("templates");
  };

  // 保存配置
  const handleSave = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setSaving(true);
    // 找到所选模板的名称
    const selectedTemplate = templates.find((t) => t.id === selectedIds[0]);
    const templateName = selectedTemplate?.name || "";

    try {
      await invoke("save_config", {
        appKey: appKey.trim(),
        appSecret: appSecret.trim(),
        userId: userId.trim(),
        selectedTemplateIds: selectedIds,
        selectedTemplateName: templateName,
      });
      dispatch({ type: "SET_CONFIGURED", isConfigured: true });
    } catch (e) {
      setTestResult({ success: false, message: `保存配置失败: ${e}` });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🛡️ 日报守卫</h1>
        <p style={styles.subtitle}>首次使用，请完成以下配置</p>

        {/* 步骤指示器 */}
        <div style={styles.steps}>
          {(["credentials", "templates", "confirm"] as WizardStep[]).map(
            (s, i) => (
              <div
                key={s}
                style={{
                  ...styles.step,
                  ...(step === s ? styles.stepActive : {}),
                  ...(i < ["credentials", "templates", "confirm"].indexOf(step)
                    ? styles.stepDone
                    : {}),
                }}
              >
                {i + 1}.{" "}
                {s === "credentials"
                  ? "凭据"
                  : s === "templates"
                    ? "模板"
                    : "完成"}
              </div>
            ),
          )}
        </div>

        {/* Step 1: 凭据配置 */}
        {step === "credentials" && (
          <div>
            <div style={styles.field}>
              <label style={styles.label}>AppKey (Client ID)</label>
              <input
                style={styles.input}
                type="text"
                placeholder="输入钉钉应用的 AppKey"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>AppSecret (Client Secret)</label>
              <input
                style={styles.input}
                type="password"
                placeholder="输入钉钉应用的 AppSecret"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>钉钉 UserID</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  type="text"
                  placeholder="你的钉钉 UserID（可从钉钉管理后台查看）"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
                <button
                  style={styles.lookupBtn}
                  title="通过手机号查询 UserID"
                  onClick={() => {
                    if (!appKey.trim() || !appSecret.trim()) {
                      setTestResult({
                        success: false,
                        message: "请先填写 AppKey 和 AppSecret",
                      });
                      return;
                    }
                    setShowLookup(true);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
              <span style={styles.hint}>
                在钉钉PC端 → 头像 → 设置 → 个人信息 中可以找到
              </span>
            </div>

            {testResult && (
              <div
                style={{
                  ...styles.alert,
                  ...(testResult.success
                    ? styles.alertSuccess
                    : styles.alertError),
                }}
              >
                {testResult.message}
                {testResult.success && templates.length === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                    请确保你的钉钉企业已创建日志模板（在钉钉管理后台 → 工作台 → 日志 → 模板管理）。
                    如已确认有模板，请点击下方按钮重试。
                  </div>
                )}
              </div>
            )}

            <div style={styles.actions}>
              <button
                style={{
                  ...styles.btn,
                  ...styles.btnSecondary,
                }}
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? "测试中..." : testResult ? "重新测试" : "测试连接"}
              </button>
              {testResult?.success && templates.length > 0 && (
                <button style={styles.btn} onClick={goToTemplates}>
                  下一步：选择模板 →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 模板选择 */}
        {step === "templates" && (
          <div>
            <p style={styles.subtitle}>
              选择需要盯的日报模板（当前仅支持选择一个）
            </p>
            <div style={styles.templateList}>
              {templates.map((t) => (
                <label
                  key={t.id}
                  style={{
                    ...styles.templateItem,
                    ...(selectedIds.includes(t.id)
                      ? styles.templateItemActive
                      : {}),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => {
                      // 当前只允许选一个
                      setSelectedIds(
                        selectedIds.includes(t.id) ? [] : [t.id],
                      );
                    }}
                    style={{ marginRight: 8 }}
                  />
                  {t.name}
                  {t.icon && (
                    <span style={{ marginLeft: 8 }}>{t.icon}</span>
                  )}
                </label>
              ))}
            </div>

            <div style={styles.actions}>
              <button
                style={{ ...styles.btn, ...styles.btnSecondary }}
                onClick={() => setStep("credentials")}
              >
                ← 上一步
              </button>
              <button
                style={styles.btn}
                disabled={selectedIds.length === 0}
                onClick={() => setStep("confirm")}
              >
                下一步：确认 →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 确认 */}
        {step === "confirm" && (
          <div>
            <div style={styles.summaryBox}>
              <p>
                <strong>AppKey:</strong> {appKey.slice(0, 8)}...
              </p>
              <p>
                <strong>UserID:</strong> {userId}
              </p>
              <p>
                <strong>盯的模板:</strong>{" "}
                {templates
                  .filter((t) => selectedIds.includes(t.id))
                  .map((t) => t.name)
                  .join(", ")}
              </p>
              <p>
                <strong>预警时间:</strong> 每天 17:30
              </p>
              <p>
                <strong>确认时间:</strong> 次日 09:30
              </p>
            </div>

            <div style={styles.actions}>
              <button
                style={{ ...styles.btn, ...styles.btnSecondary }}
                onClick={() => setStep("templates")}
              >
                ← 上一步
              </button>
              <button
                style={styles.btn}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "保存中..." : "完成配置，开始使用 →"}
              </button>
            </div>
          </div>
        )}
      </div>

      {showLookup && (
        <UserLookupModal
          appKey={appKey.trim()}
          appSecret={appSecret.trim()}
          onClose={() => setShowLookup(false)}
          onSelect={(id) => {
            setUserId(id);
            setTestResult({
              success: true,
              message: `查询成功，已填入 UserID: ${id}`,
            });
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 内联样式
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 40,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    maxWidth: 520,
    width: "100%",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  title: { fontSize: 24, marginBottom: 8 },
  subtitle: { color: "#666", marginBottom: 24, fontSize: 14 },
  steps: {
    display: "flex",
    gap: 16,
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: "1px solid #e8e8e8",
  },
  step: {
    padding: "4px 12px",
    borderRadius: 12,
    fontSize: 13,
    color: "#999",
    background: "#f5f5f5",
  },
  stepActive: {
    color: "#fff",
    background: "#1677ff",
  },
  stepDone: {
    color: "#52c41a",
    background: "#f6ffed",
  },
  field: { marginBottom: 16 },
  label: { display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d9d9d9",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },
  lookupBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    padding: 0,
    background: "#f5f5f5",
    border: "1px solid #d9d9d9",
    borderRadius: 6,
    cursor: "pointer",
    color: "#666",
    flexShrink: 0,
  },
  hint: { display: "block", marginTop: 4, fontSize: 12, color: "#999" },
  alert: {
    padding: "10px 16px",
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
  },
  alertSuccess: { background: "#f6ffed", color: "#52c41a", border: "1px solid #b7eb8f" },
  alertError: { background: "#fff2f0", color: "#ff4d4f", border: "1px solid #ffccc7" },
  actions: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  btn: {
    padding: "8px 20px",
    background: "#1677ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 500,
    fontSize: 14,
  },
  btnSecondary: {
    background: "#fff",
    color: "#1677ff",
    border: "1px solid #1677ff",
  },
  templateList: { marginBottom: 16 },
  templateItem: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
    marginBottom: 8,
    cursor: "pointer",
  },
  templateItemActive: {
    border: "2px solid #1677ff",
    background: "#f0f5ff",
  },
  summaryBox: {
    background: "#fafafa",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 2,
  },
};

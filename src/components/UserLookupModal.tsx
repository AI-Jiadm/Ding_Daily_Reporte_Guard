import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================
// 通过手机号查询钉钉 UserID 的弹窗
// 在 SetupWizard 和 SettingsModal 中复用
// ============================================================

interface UserLookupModalProps {
  onClose: () => void;
  /** 查询成功后回填 UserID（单结果时自动填入） */
  onSelect: (userId: string) => void;
  /** SetupWizard 场景需要传入（凭据尚未保存到数据库） */
  appKey?: string;
  appSecret?: string;
}

export default function UserLookupModal({
  onClose,
  onSelect,
  appKey,
  appSecret,
}: UserLookupModalProps) {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[] | null>(null);

  const handleLookup = async () => {
    const phone = mobile.trim();
    if (!phone) {
      setError("请输入手机号");
      return;
    }
    // 简单的手机号校验
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await invoke<{
        userIds: string[];
        primary: string | null;
      }>("lookup_userid", {
        mobile: phone,
        appKey: appKey || null,
        appSecret: appSecret || null,
      });

      if (data.userIds.length === 1) {
        // 单结果：自动填入
        onSelect(data.userIds[0]);
        onClose();
      } else {
        // 多结果：让用户选择
        setResults(data.userIds);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
    if (e.key === "Escape") onClose();
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>通过手机号查询 UserID</h3>
          <button style={s.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={s.body}>
          {!results ? (
            <>
              <label style={s.label}>手机号</label>
              <input
                style={s.input}
                type="tel"
                placeholder="输入钉钉绑定的手机号"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                autoFocus
              />

              {error && <div style={s.error}>{error}</div>}

              <button
                style={{
                  ...s.btn,
                  opacity: loading ? 0.6 : 1,
                }}
                onClick={handleLookup}
                disabled={loading}
              >
                {loading ? "查询中..." : "查询"}
              </button>
            </>
          ) : (
            <>
              <p style={s.multiHint}>
                该手机号对应多个账号，请选择：
              </p>
              <div style={s.list}>
                {results.map((id) => (
                  <button
                    key={id}
                    style={s.item}
                    onClick={() => {
                      onSelect(id);
                      onClose();
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 内联样式
// ============================================================
const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1100,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    maxWidth: 380,
    width: "90%",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px 0",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    color: "#999",
    padding: 0,
    lineHeight: 1,
  },
  body: {
    padding: "16px 20px 20px",
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 500,
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d9d9d9",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  error: {
    marginTop: 8,
    padding: "8px 12px",
    background: "#fff2f0",
    color: "#ff4d4f",
    borderRadius: 6,
    fontSize: 13,
  },
  btn: {
    width: "100%",
    marginTop: 16,
    padding: "8px 0",
    background: "#1677ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  multiHint: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  item: {
    padding: "10px 12px",
    background: "#f5f5f5",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left" as const,
  },
};

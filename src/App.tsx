import { useEffect } from "react";
import { AppProvider } from "./context/AppContext";
import { useAppState } from "./context/AppContext";
import SetupWizard from "./pages/SetupWizard";
import CalendarView from "./pages/CalendarView";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "./types";

function AppInner() {
  const { state, dispatch } = useAppState();

  // 启动时加载已保存的配置
  useEffect(() => {
    async function loadSavedConfig() {
      try {
        const config = await invoke<AppConfig & { isConfigured: boolean }>(
          "load_config",
        );
        if (config && config.isConfigured) {
          dispatch({
            type: "SET_CONFIG",
            config: {
              appKey: config.appKey,
              appSecret: config.appSecret,
              userId: config.userId,
              selectedTemplateIds: config.selectedTemplateIds,
              isConfigured: config.isConfigured,
            },
          });
        }
      } catch (e) {
        console.log("加载配置失败（首次使用正常）:", e);
      }
    }
    loadSavedConfig();
  }, []);

  if (!state.config.isConfigured) {
    return <SetupWizard />;
  }

  return <CalendarView />;
}

function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

export default App;

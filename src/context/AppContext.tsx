import React, { createContext, useContext, useReducer } from "react";
import type { AppState, AppAction, AppConfig } from "../types";

// ============================================================
// 初始状态
// ============================================================
const defaultConfig: AppConfig = {
  appKey: "",
  appSecret: "",
  userId: "",
  selectedTemplateIds: [],
  isConfigured: false,
};

const initialState: AppState = {
  config: defaultConfig,
  currentMonth: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
  days: [],
  summary: null,
  isChecking: false,
  lastError: null,
  templates: [],
};

// ============================================================
// Reducer
// ============================================================
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, config: { ...state.config, ...action.config } };
    case "SET_CONFIGURED":
      return {
        ...state,
        config: { ...state.config, isConfigured: action.isConfigured },
      };
    case "SET_CHECKING":
      return { ...state, isChecking: action.isChecking };
    case "SET_CHECK_RESULT":
      return {
        ...state,
        days: action.days,
        summary: action.summary,
        lastError: null,
      };
    case "SET_ERROR":
      return { ...state, lastError: action.error };
    case "SET_TEMPLATES":
      return { ...state, templates: action.templates };
    case "SET_MONTH":
      return { ...state, currentMonth: action.month };
    default:
      return state;
  }
}

// ============================================================
// Context
// ============================================================
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => {},
});

// ============================================================
// Provider
// ============================================================
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================
export function useAppState() {
  return useContext(AppContext);
}

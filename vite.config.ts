import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // 阻止 Vite 清除 Tauri 的环境变量
  clearScreen: false,
  server: {
    // Tauri 在固定端口运行
    port: 1420,
    strictPort: true,
    // Tauri 开发环境下需要监控此地址
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

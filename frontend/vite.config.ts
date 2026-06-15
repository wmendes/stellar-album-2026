import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Some wallet modules bundled by stellar-wallets-kit reference Node's
  // `global`, which doesn't exist in the browser. Alias it to globalThis.
  define: {
    global: "globalThis",
  },
});

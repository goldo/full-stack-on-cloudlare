import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // /esm/icons/index.mjs only exports the icons statically, so no separate chunks are created
      "@tabler/icons-react": "@tabler/icons-react/dist/esm/icons/index.mjs",
    },
  },
  plugins: [
    tsConfigPaths(),
    tanstackRouter({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    cloudflare(),
  ],
  server: {
    watch: {
      ignored: ["**/.wrangler/state/**"],
    },
  },
});

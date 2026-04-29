import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    fs: {
      // Restrict serving to Oro-admin's own directory only,
      // preventing Vite from accidentally resolving files from
      // the sibling Oro monorepo workspace.
      allow: ["."],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    sourcemap: false,
    drop: ["console", "debugger"],
    legalComments: "none",
  },
  build: {
    minify: "esbuild",
    target: "es2020",
    // Enable CSS code splitting so only the CSS needed per page is loaded
    cssCodeSplit: true,
    // Emit gzip-friendly output — smaller initial parse cost
    reportCompressedSize: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // Granular vendor splitting to improve cache hit rates and reduce
        // initial bundle size (unused chunks are not downloaded)
        manualChunks(id) {
          if (id.includes("node_modules/react-dom")) return "vendor-react-dom"
          if (id.includes("node_modules/react")) return "vendor-react"
          if (
            id.includes("node_modules/radix-ui") ||
            id.includes("node_modules/@radix-ui")
          )
            return "vendor-radix"
          if (id.includes("node_modules/lucide-react")) return "vendor-lucide"
          if (id.includes("node_modules/")) return "vendor-misc"
        },
        // Stable file names with content hashes → long-lived caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
      // Tree-shake anything unused
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },
  },
})

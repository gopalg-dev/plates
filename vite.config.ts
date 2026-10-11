import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  // Make .env values (MONGODB_URI, MONGODB_DB) visible to server code.
  // Values already in the environment win, so tests can point at another database.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value
  }
  return {
    resolve: { tsconfigPaths: true },
    // Nitro builds the server side for the host (Vercel picks its preset on its own builds); it sits between Start and React.
    // The function runs in Mumbai, next to the Atlas cluster: every page is a handful of queries in a row, and from
    // Vercel's default region each one crossed the planet (about two seconds a page; see HANDOVER.md item 55).
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      nitro({ vercel: { functions: { regions: ['bom1'] } } }),
      viteReact(),
    ],
  }
})

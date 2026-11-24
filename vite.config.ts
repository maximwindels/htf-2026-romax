import { defineConfig, type Rolldown } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const IGNORED_SERVER_WARNINGS = new Set([
  'EVAL',
  'CIRCULAR_DEPENDENCY',
  'THIS_IS_UNDEFINED',
  'EMPTY_BUNDLE',
  'MODULE_LEVEL_DIRECTIVE',
])

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      // Run the dev SSR environment in a child process. The default worker-thread runner
      // hung on start-up on Windows ("Vite environment "ssr" is unavailable").
      devServer: { runner: 'node-process' },
      rollupConfig: {
        external: [/^@sentry\//],
        // Overrides nitro's own onwarn, so its default ignore list is repeated here.
        // MODULE_LEVEL_DIRECTIVE: "use client" in @tanstack/react-router is irrelevant
        // in the server bundle (no React Server Components), so the warning is noise.
        onwarn(warning: Rolldown.RolldownLog, warn: Rolldown.LoggingFunction) {
          if (IGNORED_SERVER_WARNINGS.has(warning.code ?? '')) return
          warn(warning)
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config

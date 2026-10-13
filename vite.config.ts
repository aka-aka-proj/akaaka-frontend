import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'deployment-version-metadata',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
            ref: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? 'local',
            environment: process.env.VERCEL_ENV ?? 'local',
          }),
        })
      },
    },
  ],
  optimizeDeps: {
    include: ['@supabase/supabase-js', '@supabase/auth-js', '@supabase/realtime-js']
  },
  logLevel: 'error',
})

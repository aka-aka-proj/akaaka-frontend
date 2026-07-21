import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enableProfiler = env.ENABLE_PROFILER === 'true'

  return {
    plugins: [react()],
    resolve: {
      alias: enableProfiler
        ? {
            'react-dom': 'react-dom/profiling',
            'scheduler/tracing': 'scheduler/tracing-profiling',
          }
        : {},
    },
    optimizeDeps: {
      include: ['@supabase/supabase-js', '@supabase/auth-js', '@supabase/realtime-js']
    },
    logLevel: 'error',
  }
})

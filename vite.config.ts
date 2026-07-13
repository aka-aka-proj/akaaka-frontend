import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@supabase/supabase-js', '@supabase/auth-js', '@supabase/realtime-js']
  },
  // 若要隱藏 dev server 中 missing source map 的大量警告，可以把 logLevel 設為 'error'.
  // 若你希望保留其他警告，改為 'info' 或移除此選項。
  logLevel: 'error',
})

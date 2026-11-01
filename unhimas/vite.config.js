import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite 8 (Rolldown) requires `manualChunks` to be a function.
 * Object form throws: TypeError: manualChunks is not a function
 */
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
    return 'vendor-react'
  }
  if (id.includes('@tanstack/react-query') || id.includes('@tanstack/react-table')) {
    return 'vendor-query'
  }
  if (id.includes('recharts')) {
    return 'vendor-charts'
  }
  if (id.includes('@supabase')) {
    return 'vendor-supabase'
  }
  if (id.includes('react-icons')) {
    return 'vendor-icons'
  }
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})

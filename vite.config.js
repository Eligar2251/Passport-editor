import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, transformWithOxc } from 'vite'

// Весь код приложения живёт в одном файле src/app.js, поэтому JSX разрешён
// и в файлах с расширением .js (dev-сервер, прод-сборка и сканер зависимостей).
function jsxInJs() {
  return {
    name: 'jsx-in-js',
    enforce: 'pre',
    async load(id) {
      if (id.includes('\0') || !id.endsWith('.js') || id.includes('node_modules')) return null
      const code = readFileSync(id, 'utf8')
      if (!code.includes('<')) return null
      const out = await transformWithOxc(code, id, {
        lang: 'jsx',
        sourcemap: false,
        jsx: { runtime: 'automatic', importSource: 'react', development: false },
      })
      return { code: out.code, moduleType: 'js' }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [jsxInJs(), react()],
  oxc: {
    include: /\.(m?ts|[jt]sx?)$/,
    exclude: /node_modules/,
    lang: 'jsx',
  },
  optimizeDeps: {
    rolldownOptions: { moduleTypes: { '.js': 'jsx' } },
  },
  build: {
    rolldownOptions: { moduleTypes: { '.js': 'jsx' } },
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})

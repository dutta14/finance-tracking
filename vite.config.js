import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const cspPlugin = () => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob:",
            "connect-src 'self' https://api.github.com",
            "font-src 'self' https://fonts.gstatic.com",
          ].join('; '),
        },
        injectTo: 'head-prepend',
      },
    ]
  },
})

export default defineConfig({
  base: '/finance-tracking/', // Set to your repo name
  plugins: [react(), cspPlugin()],
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})

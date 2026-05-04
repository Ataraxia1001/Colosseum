import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readFrontendApiBase() {
  // Keep browser requests same-origin and let Vite proxy to backend.
  return '/api'
}

function readProxyTarget(envTarget: string | undefined) {
  if (typeof envTarget === 'string' && envTarget.trim()) {
    return envTarget
  }

  const configPath = path.resolve(__dirname, '..', 'config', 'config.yaml')
  const fallback = 'http://localhost:8000'

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed =
      (yaml.load(raw) as { frontend?: { api_base?: string } } | null) || {}
    const apiBase = parsed?.frontend?.api_base
    return typeof apiBase === 'string' && apiBase.trim() ? apiBase : fallback
  } catch {
    return fallback
  }
}

const apiBase = readFrontendApiBase()

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const proxyTarget = readProxyTarget(env.VITE_PROXY_TARGET)

  return {
    plugins: [react()],
    define: {
      __API_BASE__: JSON.stringify(apiBase),
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: ['.ngrok-free.dev'],
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
        },
      },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readFrontendApiBase() {
  const configPath = path.resolve(__dirname, '..', 'config', 'config.yaml')
  const fallback = 'http://localhost:8000'

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = yaml.load(raw) || {}
    const apiBase = parsed?.frontend?.api_base
    return typeof apiBase === 'string' && apiBase.trim() ? apiBase : fallback
  } catch {
    return fallback
  }
}

const apiBase = readFrontendApiBase()

export default defineConfig({
  plugins: [react()],
  define: {
    __API_BASE__: JSON.stringify(apiBase),
  },
  server: {
    host: true,
    port: 5173,
  },
})

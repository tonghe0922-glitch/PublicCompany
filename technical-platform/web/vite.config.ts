import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const portalBuilds = {
  employee: { input: 'employee.html', outDir: 'dist/employee', port: 5173 },
  center: { input: 'center.html', outDir: 'dist/center', port: 5174 },
  admin: { input: 'admin.html', outDir: 'dist/admin', port: 5175 },
} as const

const localApiProxyTarget = process.env.SJG_LOCAL_API_PROXY_TARGET ?? 'http://127.0.0.1:8080'

type PortalMode = keyof typeof portalBuilds

function isPortalMode(mode: string): mode is PortalMode {
  return mode in portalBuilds
}

function vueClientTestPlugin() {
  const plugin = vue()
  const originalLoad = plugin.load
  const originalTransform = plugin.transform

  if (
    !originalLoad ||
    typeof originalLoad !== 'object' ||
    typeof originalLoad.handler !== 'function' ||
    !originalTransform ||
    typeof originalTransform !== 'object' ||
    typeof originalTransform.handler !== 'function'
  ) {
    throw new Error('Unsupported @vitejs/plugin-vue hook shape for runtime tests')
  }

  const loadHandler = originalLoad.handler
  const transformHandler = originalTransform.handler

  plugin.load = {
    ...originalLoad,
    handler(id, options) {
      return loadHandler.call(this, id, { ...(options ?? {}), ssr: false })
    },
  }
  plugin.transform = {
    ...originalTransform,
    handler(code, id, options) {
      const clientOptions = options ? { ...options, ssr: false } : undefined
      return transformHandler.call(this, code, id, clientOptions)
    },
  }

  return plugin
}

function portalServer(port: number) {
  return {
    port,
    proxy: {
      '/api': {
        target: localApiProxyTarget,
        changeOrigin: true,
      },
    },
  }
}

function analysisConfig() {
  return { plugins: [vue()] }
}

export default defineConfig(({ mode }) => {
  if (mode === 'test') {
    return {
      plugins: [vueClientTestPlugin()],
    }
  }

  if (mode === 'development' || mode === 'production') {
    return analysisConfig()
  }

  if (!isPortalMode(mode)) {
    throw new Error(`Unsupported portal mode: ${mode}`)
  }

  const portal = portalBuilds[mode]
  return {
    base: './',
    plugins: [vue()],
    server: portalServer(portal.port),
    build: {
      outDir: portal.outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(import.meta.dirname, portal.input),
      },
    },
  }
})

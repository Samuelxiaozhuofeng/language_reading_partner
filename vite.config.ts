import { defineConfig } from 'vite'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { join } from 'node:path'

function kuromojiDictionaryMiddleware(): Plugin {
  const dictionaryDirectory = join(import.meta.dirname, 'public', 'dict')

  return {
    name: 'kuromoji-dictionary-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/dict', serveDictionaryFile(dictionaryDirectory))
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use('/dict', serveDictionaryFile(dictionaryDirectory))
    },
  }
}

function serveDictionaryFile(dictionaryDirectory: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = new URL(request.url ?? '', 'http://localhost').pathname
    const filename = pathname.split('/').pop() ?? ''

    if (!/^[a-z_]+\.dat\.gz$/u.test(filename)) {
      next()
      return
    }

    const filePath = join(dictionaryDirectory, filename)
    let stats

    try {
      stats = statSync(filePath)
    } catch {
      next()
      return
    }

    response.statusCode = 200
    response.setHeader('Content-Length', stats.size)
    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    createReadStream(filePath).pipe(response)
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [kuromojiDictionaryMiddleware(), react()],
})

import { defineConfig } from 'vite'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DICTIONARY_FILE_PATTERN = /^[a-z_]+\.dat\.gz$/u
const localDictionaryDirectory = join(import.meta.dirname, 'public', 'dict')
const packageDictionaryDirectory = join(import.meta.dirname, 'node_modules', 'kuromoji', 'dict')

function kuromojiDictionaryMiddleware(): Plugin {
  const dictionaryDirectory = resolveDictionaryDirectory()
  let outputDirectory = join(import.meta.dirname, 'dist')

  return {
    name: 'kuromoji-dictionary-middleware',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/dict', serveDictionaryFile(dictionaryDirectory))
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use('/dict', serveDictionaryFile(dictionaryDirectory))
    },
    closeBundle() {
      copyDictionaryFiles(dictionaryDirectory, join(outputDirectory, 'dict'))
    },
  }
}

function resolveDictionaryDirectory() {
  if (existsSync(localDictionaryDirectory)) {
    return localDictionaryDirectory
  }

  if (existsSync(packageDictionaryDirectory)) {
    return packageDictionaryDirectory
  }

  throw new Error('未找到 kuromoji 字典目录，请先运行 npm install。')
}

function copyDictionaryFiles(sourceDirectory: string, targetDirectory: string) {
  const filenames = readdirSync(sourceDirectory).filter((filename) =>
    DICTIONARY_FILE_PATTERN.test(filename),
  )

  if (filenames.length === 0) {
    throw new Error(`kuromoji 字典目录没有可复制的 .dat.gz 文件：${sourceDirectory}`)
  }

  mkdirSync(targetDirectory, { recursive: true })
  filenames.forEach((filename) => {
    copyFileSync(join(sourceDirectory, filename), join(targetDirectory, filename))
  })
}

function serveDictionaryFile(dictionaryDirectory: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = new URL(request.url ?? '', 'http://localhost').pathname
    const filename = pathname.split('/').pop() ?? ''

    if (!DICTIONARY_FILE_PATTERN.test(filename)) {
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

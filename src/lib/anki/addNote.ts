import type { AnkiConfig } from '../../types'
import { getSpeechLocale, getSpeechVoice } from '../speech'
import { getCachedSpeech } from '../speechCache'
import { synthesizeEdgeTts } from '../edgeTts'
import { AnkiDroid, ensureAnkiDroidSraNoteType } from './ankiDroid'
import { invokeAnkiAction } from './client'
import {
  getSraFieldNames,
  getSraNoteTypeName,
  type SraNoteTypeLanguage,
} from './constants'
import { shouldUseAnkiDroid } from './environment'
import { toUserFacingAnkiError } from './errors'
import {
  buildFields,
  createAnkiFieldMappingFromFieldNames,
  getAnkiFieldMappingIssues,
  type AnkiNotePayload,
} from './payload'

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
export type AddNoteToAnkiResult = {
  noteId: number
  updatedConfig?: AnkiConfig
}

export async function addNoteToAnki(
  config: AnkiConfig,
  payload: AnkiNotePayload,
  language: SraNoteTypeLanguage = 'es',
): Promise<AddNoteToAnkiResult> {
  if (shouldUseAnkiDroid()) {
    const availability = await AnkiDroid.isAvailable().catch(() => ({ available: false }))
    if (!availability.available) {
      throw new Error('未检测到 AnkiDroid，请先在手机上安装 AnkiDroid。')
    }

    const permissionResult = await AnkiDroid.requestPermission().catch(() => ({ granted: false }))
    if (!permissionResult.granted) {
      const shareSubject = payload.knowledge || payload.sentence
      const shareText = `${payload.knowledge}\n\n${payload.knowledgeExplanation || ''}\n\n${payload.sentence}`.trim()
      await AnkiDroid.shareNote({
        subject: shareSubject,
        text: shareText,
      }).catch(() => ({}))
      throw new Error('未获得 AnkiDroid 数据库读写权限，已尝试通过系统分享发送。')
    }

    let updatedConfig: AnkiConfig | undefined
    let deck = config.deck.trim()
    let noteType = config.noteType.trim()
    let fieldMapping = { ...config.fieldMapping }

    if (!deck) {
      deck = '多语言阅读助手'
    }

    if (!noteType) {
      const ensured = await ensureAnkiDroidSraNoteType(language)
      noteType = ensured?.modelName || getSraNoteTypeName(language)
      fieldMapping = createAnkiFieldMappingFromFieldNames(getSraFieldNames(language), language)
    }

    const hasConfigChanged =
      deck !== config.deck ||
      noteType !== config.noteType ||
      JSON.stringify(fieldMapping) !== JSON.stringify(config.fieldMapping)

    if (hasConfigChanged) {
      updatedConfig = {
        ...config,
        deck,
        noteType,
        fieldMapping,
      }
    }

    const effectiveConfig: AnkiConfig = updatedConfig || {
      ...config,
      deck,
      noteType,
      fieldMapping,
    }

    const issues = getAnkiFieldMappingIssues(effectiveConfig, language)
    if (issues.length > 0 && !updatedConfig) {
      throw new Error(issues[0])
    }

    const finalPayload = { ...payload }
    if (language !== 'ja') {
      try {
        const text = (finalPayload.knowledge || finalPayload.sentence || '').trim()
        const voice = getSpeechVoice(language)
        if (text && voice) {
          const locale = getSpeechLocale(language) || language
          let audioBytes = await getCachedSpeech(locale, text)
          if (!audioBytes || audioBytes.length === 0) {
            audioBytes = await synthesizeEdgeTts(text, voice)
          }
          if (audioBytes && audioBytes.length > 0) {
            const sanitized = text.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
            const preferredName = `sra_${sanitized || 'audio'}`
            const audioBase64 = uint8ArrayToBase64(audioBytes)
            const mediaResult = await AnkiDroid.addMedia({
              preferredName,
              audioBase64,
            })
            if (mediaResult?.soundTag) {
              finalPayload.audio = mediaResult.soundTag
            }
          }
        }
      } catch (audioError) {
        console.warn('添加发音到 AnkiDroid 失败，继续添加普通卡片:', audioError)
      }
    }

    const fields = buildFields(effectiveConfig, finalPayload, language)
    try {
      const { noteId } = await AnkiDroid.addNote({
        deckName: deck,
        modelName: noteType,
        fields,
      })

      return {
        noteId,
        updatedConfig,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '添加笔记到 AnkiDroid 失败。')
    }
  }

  const issue = getAnkiFieldMappingIssues(config, language)[0]
  if (issue) {
    throw new Error(issue)
  }

  try {
    const noteId = await invokeAnkiAction<number>(config.endpoint, 'addNote', {
      note: {
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload, language),
        options: {
          allowDuplicate: true,
        },
      },
    })

    return { noteId }
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function addNotesToAnki(
  config: AnkiConfig,
  payloads: readonly AnkiNotePayload[],
  language: SraNoteTypeLanguage = 'es',
) {
  if (shouldUseAnkiDroid()) {
    const results: number[] = []
    for (const payload of payloads) {
      const res = await addNoteToAnki(config, payload, language)
      results.push(res.noteId)
    }
    return results
  }

  const issue = getAnkiFieldMappingIssues(config, language)[0]
  if (issue) {
    throw new Error(issue)
  }

  if (payloads.length === 0) {
    return []
  }

  try {
    return await invokeAnkiAction<Array<number | null>>(config.endpoint, 'addNotes', {
      notes: payloads.map((payload) => ({
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload, language),
        options: {
          allowDuplicate: true,
        },
        tags: ['sra-mobile-queue'],
      })),
    })
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

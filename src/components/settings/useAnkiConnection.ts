import { useCallback, useEffect, useState } from 'react'
import type {
  AnkiConfigChangeHandler,
  AnkiFieldMappingChangeHandler,
  ModelFetchStatus,
} from '../../lib/appState'
import {
  AnkiDroid,
  createAnkiFieldMappingFromFieldNames,
  createOrRepairSraAnkiNoteType,
  ensureAnkiDroidSraNoteType,
  ensureAnkiPermission,
  fetchAnkiDeckNames,
  fetchAnkiNoteFields,
  fetchAnkiNoteTypes,
  fetchAnkiVersion,
  getAnkiFieldSourceOrder,
  getAnkiCompatibilityIssue,
  getSraNoteTypeName,
  shouldUseAnkiDroid,
  toUserFacingAnkiError,
} from '../../lib/anki'
import type { AnkiCompatibilityIssue, SraNoteTypeLanguage } from '../../lib/anki'
import type { AnkiConfig } from '../../types'

type UseAnkiConnectionOptions = {
  ankiConfig: AnkiConfig
  isActive: boolean
  isOpen: boolean
  language: SraNoteTypeLanguage
  onAnkiConfigChange: AnkiConfigChangeHandler
  onAnkiFieldMappingChange: AnkiFieldMappingChangeHandler
}

export type UseAnkiConnectionResult = {
  ankiCompatibilityIssue: AnkiCompatibilityIssue | null
  ankiFetchMessage: string
  ankiFetchStatus: ModelFetchStatus
  availableDecks: string[]
  availableNoteFields: string[]
  availableNoteTypes: string[]
  handleCreateSraNoteType: () => Promise<void>
  handleRequestPermission?: () => Promise<void>
  isAndroid: boolean
  runAnkiFetch: (signal?: AbortSignal) => Promise<void>
}

export function useAnkiConnection({
  ankiConfig,
  isActive,
  isOpen,
  language,
  onAnkiConfigChange,
  onAnkiFieldMappingChange,
}: UseAnkiConnectionOptions): UseAnkiConnectionResult {
  const isAndroid = shouldUseAnkiDroid()
  const [availableDecks, setAvailableDecks] = useState<string[]>([])
  const [availableNoteTypes, setAvailableNoteTypes] = useState<string[]>([])
  const [availableNoteFields, setAvailableNoteFields] = useState<string[]>([])
  const [ankiFetchStatus, setAnkiFetchStatus] = useState<ModelFetchStatus>('idle')
  const [ankiFetchMessage, setAnkiFetchMessage] = useState(
    isAndroid
      ? '点击「测试连接」检测 AnkiDroid 与牌组/模板。'
      : '填写 AnkiConnect URL 后会自动检测连接并加载 deck / note type。',
  )
  const ankiCompatibilityIssue = isAndroid ? null : getAnkiCompatibilityIssue(ankiConfig.endpoint)
  const fieldSourceOrder = getAnkiFieldSourceOrder(language)

  const syncAnkiFieldMapping = useCallback((nextFieldNames: string[]) => {
    const nextMapping = createAnkiFieldMappingFromFieldNames(nextFieldNames, language)

    for (const source of fieldSourceOrder) {
      if (ankiConfig.fieldMapping[source] !== nextMapping[source]) {
        onAnkiFieldMappingChange(source, nextMapping[source])
      }
    }
  }, [ankiConfig.fieldMapping, fieldSourceOrder, language, onAnkiFieldMappingChange])

  const clearInvalidAnkiFieldMapping = useCallback((nextFieldNames: string[]) => {
    for (const source of fieldSourceOrder) {
      const mappedField = ankiConfig.fieldMapping[source]
      if (mappedField && !nextFieldNames.includes(mappedField)) {
        onAnkiFieldMappingChange(source, '')
      }
    }
  }, [ankiConfig.fieldMapping, fieldSourceOrder, onAnkiFieldMappingChange])

  const applyAnkiSelection = useCallback((nextDeck: string, nextNoteType: string) => {
    if (nextDeck && nextDeck !== ankiConfig.deck) {
      onAnkiConfigChange('deck', nextDeck)
    }

    if (nextNoteType && nextNoteType !== ankiConfig.noteType) {
      onAnkiConfigChange('noteType', nextNoteType)
    }
  }, [ankiConfig.deck, ankiConfig.noteType, onAnkiConfigChange])

  const loadAnkiDroidConnectionData = useCallback(async (preferredNoteType?: string) => {
    const availability = await AnkiDroid.isAvailable().catch(() => ({ available: false }))
    if (!availability.available) {
      throw new Error('未检测到 AnkiDroid，请先在手机上安装 AnkiDroid。')
    }

    const perm = await AnkiDroid.requestPermission().catch(() => ({ granted: false }))
    if (!perm.granted) {
      throw new Error('未获得 AnkiDroid 数据库读写权限，请点击上方「授权」按钮。')
    }

    const [{ names: decks }, { names: noteTypes }] = await Promise.all([
      AnkiDroid.getDecks(),
      AnkiDroid.getModels(),
    ])

    const nextDeck = ankiConfig.deck.trim() || decks[0] || '多语言阅读助手'
    const currentNoteType = ankiConfig.noteType.trim()
    const sraName = getSraNoteTypeName(language)
    const nextNoteType =
      (preferredNoteType && noteTypes.includes(preferredNoteType) && preferredNoteType) ||
      (currentNoteType && noteTypes.includes(currentNoteType) && currentNoteType) ||
      (noteTypes.includes(sraName) && sraName) ||
      noteTypes[0] ||
      ''

    const fields = nextNoteType
      ? (await AnkiDroid.getModelFields({ modelName: nextNoteType })).fields
      : []

    return {
      decks,
      noteTypes,
      fields,
      nextDeck,
      nextNoteType,
    }
  }, [ankiConfig.deck, ankiConfig.noteType, language])

  const loadAnkiWebConnectionData = useCallback(async (
    signal?: AbortSignal,
    preferredNoteType?: string,
  ) => {
    const endpoint = ankiConfig.endpoint.trim()
    await ensureAnkiPermission(endpoint, signal)

    const [version, decks, noteTypes] = await Promise.all([
      fetchAnkiVersion(endpoint, signal),
      fetchAnkiDeckNames(endpoint, signal),
      fetchAnkiNoteTypes(endpoint, signal),
    ])

    const nextDeck = ankiConfig.deck.trim() || decks[0] || ''
    const currentNoteType = ankiConfig.noteType.trim()
    const nextNoteType =
      (preferredNoteType && noteTypes.includes(preferredNoteType) && preferredNoteType) ||
      (currentNoteType && noteTypes.includes(currentNoteType) && currentNoteType) ||
      noteTypes[0] ||
      ''
    const fields = nextNoteType ? await fetchAnkiNoteFields(endpoint, nextNoteType, signal) : []

    return {
      version,
      decks,
      noteTypes,
      fields,
      nextDeck,
      nextNoteType,
    }
  }, [ankiConfig.deck, ankiConfig.endpoint, ankiConfig.noteType])

  const runAnkiFetch = useCallback(async (signal?: AbortSignal) => {
    if (isAndroid) {
      setAnkiFetchStatus('loading')
      setAnkiFetchMessage('正在检测并连接 AnkiDroid...')

      try {
        const { decks, noteTypes, fields, nextDeck, nextNoteType } =
          await loadAnkiDroidConnectionData()

        applyAnkiSelection(nextDeck, nextNoteType)
        clearInvalidAnkiFieldMapping(fields)

        setAvailableDecks(decks)
        setAvailableNoteTypes(noteTypes)
        setAvailableNoteFields(fields)
        setAnkiFetchStatus('success')
        setAnkiFetchMessage(
          `已连接 AnkiDroid，找到 ${decks.length} 个 deck、${noteTypes.length} 个 note type。`,
        )
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setAvailableDecks([])
        setAvailableNoteTypes([])
        setAvailableNoteFields([])
        setAnkiFetchStatus('error')
        setAnkiFetchMessage(error instanceof Error ? error.message : '连接 AnkiDroid 失败。')
      }
      return
    }

    const endpoint = ankiConfig.endpoint.trim()

    if (!endpoint) {
      setAvailableDecks([])
      setAvailableNoteTypes([])
      setAvailableNoteFields([])
      setAnkiFetchStatus('idle')
      setAnkiFetchMessage('填写 AnkiConnect URL 后会自动检测连接并加载 deck / note type。')
      return
    }

    const compatibilityIssue = getAnkiCompatibilityIssue(endpoint)
    if (compatibilityIssue) {
      setAvailableDecks([])
      setAvailableNoteTypes([])
      setAvailableNoteFields([])
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(compatibilityIssue.summary)
      return
    }

    setAnkiFetchStatus('loading')
    setAnkiFetchMessage('正在连接 AnkiConnect...')

    try {
      const { version, decks, noteTypes, fields, nextDeck, nextNoteType } =
        await loadAnkiWebConnectionData(signal)

      applyAnkiSelection(nextDeck, nextNoteType)
      clearInvalidAnkiFieldMapping(fields)

      setAvailableDecks(decks)
      setAvailableNoteTypes(noteTypes)
      setAvailableNoteFields(fields)
      setAnkiFetchStatus('success')
      setAnkiFetchMessage(
        `已连接到 AnkiConnect v${version}，找到 ${decks.length} 个 deck、${noteTypes.length} 个 note type。`,
      )
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      setAvailableDecks([])
      setAvailableNoteTypes([])
      setAvailableNoteFields([])
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(toUserFacingAnkiError(error))
    }
  }, [
    ankiConfig.endpoint,
    applyAnkiSelection,
    clearInvalidAnkiFieldMapping,
    isAndroid,
    loadAnkiDroidConnectionData,
    loadAnkiWebConnectionData,
  ])

  const handleRequestPermission = useCallback(async () => {
    setAnkiFetchStatus('loading')
    setAnkiFetchMessage('正在请求 AnkiDroid 授权...')
    try {
      const { granted } = await AnkiDroid.requestPermission()
      if (!granted) {
        setAnkiFetchStatus('error')
        setAnkiFetchMessage('未获得 AnkiDroid 授权，请在系统设置中允许本应用访问 AnkiDroid。')
        return
      }
      await runAnkiFetch()
    } catch (error) {
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(error instanceof Error ? error.message : '请求授权失败。')
    }
  }, [runAnkiFetch])

  const handleCreateSraNoteType = useCallback(async () => {
    const noteTypeName = getSraNoteTypeName(language)
    const languageLabel = language === 'ja' ? '日语' : '通用/西语'

    if (isAndroid) {
      setAnkiFetchStatus('loading')
      setAnkiFetchMessage(`正在在 AnkiDroid 中创建或检查 ${noteTypeName} 模板...`)

      try {
        const result = await ensureAnkiDroidSraNoteType(language)
        const targetModelName = result?.modelName || noteTypeName
        const { decks, noteTypes, fields, nextDeck } = await loadAnkiDroidConnectionData(
          targetModelName,
        )

        applyAnkiSelection(nextDeck, targetModelName)
        syncAnkiFieldMapping(fields)

        setAvailableDecks(decks)
        setAvailableNoteTypes(noteTypes)
        setAvailableNoteFields(fields)
        setAnkiFetchStatus('success')
        setAnkiFetchMessage(
          `已就绪 ${languageLabel} ${targetModelName} 模板，并自动选中和映射 ${fields.length} 个字段。`,
        )
      } catch (error) {
        setAnkiFetchStatus('error')
        setAnkiFetchMessage(error instanceof Error ? error.message : '创建 SRA 模板失败。')
      }
      return
    }

    const endpoint = ankiConfig.endpoint.trim()

    if (!endpoint) {
      setAnkiFetchStatus('error')
      setAnkiFetchMessage('请先填写 AnkiConnect URL。')
      return
    }

    const compatibilityIssue = getAnkiCompatibilityIssue(endpoint)
    if (compatibilityIssue) {
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(compatibilityIssue.summary)
      return
    }

    setAnkiFetchStatus('loading')
    setAnkiFetchMessage(`正在创建或修复 ${noteTypeName} note type...`)

    try {
      const result = await createOrRepairSraAnkiNoteType(endpoint, language)
      const { decks, noteTypes, fields, nextDeck } = await loadAnkiWebConnectionData(
        undefined,
        noteTypeName,
      )

      applyAnkiSelection(nextDeck, noteTypeName)
      syncAnkiFieldMapping(fields)

      setAvailableDecks(decks)
      setAvailableNoteTypes(noteTypes)
      setAvailableNoteFields(fields)
      setAnkiFetchStatus('success')
      const fieldCount = result.fieldNames.length
      setAnkiFetchMessage(
        result.created
          ? `已创建 ${languageLabel} ${noteTypeName} note type，并自动选中和映射 ${fieldCount} 个字段。`
          : `已修复 ${languageLabel} ${noteTypeName} note type，并自动选中和映射 ${fieldCount} 个字段。`,
      )
    } catch (error) {
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(toUserFacingAnkiError(error))
    }
  }, [
    ankiConfig.endpoint,
    applyAnkiSelection,
    isAndroid,
    language,
    loadAnkiDroidConnectionData,
    loadAnkiWebConnectionData,
    syncAnkiFieldMapping,
  ])

  useEffect(() => {
    if (!isOpen || !isActive) {
      return
    }

    const controller = new AbortController()
    const timerId = window.setTimeout(() => {
      void runAnkiFetch(controller.signal)
    }, 400)

    return () => {
      controller.abort()
      window.clearTimeout(timerId)
    }
  }, [ankiConfig.endpoint, ankiConfig.noteType, isActive, isOpen, runAnkiFetch])

  return {
    ankiCompatibilityIssue,
    ankiFetchMessage,
    ankiFetchStatus,
    availableDecks,
    availableNoteFields,
    availableNoteTypes,
    handleCreateSraNoteType,
    handleRequestPermission,
    isAndroid,
    runAnkiFetch,
  }
}

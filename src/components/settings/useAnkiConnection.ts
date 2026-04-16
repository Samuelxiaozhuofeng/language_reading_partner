import { useCallback, useEffect, useState } from 'react'
import type {
  AnkiConfigChangeHandler,
  AnkiFieldMappingChangeHandler,
  ModelFetchStatus,
} from '../../lib/appState'
import {
  createAnkiFieldMappingFromFieldNames,
  createOrRepairSraAnkiNoteType,
  ensureAnkiPermission,
  fetchAnkiDeckNames,
  fetchAnkiNoteFields,
  fetchAnkiNoteTypes,
  fetchAnkiVersion,
  getAnkiCompatibilityIssue,
  SRA_NOTE_TYPE_NAME,
  toUserFacingAnkiError,
} from '../../lib/anki'
import type { AnkiCompatibilityIssue } from '../../lib/anki'
import { ankiFieldSourceOrder } from '../../lib/anki'
import type { AnkiConfig } from '../../types'

type UseAnkiConnectionOptions = {
  ankiConfig: AnkiConfig
  isActive: boolean
  isOpen: boolean
  onAnkiConfigChange: AnkiConfigChangeHandler
  onAnkiFieldMappingChange: AnkiFieldMappingChangeHandler
}

type UseAnkiConnectionResult = {
  ankiCompatibilityIssue: AnkiCompatibilityIssue | null
  ankiFetchMessage: string
  ankiFetchStatus: ModelFetchStatus
  availableDecks: string[]
  availableNoteFields: string[]
  availableNoteTypes: string[]
  handleCreateSraNoteType: () => Promise<void>
  runAnkiFetch: (signal?: AbortSignal) => Promise<void>
}

export function useAnkiConnection({
  ankiConfig,
  isActive,
  isOpen,
  onAnkiConfigChange,
  onAnkiFieldMappingChange,
}: UseAnkiConnectionOptions): UseAnkiConnectionResult {
  const [availableDecks, setAvailableDecks] = useState<string[]>([])
  const [availableNoteTypes, setAvailableNoteTypes] = useState<string[]>([])
  const [availableNoteFields, setAvailableNoteFields] = useState<string[]>([])
  const [ankiFetchStatus, setAnkiFetchStatus] = useState<ModelFetchStatus>('idle')
  const [ankiFetchMessage, setAnkiFetchMessage] = useState(
    '填写 AnkiConnect URL 后会自动检测连接并加载 deck / note type。',
  )
  const ankiCompatibilityIssue = getAnkiCompatibilityIssue(ankiConfig.endpoint)

  const syncAnkiFieldMapping = useCallback((nextFieldNames: string[]) => {
    const nextMapping = createAnkiFieldMappingFromFieldNames(nextFieldNames)

    for (const source of ankiFieldSourceOrder) {
      if (ankiConfig.fieldMapping[source] !== nextMapping[source]) {
        onAnkiFieldMappingChange(source, nextMapping[source])
      }
    }
  }, [ankiConfig.fieldMapping, onAnkiFieldMappingChange])

  const clearInvalidAnkiFieldMapping = useCallback((nextFieldNames: string[]) => {
    for (const source of ankiFieldSourceOrder) {
      const mappedField = ankiConfig.fieldMapping[source]
      if (mappedField && !nextFieldNames.includes(mappedField)) {
        onAnkiFieldMappingChange(source, '')
      }
    }
  }, [ankiConfig.fieldMapping, onAnkiFieldMappingChange])

  const applyAnkiSelection = useCallback((nextDeck: string, nextNoteType: string) => {
    if (nextDeck && nextDeck !== ankiConfig.deck) {
      onAnkiConfigChange('deck', nextDeck)
    }

    if (nextNoteType && nextNoteType !== ankiConfig.noteType) {
      onAnkiConfigChange('noteType', nextNoteType)
    }
  }, [ankiConfig.deck, ankiConfig.noteType, onAnkiConfigChange])

  const loadAnkiConnectionData = useCallback(async (
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
        await loadAnkiConnectionData(signal)

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
    loadAnkiConnectionData,
  ])

  const handleCreateSraNoteType = useCallback(async () => {
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
    setAnkiFetchMessage('正在创建或修复 SRA note type...')

    try {
      const result = await createOrRepairSraAnkiNoteType(endpoint)
      const { decks, noteTypes, fields, nextDeck } = await loadAnkiConnectionData(
        undefined,
        SRA_NOTE_TYPE_NAME,
      )

      applyAnkiSelection(nextDeck, SRA_NOTE_TYPE_NAME)
      syncAnkiFieldMapping(fields)

      setAvailableDecks(decks)
      setAvailableNoteTypes(noteTypes)
      setAvailableNoteFields(fields)
      setAnkiFetchStatus('success')
      setAnkiFetchMessage(
        result.created
          ? '已创建 SRA note type，并自动选中和映射 6 个字段。'
          : '已修复 SRA note type，并自动选中和映射 6 个字段。',
      )
    } catch (error) {
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(toUserFacingAnkiError(error))
    }
  }, [
    ankiConfig.endpoint,
    applyAnkiSelection,
    loadAnkiConnectionData,
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
    runAnkiFetch,
  }
}

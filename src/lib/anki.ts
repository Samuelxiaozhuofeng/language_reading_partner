import type {
  AnalysisHighlight,
  AnalysisResult,
  AnkiConfig,
  AnkiFieldMapping,
  AnkiFieldSource,
  KnowledgeKind,
  SentenceItem,
} from '../types'

type AnkiResponse<Result> = {
  error?: string | null
  result?: Result
}

type AnkiNotePayload = Record<AnkiFieldSource, string>
type AnkiPermissionResult = {
  permission: 'granted' | 'denied'
  requireApiKey?: boolean
  version?: number
}
type AnkiModelTemplates = Record<string, { Front?: string; Back?: string }>

export type AnkiCompatibilityIssue = {
  code: 'safari-secure-loopback-http'
  summary: string
  details: string[]
}

export const SRA_NOTE_TYPE_NAME = 'SRA'

export const ankiFieldSourceOrder: AnkiFieldSource[] = [
  'sentence',
  'grammar',
  'meaning',
  'knowledge',
  'knowledgeKind',
  'knowledgeExplanation',
]

export const ankiFieldSourceLabelMap: Record<AnkiFieldSource, string> = {
  sentence: '句子',
  grammar: '语法',
  meaning: '内容',
  knowledge: '知识点',
  knowledgeKind: '知识点类型',
  knowledgeExplanation: '知识点解释',
}

const sraFieldNames = ankiFieldSourceOrder.map((source) => ankiFieldSourceLabelMap[source])
const sraFrontTemplate = `<div class="es-card">
  <div class="es-header">
    <span class="es-badge">Spanish</span>
  </div>

  <div class="es-sentence-wrap">
    <div class="es-sentence">{{句子}}</div>
    {{#语法}}
    <div class="es-grammar-hint">  这里的「{{知识点}}」如何理解？
</div>
    {{/语法}}
  </div>
</div>`
const sraBackTemplate = `<div class="es-card">
  <div class="es-header">
    <span class="es-badge">Spanish</span>
    {{#语法}}<span class="es-badge es-badge-grammar">Grammar</span>{{/语法}}
  </div>

  <div class="es-sentence-wrap">
    <div class="es-sentence">{{句子}}</div>
  </div>

  {{#内容}}
  <div class="es-divider"></div>

  <div class="es-content-wrap">
    <div class="es-label">Translation / 翻译</div>
    <div class="es-content">{{内容}}</div>
  </div>
  {{/内容}}

  {{#知识点}}
  <div class="es-knowledge-wrap">
    <div class="es-knowledge-box">
      <div class="es-knowledge-header">
        <span class="es-knowledge-word">{{知识点}}</span>
        {{#知识点类型}}<span class="es-knowledge-type">{{知识点类型}}</span>{{/知识点类型}}
      </div>
      {{#知识点解释}}
      <div class="es-knowledge-explanation">{{知识点解释}}</div>
      {{/知识点解释}}
    </div>
  </div>
  {{/知识点}}
</div>`
const sraStyling = `* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  background: #f4f3f0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
  min-height: 100vh;
  font-family: -apple-system, "Helvetica Neue", "Segoe UI",
               "Noto Sans", sans-serif;
}

.nightMode .card {
  background: #1e1e1e;
}

/* 主卡片容器 */
.es-card {
  width: 100%;
  max-width: 720px;
  background: #ffffff;
  border-radius: 16px;
  border: 0.5px solid rgba(0,0,0,0.08);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.nightMode .es-card {
  background: #2a2a2a;
  border-color: rgba(255,255,255,0.08);
}

/* 顶部类型标签 */
.es-header {
  padding: 12px 24px;
  background: #f9f8f6;
  border-bottom: 0.5px solid rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 10px;
}

.nightMode .es-header {
  background: #252525;
  border-bottom-color: rgba(255,255,255,0.06);
}

.es-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 4px 12px;
  border-radius: 20px;
  background: #E8E4F3;
  color: #5B4BA4;
  text-transform: uppercase;
}

.nightMode .es-badge {
  background: #3a3266;
  color: #B8B0E3;
}

.es-badge-grammar {
  background: #E3F2FD;
  color: #1565C0;
}

.nightMode .es-badge-grammar {
  background: #1a3a5c;
  color: #90CAF9;
}

/* 句子区域 - 核心内容 */
.es-sentence-wrap {
  padding: 36px 28px 32px;
  text-align: center;
}

.es-sentence {
  font-family: "Noto Serif", Georgia, "Times New Roman", serif;
  font-size: 22px;
  line-height: 1.7;
  color: #1a1a1a;
  font-weight: 400;
}

.nightMode .es-sentence {
  color: #e8e8e8;
}

.es-sentence em,
.es-sentence i {
  color: #5B4BA4;
  font-style: italic;
}

.nightMode .es-sentence em,
.nightMode .es-sentence i {
  color: #B8B0E3;
}

.es-sentence strong,
.es-sentence b {
  color: #3a2d8a;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.nightMode .es-sentence strong,
.nightMode .es-sentence b {
  color: #d4ccff;
}

/* 语法提示 */
.es-grammar-hint {
  margin-top: 16px;
  font-size: 13px;
  color: #666;
  font-style: italic;
}

.nightMode .es-grammar-hint {
  color: #999;
}

/* 分隔线 */
.es-divider {
  height: 0.5px;
  background: rgba(0,0,0,0.08);
  margin: 0 24px;
}

.nightMode .es-divider {
  background: rgba(255,255,255,0.08);
}

/* 内容翻译区域 */
.es-content-wrap {
  padding: 24px 28px;
}

.es-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.es-content {
  font-size: 17px;
  line-height: 1.8;
  color: #333;
}

.nightMode .es-content {
  color: #d0d0d0;
}

/* 知识点区域 */
.es-knowledge-wrap {
  padding: 20px 28px 28px;
  background: #fafafa;
}

.nightMode .es-knowledge-wrap {
  background: #252525;
}

.es-knowledge-box {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  border: 0.5px solid rgba(0,0,0,0.06);
}

.nightMode .es-knowledge-box {
  background: #2f2f2f;
  border-color: rgba(255,255,255,0.06);
}

.es-knowledge-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.es-knowledge-word {
  font-family: "Noto Serif", Georgia, serif;
  font-size: 18px;
  font-weight: 600;
  color: #5B4BA4;
}

.nightMode .es-knowledge-word {
  color: #B8B0E3;
}

.es-knowledge-type {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  background: #E8E4F3;
  color: #5B4BA4;
  text-transform: uppercase;
}

.nightMode .es-knowledge-type {
  background: #3a3266;
  color: #B8B0E3;
}

.es-knowledge-explanation {
  font-size: 15px;
  line-height: 1.7;
  color: #444;
}

.nightMode .es-knowledge-explanation {
  color: #bbb;
}

.es-knowledge-explanation strong,
.es-knowledge-explanation b {
  color: #5B4BA4;
  font-weight: 600;
}

.nightMode .es-knowledge-explanation strong,
.nightMode .es-knowledge-explanation b {
  color: #B8B0E3;
}

/* 空内容隐藏 */
.es-grammar-hint:empty,
.es-content:empty,
.es-knowledge-wrap:empty,
.es-knowledge-word:empty,
.es-knowledge-explanation:empty {
  display: none;
}

/* 移动端优化 */
@media (max-width: 480px) {
  .es-sentence {
    font-size: 19px;
  }
  .es-content {
    font-size: 16px;
  }
  .es-sentence-wrap {
    padding: 28px 20px 24px;
  }
  .es-content-wrap,
  .es-knowledge-wrap {
    padding-left: 20px;
    padding-right: 20px;
  }
}`

const ankiKnowledgeKindLabelMap: Record<KnowledgeKind, string> = {
  grammar: '语法',
  phrase: '搭配',
  vocabulary: '词汇',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function highlightKnowledgeInSentence(sentence: string, knowledge: string) {
  const source = sentence.trim()
  const target = knowledge.trim()

  if (!source || !target) {
    return escapeHtml(source)
  }

  const startIndex = source.indexOf(target)
  if (startIndex < 0) {
    return escapeHtml(source)
  }

  const endIndex = startIndex + target.length
  return [
    escapeHtml(source.slice(0, startIndex)),
    '<strong>',
    escapeHtml(source.slice(startIndex, endIndex)),
    '</strong>',
    escapeHtml(source.slice(endIndex)),
  ].join('')
}

function normalizeAnkiEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, '')
}

function parseEndpoint(endpoint: string) {
  try {
    return new URL(normalizeAnkiEndpoint(endpoint))
  } catch {
    return null
  }
}

function isLoopbackHostname(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
}

function isLikelySafariBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent
  const vendor = navigator.vendor

  return (
    /Safari/i.test(userAgent) &&
    /Apple/i.test(vendor) &&
    !/Chrome|Chromium|CriOS|EdgiOS|FxiOS|OPiOS|DuckDuckGo/i.test(userAgent)
  )
}

function isSecureHttpsPage() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.isSecureContext && window.location.protocol === 'https:'
}

export function getAnkiCompatibilityIssue(endpoint: string): AnkiCompatibilityIssue | null {
  const parsed = parseEndpoint(endpoint)
  if (!parsed) {
    return null
  }

  if (
    isLikelySafariBrowser() &&
    isSecureHttpsPage() &&
    parsed.protocol === 'http:' &&
    isLoopbackHostname(parsed.hostname)
  ) {
    return {
      code: 'safari-secure-loopback-http',
      summary:
        'Safari 会阻止当前 HTTPS 页面直接访问本机 HTTP 版 AnkiConnect，这不是你的 Anki 配置错误。',
      details: [
        `当前页面来源是 ${window.location.origin}，AnkiConnect 地址是 ${parsed.origin}。`,
        '请改用 Chrome 打开当前线上页面，或者改为在本地通过 HTTP 打开本应用后再连接 Anki。',
      ],
    }
  }

  return null
}

async function invokeAnkiAction<Result>(
  endpoint: string,
  action: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
) {
  const compatibilityIssue = getAnkiCompatibilityIssue(endpoint)
  if (compatibilityIssue) {
    throw new Error(compatibilityIssue.summary)
  }

  const response = await fetch(normalizeAnkiEndpoint(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      version: 6,
      params,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`AnkiConnect 请求失败（${response.status}）。`)
  }

  const payload = (await response.json()) as AnkiResponse<Result>
  if (payload.error) {
    throw new Error(payload.error)
  }

  if (typeof payload.result === 'undefined') {
    throw new Error(`AnkiConnect 没有返回 ${action} 的结果。`)
  }

  return payload.result
}

function getAnkiFieldMappingIssues(config: AnkiConfig) {
  const issues: string[] = []

  if (!config.endpoint.trim()) {
    issues.push('请先在设置的 Anki 标签页里填写 AnkiConnect URL。')
  }

  if (!config.deck.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择要写入的 deck。')
  }

  if (!config.noteType.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择 note type。')
  }

  const assignedFields = ankiFieldSourceOrder
    .map((source) => ({
      source,
      field: config.fieldMapping[source].trim(),
    }))
    .filter((item) => item.field.length > 0)

  for (const source of ankiFieldSourceOrder) {
    if (!config.fieldMapping[source].trim()) {
      issues.push(`请先为「${ankiFieldSourceLabelMap[source]}」选择字段映射。`)
      break
    }
  }

  const fieldSet = new Set<string>()
  for (const assignment of assignedFields) {
    if (fieldSet.has(assignment.field)) {
      issues.push('字段映射里存在重复目标字段，请为每个内容选择不同的 Anki 字段。')
      break
    }

    fieldSet.add(assignment.field)
  }

  return issues
}

function buildFields(
  config: AnkiConfig,
  payload: AnkiNotePayload,
) {
  return ankiFieldSourceOrder.reduce<Record<string, string>>((fields, source) => {
    const targetField = config.fieldMapping[source].trim()
    if (!targetField) {
      return fields
    }

    return {
      ...fields,
      [targetField]: payload[source],
    }
  }, {})
}

export function createAnkiFieldMappingFromFieldNames(
  fieldNames: readonly string[],
): AnkiFieldMapping {
  const normalizedFieldNames = new Set(fieldNames)

  return ankiFieldSourceOrder.reduce<AnkiFieldMapping>(
    (mapping, source) => ({
      ...mapping,
      [source]: normalizedFieldNames.has(ankiFieldSourceLabelMap[source])
        ? ankiFieldSourceLabelMap[source]
        : '',
    }),
    {
      sentence: '',
      grammar: '',
      meaning: '',
      knowledge: '',
      knowledgeKind: '',
      knowledgeExplanation: '',
    },
  )
}

export function toUserFacingAnkiError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '连接 AnkiConnect 超时，请确认 Anki 已打开后重试。'
  }

  if (error instanceof TypeError) {
    return '无法连接到 AnkiConnect。请确认 Anki 已打开、AnkiConnect 已启用，并允许当前页面来源访问 127.0.0.1:8765。'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Anki 添加失败，请稍后重试。'
}

export async function ensureAnkiPermission(endpoint: string, signal?: AbortSignal) {
  try {
    const permissionResult = await invokeAnkiAction<AnkiPermissionResult>(
      endpoint,
      'requestPermission',
      {},
      signal,
    )

    if (permissionResult.permission !== 'granted') {
      throw new Error('AnkiConnect 拒绝了当前页面的访问请求。请在 Anki 弹窗中允许后再重试。')
    }

    if (permissionResult.requireApiKey) {
      throw new Error(
        '当前 AnkiConnect 已开启 API Key，本应用暂不支持填写 API Key。请在 AnkiConnect 配置里关闭 requireApiKey 后重试。',
      )
    }

    return permissionResult
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

async function fetchAnkiModelTemplates(
  endpoint: string,
  modelName: string,
  signal?: AbortSignal,
) {
  return invokeAnkiAction<AnkiModelTemplates>(
    endpoint,
    'modelTemplates',
    { modelName },
    signal,
  )
}

export async function createOrRepairSraAnkiNoteType(
  endpoint: string,
  signal?: AbortSignal,
) {
  try {
    await ensureAnkiPermission(endpoint, signal)

    const existingNoteTypes = await invokeAnkiAction<string[]>(endpoint, 'modelNames', {}, signal)
    const modelExists = existingNoteTypes.includes(SRA_NOTE_TYPE_NAME)

    if (!modelExists) {
      await invokeAnkiAction(endpoint, 'createModel', {
        modelName: SRA_NOTE_TYPE_NAME,
        inOrderFields: sraFieldNames,
        css: sraStyling,
        isCloze: false,
        cardTemplates: [
          {
            Name: 'Card 1',
            Front: sraFrontTemplate,
            Back: sraBackTemplate,
          },
        ],
      }, signal)

      return {
        created: true,
        fieldNames: [...sraFieldNames],
      }
    }

    const existingFields = await invokeAnkiAction<string[]>(
      endpoint,
      'modelFieldNames',
      { modelName: SRA_NOTE_TYPE_NAME },
      signal,
    )

    for (const [index, fieldName] of sraFieldNames.entries()) {
      if (!existingFields.includes(fieldName)) {
        await invokeAnkiAction(endpoint, 'modelFieldAdd', {
          modelName: SRA_NOTE_TYPE_NAME,
          fieldName,
          index,
        }, signal)
      }
    }

    for (const [index, fieldName] of sraFieldNames.entries()) {
      await invokeAnkiAction(endpoint, 'modelFieldReposition', {
        modelName: SRA_NOTE_TYPE_NAME,
        fieldName,
        index,
      }, signal)
    }

    const templates = await fetchAnkiModelTemplates(endpoint, SRA_NOTE_TYPE_NAME, signal)
    const primaryTemplateName = Object.keys(templates)[0]

    if (primaryTemplateName) {
      await invokeAnkiAction(endpoint, 'updateModelTemplates', {
        model: {
          name: SRA_NOTE_TYPE_NAME,
          templates: {
            [primaryTemplateName]: {
              Front: sraFrontTemplate,
              Back: sraBackTemplate,
            },
          },
        },
      }, signal)
    } else {
      await invokeAnkiAction(endpoint, 'modelTemplateAdd', {
        modelName: SRA_NOTE_TYPE_NAME,
        template: {
          Name: 'Card 1',
          Front: sraFrontTemplate,
          Back: sraBackTemplate,
        },
      }, signal)
    }

    await invokeAnkiAction(endpoint, 'updateModelStyling', {
      model: {
        name: SRA_NOTE_TYPE_NAME,
        css: sraStyling,
      },
    }, signal)

    return {
      created: false,
      fieldNames: [...sraFieldNames],
    }
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export function buildAnkiNotePayload(
  sentence: SentenceItem,
  result: AnalysisResult,
  highlight: AnalysisHighlight,
): AnkiNotePayload {
  const sentenceText = sentence.editedText || sentence.text

  return {
    sentence: highlightKnowledgeInSentence(sentenceText, highlight.text),
    grammar: result.grammar,
    meaning: result.meaning,
    knowledge: highlight.text,
    knowledgeKind: ankiKnowledgeKindLabelMap[highlight.kind],
    knowledgeExplanation: highlight.explanation,
  }
}

export async function fetchAnkiVersion(endpoint: string, signal?: AbortSignal) {
  try {
    return await invokeAnkiAction<number>(endpoint, 'version', {}, signal)
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function fetchAnkiDeckNames(endpoint: string, signal?: AbortSignal) {
  try {
    return await invokeAnkiAction<string[]>(endpoint, 'deckNames', {}, signal)
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function fetchAnkiNoteTypes(endpoint: string, signal?: AbortSignal) {
  try {
    return await invokeAnkiAction<string[]>(endpoint, 'modelNames', {}, signal)
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function fetchAnkiNoteFields(
  endpoint: string,
  noteType: string,
  signal?: AbortSignal,
) {
  try {
    return await invokeAnkiAction<string[]>(
      endpoint,
      'modelFieldNames',
      { modelName: noteType },
      signal,
    )
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function addNoteToAnki(
  config: AnkiConfig,
  payload: AnkiNotePayload,
) {
  const issue = getAnkiFieldMappingIssues(config)[0]
  if (issue) {
    throw new Error(issue)
  }

  try {
    return await invokeAnkiAction<number>(config.endpoint, 'addNote', {
      note: {
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload),
        options: {
          allowDuplicate: true,
        },
      },
    })
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

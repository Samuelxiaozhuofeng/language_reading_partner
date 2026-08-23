import { languageLabel } from '../lib/languages'
import type { BookLanguage } from '../types'

type AndroidPastePageProps = {
  articleTitle: string
  draftLanguage: BookLanguage
  error?: string
  isSaving?: boolean
  notice?: string
  onArticleTitleChange: (value: string) => void
  onCancel: () => void
  onDraftLanguageChange: (language: BookLanguage) => void
  onSave: () => void
  onSourceTextChange: (value: string) => void
  sourceText: string
}

function AndroidPastePage({
  articleTitle,
  draftLanguage,
  error,
  isSaving = false,
  notice,
  onArticleTitleChange,
  onCancel,
  onDraftLanguageChange,
  onSave,
  onSourceTextChange,
  sourceText,
}: AndroidPastePageProps) {
  const canSave = sourceText.trim().length > 0 && !isSaving

  return (
    <div className="app-shell">
      <main className="android-paste-page">
        <section className="panel android-paste-panel">
          <label className="field field-block">
            <span>文章标题</span>
            <input
              type="text"
              value={articleTitle}
              onChange={(event) => onArticleTitleChange(event.target.value)}
              placeholder="可选，不填则用原文开头"
            />
          </label>

          <label className="field field-block">
            <span>语言</span>
            <select
              value={draftLanguage}
              onChange={(event) =>
                onDraftLanguageChange(event.currentTarget.value as BookLanguage)
              }
            >
              <option value="es">{languageLabel('es')}</option>
              <option value="ja">{languageLabel('ja')}</option>
              <option value="ar">{languageLabel('ar')}</option>
            </select>
          </label>

          <label className="field field-block">
            <span>原文</span>
            <textarea
              className="source-textarea android-paste-textarea"
              value={sourceText}
              onChange={(event) => onSourceTextChange(event.target.value)}
              placeholder="把文章粘贴到这里"
            />
          </label>

          {notice ? <p className="notice success">{notice}</p> : null}
          {error ? <p className="notice error">{error}</p> : null}

          <div className="android-paste-actions">
            <button className="ghost-button" type="button" onClick={onCancel}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={!canSave}
              type="button"
              onClick={onSave}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AndroidPastePage

import type { ChangeEvent } from 'react'

type LibraryEmptyStateProps = {
  isImporting: boolean
  manualWorkspaceLabel: string
  onFileSelected: (file: File) => void
  onOpenManualWorkspace: () => void
}

function LibraryEmptyState({
  isImporting,
  manualWorkspaceLabel,
  onFileSelected,
  onOpenManualWorkspace,
}: LibraryEmptyStateProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    onFileSelected(file)
    event.currentTarget.value = ''
  }

  return (
    <div className="empty-state library-empty-state">
      <div className="library-empty-copy">
        <h3>书架还是空的</h3>
        <p>导入一本 EPUB 电子书，或者粘贴一段外语文章直接开始逐句精读与解析。</p>
      </div>
      <div className="library-empty-actions">
        <label className="primary-button file-trigger">
          {isImporting ? '导入中...' : '导入 EPUB'}
          <input
            accept=".epub,application/epub+zip"
            type="file"
            onChange={handleInputChange}
          />
        </label>
        <button
          className="ghost-button"
          type="button"
          onClick={onOpenManualWorkspace}
        >
          {manualWorkspaceLabel}
        </button>
      </div>
    </div>
  )
}

export default LibraryEmptyState

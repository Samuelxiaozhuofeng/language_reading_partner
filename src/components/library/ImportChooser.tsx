import { useEffect, useRef, useState } from 'react'

type ImportChooserProps = {
  className?: string
  hasDraft?: boolean
  isImporting?: boolean
  manualWorkspaceLabel?: string
  onFileSelected: (file: File) => void
  onOpenManualWorkspace: () => void
}

export default function ImportChooser({
  className = '',
  hasDraft = false,
  isImporting = false,
  manualWorkspaceLabel = '粘贴文章解析',
  onFileSelected,
  onOpenManualWorkspace,
}: ImportChooserProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const manualLabel =
    hasDraft || manualWorkspaceLabel.includes('继续') ? '继续编辑草稿' : '粘贴文章'

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleEpubClick = () => {
    setIsOpen(false)
    fileInputRef.current?.click()
  }

  const handleManualClick = () => {
    setIsOpen(false)
    onOpenManualWorkspace()
  }

  return (
    <div className={`import-chooser ${className}`} ref={menuRef}>
      <input
        accept=".epub,application/epub+zip"
        ref={fileInputRef}
        style={{ display: 'none' }}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            onFileSelected(file)
          }
          event.currentTarget.value = ''
        }}
      />

      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="primary-button import-chooser-trigger"
        disabled={isImporting}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isImporting ? '导入中...' : '导入 ▾'}
      </button>

      {isOpen ? (
        <div className="import-chooser-menu" role="menu">
          <button
            className="import-chooser-item"
            role="menuitem"
            type="button"
            onClick={handleEpubClick}
          >
            <span className="import-chooser-title">导入 EPUB</span>
            <span className="import-chooser-desc">选择本地 EPUB 电子书</span>
          </button>
          <button
            className="import-chooser-item"
            role="menuitem"
            type="button"
            onClick={handleManualClick}
          >
            <span className="import-chooser-title">{manualLabel}</span>
            <span className="import-chooser-desc">粘贴文本直接分句与解析</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

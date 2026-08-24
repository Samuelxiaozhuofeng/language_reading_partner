import ImportChooser from './ImportChooser'

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
  return (
    <div className="empty-state library-empty-state">
      <div className="library-empty-copy">
        <h3>书架还是空的</h3>
        <p>导入 EPUB 或 TXT，也可以粘贴一段外语文章，直接开始逐句精读。</p>
      </div>
      <div className="library-empty-actions">
        <ImportChooser
          isImporting={isImporting}
          manualWorkspaceLabel={manualWorkspaceLabel}
          onFileSelected={onFileSelected}
          onOpenManualWorkspace={onOpenManualWorkspace}
        />
      </div>
    </div>
  )
}

export default LibraryEmptyState

type LegacyMigrationPromptProps = {
  hasLegacyLocalLibrary: boolean
  isMigratingLegacyLibrary: boolean
  onMigrateLegacyLocalLibrary: () => void | Promise<void>
}

function LegacyMigrationPrompt({
  hasLegacyLocalLibrary,
  isMigratingLegacyLibrary,
  onMigrateLegacyLocalLibrary,
}: LegacyMigrationPromptProps) {
  if (!hasLegacyLocalLibrary) {
    return null
  }

  return (
    <section className="panel legacy-migration-panel">
      <div>
        <p className="section-kicker">Migration</p>
        <h2>发现旧本地书库</h2>
        <p className="panel-tip">可以把当前浏览器里的旧书籍、章节、学习资源和 EPUB 文件导入云端。</p>
      </div>
      <button
        className="primary-button"
        disabled={isMigratingLegacyLibrary}
        type="button"
        onClick={() => void onMigrateLegacyLocalLibrary()}
      >
        {isMigratingLegacyLibrary ? '正在导入...' : '导入旧本地书库'}
      </button>
    </section>
  )
}

export default LegacyMigrationPrompt

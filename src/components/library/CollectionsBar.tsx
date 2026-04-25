import { useState, type FormEvent } from 'react'
import type { CollectionRecord } from '../../types'

type CollectionsBarProps = {
  activeCollectionId: string | null
  collectionBookCounts: Record<string, number>
  collections: CollectionRecord[]
  onCreateCollection: (name: string) => void | Promise<void>
  onDeleteCollection: (collectionId: string) => void | Promise<void>
  onSetActiveCollection: (collectionId: string | null) => void | Promise<void>
  totalBookCount: number
}

function CollectionsBar({
  activeCollectionId,
  collectionBookCounts,
  collections,
  onCreateCollection,
  onDeleteCollection,
  onSetActiveCollection,
  totalBookCount,
}: CollectionsBarProps) {
  const [newCollectionName, setNewCollectionName] = useState('')

  const handleCreateCollection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const collectionName = newCollectionName.trim()
    if (!collectionName) {
      return
    }

    await onCreateCollection(collectionName)
    setNewCollectionName('')
  }

  return (
    <div className="collections-bar" aria-label="书架集合">
      <div className="collection-tabs">
        <button
          className={`collection-tab ${activeCollectionId === null ? 'is-active' : ''}`}
          type="button"
          onClick={() => void onSetActiveCollection(null)}
        >
          <span>全部</span>
          <span className="collection-count">{totalBookCount}</span>
        </button>

        {collections.map((collection) => (
          <div className="collection-tab-item" key={collection.id}>
            <button
              className={`collection-tab ${
                activeCollectionId === collection.id ? 'is-active' : ''
              }`}
              type="button"
              onClick={() => void onSetActiveCollection(collection.id)}
            >
              <span>{collection.name}</span>
              <span className="collection-count">
                {collectionBookCounts[collection.id] ?? 0}
              </span>
            </button>
            <button
              className="collection-delete-button"
              type="button"
              aria-label={`删除集合 ${collection.name}`}
              onClick={() => {
                if (window.confirm(`删除集合「${collection.name}」？书籍会移回全部。`)) {
                  void onDeleteCollection(collection.id)
                }
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <form className="collection-create-form" onSubmit={(event) => void handleCreateCollection(event)}>
        <input
          aria-label="新集合名称"
          className="collection-name-input"
          placeholder="新建集合"
          value={newCollectionName}
          onChange={(event) => setNewCollectionName(event.target.value)}
        />
        <button className="secondary-button" type="submit" disabled={!newCollectionName.trim()}>
          新建
        </button>
      </form>
    </div>
  )
}

export default CollectionsBar

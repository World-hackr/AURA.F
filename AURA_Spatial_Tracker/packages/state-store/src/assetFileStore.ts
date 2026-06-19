const DB_NAME = 'aura-asset-files'
const STORE_NAME = 'files'
const DB_VERSION = 1

export type StoredAssetFile = {
  key: string
  blob: Blob
  fileName: string
  mimeType: string
  updatedAt: number
}

const isBrowser = () => typeof window !== 'undefined' && 'indexedDB' in window

const openAssetDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('IndexedDB is not available in this environment.'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) => {
  const db = await openAssetDb()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = run(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export const createAssetFileKey = (assetId: string, fileName: string) =>
  `${assetId}:${fileName}:${Date.now()}`

export const saveAssetFile = async (key: string, file: File) => {
  const record: StoredAssetFile = {
    key,
    blob: file,
    fileName: file.name,
    mimeType: file.type || 'model/gltf-binary',
    updatedAt: Date.now(),
  }

  await withStore('readwrite', store => store.put(record))
}

export const getAssetFile = (key: string) =>
  withStore<StoredAssetFile | undefined>('readonly', store => store.get(key))

export const createAssetObjectUrl = async (key: string) => {
  const record = await getAssetFile(key)
  return record ? URL.createObjectURL(record.blob) : null
}

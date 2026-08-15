const DATABASE_NAME = 'akaaka-virtual-lover-key-material'
const DATABASE_VERSION = 1
const STORE_NAME = 'device-private-keys'

export interface DevicePrivateKeyRecord {
  userId: string
  deviceId: string
  privateKey: CryptoKey
}

export interface DeviceKeyStore {
  save(record: DevicePrivateKeyRecord): Promise<void>
  load(userId: string, deviceId: string): Promise<DevicePrivateKeyRecord | undefined>
  remove(userId: string, deviceId: string): Promise<void>
  clearUser(userId: string): Promise<void>
}

function recordKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

function assertIdentifier(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name}_required`)
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexeddb_request_failed'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('indexeddb_transaction_failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('indexeddb_transaction_aborted'))
  })
}

export function createIndexedDbDeviceKeyStore(
  factory: IDBFactory = globalThis.indexedDB,
): DeviceKeyStore {
  let databasePromise: Promise<IDBDatabase> | undefined

  const openDatabase = (): Promise<IDBDatabase> => {
    if (!factory) return Promise.reject(new Error('indexeddb_unavailable'))
    databasePromise ??= new Promise((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('indexeddb_open_failed'))
    })
    return databasePromise
  }

  return {
    async save(record) {
      assertIdentifier(record.userId, 'user_id')
      assertIdentifier(record.deviceId, 'device_id')
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ ...record, key: recordKey(record.userId, record.deviceId) })
      await transactionComplete(transaction)
    },
    async load(userId, deviceId) {
      assertIdentifier(userId, 'user_id')
      assertIdentifier(deviceId, 'device_id')
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const result = await requestResult<DevicePrivateKeyRecord & { key: string }>(
        transaction.objectStore(STORE_NAME).get(recordKey(userId, deviceId)),
      )
      return result ? { userId: result.userId, deviceId: result.deviceId, privateKey: result.privateKey } : undefined
    },
    async remove(userId, deviceId) {
      assertIdentifier(userId, 'user_id')
      assertIdentifier(deviceId, 'device_id')
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(recordKey(userId, deviceId))
      await transactionComplete(transaction)
    },
    async clearUser(userId) {
      assertIdentifier(userId, 'user_id')
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        const value = cursor.value as DevicePrivateKeyRecord & { key: string }
        if (value.userId === userId) cursor.delete()
        cursor.continue()
      }
      await transactionComplete(transaction)
    },
  }
}

export function createMemoryDeviceKeyStore(): DeviceKeyStore {
  const records = new Map<string, DevicePrivateKeyRecord>()
  return {
    async save(record) {
      assertIdentifier(record.userId, 'user_id')
      assertIdentifier(record.deviceId, 'device_id')
      records.set(recordKey(record.userId, record.deviceId), record)
    },
    async load(userId, deviceId) {
      assertIdentifier(userId, 'user_id')
      assertIdentifier(deviceId, 'device_id')
      return records.get(recordKey(userId, deviceId))
    },
    async remove(userId, deviceId) {
      assertIdentifier(userId, 'user_id')
      assertIdentifier(deviceId, 'device_id')
      records.delete(recordKey(userId, deviceId))
    },
    async clearUser(userId) {
      assertIdentifier(userId, 'user_id')
      for (const key of records.keys()) if (key.startsWith(`${userId}:`)) records.delete(key)
    },
  }
}

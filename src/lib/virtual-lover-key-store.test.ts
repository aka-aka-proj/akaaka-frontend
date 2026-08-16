import { describe, expect, it } from 'vitest'
import { createMemoryDeviceKeyStore } from './virtual-lover-key-store'

describe('Virtual Lover device key storage contract', () => {
  it('stores private key material by user and device without browser web storage', async () => {
    const store = createMemoryDeviceKeyStore()
    const privateKey = { type: 'private', extractable: false } as CryptoKey

    await store.save({ userId: 'user-1', deviceId: 'device-1', privateKey })

    await expect(store.load('user-1', 'device-1')).resolves.toEqual({
      userId: 'user-1',
      deviceId: 'device-1',
      privateKey,
    })
    await expect(store.loadAny('user-1')).resolves.toEqual({
      userId: 'user-1',
      deviceId: 'device-1',
      privateKey,
    })
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('clears every device private key for a user on sign-out or account removal', async () => {
    const store = createMemoryDeviceKeyStore()
    const privateKey = { type: 'private', extractable: false } as CryptoKey

    await store.save({ userId: 'user-1', deviceId: 'device-1', privateKey })
    await store.save({ userId: 'user-1', deviceId: 'device-2', privateKey })
    await store.save({ userId: 'user-2', deviceId: 'device-1', privateKey })
    await store.clearUser('user-1')

    await expect(store.load('user-1', 'device-1')).resolves.toBeUndefined()
    await expect(store.load('user-1', 'device-2')).resolves.toBeUndefined()
    await expect(store.load('user-2', 'device-1')).resolves.toBeDefined()
  })

  it('rejects empty ownership identifiers', async () => {
    const store = createMemoryDeviceKeyStore()
    const privateKey = { type: 'private' } as CryptoKey

    await expect(store.save({ userId: '', deviceId: 'device-1', privateKey })).rejects.toThrow('user_id_required')
    await expect(store.load('user-1', ' ')).rejects.toThrow('device_id_required')
  })
})

import { describe, expect, it } from 'vitest'
import {
  decryptRecord,
  encryptRecord,
  generateDeviceKeyPair,
  generateVaultDataKey,
  unwrapVaultKey,
  wrapVaultKey,
} from './virtual-lover-crypto'

const address = {
  table: 'ai_messages',
  recordId: 'message-1',
  field: 'content',
  keyVersion: 1,
} as const

describe('Virtual Lover client-side encryption', () => {
  it('encrypts and decrypts a record with authenticated metadata', async () => {
    const key = await generateVaultDataKey()
    const encrypted = await encryptRecord('敏感對話內容', key, address)

    expect(encrypted.ciphertext).not.toContain('敏感對話內容')
    expect(encrypted.nonce).not.toBe('')
    await expect(decryptRecord(encrypted, key, address)).resolves.toBe('敏感對話內容')
    await expect(decryptRecord(encrypted, key, { ...address, recordId: 'other-message' }))
      .rejects.toThrow()
  })

  it('wraps the vault key for a device and unwraps it without exporting the private key', async () => {
    const vaultKey = await generateVaultDataKey()
    const device = await generateDeviceKeyPair()
    const wrapped = await wrapVaultKey(vaultKey, device.publicKey)
    const restored = await unwrapVaultKey(wrapped, device.privateKey)
    const encrypted = await encryptRecord('device recovery', restored, address)

    await expect(decryptRecord(encrypted, vaultKey, address)).resolves.toBe('device recovery')
    expect(device.privateKey.extractable).toBe(false)
  })
})

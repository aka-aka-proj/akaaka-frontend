const RECORD_SCHEMA_VERSION = 1
const NONCE_BYTES = 12

export interface EncryptedRecord {
  ciphertext: string
  nonce: string
  keyVersion: number
  aadVersion: number
}

export interface RecordAddress {
  table: string
  recordId: string
  field: string
  keyVersion: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

function addressBytes(address: RecordAddress): Uint8Array {
  return encoder.encode(JSON.stringify({
    schemaVersion: RECORD_SCHEMA_VERSION,
    table: address.table,
    recordId: address.recordId,
    field: address.field,
    keyVersion: address.keyVersion,
  }))
}

export async function generateVaultDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  ) as Promise<CryptoKey>
}

export async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    false,
    ['wrapKey', 'unwrapKey'],
  ) as Promise<CryptoKeyPair>
}

export async function wrapVaultKey(vaultKey: CryptoKey, devicePublicKey: CryptoKey): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    vaultKey,
    devicePublicKey,
    { name: 'RSA-OAEP' },
  )
  return bytesToBase64Url(new Uint8Array(wrapped))
}

export async function unwrapVaultKey(
  wrappedVaultKey: string,
  devicePrivateKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    asArrayBuffer(base64UrlToBytes(wrappedVaultKey)),
    devicePrivateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )
}

export async function encryptRecord(
  plaintext: string,
  vaultKey: CryptoKey,
  address: RecordAddress,
): Promise<EncryptedRecord> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(nonce), additionalData: asArrayBuffer(addressBytes(address)) },
    vaultKey,
    encoder.encode(plaintext),
  )
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    nonce: bytesToBase64Url(nonce),
    keyVersion: address.keyVersion,
    aadVersion: RECORD_SCHEMA_VERSION,
  }
}

export async function decryptRecord(
  record: EncryptedRecord,
  vaultKey: CryptoKey,
  address: RecordAddress,
): Promise<string> {
  if (record.keyVersion !== address.keyVersion || record.aadVersion !== RECORD_SCHEMA_VERSION) {
    throw new Error('unsupported_encryption_version')
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(base64UrlToBytes(record.nonce)),
      additionalData: asArrayBuffer(addressBytes(address)),
    },
    vaultKey,
    asArrayBuffer(base64UrlToBytes(record.ciphertext)),
  )
  return decoder.decode(plaintext)
}

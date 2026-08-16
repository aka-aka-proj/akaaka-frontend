import { supabase } from '../supabaseClient'
import {
  generateDeviceKeyPair,
  generateVaultDataKey,
  unwrapVaultKey,
  wrapVaultKey,
} from './virtual-lover-crypto'
import {
  createIndexedDbDeviceKeyStore,
  type DevicePrivateKeyRecord,
} from './virtual-lover-key-store'

export type VaultUnlockResult =
  | { status: 'ready'; deviceId: string; vaultKey: CryptoKey }
  | { status: 'recovery_required'; reason: 'device_not_registered' | 'private_key_not_available' }

const deviceKeyStore = createIndexedDbDeviceKeyStore()

function publicKeyText(publicKeyJwk: JsonWebKey): string {
  return JSON.stringify(publicKeyJwk)
}

async function enrollDevice(userId: string, deviceLabel: string): Promise<VaultUnlockResult> {
  const keyPair = await generateDeviceKeyPair()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const deviceId = crypto.randomUUID()
  const localRecord: DevicePrivateKeyRecord = {
    userId,
    deviceId,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
  }

  const { data: device, error: deviceError } = await supabase
    .from('ai_encryption_devices')
    .insert({
      id: deviceId,
      user_id: userId,
      device_label: deviceLabel.trim().slice(0, 120) || 'Browser device',
      public_key_jwk: publicKeyText(publicKeyJwk),
      key_version: 1,
      status: 'active',
    })
    .select('id')
    .single()
  if (deviceError || !device) throw new Error('device_enrollment_failed')

  try {
    const vaultKey = await generateVaultDataKey()
    const wrappedDataKey = await wrapVaultKey(vaultKey, keyPair.publicKey)
    const { error: vaultError } = await supabase
      .from('ai_encryption_vault_keys')
      .insert({
        user_id: userId,
        device_id: device.id,
        wrapped_data_key: wrappedDataKey,
        wrap_algorithm: 'RSA-OAEP-3072-SHA256',
        key_version: 1,
        status: 'active',
      })
    if (vaultError) throw new Error('vault_key_enrollment_failed')

    await deviceKeyStore.save(localRecord)
    return { status: 'ready', deviceId: device.id, vaultKey }
  } catch (error) {
    await supabase.from('ai_encryption_devices').delete().eq('id', deviceId).eq('user_id', userId)
    throw error
  }
}

export async function unlockOrEnrollVirtualLoverVault(
  userId: string,
  deviceLabel = 'Browser device',
): Promise<VaultUnlockResult> {
  const localDevice = await deviceKeyStore.loadAny(userId)
  if (!localDevice) return enrollDevice(userId, deviceLabel)
  if (!localDevice.publicKeyJwk) {
    return { status: 'recovery_required', reason: 'private_key_not_available' }
  }

  const { data: devices, error: deviceError } = await supabase
    .from('ai_encryption_devices')
    .select('id, public_key_jwk, status')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (deviceError) throw new Error('device_lookup_failed')

  const device = (devices ?? []).find((candidate) => candidate.id === localDevice.deviceId
    && candidate.public_key_jwk === publicKeyText(localDevice.publicKeyJwk!))
  if (!device) return { status: 'recovery_required', reason: 'device_not_registered' }

  const { data: wrapped, error: vaultError } = await supabase
    .from('ai_encryption_vault_keys')
    .select('wrapped_data_key, key_version, wrap_algorithm')
    .eq('user_id', userId)
    .eq('device_id', device.id)
    .eq('status', 'active')
    .order('key_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (vaultError || !wrapped || wrapped.wrap_algorithm !== 'RSA-OAEP-3072-SHA256') {
    return { status: 'recovery_required', reason: 'device_not_registered' }
  }

  const vaultKey = await unwrapVaultKey(wrapped.wrapped_data_key, localDevice.privateKey)
  return { status: 'ready', deviceId: device.id, vaultKey }
}

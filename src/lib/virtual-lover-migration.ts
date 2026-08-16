import {
  decryptRecord,
  encryptRecord,
  type EncryptedRecord,
  type RecordAddress,
} from './virtual-lover-crypto'

export const VIRTUAL_LOVER_MIGRATION_VERSION = 1
export const VIRTUAL_LOVER_MIGRATION_BATCH_SIZE = 50

export type MigrationTable = 'ai_characters' | 'ai_messages'
export type MigrationStatus = 'pending' | 'in_progress' | 'complete' | 'blocked' | 'cancelled'

export interface MigrationCursor {
  table: MigrationTable | null
  createdAt: string | null
  id: string | null
}

export interface MigrationState {
  id: string
  userId: string
  targetVersion: number
  status: MigrationStatus
  cursor: MigrationCursor
  legacyRowsSeen: number
  encryptedRowsVerified: number
  legacyRowsCleared: number
  failureCode: string | null
}

export interface LegacyMigrationRow {
  table: MigrationTable
  id: string
  createdAt: string
  plaintext: string
}

export interface VerifiedEncryptedRow {
  encrypted: EncryptedRecord
  legacyCleared: boolean
}

export interface VirtualLoverMigrationAdapter {
  loadOrCreateMigration(userId: string, targetVersion: number): Promise<MigrationState>
  setInProgress(state: MigrationState): Promise<MigrationState>
  listLegacyRows(
    userId: string,
    table: MigrationTable,
    cursor: MigrationCursor,
    limit: number,
  ): Promise<LegacyMigrationRow[]>
  writeEncryptedAndClearLegacy(
    userId: string,
    row: LegacyMigrationRow,
    encrypted: EncryptedRecord,
  ): Promise<void>
  verifyEncryptedRow(userId: string, row: LegacyMigrationRow): Promise<VerifiedEncryptedRow>
  saveProgress(state: MigrationState): Promise<MigrationState>
  markBlocked(state: MigrationState, failureCode: string): Promise<MigrationState>
  markComplete(state: MigrationState): Promise<MigrationState>
}

export interface MigrationRunResult {
  state: MigrationState
  processedRows: number
  blocked: boolean
}

function fieldForTable(table: MigrationTable): string {
  return table === 'ai_characters' ? 'memory' : 'content'
}

function encryptedAddress(row: LegacyMigrationRow, keyVersion: number): RecordAddress {
  return {
    table: row.table,
    recordId: row.id,
    field: fieldForTable(row.table),
    keyVersion,
  }
}

function stableFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  const knownCodes = new Set([
    'device_locked',
    'vault_key_unavailable',
    'decrypt_failed',
    'aad_mismatch',
    'row_identity_mismatch',
    'ciphertext_write_failed',
    'legacy_clear_verification_failed',
    'permission_denied',
    'unsupported_version',
  ])
  return knownCodes.has(message) ? message : 'migration_step_failed'
}

function nextTable(table: MigrationTable): MigrationTable | null {
  return table === 'ai_characters' ? 'ai_messages' : null
}

function initialCursor(state: MigrationState): MigrationCursor {
  return state.cursor.table ? state.cursor : { table: 'ai_characters', createdAt: null, id: null }
}

/**
 * Runs at most one deterministic batch. Plaintext exists only in this call's
 * browser memory and is never included in adapter progress/state payloads.
 */
export async function runVirtualLoverMigrationBatch(
  adapter: VirtualLoverMigrationAdapter,
  userId: string,
  vaultKey: CryptoKey,
): Promise<MigrationRunResult> {
  let state = await adapter.loadOrCreateMigration(userId, VIRTUAL_LOVER_MIGRATION_VERSION)
  if (state.status === 'complete' || state.status === 'cancelled') {
    return { state, processedRows: 0, blocked: false }
  }

  state = await adapter.setInProgress({ ...state, failureCode: null })
  let cursor = initialCursor(state)
  let processedRows = 0

  try {
    if (!cursor.table) {
      return { state: await adapter.markComplete({ ...state, cursor }), processedRows, blocked: false }
    }

    const rows = await adapter.listLegacyRows(userId, cursor.table, cursor, VIRTUAL_LOVER_MIGRATION_BATCH_SIZE)
    if (rows.length === 0) {
      const table = nextTable(cursor.table)
      if (!table) {
        return { state: await adapter.markComplete({ ...state, cursor: { table: null, createdAt: null, id: null } }), processedRows, blocked: false }
      }
      state = await adapter.saveProgress({
        ...state,
        cursor: { table, createdAt: null, id: null },
      })
      return { state, processedRows, blocked: false }
    }

    for (const row of rows) {
      const keyVersion = state.targetVersion
      const address = encryptedAddress(row, keyVersion)
      const encrypted = await encryptRecord(row.plaintext, vaultKey, address)
      const verifiedPlaintext = await decryptRecord(encrypted, vaultKey, address)
      if (verifiedPlaintext !== row.plaintext) throw new Error('decrypt_failed')

      await adapter.writeEncryptedAndClearLegacy(userId, row, encrypted)
      const persisted = await adapter.verifyEncryptedRow(userId, row)
      if (!persisted.legacyCleared) throw new Error('legacy_clear_verification_failed')
      const persistedPlaintext = await decryptRecord(persisted.encrypted, vaultKey, address)
      if (persistedPlaintext !== row.plaintext) throw new Error('row_identity_mismatch')

      processedRows += 1
      state = await adapter.saveProgress({
        ...state,
        cursor: { table: row.table, createdAt: row.createdAt, id: row.id },
        legacyRowsSeen: state.legacyRowsSeen + 1,
        encryptedRowsVerified: state.encryptedRowsVerified + 1,
        legacyRowsCleared: state.legacyRowsCleared + 1,
      })
    }

    return { state, processedRows, blocked: false }
  } catch (error) {
    const failureCode = stableFailureCode(error)
    const blockedState = await adapter.markBlocked({ ...state, cursor }, failureCode)
    return { state: blockedState, processedRows, blocked: true }
  }
}

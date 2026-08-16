import { describe, expect, it, vi } from 'vitest'
import { generateVaultDataKey } from './virtual-lover-crypto'
import {
  runVirtualLoverMigrationBatch,
  type LegacyMigrationRow,
  type MigrationState,
  type VirtualLoverMigrationAdapter,
} from './virtual-lover-migration'

function state(overrides: Partial<MigrationState> = {}): MigrationState {
  return {
    id: 'migration-1',
    userId: 'user-1',
    targetVersion: 1,
    status: 'pending',
    cursor: { table: 'ai_characters', createdAt: null, id: null },
    legacyRowsSeen: 0,
    encryptedRowsVerified: 0,
    legacyRowsCleared: 0,
    failureCode: null,
    ...overrides,
  }
}

function createAdapter(rows: LegacyMigrationRow[] = [], initialState: MigrationState = state()): VirtualLoverMigrationAdapter {
  let current = initialState
  const persisted = new Map<string, { ciphertext: string; nonce: string; keyVersion: number; aadVersion: number }>()
  const cleared = new Set<string>()
  return {
    async loadOrCreateMigration() { return current },
    async setInProgress(next) { current = { ...next, status: 'in_progress' }; return current },
    async listLegacyRows(_userId, table) {
      return rows.filter((row) => row.table === table && !cleared.has(row.id))
    },
    async writeEncryptedAndClearLegacy(_userId, row, encrypted) {
      persisted.set(row.id, encrypted)
      cleared.add(row.id)
    },
    async verifyEncryptedRow(_userId, row) {
      const encrypted = persisted.get(row.id)
      if (!encrypted) throw new Error('ciphertext_write_failed')
      return { encrypted, legacyCleared: cleared.has(row.id) }
    },
    async saveProgress(next) { current = next; return current },
    async markBlocked(next, failureCode) { current = { ...next, status: 'blocked', failureCode }; return current },
    async markComplete(next) { current = { ...next, status: 'complete' }; return current },
  }
}

describe('Virtual Lover legacy migration', () => {
  it('encrypts, verifies, clears, and records progress for a row', async () => {
    const vaultKey = await generateVaultDataKey()
    const adapter = createAdapter([{ table: 'ai_characters', id: 'character-1', createdAt: '2026-01-01T00:00:00Z', plaintext: '記憶' }])

    const result = await runVirtualLoverMigrationBatch(adapter, 'user-1', vaultKey)

    expect(result.blocked).toBe(false)
    expect(result.processedRows).toBe(1)
    expect(result.state.legacyRowsCleared).toBe(1)
  })

  it('blocks without clearing when persistence verification fails', async () => {
    const vaultKey = await generateVaultDataKey()
    const adapter = createAdapter(
      [{ table: 'ai_messages', id: 'message-1', createdAt: '2026-01-01T00:00:00Z', plaintext: '訊息' }],
      state({ cursor: { table: 'ai_messages', createdAt: null, id: null } }),
    )
    vi.spyOn(adapter, 'verifyEncryptedRow').mockRejectedValue(new Error('ciphertext_write_failed'))

    const result = await runVirtualLoverMigrationBatch(adapter, 'user-1', vaultKey)

    expect(result.blocked).toBe(true)
    expect(result.state.status).toBe('blocked')
    expect(result.state.failureCode).toBe('ciphertext_write_failed')
    expect(result.state.legacyRowsCleared).toBe(0)
  })

  it('advances from characters to messages and then completes', async () => {
    const vaultKey = await generateVaultDataKey()
    const adapter = createAdapter([
      { table: 'ai_characters', id: 'character-1', createdAt: '2026-01-01T00:00:00Z', plaintext: '記憶' },
      { table: 'ai_messages', id: 'message-1', createdAt: '2026-01-02T00:00:00Z', plaintext: '訊息' },
    ])

    await runVirtualLoverMigrationBatch(adapter, 'user-1', vaultKey)
    const second = await runVirtualLoverMigrationBatch(adapter, 'user-1', vaultKey)
    await runVirtualLoverMigrationBatch(adapter, 'user-1', vaultKey)
    const fourth = await runVirtualLoverMigrationBatch(adapter, 'user-1', vaultKey)

    expect(second.state.cursor.table).toBe('ai_messages')
    expect(fourth.state.status).toBe('complete')
  })
})

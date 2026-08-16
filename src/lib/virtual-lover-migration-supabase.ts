import { supabase } from '../supabaseClient'
import type {
  EncryptedRecord,
} from './virtual-lover-crypto'
import {
  type LegacyMigrationRow,
  type MigrationState,
  type MigrationTable,
  type VirtualLoverMigrationAdapter,
} from './virtual-lover-migration'

type DatabaseRow = Record<string, unknown>

function fieldForTable(table: MigrationTable): string {
  return table === 'ai_characters' ? 'memory' : 'content'
}

function encryptedColumnsForTable(table: MigrationTable): string {
  return table === 'ai_characters'
    ? 'memory_ciphertext, memory_nonce, memory_key_version, memory_aad_version'
    : 'content_ciphertext, content_nonce, content_key_version, content_aad_version'
}

function toState(row: DatabaseRow): MigrationState {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    targetVersion: Number(row.target_version),
    status: row.status as MigrationState['status'],
    cursor: {
      table: (row.cursor_table as MigrationTable | null) ?? null,
      createdAt: (row.cursor_created_at as string | null) ?? null,
      id: (row.cursor_id as string | null) ?? null,
    },
    legacyRowsSeen: Number(row.legacy_rows_seen),
    encryptedRowsVerified: Number(row.encrypted_rows_verified),
    legacyRowsCleared: Number(row.legacy_rows_cleared),
    failureCode: (row.failure_code as string | null) ?? null,
  }
}

function statePayload(state: MigrationState): DatabaseRow {
  return {
    status: state.status,
    cursor_table: state.cursor.table,
    cursor_created_at: state.cursor.createdAt,
    cursor_id: state.cursor.id,
    legacy_rows_seen: state.legacyRowsSeen,
    encrypted_rows_verified: state.encryptedRowsVerified,
    legacy_rows_cleared: state.legacyRowsCleared,
    failure_code: state.failureCode,
    updated_at: new Date().toISOString(),
    ...(state.status === 'in_progress' ? { started_at: new Date().toISOString() } : {}),
    ...(state.status === 'complete' ? { completed_at: new Date().toISOString() } : {}),
  }
}

async function singleMigration(userId: string): Promise<MigrationState | null> {
  const { data, error } = await supabase
    .from('ai_encryption_migrations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('permission_denied')
  return data ? toState(data as DatabaseRow) : null
}

async function saveState(state: MigrationState): Promise<MigrationState> {
  const { data, error } = await supabase
    .from('ai_encryption_migrations')
    .update(statePayload(state))
    .eq('id', state.id)
    .eq('user_id', state.userId)
    .select('*')
    .single()
  if (error || !data) throw new Error('permission_denied')
  return toState(data as DatabaseRow)
}

export function createSupabaseVirtualLoverMigrationAdapter(): VirtualLoverMigrationAdapter {
  return {
    async loadOrCreateMigration(userId, targetVersion) {
      const existing = await singleMigration(userId)
      if (existing) return existing

      const { data, error } = await supabase
        .from('ai_encryption_migrations')
        .insert({ user_id: userId, target_version: targetVersion })
        .select('*')
        .single()
      if (!error && data) return toState(data as DatabaseRow)

      const retried = await singleMigration(userId)
      if (retried) return retried
      throw new Error('permission_denied')
    },

    async setInProgress(state) {
      return saveState({ ...state, status: 'in_progress' })
    },

    async listLegacyRows(userId, table, cursor, limit) {
      const field = fieldForTable(table)
      let query = supabase
        .from(table)
        .select(`id, created_at, ${field}`)
        .not(field, 'is', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit)
      if (table === 'ai_characters') query = query.eq('user_id', userId)
      if (cursor.createdAt && cursor.id) {
        const addOrFilter = query as unknown as { or: (filters: string) => unknown }
        query = addOrFilter.or(
          `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`,
        ) as typeof query
      }
      const { data, error } = await query
      if (error) throw new Error('permission_denied')
      return ((data ?? []) as unknown as DatabaseRow[]).map((row) => ({
        table,
        id: String(row.id),
        createdAt: String(row.created_at),
        plaintext: String(row[field] ?? ''),
      })) as LegacyMigrationRow[]
    },

    async writeEncryptedAndClearLegacy(userId, row, encrypted) {
      const field = fieldForTable(row.table)
      const prefix = row.table === 'ai_characters' ? 'memory' : 'content'
      let query = supabase
        .from(row.table)
        .update({
          [`${prefix}_ciphertext`]: encrypted.ciphertext,
          [`${prefix}_nonce`]: encrypted.nonce,
          [`${prefix}_key_version`]: encrypted.keyVersion,
          [`${prefix}_aad_version`]: encrypted.aadVersion,
          [field]: null,
        })
        .eq('id', row.id)
      if (row.table === 'ai_characters') query = query.eq('user_id', userId)
      const { error } = await query
      if (error) throw new Error('ciphertext_write_failed')
    },

    async verifyEncryptedRow(userId, row) {
      const field = fieldForTable(row.table)
      let query = supabase
        .from(row.table)
        .select(`${encryptedColumnsForTable(row.table)}, ${field}`)
        .eq('id', row.id)
      if (row.table === 'ai_characters') query = query.eq('user_id', userId)
      const { data, error } = await query.single()
      if (error || !data) throw new Error('legacy_clear_verification_failed')
      const value = data as unknown as DatabaseRow
      const prefix = row.table === 'ai_characters' ? 'memory' : 'content'
      return {
        encrypted: {
          ciphertext: String(value[`${prefix}_ciphertext`]),
          nonce: String(value[`${prefix}_nonce`]),
          keyVersion: Number(value[`${prefix}_key_version`]),
          aadVersion: Number(value[`${prefix}_aad_version`]),
        } as EncryptedRecord,
        legacyCleared: value[field] === null,
      }
    },

    async saveProgress(state) {
      return saveState(state)
    },

    async markBlocked(state, failureCode) {
      return saveState({ ...state, status: 'blocked', failureCode })
    },

    async markComplete(state) {
      return saveState({ ...state, status: 'complete', cursor: { table: null, createdAt: null, id: null } })
    },
  }
}

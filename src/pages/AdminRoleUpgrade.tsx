import type { FormEvent } from 'react'
import { useState } from 'react'
import { Layout } from '../components/Layout'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { RoleStatus } from '../types'

const ROLES: RoleStatus[] = ['general', 'venue_pending', 'venue_approved']

export function AdminRoleUpgrade() {
  const { t } = useT()
  const [targetUserId, setTargetUserId] = useState('')
  const [newRole, setNewRole] = useState<RoleStatus>('general')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setIsError(false)

    const userId = targetUserId.trim()
    if (!userId) {
      setMessage(t('admin.roleUpgrade.userIdRequired'))
      setIsError(true)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-role-upgrade', {
        body: { target_user_id: userId, new_role: newRole },
      })

      if (error) {
        let detail = error.message
        try {
          const body = await (error as { context?: Response }).context?.json?.()
          if (body?.error) detail = body.error
        } catch {
          // ignore parse errors
        }
        setMessage(detail)
        setIsError(true)
      } else {
        setMessage(
          t('admin.roleUpgrade.success', {
            userId: (data as { user_id: string }).user_id,
            role: (data as { new_role: string }).new_role,
          }),
        )
        setTargetUserId('')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('admin.roleUpgrade.unexpectedError'))
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <section className="card">
        <h2>{t('admin.roleUpgrade.heading')}</h2>
        <p>{t('admin.roleUpgrade.description')}</p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <label>
            {t('admin.roleUpgrade.targetUserIdLabel')}
            <input
              aria-label={t('admin.roleUpgrade.targetUserIdLabel')}
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
          </label>
          <label>
            {t('admin.roleUpgrade.newRoleLabel')}
            <select
              aria-label={t('admin.roleUpgrade.newRoleLabel')}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as RoleStatus)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? t('admin.roleUpgrade.upgrading') : t('admin.roleUpgrade.applyRoleChange')}
          </button>
        </form>
        {message ? (
          <p className="message" style={{ color: isError ? 'red' : 'green' }}>
            {message}
          </p>
        ) : null}
      </section>
    </Layout>
  )
}

import type { FormEvent } from 'react'
import { useState } from 'react'
import { Layout } from '../components/Layout'
import { supabase } from '../supabaseClient'
import type { RoleStatus } from '../types'

const ROLES: RoleStatus[] = ['general', 'venue_pending', 'venue_approved']

export function AdminRoleUpgrade() {
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
      setMessage('Target user ID is required.')
      setIsError(true)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-role-upgrade', {
        body: { target_user_id: userId, new_role: newRole },
      })

      if (error) {
        // FunctionsHttpError exposes a JSON body; fall back to error.message
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
          `Success — user ${(data as { user_id: string }).user_id} is now "${(data as { new_role: string }).new_role}".`,
        )
        setTargetUserId('')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unexpected error')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Admin — Role Upgrade">
      <section className="card">
        <h2>Admin Role Upgrade</h2>
        <p>Assign a new role to any user. All changes are recorded in the audit log.</p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Target user ID
            <input
              aria-label="Target user ID"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
          </label>
          <label>
            New role
            <select
              aria-label="New role"
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
            {loading ? 'Upgrading…' : 'Apply role change'}
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

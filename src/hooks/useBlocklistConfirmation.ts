import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Request {
  name: 'create-registration' | 'register-for-event-series' | 'review-registration'
  kind: 'register' | 'series' | 'review'
  trigger?: HTMLElement
  body: Record<string, unknown>
  onSuccess: () => void | Promise<void>
  onError: (error: Error) => void | Promise<void>
}
interface Confirmation { request: Request; hostId?: string }

export function useBlocklistConfirmation(scope: string) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const inFlight = useRef(false)
  useEffect(() => {
    generation.current++
    inFlight.current = false
    setConfirmation(null)
    setBusy(false)
    const requestGeneration = generation
    return () => { requestGeneration.current++ }
  }, [scope])

  const execute = useCallback(async (request: Request, acknowledge: boolean) => {
    if (inFlight.current) return
    const current = generation.current
    inFlight.current = true
    setBusy(true)
    try {
      const { error } = await supabase.functions.invoke(request.name, {
        body: { ...request.body, ...(acknowledge ? { acknowledge_blocklist_conflict: true } : {}) },
      })
      if (current !== generation.current) return
      if (error) {
        const response = error.context instanceof Response ? error.context : null
        const payload = response?.status === 409 ? await response.clone().json().catch(() => null) : null
        if (current !== generation.current) return
        if (payload?.error?.code === 'blocklist_confirmation_required' && !acknowledge) {
          const details = payload.error.details
          const snapshot = details?.expected_event_ids
          const confirmedRequest = request.kind === 'series' && Array.isArray(snapshot) && snapshot.every((id: unknown) => typeof id === 'string')
            ? { ...request, body: { ...request.body, expected_event_ids: snapshot } } : request
          setConfirmation({ request: confirmedRequest, hostId: typeof details?.host_profile_id === 'string' ? details.host_profile_id : undefined })
          return
        }
        setConfirmation(null)
        await request.onError(error)
        return
      }
      setConfirmation(null)
      await request.onSuccess()
    } catch (error) {
      if (current === generation.current) {
        setConfirmation(null)
        await request.onError(error instanceof Error ? error : new Error('Request failed'))
      }
    } finally {
      if (current === generation.current) { inFlight.current = false; setBusy(false) }
    }
  }, [])
  const run = useCallback((request: Request) => execute({ ...request, body: structuredClone(request.body), trigger: request.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined) }, false), [execute])
  const cancel = useCallback(() => { if (!inFlight.current) setConfirmation(null) }, [])
  const confirm = useCallback(async () => {
    if (confirmation) await execute(confirmation.request, true)
  }, [confirmation, execute])
  return { confirmation, busy, run, cancel, confirm }
}

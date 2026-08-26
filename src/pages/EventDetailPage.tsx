import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { PrivacyDisclosure } from '../components/PrivacyDisclosure'
import { ShareButton } from '../components/ShareButton'
import { ShareToXModal } from '../components/ShareToXModal'
import { ReportForm } from '../components/ReportForm'
import { EventBookmarkButton } from '../components/EventBookmarkButton'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { EventAnnouncements } from '../components/EventAnnouncements'
import { useAuth } from '../context/AuthContext'
import { useError } from '../context/ErrorContext'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { downloadIcs, getGoogleCalendarUrl } from '../lib/ics'
import { getAttendanceFeeLabel, parseEventTypes, isEventEditLocked } from '../lib/event-utils'
import { hasPracticeTag, getEventTypeI18nKey } from '../lib/event-types'
import { getAvatarPath } from '../lib/profile'
import { isAllowedExternalRegistrationUrl } from '../lib/external-registration'
import type { EventItem, EventThread, Registration, RegistrationFormField, RegistrationResponse, ExternalGuest, EventInvitation, PublicProfilePreview } from '../types'

interface Attendee {
  profile_id: string
  display_name: string | null
  joined_at: string
}

interface PublicCapacitySummary {
  approved_registration_count: number
  capacity_external_guest_count: number
}

interface FormResponseWithRegistrant extends RegistrationResponse {
  registration?: { profile_id: string } | null
}

const SHARE_TOKEN_STORAGE_PREFIX = 'event-share-token:'

function readShareTokenFromHash(): string | null {
  const hash = window.location.hash
  if (!hash.startsWith('#t=')) {
    return null
  }
  return hash.slice(3) || null
}

function readStoredShareToken(eventId: string): string | null {
  try {
    return sessionStorage.getItem(SHARE_TOKEN_STORAGE_PREFIX + eventId)
  } catch {
    // Storage unavailable (e.g. blocked cookies); the hash token still works.
    return null
  }
}

function storeShareToken(eventId: string, token: string): void {
  try {
    sessionStorage.setItem(SHARE_TOKEN_STORAGE_PREFIX + eventId, token)
  } catch {
    // Storage unavailable; the current-page session keeps working via state.
  }
}

function getCompatibleFormData(
  fields: RegistrationFormField[],
  responses: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = responses[field.id]
      const compatible = field.type === 'checkbox'
        ? typeof value === 'boolean'
        : (field.type === 'select' || field.type === 'radio')
          ? typeof value === 'string' && (!field.options || field.options.includes(value))
          : typeof value === 'string'
      return value !== undefined && compatible ? [[field.id, value]] : []
    }),
  )
}

export function EventDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t, locale } = useT()
  const { showError } = useError()
  const navigate = useNavigate()
  const [eventItem, setEventItem] = useState<EventItem | null>(null)
  const [seriesInstances, setSeriesInstances] = useState<{ id: string; start_time: string; registration_deadline: string | null }[]>([])
  const [seriesIndex, setSeriesIndex] = useState(0)
  const [threads, setThreads] = useState<EventThread[]>([])
  const [content, setContent] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [postingThread, setPostingThread] = useState(false)
  const [discussionStatus, setDiscussionStatus] = useState('')
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  const [creatorReportCount, setCreatorReportCount] = useState<number>(0)
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [publicCapacityOccupied, setPublicCapacityOccupied] = useState<number | null>(null)
  const [capacityQueryFailed, setCapacityQueryFailed] = useState(false)
  const [profileNameMap, setProfileNameMap] = useState<Map<string, string | null>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [formResponses, setFormResponses] = useState<FormResponseWithRegistrant[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [formValidationError, setFormValidationError] = useState('')
  const [previousFormData, setPreviousFormData] = useState<Record<string, unknown>>({})
  const [shareOpen, setShareOpen] = useState(false)
  const [attendeeShareOpen, setAttendeeShareOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [publicationConfirmOpen, setPublicationConfirmOpen] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [externalGuests, setExternalGuests] = useState<ExternalGuest[]>([])
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestContact, setNewGuestContact] = useState('')
  const [newGuestCountsToCapacity, setNewGuestCountsToCapacity] = useState(true)
  const [guestToRemove, setGuestToRemove] = useState<ExternalGuest | null>(null)
  const [submittingGuest, setSubmittingGuest] = useState(false)
  const [invitations, setInvitations] = useState<EventInvitation[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSearchQuery, setInviteSearchQuery] = useState('')
  const [inviteSearchResults, setInviteSearchResults] = useState<PublicProfilePreview[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [invitationToRetract, setInvitationToRetract] = useState<EventInvitation | null>(null)
  const [hostConsoleView, setHostConsoleView] = useState<'participants' | 'management'>('participants')

  const isHost = user && eventItem && user.id === eventItem.creator_id
  const isEditLocked = eventItem ? isEventEditLocked(eventItem) : false
  const [, setEditLockClock] = useState(0)

  const deadlinePending = Boolean(
    eventItem?.registration_deadline
    && new Date(eventItem.registration_deadline).getTime() > Date.now(),
  )

  useEffect(() => {
    const hostNeedsEditLockClock = Boolean(
      eventItem && isHost && !isEditLocked && eventItem.lifecycle_status !== 'draft',
    )
    if (!eventItem || (!hostNeedsEditLockClock && !deadlinePending)) {
      return
    }
    // Bumping unused state forces a re-render so isEventEditLocked() and
    // deadline-derived values are re-evaluated as time passes.
    const timer = window.setInterval(() => setEditLockClock((tick) => tick + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [eventItem, isHost, isEditLocked, deadlinePending])
  const isRegistrationClosed = eventItem?.registration_deadline
    ? new Date(eventItem.registration_deadline).getTime() <= Date.now()
    : false
  const [shareLinkPending, setShareLinkPending] = useState(false)
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false)

  const isPrivateShareable = Boolean(
    eventItem
    && isHost
    && eventItem.lifecycle_status !== 'draft'
    && eventItem.publication_status === 'published'
    && eventItem.visibility_settings?.type === 'private',
  )

  const sharedEventUrl = (() => {
    if (!eventItem) {
      return window.location.href
    }
    const storedToken = readStoredShareToken(eventItem.id)
    return storedToken
      ? `${window.location.origin}/events/${eventItem.id}#t=${storedToken}`
      : window.location.href
  })()

  const deliverShareUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      alert(t('eventDetail.shareLinkCopied'))
    } catch {
      // Clipboard denied/unavailable — surface the full URL for manual copy.
      window.prompt(t('events.shareFailed'), url)
    }
  }

  const copyShareLink = async (rotate: boolean) => {
    if (!eventItem || !isHost || shareLinkPending) {
      return
    }
    setShareLinkPending(true)
    try {
      const { data: token, error } = await supabase.rpc(
        rotate ? 'rotate_event_share_token' : 'ensure_event_share_token',
        { p_event_id: eventItem.id },
      )
      if (error || typeof token !== 'string' || !token) {
        showError(error?.message ?? t('events.shareFailed'), error)
        return
      }
      await deliverShareUrl(`${window.location.origin}/events/${eventItem.id}#t=${token}`)
    } finally {
      setShareLinkPending(false)
    }
  }

  const registrationIntakeActive = Boolean(
    eventItem
    && (eventItem.lifecycle_status === 'published' || eventItem.lifecycle_status === 'registration_open')
    && eventItem.publication_status !== 'closed',
  )
  const registrationEntryBlocked = !registrationIntakeActive
    || Boolean(eventItem?.registration_deadline && isRegistrationClosed)
  const capacityExternalGuests = useMemo(
    () => externalGuests.filter((g) => g.count_towards_capacity),
    [externalGuests],
  )
  const extraExternalGuests = useMemo(
    () => externalGuests.filter((g) => !g.count_towards_capacity),
    [externalGuests],
  )
  const totalCapacityOccupied = useMemo(() => {
    if (!eventItem?.max_capacity) return 0
    return attendees.length + capacityExternalGuests.length
  }, [attendees.length, capacityExternalGuests.length, eventItem?.max_capacity])
  const capacityOccupied = isHost ? totalCapacityOccupied : publicCapacityOccupied
  const isAtCapacity = Boolean(eventItem?.max_capacity && capacityOccupied !== null && capacityOccupied >= eventItem.max_capacity)
  const capacityKnown = Boolean(isHost) || publicCapacityOccupied !== null
  const capacityOccupiedValue = isHost ? totalCapacityOccupied : (publicCapacityOccupied ?? 0)
  const capacityRatio = eventItem?.max_capacity
    ? Math.min(1, capacityOccupiedValue / eventItem.max_capacity)
    : 0
  const capacityBadgeKind = isRegistrationClosed ? 'closed' : isAtCapacity ? 'full' : 'open'
  const capacityBadgeKey = isRegistrationClosed
    ? 'eventDetail.statusBadgeRegClosed'
    : isAtCapacity
      ? 'eventDetail.statusBadgeFull'
      : 'eventDetail.statusBadgeOpen'
  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'pending'),
    [invitations],
  )

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !blockedUserIds.includes(thread.profile_id)),
    [threads, blockedUserIds],
  )

  const threadChildren = useMemo(() => {
    const children = new Map<string, EventThread[]>()
    for (const thread of visibleThreads) {
      if (!thread.parent_id) continue
      children.set(thread.parent_id, [...(children.get(thread.parent_id) ?? []), thread])
    }
    return children
  }, [visibleThreads])

  const rootThreads = useMemo(
    () => visibleThreads.filter((thread) => !thread.parent_id || !visibleThreads.some((candidate) => candidate.id === thread.parent_id)),
    [visibleThreads],
  )

  const relativeTime = (createdAt: string) => {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    if (elapsedMinutes < 1) return t('eventDetail.justNow')
    if (elapsedMinutes < 60) return t('eventDetail.minutesAgo', { count: elapsedMinutes })
    const elapsedHours = Math.floor(elapsedMinutes / 60)
    if (elapsedHours < 24) return t('eventDetail.hoursAgo', { count: elapsedHours })
    return t('eventDetail.daysAgo', { count: Math.floor(elapsedHours / 24) })
  }

  const load = useCallback(async () => {
    if (!id) {
      return
    }

    const bookmarkQuery = user
      ? supabase
        .from('event_bookmarks')
        .select('event_id')
        .eq('profile_id', user.id)
        .eq('event_id', id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const threadQuery = user
      ? supabase
        .from('event_threads')
        .select('*, profile:profiles(display_name)')
        .eq('event_id', id)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: null, error: null })

    const eventsQuery = user
      ? supabase.from('events').select('*, creator:profiles!events_creator_id_fkey(display_name, reputation_score, metadata)').eq('id', id).maybeSingle()
      : supabase.from('events').select('*').eq('id', id).maybeSingle()

    const [{ data: eventData, error: eventError }, { data: threadData, error: threadError }, { data: bookmarkData }] =
      await Promise.all([
        eventsQuery,
        threadQuery,
        bookmarkQuery,
      ])

    if (eventError || threadError) {
      showError(eventError?.message ?? threadError?.message ?? t('eventDetail.unableToLoad'), eventError || threadError)
      return
    }

    let currentEvent = (eventData as EventItem | null) ?? null
    let usedShareToken: string | null = null

    // Private-event share link (ADR-022): consume the fragment token
    // unconditionally — even when RLS already grants a direct read — so the
    // bearer token never lingers in the address bar or history.
    const hashToken = readShareTokenFromHash()
    if (id && hashToken) {
      storeShareToken(id, hashToken)
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }

    // Non-creators cannot read private rows directly; fall back to the
    // controlled read-only token path via same-tab session storage.
    if (!currentEvent && id) {
      const shareToken = readStoredShareToken(id)
      if (shareToken) {
        const { data: tokenData, error: tokenError } = await supabase
          .rpc('get_event_by_share_token', { p_token: shareToken })
          .maybeSingle()
        if (tokenError) {
          showError(tokenError.message, tokenError)
          return
        }
        if (tokenData && (tokenData as EventItem).id === id) {
          currentEvent = tokenData as EventItem
          usedShareToken = shareToken
        }
      }
    }

    setEventItem(currentEvent)
    setThreads((threadData as EventThread[]) ?? [])
    setIsBookmarked(Boolean(bookmarkData))
    setPreviousFormData({})

    // Series context: load sibling instances when this event belongs to a recurring series.
    // Standalone events (no series_id and no recurrence_rule) skip these queries entirely;
    // parent/child lookups run in parallel so they don't delay capacity/registration loads.
    setSeriesInstances([])
    setSeriesIndex(0)
    if (currentEvent && (currentEvent.series_id != null || currentEvent.recurrence_rule != null)) {
      const seriesParentId = currentEvent.series_id ?? currentEvent.id
      const [seriesParentRes, seriesChildRes] = await Promise.all([
        supabase.from('events').select('id, start_time, registration_deadline').eq('id', seriesParentId).maybeSingle(),
        supabase.from('events').select('id, start_time, registration_deadline').eq('series_id', seriesParentId).order('start_time', { ascending: true }),
      ])
      type SeriesInstance = { id: string; start_time: string; registration_deadline: string | null }
      const parentInstance = (seriesParentRes.data as SeriesInstance | null) ?? null
      const childInstances = ((seriesChildRes.data as SeriesInstance[] | null) ?? [])
      if (childInstances.length > 0) {
        const instances = [...(parentInstance ? [parentInstance] : []), ...childInstances]
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
        const index = instances.findIndex((instance) => instance.id === currentEvent.id)
        if (index >= 0 && instances.length > 1) {
          setSeriesInstances(instances)
          setSeriesIndex(index + 1)
        }
      }
    }
    if (currentEvent?.max_capacity && (!user || user.id !== currentEvent.creator_id)) {
      const capacityResponse = usedShareToken
        ? await supabase.rpc('get_event_capacity_by_share_token', { p_token: usedShareToken }).maybeSingle()
        : await supabase.rpc('get_event_capacity', { p_event_id: id }).maybeSingle()
      const { data: capacityData, error: capacityError } = capacityResponse

      if (capacityError || !capacityData) {
        setPublicCapacityOccupied(null)
        setCapacityQueryFailed(true)
      } else {
        setCapacityQueryFailed(false)
        const capacitySummary = capacityData as PublicCapacitySummary
        setPublicCapacityOccupied(
          Number(capacitySummary.approved_registration_count ?? 0)
          + Number(capacitySummary.capacity_external_guest_count ?? 0),
        )
      }
    } else {
      setPublicCapacityOccupied(null)
      setCapacityQueryFailed(false)
    }

    if (user && currentEvent) {
      const { data: reportStats } = await supabase
        .from('profile_report_stats')
        .select('report_count')
        .eq('profile_id', currentEvent.creator_id)
        .maybeSingle()
      setCreatorReportCount(Number(reportStats?.report_count ?? 0))
    }

    if (user) {
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      if (blocksError) {
        showError(blocksError.message, blocksError)
      } else {
        setBlockedUserIds(((blocksData as { blocked_id: string }[] | null) ?? []).map((item) => item.blocked_id))
      }

      if (!currentEvent?.external_registration_url) {
        const { data: myReg } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', id)
          .eq('profile_id', user.id)
          .neq('status', 'cancelled')
          .maybeSingle()

        setMyRegistration((myReg as Registration | null) ?? null)
      } else {
        setMyRegistration(null)
      }

      if (currentEvent?.registration_form_config && !currentEvent.external_registration_url) {
        const { data: pastRegistrations } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', id)
          .eq('profile_id', user.id)
          .eq('status', 'cancelled')
          .order('created_at', { ascending: false })

        const pastIds = ((pastRegistrations as { id: string }[] | null) ?? []).map((registration) => registration.id)
        if (pastIds.length > 0) {
          const { data: pastResponses } = await supabase
            .from('event_registration_responses')
            .select('responses, created_at')
            .in('registration_id', pastIds)
            .order('created_at', { ascending: false })
            .limit(1)

          const latestResponses = (pastResponses?.[0] as { responses?: Record<string, unknown> } | undefined)?.responses
          if (latestResponses) {
            setPreviousFormData(getCompatibleFormData(currentEvent.registration_form_config, latestResponses))
          }
        }
      }
    }

    // External events never expose native registration state or registrant profiles.
    const allRegs = user
      ? (currentEvent && currentEvent.external_registration_url
          ? []
          : (await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', id)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: true })).data ?? [])
      : []

    setRegistrations((allRegs as Registration[]) ?? [])

    // Load public profile names for registrants + invited users
    let tempMap = new Map<string, string | null>()
    const registrantIds = allRegs ? [...new Set(((allRegs as Registration[]) ?? []).map((r) => r.profile_id))] : []

    // Load external guests (host only — RLS will return empty for non-host)
    const { data: guestData } = await supabase
      .from('event_external_guests')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true })

    setExternalGuests((guestData as ExternalGuest[] | null) ?? [])

    // Load invitations (host sees all, target sees own)
    const { data: inviteData } = await supabase
      .from('event_invitations')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true })

    setInvitations((inviteData as EventInvitation[] | null) ?? [])

    const inviteTargetIds = inviteData
      ? [...new Set((inviteData as EventInvitation[]).map((inv) => inv.target_profile_id))]
      : []
    const allProfileIds = [...new Set([...registrantIds, ...inviteTargetIds])]
    if (allProfileIds.length > 0) {
      const { data: allProfiles } = await supabase
        .from('public_profiles')
        .select('id, display_name')
        .in('id', allProfileIds)
      tempMap = new Map(((allProfiles as { id: string; display_name: string | null }[]) ?? []).map((p) => [p.id, p.display_name]))
      setProfileNameMap(tempMap)
    } else {
      setProfileNameMap(new Map())
    }

    // Load attendees (approved or cancellation_rejected)
    const approvedRegs = ((allRegs as Registration[]) ?? []).filter((r) => r.status === 'approved' || r.status === 'cancellation_rejected')
    if (approvedRegs.length > 0) {
      setAttendees(
        approvedRegs.map((r) => ({
          profile_id: r.profile_id,
          display_name: tempMap.get(r.profile_id) ?? null,
          joined_at: r.created_at,
        })),
      )
    } else {
      setAttendees([])
}

  }, [id, user, t, showError])

  useEffect(() => {
    void load()
  }, [load])

  const handleRegister = async () => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)

    const { error } = await supabase.functions.invoke('create-registration', {
      body: { event_id: id },
    })

    setSubmitting(false)

    if (error) {
      const errorMessage = error.message
      showError(errorMessage, error)
      return
    }

    await load()
  }

  const handleCancelRegistration = async () => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)

    const { error } = await supabase.functions.invoke('cancel-registration', {
      body: { event_id: id },
    })

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
      return
    }

    setMyRegistration(null)
    await load()
  }

  const handleForceCancel = async (registrationId: string) => {
    if (!confirm(t('eventDetail.forceCancelConfirm'))) {
      return
    }
    setSubmitting(true)

    const { error } = await supabase
      .from('event_registrations')
      .update({ status: 'cancelled' })
      .eq('id', registrationId)

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
      return
    }

    await load()
  }

  const handlePublicationChange = async (status: 'published' | 'closed') => {
    if (!eventItem || !user || !isHost) return
    const { data, error } = await supabase.rpc('set_event_publication', {
      p_event_id: eventItem.id,
      p_publication_status: status,
      p_publish_at: null,
      p_unpublish_at: null,
    })
    if (error) {
      showError(error.message, error)
      return
    }
    setEventItem(data as EventItem)
    setPublicationConfirmOpen(false)
  }

  const handleCheckIn = async (registrationId: string) => {
    setSubmitting(true)

    const { error } = await supabase
      .from('event_registrations')
      .update({ checked_in_at: new Date().toISOString() })
      .eq('id', registrationId)

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
      return
    }

    await load()
  }

  const handleAddExternalGuest = async () => {
    if (!id || !newGuestName.trim()) return
    setSubmittingGuest(true)

    const { error } = await supabase.from('event_external_guests').insert([
      {
        event_id: id,
        guest_name: newGuestName.trim(),
        contact_info: newGuestContact.trim() || null,
        count_towards_capacity: newGuestCountsToCapacity,
      },
    ])

    setSubmittingGuest(false)

    if (error) {
      showError(error.message, error)
      return
    }

    setNewGuestName('')
    setNewGuestContact('')
    setNewGuestCountsToCapacity(true)
    setShowAddGuest(false)
    await load()
  }

  const handleRemoveExternalGuest = async () => {
    if (!guestToRemove) return
    setSubmittingGuest(true)

    const { error } = await supabase
      .from('event_external_guests')
      .delete()
      .eq('id', guestToRemove.id)

    setSubmittingGuest(false)

    if (error) {
      showError(error.message, error)
      return
    }

    setGuestToRemove(null)
    await load()
  }

  const handleSearchMembers = async (query: string) => {
    setInviteSearchQuery(query)
    if (query.trim().length < 2) {
      setInviteSearchResults([])
      return
    }
    const { data } = await supabase
      .from('public_profiles')
      .select('id, display_name, avatar_path')
      .ilike('display_name', `%${query.trim()}%`)
      .limit(20)
    setInviteSearchResults((data as PublicProfilePreview[] | null) ?? [])
  }

  const handleSendInvitation = async (targetProfileId: string) => {
    if (!id || !user) return
    setInviting(true)
    setInviteError('')
    const { error } = await supabase.from('event_invitations').insert([{
      event_id: id,
      host_id: user.id,
      target_profile_id: targetProfileId,
    }])
    setInviting(false)
    if (error) {
      setInviteError(error.message)
      return
    }
    setShowInviteModal(false)
    setInviteSearchQuery('')
    setInviteSearchResults([])
    await load()
  }

  const handleRetractInvitation = async () => {
    if (!user || !invitationToRetract) return
    const { error } = await supabase
      .from('event_invitations')
      .update({ status: 'retracted' })
      .eq('id', invitationToRetract.id)
    setInvitationToRetract(null)
    if (error) {
      showError(error.message, error)
      return
    }
    await load()
  }

  const handleReview = async (registrationId: string, action: 'approve' | 'reject' | 'reopen') => {
    if (!id || !user) {
      return
    }
    setSubmitting(true)

    const { error } = await supabase.functions.invoke('review-registration', {
      body: { event_id: id, registration_id: registrationId, action },
    })

    setSubmitting(false)

    if (error) {
      showError(error.message, error)
      return
    }

    await load()
  }

  const postThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !user || !content.trim()) {
      return
    }

    setPostingThread(true)
    setDiscussionStatus('')
    const { error } = await supabase.from('event_threads').insert([
      {
        event_id: id,
        profile_id: user.id,
        content: content.trim(),
        parent_id: null,
      },
    ])

    if (error) {
      setPostingThread(false)
      showError(error.message, error)
      return
    }

    setContent('')
    await load()
    setPostingThread(false)
    setDiscussionStatus(t('eventDetail.commentPosted'))
  }

  const postReply = async (parentId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !user || !replyDrafts[parentId]?.trim()) return

    setPostingThread(true)
    setDiscussionStatus('')
    const { error } = await supabase.from('event_threads').insert([{
      event_id: id,
      profile_id: user.id,
      content: replyDrafts[parentId].trim(),
      parent_id: parentId,
    }])

    if (error) {
      setPostingThread(false)
      showError(error.message, error)
      return
    }

    setReplyDrafts((drafts) => ({ ...drafts, [parentId]: '' }))
    setReplyingToId(null)
    await load()
    setPostingThread(false)
    setDiscussionStatus(t('eventDetail.commentPosted'))
  }

  const registrationStatus = (status: string) => {
    switch (status) {
      case 'pending': return t('eventDetail.regPending')
      case 'approved': return t('eventDetail.regApproved')
      case 'rejected': return t('eventDetail.regRejected')
      case 'waitlisted': return t('eventDetail.regWaitlisted')
      case 'cancellation_pending': return t('eventDetail.regCancellationPending')
      case 'cancellation_rejected': return t('eventDetail.regCancellationRejected')
      default: return status
    }
  }

  function renderThread(thread: EventThread, depth = 0) {
    const displayName = thread.profile?.display_name || thread.profile_id
    const isHostComment = eventItem?.creator_id === thread.profile_id
    return (
      <li key={thread.id} className={`discussion-item${depth > 0 ? ' discussion-item-reply' : ''}`}>
        <article className="discussion-card">
          <header className="discussion-header">
            <img src={getAvatarPath(thread.profile)} alt="" width={36} height={36} className="avatar" />
            <div className="discussion-author">
              <Link to={`/profile/${thread.profile_id}`}>{displayName}</Link>
              {isHostComment ? <span className="host-badge">{t('eventDetail.hostBadge')}</span> : null}
              <time dateTime={thread.created_at}>{relativeTime(thread.created_at)}</time>
            </div>
          </header>
          <p className="discussion-content">{thread.content}</p>
          <div className="discussion-actions">
            <button type="button" className="ghost-button" onClick={() => setReplyingToId(thread.id)}>
              <Icon href="/action-icons.svg" name="action-reply" size={14} /> {t('eventDetail.reply')}
            </button>
          </div>
          {replyingToId === thread.id ? (
            <form className="inline-reply-form" onSubmit={(event) => void postReply(thread.id, event)}>
              <textarea
                autoFocus
                aria-label={t('eventDetail.replyingToUser', { name: displayName })}
                value={replyDrafts[thread.id] ?? ''}
                onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [thread.id]: event.target.value }))}
                placeholder={t('eventDetail.replyingToUser', { name: displayName })}
                rows={2}
              />
              <div className="discussion-form-actions">
                <button type="button" className="ghost-button" onClick={() => setReplyingToId(null)}>
                  {t('common.cancelReply')}
                </button>
                <button type="submit" className="primary-cta" disabled={postingThread || !replyDrafts[thread.id]?.trim()}>
                  {postingThread ? t('eventDetail.posting') : t('eventDetail.post')}
                </button>
              </div>
            </form>
          ) : null}
        </article>
        {threadChildren.get(thread.id)?.length ? (
          <ul className="discussion-replies">
            {threadChildren.get(thread.id)?.map((child) => renderThread(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <Layout>
      <div className="event-detail-layout">
      <section className="card event-detail-hero">
        {eventItem ? (
          <>
            {seriesInstances.length > 0 ? (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface-muted)' }}>
                <strong>📅 系列活動 第 {seriesIndex}／{seriesInstances.length} 場</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.35rem' }}>
                  {seriesInstances.map((instance) => {
                    const closed = instance.registration_deadline ? new Date(instance.registration_deadline).getTime() <= Date.now() : false
                    const isCurrent = instance.id === eventItem.id
                    const label = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-TW', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instance.start_time))
                    return (
                      <span key={instance.id}>
                        {isCurrent ? <strong>{label}</strong> : <Link to={`/events/${instance.id}`}>{label}</Link>}
                        {!isCurrent && closed ? <small>（報名已關閉）</small> : null}
                      </span>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <h2>{eventItem.title}</h2>
            {eventItem.lifecycle_status === 'draft' ? (
              <p className="message">{t('eventDetail.draftNotice')}</p>
            ) : null}
            {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status === 'closed' ? (
              <p className="message">{t('eventDetail.closedNotice')}</p>
            ) : null}
            {isHost && (eventItem.publish_at || eventItem.unpublish_at) ? (
              <p className="event-meta">
                {eventItem.publish_at ? `${t('eventDetail.publishAtLabel')}: ${new Date(eventItem.publish_at).toLocaleString()}` : null}
                {eventItem.publish_at && eventItem.unpublish_at ? ' · ' : null}
                {eventItem.unpublish_at ? `${t('eventDetail.unpublishAtLabel')}: ${new Date(eventItem.unpublish_at).toLocaleString()}` : null}
              </p>
            ) : null}
            {eventItem.event_type && (
              <div className="chip-group" style={{ marginBottom: '1rem' }}>
                {parseEventTypes(eventItem.event_type).map((type) => (
                  <span key={type} className="chip">
                    {t(getEventTypeI18nKey(type))}
                  </span>
                ))}
              </div>
            )}
            <MarkdownRenderer content={eventItem.description} fallback={t('eventDetail.noDescription')} />
            {eventItem && hasPracticeTag(parseEventTypes(eventItem.event_type)) && (
              <div className="safety-banner">
                <div className="safety-banner-title">
                  <Icon href="/action-icons.svg" name="action-shield" size={16} /> {t('eventDetail.safetyProtocolTitle')}
                </div>
                <div className="safety-banner-body">
                  <p>{t('eventDetail.safetyProtocolDesc')}</p>
                </div>
                <div className="safety-banner-protocol">
                  <span className="safety-banner-tag">SSC</span>
                  <span className="safety-banner-tag">RACK</span>
                </div>
                <details className="safety-guidelines">
                  <summary>{t('eventDetail.safetyGuidelinesTitle')}</summary>
                  <ul>
                    <li>{t('eventDetail.safetyGuidelineConsent')}</li>
                    <li>{t('eventDetail.safetyGuidelineBoundaries')}</li>
                    <li>{t('eventDetail.safetyGuidelinePhotos')}</li>
                    <li>{t('eventDetail.safetyGuidelineAlcohol')}</li>
                  </ul>
                </details>
              </div>
            )}
            <p className="event-meta">
              <img src={user && eventItem.creator ? getAvatarPath(eventItem.creator) : eventItem.creator_avatar_path || '/default-avatar.svg'} alt="" width={24} height={24} className="avatar avatar-sm" />
              {t('eventDetail.createdBy')}{' '}
              {user && eventItem.creator ? (
                <Link to={`/profile/${eventItem.creator_id}`}>{eventItem.creator.display_name || eventItem.creator_id}</Link>
              ) : (
                <span>{eventItem.creator_display_name || eventItem.creator_id}</span>
              )}
            </p>
            {user && eventItem.creator ? (
            <div className="event-creator-stats">
              <span className="creator-stat">
                <Icon href="/badge-icons.svg" name="reputation-star" size={14} />
                {eventItem.creator?.reputation_score ?? 0}
              </span>
              <span className="creator-stat">
                <Icon href="/report-icons.svg" name="report-safety-risk" size={14} />
                {creatorReportCount} {t('eventDetail.reports')}
              </span>
            </div>
            ) : null}
          </>
        ) : (
          <p>{t('eventDetail.notFound')}</p>
        )}
      </section>

      {eventItem ? (
        <aside className="card event-quickfacts-card" aria-label={t('eventDetail.summaryLabel')}>
          <h3>{t('eventDetail.quickFactsTitle')}</h3>
          <div className="event-summary-grid">
            {eventItem.location_detail ? (
              <div className="event-summary-item">
                <Icon href="/form-icons.svg" name="form-location" size={18} />
                <span><strong>{t('eventDetail.locationLabel')}</strong>{eventItem.location_detail}</span>
              </div>
            ) : null}
            <div className="event-summary-item">
              <Icon href="/form-icons.svg" name="form-calendar" size={18} />
              <span><strong>{t('eventDetail.startTimeLabel')}</strong>{new Date(eventItem.start_time).toLocaleString()}</span>
            </div>
            {eventItem.max_capacity && !eventItem.external_registration_url ? (
              <div className={`event-summary-item event-summary-item--full${isAtCapacity ? ' event-summary-item-warning' : ''}`}>
                <Icon href="/form-icons.svg" name="form-user" size={18} />
                <span>
                  <strong>{t('eventDetail.capacityLabel')}</strong>
                  {isHost
                    ? t('eventDetail.capacityHost', { max: eventItem.max_capacity, current: totalCapacityOccupied }) + (extraExternalGuests.length > 0 ? ` (+${extraExternalGuests.length} ${t('eventDetail.externalGuestBadge')})` : '')
                    : (publicCapacityOccupied === null
                      ? t(capacityQueryFailed ? 'eventDetail.capacityRemainingUnavailable' : 'eventDetail.capacityRemainingUnknown', { max: eventItem.max_capacity })
                      : t('eventDetail.capacityRemaining', { max: eventItem.max_capacity, remaining: Math.max(0, eventItem.max_capacity - publicCapacityOccupied) }))}
                  {registrationIntakeActive ? (
                    <span className="capacity-status-badge-wrap">
                      <span className={`chip capacity-status-badge capacity-status-badge--${capacityBadgeKind}`}>{t(capacityBadgeKey)}</span>
                    </span>
                  ) : null}
                  {capacityKnown ? (
                    <span
                      className={`capacity-progress${isAtCapacity ? ' capacity-progress--full' : capacityRatio >= 0.8 ? ' capacity-progress--warning' : ''}`}
                      role="progressbar"
                      aria-label={t('eventDetail.capacityProgressLabel')}
                      aria-valuemin={0}
                      aria-valuemax={eventItem.max_capacity}
                      aria-valuenow={Math.min(capacityOccupiedValue, eventItem.max_capacity)}
                    >
                      <span className="capacity-progress-fill" style={{ width: `${Math.round(capacityRatio * 100)}%` }} />
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
            {eventItem.registration_deadline && !eventItem.external_registration_url ? (
              <div className={`event-summary-item${isRegistrationClosed ? ' event-summary-item-warning' : ''}`}>
                <Icon href="/form-icons.svg" name="form-calendar" size={18} />
                <span>
                  <strong>{t('eventDetail.registrationDeadlineLabel')}</strong>
                  {new Date(eventItem.registration_deadline).toLocaleString()}
                  {registrationIntakeActive && !eventItem.max_capacity ? (
                    <span className="capacity-status-badge-wrap">
                      <span className={`chip capacity-status-badge capacity-status-badge--${capacityBadgeKind}`}>{t(capacityBadgeKey)}</span>
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
            <div className="event-summary-item">
              <Icon href="/form-icons.svg" name="form-edit" size={18} />
              <span><strong>{t('eventDetail.attendanceFeeLabel')}</strong>{getAttendanceFeeLabel(eventItem.attendance_fee_type ?? 'free', eventItem.attendance_fee_amount, locale)}</span>
            </div>
          </div>
          {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' ? (
            <div className="event-action-bar" role="group" aria-label={t('eventDetail.eventTools')}>
              {user ? <EventBookmarkButton eventId={eventItem.id} isBookmarked={isBookmarked} onChange={setIsBookmarked} /> : null}
               <details className="calendar-menu">
                 <summary className="calendar-btn">{t('events.addToCalendar')} <span aria-hidden="true">⌄</span></summary>
                 <div className="calendar-menu-items">
                   <button type="button" className="calendar-btn" onClick={() => downloadIcs(eventItem)}>
                     {t('events.downloadIcs')}
                   </button>
                   <a href={getGoogleCalendarUrl(eventItem)} target="_blank" rel="noopener noreferrer" className="calendar-btn">
                     {t('events.googleCalendar')}
                   </a>
                 </div>
               </details>
               <button
                 type="button"
                 className="secondary-action"
                 onClick={async () => {
                   try {
                     await navigator.clipboard.writeText(window.location.href)
                     alert(t('eventDetail.urlCopied'))
                   } catch (err) {
                     console.error('Failed to copy URL:', err)
                     alert(t('events.shareFailed'))
                   }
                 }}
                 style={{ minWidth: 'auto', padding: '0.4rem 0.75rem' }}
               >
                 {t('eventDetail.copyUrlLabel')}
               </button>
               {!(isHost && eventItem.visibility_settings?.type === 'private') ? (
                 <ShareButton
                   title={eventItem.title}
                   text={eventItem.description ?? ''}
                   url={sharedEventUrl}
                 />
               ) : null}
              {isHost ? (
                <button type="button" className="calendar-btn" onClick={() => setShareOpen(true)}>
                  {t('shareModal.broadcastToX')}
                </button>
              ) : null}
            </div>
          ) : isHost ? (
            <div className="event-action-bar" role="group" aria-label={t('eventDetail.eventTools')}>
              {user ? <EventBookmarkButton eventId={eventItem.id} isBookmarked={isBookmarked} onChange={setIsBookmarked} /> : null}
            </div>
          ) : null}
        </aside>
      ) : null}

      {isHost && eventItem ? (
        <div className="host-view-tabs" role="group" aria-label={t('eventDetail.managementConsole')}>
          <span className="host-view-tabs-label">
            <Icon href="/form-icons.svg" name="form-user" size={14} /> {t('eventDetail.hostTools')}
          </span>
          <div className="host-view-tab-group">
            <button
              type="button"
              aria-pressed={hostConsoleView === 'participants'}
              className={`host-view-tab${hostConsoleView === 'participants' ? ' host-view-tab--active' : ''}`}
              onClick={() => setHostConsoleView('participants')}
            >
              {t('eventDetail.hostTabParticipants')}
            </button>
            <button
              type="button"
              aria-pressed={hostConsoleView === 'management'}
              className={`host-view-tab${hostConsoleView === 'management' ? ' host-view-tab--active' : ''}`}
              onClick={() => setHostConsoleView('management')}
            >
              {t('eventDetail.hostTabManagement')}
            </button>
          </div>
        </div>
      ) : null}

      {eventItem ? (
        <EventAnnouncements
          eventId={eventItem.id}
          isHost={Boolean(isHost)}
          nativeRegistration={!eventItem.external_registration_url}
        />
      ) : null}

      {/* Registration Section */}
      {eventItem && eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' && !isHost && eventItem.external_registration_url && isAllowedExternalRegistrationUrl(eventItem.external_registration_url) ? (
        <section className="card event-registration-section">
          <h3>{t('eventDetail.registration')}</h3>
          <p className="registration-hint">{t('eventDetail.externalRegistrationNotice')}</p>
          {registrationEntryBlocked ? (
            <button type="button" className="primary-cta primary-cta--disabled" disabled aria-disabled="true">
              {t('eventDetail.registrationClosedCta')}
            </button>
          ) : (
            <a href={eventItem.external_registration_url} target="_blank" rel="noopener noreferrer" className="primary-cta">
              {t('eventDetail.externalRegistrationCta')}
            </a>
          )}
        </section>
      ) : null}
      {eventItem && eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' && !isHost && eventItem.external_registration_url && !isAllowedExternalRegistrationUrl(eventItem.external_registration_url) ? (
        <section className="card event-registration-section" role="status">
          <h3>{t('eventDetail.registration')}</h3>
          <p className="registration-hint">{t('eventDetail.externalRegistrationUnavailable')}</p>
        </section>
      ) : null}
      {eventItem && eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' && !user && !isHost && !eventItem.external_registration_url ? (
        <section className="card event-registration-section">
          <h3>{t('eventDetail.registration')}</h3>
          {registrationEntryBlocked ? (
            <>
              <button type="button" className="primary-cta primary-cta--disabled" disabled aria-disabled="true">
                {t('eventDetail.registrationClosedCta')}
              </button>
              <p className="registration-hint">{t('eventDetail.registrationClosed')}</p>
            </>
          ) : (
            <>
              <p className="registration-hint">{t('eventDetail.loginToRegister')}</p>
              <Link to={`/auth?from=${encodeURIComponent(window.location.pathname)}`} className="primary-cta">
                {t('eventDetail.loginToRegisterCta')}
              </Link>
            </>
          )}
        </section>
      ) : null}
      {eventItem && eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'closed' && user && !isHost && !eventItem.external_registration_url ? (
        <section className="card event-registration-section">
          <h3>{t('eventDetail.registration')}</h3>
          {!myRegistration && isAtCapacity ? (
            <p className="registration-hint">{t('eventDetail.waitlistHint')}</p>
          ) : null}
          {myRegistration ? (
            <div>
              <p>{t('eventDetail.myRegistrationStatus')}: <strong>{registrationStatus(myRegistration.status)}</strong></p>
              {myRegistration.status === 'waitlisted' && myRegistration.waitlist_position ? (
                <p>{t('eventDetail.waitlistPosition', { position: myRegistration.waitlist_position })}</p>
              ) : null}
            {myRegistration.status === 'cancellation_rejected' && (
              <p>{t('eventDetail.regCancellationRejected')}</p>
            )}
            {(myRegistration.status === 'pending' || myRegistration.status === 'approved' || myRegistration.status === 'waitlisted') ? (
              <button type="button" onClick={() => void handleCancelRegistration()} disabled={submitting}>
                {t('eventDetail.cancelRegistration')}
              </button>
            ) : null}

            {myRegistration.status === 'approved' ? (
              <button type="button" onClick={() => setAttendeeShareOpen(true)} style={{ marginLeft: '0.5rem' }}>
                {t('shareModal.attendeeAnnounce')}
              </button>
            ) : null}

            </div>
          ) : registrationEntryBlocked ? (
            <>
              <button type="button" className="primary-cta primary-cta--disabled" disabled aria-disabled="true">
                {t('eventDetail.registrationClosedCta')}
              </button>
              <p className="registration-hint">{t('eventDetail.registrationClosed')}</p>
            </>
          ) : eventItem.registration_form_config ? (
            showForm ? (
              <div>
                <p className="form-field"><PrivacyDisclosure label={t('privacyDisclosure.label')} description={t('privacyDisclosure.registrationResponses')} learnMore={t('privacyDisclosure.learnMore')} /> {t('privacyDisclosure.registrationResponses')}</p>
                {Object.keys(previousFormData).length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFormData(previousFormData)}
                    disabled={submitting}
                    style={{ marginBottom: '0.75rem' }}
                  >
                    {t('eventDetail.copyPreviousAnswers')}
                  </button>
                ) : null}
                {(eventItem.registration_form_config as RegistrationFormField[]).map((field) => (
                  <label key={field.id} className="form-field" style={{ marginBottom: '0.5rem' }}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    {field.type === 'text' && (
                      <input value={(formData[field.id] as string) ?? ''} onChange={(e) => { setFormValidationError(''); setFormData({...formData, [field.id]: e.target.value}) }} placeholder={field.placeholder} />
                    )}
                    {field.type === 'textarea' && (
                      <textarea value={(formData[field.id] as string) ?? ''} onChange={(e) => { setFormValidationError(''); setFormData({...formData, [field.id]: e.target.value}) }} placeholder={field.placeholder} />
                    )}
                    {field.type === 'select' && field.options && (
                      <select value={(formData[field.id] as string) ?? ''} onChange={(e) => { setFormValidationError(''); setFormData({...formData, [field.id]: e.target.value}) }}>
                        <option value="">--</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {field.type === 'checkbox' && (
                      <label className="checkbox">
                        <input type="checkbox" checked={!!formData[field.id]} onChange={(e) => { setFormValidationError(''); setFormData({...formData, [field.id]: e.target.checked}) }} />
                        {field.label}
                      </label>
                    )}
                    {field.type === 'radio' && field.options?.map(o => (
                      <label key={o} className="checkbox">
                        <input type="radio" name={field.id} value={o} checked={formData[field.id] === o} onChange={(e) => { setFormValidationError(''); setFormData({...formData, [field.id]: e.target.value}) }} />
                        {o}
                      </label>
                    ))}
                  </label>
                ))}
                <button type="button" className="primary-cta" disabled={submitting} onClick={async () => {
                  const fields = eventItem.registration_form_config as RegistrationFormField[]
                  for (const f of fields) {
                    if (f.required) {
                      const val = formData[f.id]
                      if (val === undefined || val === null || val === '' || val === false) {
                        setFormValidationError(`"${f.label}" ${t('eventDetail.fillFormBeforeRegister')}`)
                        return
                      }
                    }
                  }
                  setSubmitting(true)
                  const { error } = await supabase.functions.invoke('create-registration', {
                    body: { event_id: id, form_responses: formData },
                  })
                  setSubmitting(false)
                  if (error) {
                    const response = error instanceof FunctionsHttpError ? error.context : undefined
                    let responseBody: { error?: string; message?: string } | null = null
                    if (response?.status === 400) {
                      responseBody = await response.clone().json().catch(() => null)
                    }
                    if (response?.status === 400 && responseBody?.error === 'form_validation_error') {
                      setFormValidationError(t('eventDetail.formValidationError'))
                    } else {
                      showError(responseBody?.message || error.message, error)
                    }
                    return
                  }
                  setFormValidationError('')
                  setShowForm(false)
                  await load()
                }}>
                  {isAtCapacity ? t('eventDetail.waitlistRegister') : t('eventDetail.register')}
                </button>
                {formValidationError ? <p className="error-message" role="alert">{formValidationError}</p> : null}
                <button type="button" onClick={() => setShowForm(false)}>{t('common.cancelReply')}</button>
              </div>
            ) : (
                <button type="button" className="primary-cta" onClick={() => setShowForm(true)} disabled={submitting}>
                {isAtCapacity ? t('eventDetail.waitlistRegister') : t('eventDetail.register')}
              </button>
            )
          ) : eventItem.max_capacity && isAtCapacity ? (
            <button type="button" className="primary-cta" onClick={() => void handleRegister()} disabled={submitting}>
              {t('eventDetail.waitlistRegister')}
            </button>
          ) : (
            <button type="button" className="primary-cta" onClick={() => void handleRegister()} disabled={submitting}>
              {t('eventDetail.register')}
            </button>
          )}
        </section>
      ) : null}

      {isHost && hostConsoleView === 'management' && eventItem ? (
        <section className="card event-admin-section" aria-labelledby="event-management-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">{t('eventDetail.hostTools')}</p>
              <h3 id="event-management-title">{t('eventDetail.managementConsole')}</h3>
            </div>
            <span className="chip chip-neutral">
              {eventItem.publication_status === 'published' ? t('eventDetail.statusPublished') : t('eventDetail.statusClosed')}
            </span>
          </div>
          <div className="event-admin-actions">
            {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status !== 'published' ? (
              <button type="button" className="secondary-action" onClick={() => void handlePublicationChange('published')}>
                {t('eventDetail.publishNow')}
              </button>
            ) : null}
            {!isEditLocked ? (
              <Link to={`/events/${eventItem.id}/edit`} className="secondary-action">
                <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.editEvent')}
              </Link>
            ) : null}
            <button type="button" className="secondary-action" onClick={() => navigate(`/events/new?from_event_id=${eventItem.id}`)}>
              <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.copyEvent')}
            </button>
            {eventItem.registration_form_config && !eventItem.external_registration_url ? (
              <button type="button" className="secondary-action" onClick={async () => {
                const { data } = await supabase
                  .from('event_registration_responses')
                  .select('*, registration:event_registrations!inner(profile_id)')
                  .in('registration.event_id', [eventItem.id])
                if (data) setFormResponses(data as FormResponseWithRegistrant[])
              }}>
                <Icon href="/form-icons.svg" name="form-edit" size={14} /> {t('eventDetail.viewFormResponses')}
              </button>
            ) : null}
            <button type="button" className="secondary-action" onClick={() => setShowAddGuest(true)}>
              <Icon href="/form-icons.svg" name="form-user" size={14} /> {t('eventDetail.addExternalGuest')}
            </button>
            <button type="button" className="secondary-action" onClick={() => setShowInviteModal(true)}>
              <Icon href="/form-icons.svg" name="form-user" size={14} /> {t('eventDetail.inviteMember')}
            </button>
            {isPrivateShareable ? (
              <>
                <button type="button" className="secondary-action" disabled={shareLinkPending} onClick={() => void copyShareLink(false)}>
                  <Icon href="/form-icons.svg" name="form-eye" size={14} /> {t('eventDetail.copyShareLink')}
                </button>
                <button type="button" className="secondary-action" disabled={shareLinkPending} onClick={() => setRotateConfirmOpen(true)}>
                  {t('eventDetail.rotateShareLink')}
                </button>
              </>
            ) : null}
          </div>
          {eventItem.lifecycle_status !== 'draft' && eventItem.publication_status === 'published' ? (
            <div className="event-admin-danger-zone">
              <button type="button" className="danger-action" onClick={() => setPublicationConfirmOpen(true)}>
                {t('eventDetail.unpublishNow')}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Host Review Section - All Registrations */}
      {isHost && hostConsoleView === 'management' && registrations.length > 0 ? (
        <section className="card event-admin-section event-admin-section--wide">
          <h3>{t('eventDetail.allRegistrations')} ({registrations.length})</h3>
          {(['pending', 'approved', 'waitlisted', 'rejected', 'cancellation_pending', 'cancellation_rejected'] as const).map((status) => {
            const filtered = registrations.filter((r) => r.status === status)
            if (filtered.length === 0) {
              return null
            }
            const sectionTitle =
              status === 'pending' ? t('eventDetail.sectionPending')
              : status === 'approved' ? t('eventDetail.sectionApproved')
              : status === 'waitlisted' ? t('eventDetail.sectionWaitlisted')
              : status === 'cancellation_pending' ? t('eventDetail.sectionCancellationPending')
              : status === 'cancellation_rejected' ? t('eventDetail.sectionCancellationRejected')
              : t('eventDetail.sectionRejected')
            return (
              <div key={status} className="registration-section">
                <h4>{sectionTitle} ({filtered.length})</h4>
                <ul>
                  {filtered.map((reg) => (
                    <li key={reg.id} className="thread-item">
                      <div className="thread-header">
                        <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                        <div>
                          <p><Link to={`/profile/${reg.profile_id}`}>{profileNameMap.get(reg.profile_id) || reg.profile_id}</Link></p>
                          <small>{new Date(reg.created_at).toLocaleString()}</small>
                          {status === 'waitlisted' && reg.waitlist_position ? (
                            <small> — {t('eventDetail.waitlistPosition', { position: reg.waitlist_position })}</small>
                          ) : null}
                          {reg.reviewed_at ? (
                            <small> — {new Date(reg.reviewed_at).toLocaleString()}</small>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        {status === 'cancellation_pending' ? (
                          <>
                            <button type="button" onClick={() => void handleReview(reg.id, 'approve')} disabled={submitting}>
                              {t('eventDetail.confirmCancellation')}
                            </button>
                            <button type="button" onClick={() => void handleReview(reg.id, 'reject')} disabled={submitting}>
                              {t('eventDetail.rejectCancellation')}
                            </button>
                          </>
                        ) : status === 'pending' ? (
                          <>
                            <button type="button" onClick={() => void handleReview(reg.id, 'approve')} disabled={submitting}>
                              {t('eventDetail.approveRegistration')}
                            </button>
                            <button type="button" onClick={() => void handleReview(reg.id, 'reject')} disabled={submitting}>
                              {t('eventDetail.rejectRegistration')}
                            </button>
                          </>
                        ) : null}
                        {status === 'cancellation_rejected' ? (
                          <button type="button" onClick={() => void handleReview(reg.id, 'reopen')} disabled={submitting}>
                            {t('eventDetail.reopen')}
                          </button>
                        ) : null}
                        {status === 'approved' ? (
                          <>
                            {reg.checked_in_at ? (
                              <span className="chip chip-checked-in">{t('eventDetail.checkedIn')}</span>
                            ) : (
                              <button type="button" onClick={() => void handleCheckIn(reg.id)} disabled={submitting}>
                                {t('eventDetail.checkIn')}
                              </button>
                            )}
                            <button type="button" onClick={() => void handleForceCancel(reg.id)} disabled={submitting}>
                              {t('eventDetail.forceCancel')}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      ) : null}

      {/* Attendees Section */}
      {isHost && hostConsoleView === 'management' && attendees.length > 0 ? (
        <section className="card event-admin-section event-admin-section--wide">
          <h3>{t('eventDetail.attendees')} ({attendees.length})</h3>
          <ul>
            {attendees.map((a) => (
              <li key={a.profile_id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p><Link to={`/profile/${a.profile_id}`}>{a.display_name || a.profile_id}</Link></p>
                    <small>{new Date(a.joined_at).toLocaleString()}</small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      
      {/* External Guests Section (host only) */}
      {isHost && hostConsoleView === 'management' && externalGuests.length > 0 ? (
        <section className="card event-admin-section event-admin-section--wide">
          <h3>{t('eventDetail.externalGuests')} ({externalGuests.length})</h3>
          <ul>
            {capacityExternalGuests.map((g) => (
              <li key={g.id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p>
                      {g.guest_name}{' '}
                      <span className="chip chip-neutral">{t('eventDetail.externalGuestBadge')}</span>{' '}
                      <span className="chip">{t('eventDetail.externalGuestCapacity')}</span>
                    </p>
                    {g.contact_info ? <small>{g.contact_info}</small> : null}
                    <small>{new Date(g.created_at).toLocaleString()}</small>
                  </div>
                </div>
                <div>
                  <button type="button" className="danger-action" onClick={() => setGuestToRemove(g)}>
                    {t('eventDetail.removeExternalGuest')}
                  </button>
                </div>
              </li>
            ))}
            {extraExternalGuests.map((g) => (
              <li key={g.id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p>
                      {g.guest_name}{' '}
                      <span className="chip chip-neutral">{t('eventDetail.externalGuestBadge')}</span>{' '}
                      <span className="chip">{t('eventDetail.externalGuestNoCapacity')}</span>
                    </p>
                    {g.contact_info ? <small>{g.contact_info}</small> : null}
                    <small>{new Date(g.created_at).toLocaleString()}</small>
                  </div>
                </div>
                <div>
                  <button type="button" className="danger-action" onClick={() => setGuestToRemove(g)}>
                    {t('eventDetail.removeExternalGuest')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Pending Invitations Section (host only) */}
      {isHost && hostConsoleView === 'management' && pendingInvitations.length > 0 ? (
        <section className="card event-admin-section event-admin-section--wide">
          <h3>{t('eventDetail.invitations')} ({pendingInvitations.length})</h3>
          <ul>
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="thread-item">
                <div className="thread-header">
                  <img src="/default-avatar.svg" alt="" width={32} height={32} className="avatar" />
                  <div>
                    <p>
                      <Link to={`/profile/${inv.target_profile_id}`}>
                        {profileNameMap.get(inv.target_profile_id) || t('eventDetail.unnamedMember')}
                      </Link>{' '}
                      <span className="chip chip-neutral">{t('eventDetail.pendingInvite')}</span>
                    </p>
                    <small>{new Date(inv.created_at).toLocaleString()}</small>
                  </div>
                </div>
                <div>
                  <button type="button" className="danger-action" onClick={() => setInvitationToRetract(inv)}>
                    {t('eventDetail.retractInvitation')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isHost && hostConsoleView === 'management' && formResponses.length > 0 ? (
        <section className="card event-admin-section event-admin-section--wide">
          <h3>{t('eventDetail.formResponsesTitle')}</h3>
          {formResponses.map((fr) => {
            const fields = (eventItem?.registration_form_config ?? []) as RegistrationFormField[]
            const respondentId = fr.registration?.profile_id
            return (
              <div key={fr.id} className="form-response-item">
                <p className="form-response-meta">
                  {respondentId ? (
                    <Link to={`/profile/${respondentId}`}>{profileNameMap.get(respondentId) || respondentId}</Link>
                  ) : (
                    t('eventDetail.unnamedMember')
                  )}
                  {' · '}
                  {new Date(fr.created_at).toLocaleString()}
                </p>
                <dl className="form-response-fields">
                  {Object.entries(fr.responses ?? {}).map(([fieldId, value]) => {
                    const field = fields.find((f) => f.id === fieldId)
                    let display: string
                    if (typeof value === 'boolean') {
                      display = value ? t('eventDetail.formAnswerYes') : t('eventDetail.formAnswerNo')
                    } else if (typeof value === 'string') {
                      display = value
                    } else if (value === null || value === undefined) {
                      display = ''
                    } else {
                      display = String(value)
                    }
                    return (
                      <div key={fieldId} className="form-response-field">
                        <dt>{field?.label ?? fieldId}</dt>
                        <dd>{display}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )
          })}
        </section>
      ) : null}

      {user ? (
      <section className="card event-discussion-section">
        <div className="discussion-heading">
          <div>
            <p className="eyebrow">{t('eventDetail.discussionEyebrow')}</p>
            <h3>{t('eventDetail.discussion')}</h3>
          </div>
          {discussionStatus ? <p className="discussion-status" role="status">{discussionStatus}</p> : null}
        </div>
        <form className="discussion-composer" onSubmit={postThread}>
          <textarea
            aria-label={t('eventDetail.discussion')}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t('eventDetail.postComment')}
            rows={3}
          />
          <div className="discussion-form-actions">
            <button type="submit" className="primary-cta" disabled={postingThread || !content.trim()}>
              <Icon href="/action-icons.svg" name="action-reply" size={16} /> {postingThread ? t('eventDetail.posting') : t('eventDetail.post')}
            </button>
          </div>
        </form>
        {visibleThreads.length === 0 ? (
          <div className="empty-state">
            <p>{t('eventDetail.discussionEmpty')}</p>
          </div>
        ) : (
          <ul className="discussion-list">
            {rootThreads.map((thread) => renderThread(thread))}
          </ul>
        )}
      </section>
      ) : null}
      </div>

      {id && user ? (
        <section className="event-report-section" aria-label={t('report.title')}>
          <button type="button" className="report-trigger" onClick={() => setReportOpen(true)}>
            <Icon href="/report-icons.svg" name="report-safety-risk" size={16} />
            {t('eventDetail.reportEvent')}
          </button>
        </section>
      ) : null}

      {id && user && reportOpen ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReportOpen(false)
        }}>
          <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="event-report-title">
            <div className="report-modal-header">
              <h3 id="event-report-title">{t('eventDetail.reportEvent')}</h3>
              <button type="button" className="modal-close" onClick={() => setReportOpen(false)} aria-label={t('common.close')}>×</button>
            </div>
            <ReportForm targetEventId={id} />
          </div>
        </div>
      ) : null}

      {eventItem && publicationConfirmOpen ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPublicationConfirmOpen(false)
        }}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="unpublish-dialog-title">
            <h3 id="unpublish-dialog-title">{t('eventDetail.unpublishConfirmTitle')}</h3>
            <p>{t('eventDetail.unpublishWarning')}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setPublicationConfirmOpen(false)}>
                {t('common.cancelReply')}
              </button>
              <button type="button" className="danger-action" onClick={() => void handlePublicationChange('closed')}>
                {t('eventDetail.unpublishNow')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eventItem && rotateConfirmOpen ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setRotateConfirmOpen(false)
        }}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="rotate-share-link-dialog-title">
            <h3 id="rotate-share-link-dialog-title">{t('eventDetail.rotateShareLinkConfirmTitle')}</h3>
            <p>{t('eventDetail.rotateShareLinkWarning')}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setRotateConfirmOpen(false)}>
                {t('common.cancelReply')}
              </button>
              <button type="button" className="danger-action" disabled={shareLinkPending} onClick={() => {
                setRotateConfirmOpen(false)
                void copyShareLink(true)
              }}>
                {t('eventDetail.rotateShareLink')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eventItem && showAddGuest ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowAddGuest(false)
        }}>
          <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="add-guest-title">
            <div className="report-modal-header">
              <h3 id="add-guest-title">{t('eventDetail.addExternalGuestTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => setShowAddGuest(false)} aria-label={t('common.close')}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1rem' }}>
              <label className="form-field" style={{ marginBottom: '0.75rem' }}>
                <span>{t('eventDetail.addGuestName')} *</span>
                <input
                  autoFocus
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  placeholder={t('eventDetail.addGuestName')}
                />
              </label>
              <label className="form-field" style={{ marginBottom: '0.75rem' }}>
                <span>{t('eventDetail.addContactInfo')}</span>
                <input
                  value={newGuestContact}
                  onChange={(e) => setNewGuestContact(e.target.value)}
                  placeholder={t('eventDetail.addContactInfo')}
                />
              </label>
              <label className="form-field checkbox" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={newGuestCountsToCapacity}
                  onChange={(e) => setNewGuestCountsToCapacity(e.target.checked)}
                />
                <div>
                  <span>{t('eventDetail.countTowardsCapacity')}</span>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{t('eventDetail.countTowardsCapacityHint')}</p>
                </div>
              </label>
              <div className="confirm-dialog-actions">
                <button type="button" className="secondary-action" onClick={() => setShowAddGuest(false)}>
                  {t('common.cancelReply')}
                </button>
                <button type="button" className="primary-cta" disabled={submittingGuest || !newGuestName.trim()} onClick={() => void handleAddExternalGuest()}>
                  {submittingGuest ? t('common.loading') : t('eventDetail.addExternalGuest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {eventItem && guestToRemove ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setGuestToRemove(null)
        }}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-guest-dialog-title">
            <h3 id="remove-guest-dialog-title">{t('eventDetail.removeExternalGuest')}</h3>
            <p>{t('eventDetail.removeExternalGuestConfirm')}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setGuestToRemove(null)}>
                {t('common.cancelReply')}
              </button>
              <button type="button" className="danger-action" disabled={submittingGuest} onClick={() => void handleRemoveExternalGuest()}>
                {submittingGuest ? t('common.loading') : t('eventDetail.removeExternalGuest')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eventItem && invitationToRetract ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setInvitationToRetract(null)
        }}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="retract-invitation-dialog-title">
            <h3 id="retract-invitation-dialog-title">{t('eventDetail.retractInvitation')}</h3>
            <p>{t('eventDetail.retractInvitationConfirm')}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setInvitationToRetract(null)}>
                {t('common.cancelReply')}
              </button>
              <button type="button" className="danger-action" onClick={() => void handleRetractInvitation()}>
                {t('eventDetail.retractInvitation')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eventItem && showInviteModal ? (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) { setShowInviteModal(false); setInviteSearchResults([]); setInviteError('') }
        }}>
          <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="invite-member-title">
            <div className="report-modal-header">
              <h3 id="invite-member-title">{t('eventDetail.inviteMemberTitle')}</h3>
              <button type="button" className="modal-close" onClick={() => { setShowInviteModal(false); setInviteSearchResults([]); setInviteError('') }} aria-label={t('common.close')}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1rem' }}>
              <label className="form-field" style={{ marginBottom: '0.75rem' }}>
                <span>{t('eventDetail.searchMember')}</span>
                <input
                  autoFocus
                  value={inviteSearchQuery}
                  onChange={(e) => void handleSearchMembers(e.target.value)}
                  placeholder={t('eventDetail.searchMember')}
                />
              </label>
              {inviteError ? <p className="error-message" role="alert">{inviteError}</p> : null}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {inviteSearchResults.map((profile) => (
                  <li key={profile.id} className="thread-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                    <span>{profile.display_name || profile.id}</span>
                    <button
                      type="button"
                      className="primary-cta"
                      disabled={inviting}
                      onClick={() => void handleSendInvitation(profile.id)}
                      style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                    >
                      {inviting ? t('common.loading') : t('eventDetail.sendInvitation')}
                    </button>
                  </li>
                ))}
              </ul>
              {inviteSearchQuery.trim().length >= 2 && inviteSearchResults.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{t('common.noResults')}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {eventItem ? (
        <ShareToXModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          templateType="host_broadcast"
          data={{
            event: {
              title: eventItem.title,
              startTime: new Date(eventItem.start_time).toLocaleString(),
              region: eventItem.location_region ?? '線上',
              eventUrl: window.location.href,
            },
          }}
        />
      ) : null}

      {eventItem && eventItem.creator ? (
        <ShareToXModal
          open={attendeeShareOpen}
          onClose={() => setAttendeeShareOpen(false)}
          templateType="attendee_announcement"
          data={{
            event: {
              title: eventItem.title,
              startTime: '',
              hostName: eventItem.creator.metadata?.twitter_handle
                ? `@${eventItem.creator.metadata.twitter_handle}`
                : (eventItem.creator.display_name ?? ''),
              eventUrl: window.location.href,
            },
          }}
        />
      ) : null}
    </Layout>
  )
}

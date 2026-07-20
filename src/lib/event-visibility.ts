import type { EventItem, Visibility } from '../types'

export function getEventVisibility(event: EventItem): Visibility {
  const raw = event.visibility_settings?.type
  if (raw === 'public' || raw === 'connections_only' || raw === 'private') {
    return raw
  }
  return 'public'
}

export function canSeeEvent(
  event: EventItem,
  viewerId: string | null | undefined,
): boolean {
  if (!viewerId) return false

  const visibility = getEventVisibility(event)

  if (event.creator_id === viewerId) return true
  if (visibility === 'public') return true
  if (visibility === 'private') return false

  // connections_only: RLS 已處理完整檢查，前端僅做粗略過濾
  // 當 viewer 非建立者且 visibility 為 connections_only 時，預設不可見
  // 完整的 connections 查詢由 RLS 在 DB 層級執行
  return false
}

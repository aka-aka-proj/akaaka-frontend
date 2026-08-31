import type { EventItem } from '../types'

export type HostConsoleView = 'participants' | 'management'

export function shouldShowPublishShortcut(
  lifecycleStatus: EventItem['lifecycle_status'],
  publicationStatus: EventItem['publication_status'],
): boolean {
  return lifecycleStatus === 'draft' || publicationStatus === 'closed'
}

export function getInitialHostConsoleView(isHost: boolean): HostConsoleView {
  return isHost ? 'management' : 'participants'
}

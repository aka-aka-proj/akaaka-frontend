export type HostConsoleView = 'participants' | 'management'

export function getInitialHostConsoleView(isHost: boolean): HostConsoleView {
  return isHost ? 'management' : 'participants'
}

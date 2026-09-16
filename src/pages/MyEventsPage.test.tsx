import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyEventsPage } from './MyEventsPage'
const auth = vi.fn()
const requests: Array<{ table: string; filters: Record<string, unknown>; range?: number[] }> = []
const response = vi.fn()
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth() }))
vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../supabaseClient', () => ({ supabase: { from: (table: string) => {
  const request = { table, filters: {} as Record<string, unknown>, range: [] as number[] }; requests.push(request)
  const q = { select: () => q, eq: (key: string, value: unknown) => { request.filters[key] = value; return q }, order: () => q,
    range: (start: number, end: number) => { request.range = [start,end]; return response(request) } }
  return q
} } }))
const draft = { id:'series-1', creator_id:'owner', title:'空系列草稿', updated_at:'2026-09-01T00:00:00Z', event_series_membership:[{count:0}] }
describe('MyEventsPage', () => {
 beforeEach(() => { requests.length=0; auth.mockReturnValue({ user:{ id:'owner' } }); response.mockResolvedValue({data:[draft],error:null}) })
 it('finds an empty owned series draft and links directly to manage', async () => {
  render(<MemoryRouter initialEntries={['/events/mine?type=series&status=draft']}><MyEventsPage /></MemoryRouter>)
  expect(await screen.findByText('空系列草稿')).toBeTruthy()
  expect(screen.getByRole('link',{name:/繼續編輯/}).getAttribute('href')).toBe('/events/series/series-1/manage')
  expect(requests[0]).toMatchObject({table:'event_series',filters:{creator_id:'owner',lifecycle_status:'draft'}})
  expect(screen.getByText(/0 場/)).toBeTruthy()
 })
 it('has an error state and retries without displaying raw database errors', async () => {
  response.mockResolvedValueOnce({data:null,error:{message:'private database details'}})
  const user=userEvent.setup()
  render(<MemoryRouter initialEntries={['/events/mine?type=series']}><MyEventsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('private database details')).toBeNull()
  await user.click(screen.getByRole('button',{name:'重試'}))
  expect(await screen.findByText('空系列草稿')).toBeTruthy()
 })
 it('loads more than one page and switches to published events', async () => {
  response.mockResolvedValueOnce({data:Array.from({length:20},(_,i)=>({...draft,id:`series-${i}`,title:`草稿 ${i}`})),error:null})
  const user=userEvent.setup()
  render(<MemoryRouter initialEntries={['/events/mine?type=series']}><MyEventsPage /></MemoryRouter>)
  await user.click(await screen.findByRole('button',{name:'載入更多活動'}))
  await waitFor(()=>expect(requests.some(r=>r.range?.[1]===39)).toBe(true))
  await user.click(screen.getByRole('button',{name:'已發布'}))
  await user.click(screen.getByRole('button',{name:'活動'}))
  await waitFor(()=>expect(requests.at(-1)).toMatchObject({table:'events',filters:{creator_id:'owner',lifecycle_status:'published'}}))
 })
 it('does not show a stale response after changing accounts', async () => {
  let finish!: (value: unknown) => void
  response.mockReturnValueOnce(new Promise(resolve=>{finish=resolve})).mockResolvedValue({data:[],error:null})
  const view=render(<MemoryRouter initialEntries={['/events/mine?type=series']}><MyEventsPage /></MemoryRouter>)
  auth.mockReturnValue({user:{id:'other'}}); view.rerender(<MemoryRouter><MyEventsPage /></MemoryRouter>)
  await waitFor(()=>expect(requests.some(r=>r.filters.creator_id==='other')).toBe(true))
  finish({data:[draft],error:null})
  await waitFor(()=>expect(screen.queryByText('空系列草稿')).toBeNull())
 })
})

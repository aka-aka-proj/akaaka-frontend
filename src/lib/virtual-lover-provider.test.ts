import { describe, expect, it, vi } from 'vitest'
import {
  provisionBrowserProviderKey,
  requestProviderChat,
  VIRTUAL_LOVER_PROVIDER_POLICY,
} from './virtual-lover-provider'

describe('Virtual Lover browser provider boundary', () => {
  it('provisions a key without persisting or logging the plaintext', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ provider_key: 'secret-key' }), { status: 201 }),
    )

    await expect(provisionBrowserProviderKey('https://supabase.test', 'token'))
      .resolves.toBe('secret-key')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/llm-key',
      expect.objectContaining({ method: 'POST' }),
    )
    vi.restoreAllMocks()
  })

  it('always sends the reviewed provider privacy policy', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))

    await requestProviderChat('secret-key', 'reviewed-model', [{ role: 'user', content: 'hello' }])
    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as { provider: typeof VIRTUAL_LOVER_PROVIDER_POLICY }
    expect(body.provider).toEqual(VIRTUAL_LOVER_PROVIDER_POLICY)
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer secret-key' })
    vi.restoreAllMocks()
  })
})

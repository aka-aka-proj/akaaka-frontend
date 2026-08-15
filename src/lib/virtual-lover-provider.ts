export const VIRTUAL_LOVER_PROVIDER_POLICY = {
  zdr: true,
  data_collection: 'deny',
} as const

interface ProviderKeyResponse {
  provider_key?: string
  error?: string
}

export async function provisionBrowserProviderKey(
  supabaseUrl: string,
  accessToken: string,
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/llm-key`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body = await response.json() as ProviderKeyResponse
  if (!response.ok || !body.provider_key) {
    throw new Error(body.error ?? 'llm_key_unavailable')
  }
  return body.provider_key
}

export async function requestProviderChat(
  providerKey: string,
  model: string,
  messages: unknown[],
): Promise<Response> {
  if (!providerKey) throw new Error('llm_key_unavailable')
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      provider: VIRTUAL_LOVER_PROVIDER_POLICY,
    }),
  })
}

export const VIRTUAL_LOVER_PROVIDER_POLICY = {
  zdr: true,
  data_collection: 'deny',
} as const

export const VIRTUAL_LOVER_MODELS = [
  'aion-labs/aion-3.0-mini',
  'minimax/minimax-m2-her',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition',
  'deepseek/deepseek-v4-flash',
] as const

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models?zdr=true'
const OPENROUTER_USER_MODELS_URL = 'https://openrouter.ai/api/v1/models/user'

interface ProviderModel {
  id?: unknown
  architecture?: {
    input_modalities?: unknown
    output_modalities?: unknown
  }
}

interface ProviderModelsResponse {
  data?: ProviderModel[]
}

function readModelIds(body: ProviderModelsResponse): Set<string> {
  return new Set((body.data ?? [])
    .filter((model) => {
      const input = model.architecture?.input_modalities
      const output = model.architecture?.output_modalities
      return typeof model.id === 'string'
        && Array.isArray(input) && input.includes('text')
        && Array.isArray(output) && output.includes('text')
    })
    .map((model) => model.id as string))
}

/** Return only models that are both ZDR-capable and allowed by this key's user settings. */
export async function listZdrModels(providerKey: string): Promise<string[]> {
  if (!providerKey) throw new Error('llm_key_unavailable')

  const headers = { Authorization: `Bearer ${providerKey}` }
  const [zdrResponse, userResponse] = await Promise.all([
    fetch(OPENROUTER_MODELS_URL, { headers }),
    fetch(OPENROUTER_USER_MODELS_URL, { headers }),
  ])
  if (!zdrResponse.ok || !userResponse.ok) throw new Error('provider_zdr_unavailable')

  const zdrCatalog = readModelIds(await zdrResponse.json() as ProviderModelsResponse)
  const userCatalog = readModelIds(await userResponse.json() as ProviderModelsResponse)
  return [
    ...VIRTUAL_LOVER_MODELS.filter((model) => zdrCatalog.has(model) && userCatalog.has(model)),
    ...[...userCatalog].filter((model) => zdrCatalog.has(model) && !VIRTUAL_LOVER_MODELS.includes(model as typeof VIRTUAL_LOVER_MODELS[number])),
  ]
}

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
  if (!model) throw new Error('provider_zdr_unavailable')
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

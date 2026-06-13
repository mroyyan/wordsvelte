import { PUBLIC_API_URL } from '$env/static/public'

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'API Error')
  return json
}

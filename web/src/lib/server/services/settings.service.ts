import { settings } from '@wordsvelte/shared'

export async function getSettings(db: any): Promise<Record<string, string>> {
	const all = await db.select().from(settings)
	const data: Record<string, string> = {}
	all.forEach((s: any) => { data[s.key] = s.value })
	return data
}

export async function updateSettings(db: any, data: Record<string, string>) {
	for (const [key, value] of Object.entries(data)) {
		await db.insert(settings)
			.values({ key, value })
			.onConflictDoUpdate({ target: settings.key, set: { value } })
	}
}

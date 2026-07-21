export function parseEventTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return [raw];
  }
}

export function stringifyEventTypes(types: string[]): string {
  return JSON.stringify(types);
}

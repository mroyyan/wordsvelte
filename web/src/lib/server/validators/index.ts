const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRequired(fields: Record<string, any>, ...names: string[]) {
  for (const name of names) {
    if (!fields[name] && fields[name] !== 0 && fields[name] !== false) {
      return `${name} is required`
    }
  }
  return null
}

export function validateEmail(email: string) {
  if (!EMAIL_RE.test(email)) return 'Invalid email format'
  return null
}

export function validateMaxLength(value: string, max: number, field: string) {
  if (value && value.length > max) return `${field} too long (max ${max} chars)`
  return null
}

export { EMAIL_RE }

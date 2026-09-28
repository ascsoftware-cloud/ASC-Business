const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escape anything a business owner or customer typed before it goes into markup. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]!)

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

const dateTime = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

export const fmtDate = (iso: string): string => dateTime.format(new Date(iso))
export const fmtDay = (iso: string): string => dateOnly.format(new Date(iso))

/** Value for an <input type="datetime-local"> in the user's own time zone. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (s: string): string => new Date(s).toISOString()

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'my-business'
}

/** Turn typed text into paragraphs. Always escapes. */
export const paragraphs = (s: string): string =>
  s
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

/** Only allow web, mail and phone links. Returns '' when the value is not usable. */
export function safeUrl(raw: string): string {
  const t = raw.trim()
  if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t
  if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/|$|\?)/i.test(t)) return `https://${t}`
  return ''
}

export const isHex = (s: string): boolean => /^#[0-9a-f]{6}$/i.test(s)

function channel(c: number): number {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** White or near-black, whichever reads better on the given brand colour (WCAG contrast). */
export function readableOn(hex: string): string {
  const l = luminance(hex)
  const white = 1.05 / (l + 0.05)
  const dark = (l + 0.05) / (luminance('#10201c') + 0.05)
  return white >= dark ? '#ffffff' : '#10201c'
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

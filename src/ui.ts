export type Handler = (el: HTMLElement, ev: Event) => void

const registry: Record<string, Handler> = {}

export const register = (actions: Record<string, Handler>): void => {
  Object.assign(registry, actions)
}

/** One delegated listener for the whole app. Markup uses data-action and data-submit. */
export function bind(root: HTMLElement): void {
  root.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!el || !root.contains(el)) return
    registry[el.dataset.action!]?.(el, ev)
  })
  root.addEventListener('submit', (ev) => {
    const form = ev.target as HTMLFormElement
    const name = form.dataset.submit
    if (!name) return
    ev.preventDefault()
    // Let the redraw that follows a save go ahead; it is skipped while a field has focus.
    if (form.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
    registry[name]?.(form, ev)
  })
}

let region: HTMLElement | null = null

export function toast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  if (!region) {
    region = document.createElement('div')
    region.className = 'toasts'
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    document.body.append(region)
  }
  const item = document.createElement('p')
  item.className = `toast toast-${kind}`
  item.textContent = message
  region.append(item)
  setTimeout(() => item.remove(), 4500)
}

export const formData = (form: HTMLFormElement): FormData => new FormData(form)

export const str = (data: FormData, key: string): string => String(data.get(key) ?? '').trim()

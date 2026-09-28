import { emailLink, signIn, signOut, signUp } from './cloud.ts'
import { go } from './router.ts'
import { formData, register, str, toast } from './ui.ts'
import { esc } from './util.ts'
import { site } from './content.ts'

const shell = (title: string, body: string): string => `
    <a class="skip" href="#start-main">Skip to Main Content</a>
    <header class="masthead">
      <div class="wrap bar">
        <a class="brand" href="#/"><span translate="no">${esc(site.brand)}</span></a>
        <a class="btn btn-quiet" href="#/">Back to Site</a>
      </div>
    </header>
    <main id="start-main" class="wrap start" tabindex="-1">
      <h1>${title}</h1>
      ${body}
    </main>`

export function renderLogin(params: URLSearchParams): string {
  const sent = params.get('sent')
  if (sent) {
    return shell(
      'Check Your Email',
      `<p class="lead">${
        sent === 'confirm'
          ? 'We sent you a link to confirm your account. Open it on this device and you will land in your dashboard.'
          : 'We sent you a sign-in link. Open it on this device and you will land in your dashboard.'
      }</p>
      <p><a class="text-link" href="#/login">Back to Sign In</a></p>`,
    )
  }

  const signup = params.get('mode') === 'signup'
  return shell(
    signup ? 'Create Your Account' : 'Sign In',
    `<p class="lead">${
      signup
        ? 'One account for your business app. Then we set up your app in three answers.'
        : 'Sign in to manage your app.'
    }</p>
    <form class="panel stack" data-submit="auth" data-mode="${signup ? 'signup' : 'signin'}">
      <div class="field">
        <label for="l-email">Email</label>
        <input id="l-email" name="email" type="email" required autocomplete="email" spellcheck="false" inputmode="email">
      </div>
      <div class="field">
        <label for="l-pass">Password${signup ? ' <span class="muted">(at least 8 characters)</span>' : ''}</label>
        <input id="l-pass" name="password" type="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? 'new-password' : 'current-password'}">
      </div>
      <div class="row-actions">
        <button class="btn" type="submit">${signup ? 'Create Account' : 'Sign In'}</button>
        ${signup ? '' : '<button class="btn btn-quiet" type="button" data-action="emailLink" data-from="l-email">Email Me a Sign-In Link</button>'}
      </div>
      <p>${
        signup
          ? 'Already have an account? <a class="text-link" href="#/login">Sign in</a>'
          : 'New here? <a class="text-link" href="#/login?mode=signup">Create an account</a>'
      }</p>
    </form>`,
  )
}

const busy = (form: HTMLFormElement, on: boolean): void => {
  form.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = on))
}

register({
  auth: async (form) => {
    const f = form as HTMLFormElement
    const d = formData(f)
    const email = str(d, 'email')
    const password = String(d.get('password') ?? '')
    busy(f, true)
    try {
      if (f.dataset.mode === 'signup') {
        const ready = await signUp(email, password)
        // With email confirmation on, there is no session yet; the auth listener takes over once they click the link.
        if (!ready) go('/login?sent=confirm')
      } else {
        await signIn(email, password)
      }
      // A session now exists: main.ts loads the account and the route guards send them on.
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not sign in.', 'error')
      busy(f, false)
    }
  },

  emailLink: async (el) => {
    const input = document.getElementById(el.dataset.from ?? '') as HTMLInputElement | null
    if (!input?.value.trim() || !input.checkValidity()) {
      toast('Enter your email address first.', 'error')
      input?.focus()
      return
    }
    try {
      await emailLink(input.value.trim())
      go('/login?sent=link')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the link.', 'error')
    }
  },

  signOut: async () => {
    try {
      await signOut()
      go('/')
    } catch {
      toast('Could not sign out. Try again.', 'error')
    }
  },
})

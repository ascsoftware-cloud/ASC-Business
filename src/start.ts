import { flush, mutate } from './store.ts'
import type { Industry } from './store.ts'
import { go } from './router.ts'
import { industries, industryList, sampleContent } from './templates.ts'
import { formData, register, str } from './ui.ts'
import { esc, isHex, slugify } from './util.ts'
import { site } from './content.ts'

export function renderStart(): string {
  return `
    <a class="skip" href="#start-main">Skip to Main Content</a>
    <header class="masthead">
      <div class="wrap bar">
        <a class="brand" href="#/"><span translate="no">${esc(site.brand)}</span></a>
        <a class="btn btn-quiet" href="#/">Back to Site</a>
      </div>
    </header>
    <main id="start-main" class="wrap start" tabindex="-1">
      <h1>Set Up Your App</h1>
      <p class="lead">Three answers, then you can edit everything. We add sample content for your type of business.</p>
      <form class="panel stack" data-submit="createBusiness" autocomplete="off">
        <div class="field">
          <label for="s-name">Business name</label>
          <input id="s-name" name="name" required maxlength="60" placeholder="Karoo Coffee Roasters…">
        </div>
        <div class="field">
          <label for="s-industry">What kind of business is it?</label>
          <select id="s-industry" name="industry">
            ${industryList.map((i) => `<option value="${i.key}">${i.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="s-color">Brand colour</label>
          <input id="s-color" name="color" type="color" value="#0a6650" class="color-input">
        </div>
        <div><button class="btn" type="submit">Create My App</button></div>
      </form>
    </main>`
}

register({
  createBusiness: async (form) => {
    const d = formData(form as HTMLFormElement)
    const industry = str(d, 'industry') as Industry
    const name = str(d, 'name')
    const color = str(d, 'color')
    mutate((s) => {
      s.business = {
        name,
        slug: slugify(name),
        industry,
        tagline: industries[industry]?.tagline ?? '',
        color: isHex(color) ? color : '#0a6650',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        hours: '',
      }
      Object.assign(s, sampleContent(industry))
    })
    // In cloud mode this is the moment the app is created. The dashboard is already open behind the
    // redraw above; wait so its link shows the final address. A failure is reported and retried by the store.
    await flush()
    go('/dashboard?welcome=1')
  },
})

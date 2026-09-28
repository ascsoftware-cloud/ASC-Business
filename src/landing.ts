import { cloudEnabled } from './cloud.ts'
import { audience, closing, faq, hero, how, included, local, nav, site, why } from './content.ts'

const mailto = (subject: string) => `mailto:${site.email}?subject=${encodeURIComponent(subject)}`

const brand = `<span translate="no">${site.brand}</span>`

export function renderLanding(): string {
  return `
<a class="skip" href="#main">Skip to Main Content</a>

<header class="masthead">
  <div class="wrap bar">
    <a class="brand" href="#top" aria-label="${site.brand.replace(' ', ' ')}, back to top">${brand}</a>
    <nav aria-label="Main">
      <ul class="nav-links">
        ${nav.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}
      </ul>
    </nav>
    <a class="btn btn-quiet" href="#/dashboard">${cloudEnabled ? 'Sign In' : 'Open Dashboard'}</a>
  </div>
</header>

<main id="main">
  <section class="hero wrap" id="top" aria-labelledby="hero-h">
    <p class="eyebrow">${hero.eyebrow}</p>
    <h1 id="hero-h">${hero.title}</h1>
    <p class="lead">${hero.lead}</p>
    <div class="actions">
      <a class="btn" href="#/start">${hero.cta}</a>
      <a class="text-link" href="${hero.secondary.href}">${hero.secondary.label}</a>
    </div>
  </section>

  <section class="section wrap" id="why" aria-labelledby="why-h">
    <h2 id="why-h">${why.title}</h2>
    <div class="why-grid">
      ${why.points
        .map(
          (p, i) => `
        <div class="why-item ${i === 0 ? 'why-lead' : ''}">
          <h3>${p.title}</h3>
          <p>${p.body}</p>
        </div>`,
        )
        .join('')}
    </div>
  </section>

  <section class="section section-tint" id="included" aria-labelledby="inc-h">
    <div class="wrap included">
      <div class="included-head">
        <h2 id="inc-h">${included.title}</h2>
        <p>${included.intro}</p>
      </div>
      <dl class="term-list">
        ${included.items.map((i) => `<div><dt>${i.term}</dt><dd>${i.detail}</dd></div>`).join('')}
      </dl>
    </div>
  </section>

  <section class="section wrap" id="who" aria-labelledby="who-h">
    <h2 id="who-h">${audience.title}</h2>
    <ul class="who-grid">
      ${audience.items.map((a) => `<li><h3>${a.name}</h3><p>${a.body}</p></li>`).join('')}
    </ul>
  </section>

  <section class="section section-tint" id="how" aria-labelledby="how-h">
    <div class="wrap">
      <h2 id="how-h">${how.title}</h2>
      <ol class="how-list">
        ${how.steps.map((s) => `<li><h3>${s.verb}</h3><p>${s.body}</p></li>`).join('')}
      </ol>
    </div>
  </section>

  <section class="section wrap" id="local" aria-labelledby="local-h">
    <div class="included">
      <div class="included-head">
        <h2 id="local-h">${local.title}</h2>
      </div>
      <dl class="term-list">
        ${local.points.map((p) => `<div><dt>${p.term}</dt><dd>${p.detail}</dd></div>`).join('')}
      </dl>
    </div>
  </section>

  <section class="section section-tint" id="faq" aria-labelledby="faq-h">
    <div class="wrap faq">
      <h2 id="faq-h">${faq.title}</h2>
      <div class="faq-list">
        ${faq.items.map((f) => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}
      </div>
    </div>
  </section>

  <section class="closing wrap" aria-labelledby="close-h">
    <h2 id="close-h">${closing.title}</h2>
    <p>${closing.body}</p>
    <a class="btn" href="${mailto(closing.ctaSubject)}">${closing.cta}</a>
  </section>
</main>

<footer class="site-foot">
  <div class="wrap foot-inner">
    <span>&copy; ${site.year} ${brand}</span>
  </div>
</footer>
`
}

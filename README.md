# ASC Business

A Subsplash-style app builder for any South African SME, delivered as a web app. A business owner sets up a branded app in minutes and shares it with a link. Customers open it on their phone.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and production build into dist/
```

## Surfaces

| Route | What it is |
|---|---|
| `#/` | Marketing page (copy in `src/content.ts`) |
| `#/start` | Setup: name, business type, brand colour. Adds editable sample content |
| `#/dashboard` | Owner dashboard: overview, notifications, news, events, forms and enquiries, links, preview, settings |
| `#/a/<slug>` | The customer app: Home, News, Events, Alerts, Contact. Themed with the owner's brand colour |

## How it is built

Vite and TypeScript, no framework. Pages are functions that return HTML strings, with one delegated event listener (`data-action`, `data-submit`) in `src/ui.ts`. Everything a person types goes through `esc()` before it reaches markup.

| File | Job |
|---|---|
| `src/store.ts` | State, persistence, subscribe. The only file that knows where data lives |
| `src/templates.ts` | Sample content per business type |
| `src/manage.ts` | Dashboard pages for notifications, news, events, forms, links, plus their actions |
| `src/dashboard.ts` | Dashboard shell, overview, preview, settings |
| `src/app.ts` | The customer app |
| `src/landing.ts`, `src/content.ts` | Marketing page and its copy |

## Current limits

- **Data lives in the browser** (`localStorage`). An app only works on the device that built it, and there are no accounts. Moving to a backend (for example Supabase, as ASC Manager uses) means replacing `load` and `save` in `src/store.ts`, plus adding sign-in for the dashboard and a public read endpoint for the customer app.
- **Notifications are in-app.** They appear on the Alerts tab and as a browser notification while the app is open. True push to a closed app needs a service worker, a push service and a server.
- **Not yet installable as a PWA.** Customers can use "Add to Home Screen" from the browser menu, but there is no manifest or offline support.
- Items marked `CONFIRM` in `src/content.ts` are commitments only ASC Software can verify (contact address, rand invoicing, support, pricing).

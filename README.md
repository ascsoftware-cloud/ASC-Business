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
| `src/store.ts` | State, persistence, subscribe. The only file that decides where data lives (browser or cloud) |
| `src/templates.ts` | Sample content per business type |
| `src/manage.ts` | Dashboard pages for notifications, news, events, forms, links, plus their actions |
| `src/dashboard.ts` | Dashboard shell, overview, preview, settings |
| `src/app.ts` | The customer app |
| `src/landing.ts`, `src/content.ts` | Marketing page and its copy |

## Turning on accounts and cloud storage (Supabase)

Without any settings the app keeps everything in the browser, so it runs with no setup. With Supabase settings it becomes a real multi-device product: owners sign in, and customers open the app from any phone.

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql` and run it. It is safe to run again.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings, API).
4. In **Authentication > URL Configuration**, set the Site URL to where the app is hosted, and add `http://localhost:5173` to the redirect URLs for local work. Email confirmation is on by default; turn it off under Authentication > Providers > Email if you want instant sign-up while testing.
5. `npm run dev`. The landing page now says **Sign In**, `#/login` handles accounts, and `#/a/<slug>` works on any device.

How it fits together:

| Piece | What it does |
|---|---|
| `supabase/schema.sql` | Tables `apps`, `submissions`, `subscribers`; row level security; four functions customers call |
| `src/cloud.ts` | The only file that talks to Supabase |
| `src/store.ts` | Same `get` / `mutate` API as before. In cloud mode it saves the owner's content to `apps.data` a moment after each change, and syncs enquiries |
| `src/published.ts` | What customers see: the published app fetched by slug and re-checked every 15 seconds (5 in the dashboard preview) |
| `src/login.ts` | Sign in, create account, email a sign-in link |

Access rules: owners can only read and write their own rows. Signed-out customers never touch the tables. They can read a published app, send a form the app actually has, and turn notifications on or off, all through functions that validate the request. Scheduled notifications stay hidden from customers until their time, even if the owner's browser is closed. `supabase/schema.sql` has the details.

## Current limits

- **Notifications are in-app.** Customers see them on the Alerts tab within about 15 seconds and get a browser notification while the app is open. True push to a closed app needs a service worker, a push service and a server.
- **Not yet installable as a PWA.** Customers can use "Add to Home Screen" from the browser menu, but there is no manifest or offline support.
- **One app per account**, and its web address is fixed when it is created (a number is added if the name is taken).
- **Two tabs, one account:** the last save wins. Enquiries and subscribers refresh every 20 seconds.
- **Spam:** a form takes at most 200 enquiries an hour per app, but there is no captcha and subscriber counts can be inflated by anyone who scripts the API.
- **Data created in local mode is not migrated** when Supabase is switched on. It stays in that browser.
- **The cloud path was tested against a stand-in for Supabase and the schema against a local Postgres, not against a live Supabase project.** Run through sign-up, create, edit, customer view and form submit once on your project before relying on it.
- Items marked `CONFIRM` in `src/content.ts` are commitments only ASC Software can verify (contact address, rand invoicing, support, pricing).

import { newId } from './store.ts'
import type { Business, EventItem, Field, FormDef, Industry, LinkItem, Post, State } from './store.ts'

interface Template {
  label: string
  tagline: string
  posts: { title: string; body: string; pinned?: boolean }[]
  event: { title: string; daysAhead: number; hour: number; location: string; description: string }
  form: { name: string; extra: { label: string; type: Field['type']; required: boolean }[] }
  links: { label: string; url: string }[]
}

export const industries: Record<Industry, Template> = {
  gym: {
    label: 'Gym or Studio',
    tagline: 'Train with people who show up.',
    posts: [
      { title: 'Welcome to Our New App', body: 'Class times, cancellations and member notices now live here.\n\nTurn on notifications so you never miss a schedule change.', pinned: true },
      { title: 'New Saturday Class Schedule', body: 'From this weekend, our Saturday classes start at 07:30. Book early, spaces are limited.' },
    ],
    event: { title: 'Saturday Bootcamp', daysAhead: 5, hour: 7, location: 'Main studio', description: 'All levels welcome. Bring water and a towel.' },
    form: { name: 'Book a Trial Class', extra: [{ label: 'Preferred class', type: 'text', required: false }] },
    links: [{ label: 'Class timetable', url: 'https://example.com/timetable' }],
  },
  salon: {
    label: 'Salon or Spa',
    tagline: 'Look good, feel better.',
    posts: [
      { title: 'Book Straight From the App', body: 'Use the booking form to request your next appointment. We confirm by message.', pinned: true },
      { title: 'Midweek Special', body: 'Book a Tuesday or Wednesday slot and get 10% off any treatment.' },
    ],
    event: { title: 'Bridal Open Day', daysAhead: 12, hour: 10, location: 'In salon', description: 'Meet our stylists and plan your wedding look.' },
    form: { name: 'Request an Appointment', extra: [{ label: 'Treatment', type: 'text', required: true }, { label: 'Preferred day and time', type: 'text', required: false }] },
    links: [{ label: 'Price list', url: 'https://example.com/prices' }],
  },
  restaurant: {
    label: 'Restaurant or Coffee Shop',
    tagline: 'Good food, every day.',
    posts: [
      { title: 'Today’s Specials', body: 'See what the kitchen is cooking today. Updated every morning.', pinned: true },
      { title: 'We Are Open Late on Fridays', body: 'Kitchen stays open until 21:00 on Fridays. Come hungry.' },
    ],
    event: { title: 'Braai Night', daysAhead: 6, hour: 18, location: 'Courtyard', description: 'Live music and a set braai menu. Booking recommended.' },
    form: { name: 'Book a Table', extra: [{ label: 'Number of guests', type: 'text', required: true }, { label: 'Date and time', type: 'text', required: true }] },
    links: [{ label: 'Full menu', url: 'https://example.com/menu' }],
  },
  school: {
    label: 'School or Aftercare',
    tagline: 'Clear updates for busy parents.',
    posts: [
      { title: 'Term Dates and Closures', body: 'Term dates and public holiday closures are listed here. Check back for updates.', pinned: true },
      { title: 'Reminder: Fee Statements', body: 'Statements go out on the 25th. Contact the office if anything looks wrong.' },
    ],
    event: { title: 'Parent Evening', daysAhead: 14, hour: 18, location: 'School hall', description: 'Meet the teachers and hear about the term ahead.' },
    form: { name: 'Contact the Office', extra: [{ label: 'Learner name and grade', type: 'text', required: true }] },
    links: [{ label: 'Fee information', url: 'https://example.com/fees' }],
  },
  estate: {
    label: 'Estate or Body Corporate',
    tagline: 'News and notices for residents.',
    posts: [
      { title: 'Planned Water Maintenance', body: 'Water will be off on Thursday between 09:00 and 13:00 while the main valve is replaced.', pinned: true },
      { title: 'Levy Statements', body: 'Monthly levy statements are available from the managing agent.' },
    ],
    event: { title: 'Annual General Meeting', daysAhead: 21, hour: 18, location: 'Clubhouse', description: 'All owners are invited. Agenda to follow.' },
    form: { name: 'Report a Maintenance Issue', extra: [{ label: 'Unit or street address', type: 'text', required: true }] },
    links: [{ label: 'Estate rules', url: 'https://example.com/rules' }],
  },
  clinic: {
    label: 'Clinic or Practice',
    tagline: 'Care you can reach easily.',
    posts: [
      { title: 'Practice Hours', body: 'Our opening hours are listed on the Contact tab. Call us for urgent matters.', pinned: true },
      { title: 'Flu Vaccinations Available', body: 'Book your flu vaccination before the season starts.' },
    ],
    event: { title: 'Health Screening Day', daysAhead: 10, hour: 9, location: 'At the practice', description: 'Blood pressure, glucose and cholesterol checks.' },
    form: { name: 'Request a Callback', extra: [{ label: 'Reason for calling', type: 'textarea', required: false }] },
    links: [{ label: 'Book online', url: 'https://example.com/book' }],
  },
  retail: {
    label: 'Shop or Retail',
    tagline: 'Fresh stock, honest prices.',
    posts: [
      { title: 'New Stock In Store', body: 'Come and see what just arrived. Follow this feed for weekly specials.', pinned: true },
      { title: 'Weekend Special', body: 'Show this post at the till and get 10% off on Saturday.' },
    ],
    event: { title: 'Customer Appreciation Day', daysAhead: 9, hour: 9, location: 'In store', description: 'Specials, tasting tables and giveaways all day.' },
    form: { name: 'Product Enquiry', extra: [{ label: 'Product you are looking for', type: 'text', required: true }] },
    links: [{ label: 'Online shop', url: 'https://example.com/shop' }],
  },
  other: {
    label: 'Other Business',
    tagline: 'Stay in touch with us.',
    posts: [
      { title: 'Welcome to Our App', body: 'News, events and ways to reach us, all in one place.', pinned: true },
    ],
    event: { title: 'Open Day', daysAhead: 10, hour: 10, location: 'Our premises', description: 'Come and meet the team.' },
    form: { name: 'Get in Touch', extra: [] },
    links: [{ label: 'Our website', url: 'https://example.com' }],
  },
}

export const industryList = (Object.keys(industries) as Industry[]).map((k) => ({
  key: k,
  label: industries[k].label,
}))

function atHour(daysAhead: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** Sample content for a new business, all of it editable or deletable. */
export function sampleContent(industry: Industry): Pick<State, 'posts' | 'events' | 'forms' | 'links'> {
  const t = industries[industry]
  const now = Date.now()
  const posts: Post[] = t.posts.map((p, i) => ({
    id: newId(),
    title: p.title,
    body: p.body,
    pinned: p.pinned ?? false,
    createdAt: new Date(now - i * 86_400_000).toISOString(),
  }))
  const events: EventItem[] = [
    {
      id: newId(),
      title: t.event.title,
      date: atHour(t.event.daysAhead, t.event.hour),
      location: t.event.location,
      description: t.event.description,
    },
  ]
  const field = (label: string, type: Field['type'], required: boolean): Field => ({
    id: newId(),
    label,
    type,
    required,
  })
  const forms: FormDef[] = [
    {
      id: newId(),
      name: t.form.name,
      fields: [
        field('Your name', 'text', true),
        field('Phone number', 'tel', true),
        field('Email', 'email', false),
        ...t.form.extra.map((f) => field(f.label, f.type, f.required)),
        field('Message', 'textarea', false),
      ],
    },
  ]
  const links: LinkItem[] = t.links.map((l) => ({ id: newId(), ...l }))
  return { posts, events, forms, links }
}

export const blankBusiness = (): Business => ({
  name: '',
  slug: '',
  industry: 'other',
  tagline: '',
  color: '#0a6650',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  hours: '',
})

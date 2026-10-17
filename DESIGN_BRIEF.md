# Government Project Tracker (GPT) — Design Brief

> Purpose: feed this document to an AI design tool (v0, Figma AI, Lovable, etc.) to redesign or iterate on the UI.

## 1. What the product is

**Government Project Tracker** is a public-accountability platform for government bodies. It tracks publicly funded construction/development projects — budgets in Nigerian Naira (₦), organized by Local Government Area (LGA) — across their lifecycle from creation to completion.

Three audiences:

1. **The public** — browse projects, budgets, and progress by LGA (transparency portal, no login)
2. **Contractors** — log in to submit progress updates, milestones, and documents for assigned projects
3. **Government staff** — Government Admins/Officers manage projects and users; M&E (Monitoring & Evaluation) Officers review contractor submissions, approve/reject them, and generate reports

Key domain concepts:

- **Project**: name, description, LGA (17 of them), category (Transportation, Healthcare, Water & Sanitation, Education, Housing), budget (₦), status, progress %, start/end dates, assigned contractor, milestones
- **Project statuses**: `NOT_STARTED`, `IN_PROGRESS`, `NEAR_COMPLETION`, `COMPLETED`, `DELAYED`, `ON_HOLD`, `CANCELLED`
- **Submission**: contractor's progress report on a milestone — M&E officers approve/reject
- **Notification**: real-time alerts (new submission, submission reviewed) via WebSocket
- **17 LGAs**: Aba North, Aba South, Arochukwu, Bende, Ikwuano, Isiala Ngwa North, Isiala Ngwa South, Isuikwuato, Obi Ngwa, Ohafia, Osisioma, Ugwunagbo, Ukwa East, Ukwa West, Umuahia North, Umuahia South, Umu Nneochi

## 2. User roles & post-login destinations

| Role | Lands on | Can access |
|---|---|---|
| `GOVERNMENT_ADMIN` | `/dashboard` | Everything incl. create projects/contractors/M&E officers |
| `GOVERNMENT_OFFICER` | `/dashboard` | Dashboard, projects, contractors, reports, analytics, map, progress |
| `ME_OFFICER` | `/me/dashboard` | M&E review queue + shared pages |
| `CONTRACTOR` | `/contractor/dashboard` | Own dashboard, project detail, map, settings |
| Public (no login) | `/`, `/public` | Landing page + transparency portal |

## 3. Current design system

### Palette (Tailwind, exact hexes)

Primary brand = `primary` = Tailwind `sky` blue scale:

```
primary-500 #0ea5e9   primary-600 #0284c7   primary-700 #0369a1   primary-800 #075985   primary-900 #0c4a6e
```

Green accent (verified/active indicators): Tailwind `green` scale (`#22c55e` etc.)

Status semantic colors:

| Status | Classes (light mode) | Look |
|---|---|---|
| COMPLETED | `bg-green-100 text-green-800` | green pill |
| IN_PROGRESS | `bg-yellow-100 text-yellow-800` | amber pill |
| DELAYED | `bg-red-100 text-red-800` | red pill |
| NOT_STARTED | `bg-gray-100 text-gray-800` | gray pill |

Stats-card accent colors: blue, green, yellow, red, purple, orange — used as left-border accent + gradient icon tile.

Backgrounds: light mode `bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50`; dark mode `from-gray-900 via-gray-800 to-gray-900`. Dark mode is `class`-based (`dark:` variants, toggle in header), currently partially implemented.

### Typography

- Font: **Inter** (Google Fonts, weights 300–800)
- Page titles: `text-4xl font-extrabold` with gradient text (`from-primary-600 to-primary-800` clipped)
- Section headings: `text-lg font-semibold` / `text-xl font-bold`
- Body: `text-base`/`text-sm`; stat values `text-4xl font-extrabold`; labels `text-[10px] font-bold uppercase tracking-widest`

### Shape, shadow, motion

- Cards: `rounded-2xl`, `border border-gray-100`, `shadow-md → hover:shadow-xl`, `p-6`
- Buttons: `rounded-xl px-6 py-3`, gradient fills, `hover:-translate-y-0.5` lift, `transition-all duration-300`
- Nav items: `rounded-xl`, active = `bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg scale-105`
- Icons: **lucide-react**, `h-5 w-5` standard
- Micro-motion: fade-in 0.5s, slide-up 0.3s, icon scale-on-hover, blur-3xl gradient blobs behind stat cards
- Component classes defined globally: `.btn-primary` (blue gradient), `.btn-secondary` (white/outline), `.btn-success` (green gradient), `.card`, `.status-badge` + status variants

## 4. Layout structure

Two shells:

**A. App shell** (all authenticated pages): fixed left sidebar `w-64` + top header + scrollable `<main>` (lg:ml-64, p-8).

- **Sidebar**: gradient logo bar (`from-primary-600 to-primary-800`, white rounded "GPT" mark) → user card (rounded-2xl avatar w/ green online dot, name, role pill) → nav (Dashboard, Projects, Contractors, M&E Reports, Analytics, Map View, Settings) → "Quick Actions" section → footer ("© 2025 Kreatix Technologies"). Mobile: hamburger + overlay slide-in.
- **Header**: sticky, `bg-white/80 backdrop-blur-lg` — left: big gradient page title + welcome subtitle; right: search input, dark-mode toggle, notification bell (dropdown w/ unread badge), user avatar dropdown (Profile Settings, Preferences, Clear Cache, Sign Out).

**B. Public shell** (`/` and `/public`): standalone, no sidebar — own header/footer.

## 5. Page inventory

### `/` — Home (public landing)
Sticky white header (logo, "Public Portal" link, Login + Register buttons). Dark-blue `bg-primary-800` hero: huge headline "Tracking Public Projects Together", tagline, project-search input, **demo nav buttons (yellow)** — these are leftover dev shortcuts, should be removed in redesign. Right side: hand-drawn **SVG map of project areas** in a white card (colored polygons, labeled). Below: 4-stat row (hardcoded: 324 projects, 17 LGAs, ₦2.4B, 45+ contractors — should become live data), 4 feature cards (Real-time Tracking, Transparent Reporting, Multi-role Access, Secure Platform), dark footer w/ quick links + contact.

### `/public` — PublicPortal (no login)
Blue `bg-primary-600` header "Public Transparency Portal". Search + filters (category, LGA dropdowns). Live stats from `/api/public/stats`. Project cards grid: name, LGA badge, status pill, budget ₦, progress bar, contractor, dates; click → detail modal.

### `/dashboard` — Dashboard (admin/officer)
4 `StatsCard` row (Total Projects / Active / Total Budget ₦ / Contractors w/ verified count; colored icon tiles, trend badges). 2 charts (Recharts: bar + pie of projects by status). Below: `RecentProjects` table (2/3 width) + right column: Quick Links buttons (role-gated) + **hardcoded Recent Activity feed** (placeholder — should become real audit data).

### `/projects`, `/projects/:id`, `/projects/new`
List: filterable table/cards of projects w/ status pills, budget, progress bars. Detail: tabs/sections — overview, milestones w/ progress tracker, submissions, documents, contractor info. New: multi-section form (admin only).

### `/contractors`, `/contractor/dashboard`, `/contractors/new`
Contractor directory w/ verification badges, performance stats (`/contractors/:id/performance`: completion rate, on-time %, rating). Contractor's own dashboard: assigned projects, milestone submission forms, upload documents, submission history w/ review status.

### `/me/dashboard` — M&E officer
Review queue: pending contractor submissions → `ReportDetailModal` to inspect + approve/reject w/ comments. Stats on reviews.

### `/reports`
Report generation form (type, filters, role-scoped) + list of generated reports w/ `GeneratedReportModal` snapshot viewer and authenticated file download.

### `/analytics`
KPI cards + Recharts charts: projects by status/LGA/category, budget distribution, monthly trend, contractor performance leaderboard.

### `/map`
Project map view — currently a stylized/static representation; candidates for real geo (projects carry LGA, not lat/lng — a redesign could group by LGA choropleth or add coordinates).

### `/progress` — ProgressMeasurement
Pick a project → milestone checklist, progress % tracking, submission history (`ProgressTracker` component computes metrics from real data).

### `/settings`
Profile (name, image upload — public-uploaded avatar renders w/o auth), password change, theme preference.

## 6. Component inventory

`StatsCard` (accent-border + gradient icon tile + trend badge), `ProjectStatusChart` (Recharts bar/pie), `RecentProjects` (table), `ProgressTracker`, `NotificationCenter` (bell + dropdown, Socket.IO live updates), `SignInModal` (centered card modal: email+password, show/hide, error banner), `ReportDetailModal` (submission review), `GeneratedReportModal` (report snapshot), `ContractorDetailModal`, `ProtectedRoute`, loading skeletons/spinners, `react-hot-toast` notifications.

## 7. What a redesign should fix / keep

**Keep:** Inter + sky-blue brand, rounded-2xl cards w/ subtle borders, status pill system, sidebar+header app shell, dark-mode variant, ₦ formatting, LGA-centric organization.

**Fix (known weaknesses):**
- Home hero has yellow "Demo Navigation" dev buttons and hardcoded stats/map — replace w/ real `/api/public/stats` and a better visual
- `Recent Activity` on Dashboard is hardcoded placeholder data
- Header search input is decorative (not wired)
- Sidebar has `console.log` debug residue; dark-mode coverage is inconsistent (some components missing `dark:` variants)
- Map page uses stylized shapes, not real geography
- No empty-states designed for a fresh DB (currently live w/ 0 projects — every page shows zeros)
- 17-LGA list is hardcoded in PublicPortal; should come from data
- Login is a modal on Home — consider a dedicated `/login` route page
- Bundle is one ~1MB chunk; code-split per page during redesign

## 8. Suggested prompts for the design tool

- "Redesign a government transparency dashboard. Sidebar+topbar shell, Inter font, sky-blue (#0ea5e9–#075985) brand, rounded-2xl cards, status pills (green/yellow/red/gray), Nigerian Naira amounts, dark mode. Pages: admin dashboard w/ 4 KPI cards + charts, projects table, project detail w/ milestone timeline, contractor submission inbox for M&E review, public project portal w/ LGA filter + map, report generator, analytics w/ Recharts."
- "Design a public transparency landing page for a Nigerian state project tracker: hero w/ LGA map motif, live stats strip, searchable project grid."

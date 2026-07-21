# Design Tokens

Extracted from the Figma **"Design System"** file (`88muDL6Toh6RC9PnwNtzpk`), library page, frame **node `30:2`** ("Colors / Typography / Spacing & Layout / Components"). Applied in [`src/index.css`](../src/index.css) via Tailwind v4's `@theme`.

Update this file and `index.css` together if the library changes — don't let them drift.

## Colors

The dark neutral palette is custom (not a Tailwind default scale) — defined as theme tokens, used as `bg-background`, `text-muted`, `border-border`, etc.

| Token | Hex | Figma name | Use |
|---|---|---|---|
| `background` | `#0A0A0A` | Background | Page canvas |
| `surface` | `#141414` | Surface | Cards / panels |
| `input` | `#1F1F1F` | Input | Form field background |
| `border` | `#2A2A2A` | Border | Borders / separators |
| `mid` | `#3D3D3D` | Mid | Placeholders / icons |
| `subtle` | `#4D4D4D` | Subtle | Very secondary text |
| `muted` | `#888888` | Text Secondary | Subtitles / labels |
| — | `#FFFFFF` | Text Primary | Use Tailwind's built-in `white` — no custom token |

**Status/severity colors are Tailwind's own defaults — no custom tokens needed:**

| Meaning | Tailwind class | Hex (confirmed matches Figma) |
|---|---|---|
| Sin mora / al día / activo | `green-500` | `#22C55E` |
| Mora baja | `yellow-500` | `#EAB308` |
| Mora media | `orange-500` | `#F97316` |
| Mora crítica / fallido | `red-500` | `#EF4444` |

## Typography

All type sizes below are custom tokens (`--text-*` in `index.css`) since none match Tailwind's default type scale. Font is Inter throughout (loaded via Tailwind's default sans stack — confirm a webfont import is added if Inter isn't already available system-wide).

| Token | Size | Figma name | Weight used | Example |
|---|---|---|---|---|
| `h1` | 28px | H1 | Light | "Inicia sesión" |
| `kpi` | 24px | KPI Value | Light | "$84,320" |
| `page-title` | 22px | Page Title | Light | "Dashboard" |
| `card-title` | 15px | Card Title | Medium | "Ana Gómez" |
| `body` | 13px | Body / Nav, Body Medium | Regular or Medium | "Accede a tu panel de cobranza" |
| `small` | 12px | Small | Regular | "¿Olvidaste tu contraseña?" |
| `label` | 11px | Label, Caption | Medium (label, often tracked+uppercase) or Regular (caption) | "CORREO ELECTRÓNICO" |
| `meta` | 10px | Meta / Subtitle | Regular | "+ 12 este mes" |
| `section-label` | 9px | Section Label, Badge / Tag | Medium, tracked, uppercase | "ESTADO DEL SISTEMA — SOLO ADMIN" |
| `control` | 14px | *(not a named library row — used inline on every input/button in the Login component)* | Regular / Semibold | Input values, button labels |

## Spacing

The entire spacing scale in the library (4/8/12/16/20/24/32/40/64px) is exactly Tailwind's default 4px-based scale (`1`=4px ... `16`=64px). **No custom spacing tokens — just use standard Tailwind spacing utilities.**

| px | Tailwind | Figma label |
|---|---|---|
| 4 | `1` | Gap mínimo |
| 8 | `2` | Gap items |
| 12 | `3` | Gap secciones |
| 16 | `4` | Padding card |
| 20 | `5` | Padding card + |
| 24 | `6` | Entre secciones |
| 32 | `8` | Padding main |
| 40 | `10` | Padding main (variant) |
| 64 | `16` | Padding canvas |

Border radius throughout is `4px` — Tailwind's default `rounded` (not `rounded-md`/`rounded-lg`).

## Components catalogued in the library (not all built yet)

Seen on frame `30:2` but not needed until a later phase — noted here so we don't have to re-fetch the screenshot each time:

- **Buttons**: primary (white bg / `background`-colored text, e.g. "Entrar"), secondary/dark (e.g. "Cancelar", "Pausar", "Activar", "Exportar"), outline (e.g. "Ver detalle")
- **Nav item**: active = white bg + `background` text; inactive = `muted` text, `surface` hover — already applied in `Sidebar.tsx`
- **KPI card**: `surface` bg, big number (`kpi` token) + `meta`-sized delta line
- **Role badge**: small pill, `ADMIN` / `COBRADOR`, uppercase `section-label`
- **Avatar**: circular, initials centered (e.g. "AG", "AC")
- **CronJob indicator**: status dot + label + Pausar/Activar button (used for the WhatsApp cron controls — Phase 5/9)
- **Status badges** (client/loan state): `Activo`, `En mora`, `Pagado`, `Congelado` — colored per the severity table above
- **Data table**: `Nombre / Estado / Acciones` columns, pagination
- **Confirm dialog**: modal card, e.g. "Desactivar cliente" with Cancelar/Confirmar
- **File upload dropzone**: dashed border, "Arrastra tu .xlsx aquí" — Excel import, Phase 8
- **Form panel**: e.g. "Nuevo cliente" — Phase 3
- **WhatsApp message preview bubble** — Phase 5/9
- **Message status badges**: `Entregado`, `Leído`, `Pendiente`, `Fallido` — Phase 5

## Screens reviewed so far

| Phase | Figma node | Status |
|---|---|---|
| 2 — Login (desktop) | `16:2` | Built — `features/auth/LoginPage.tsx` |
| 2 — Login (tablet/mobile) | *(not reviewed yet)* | Pending |
| 3 — F-10 Clientes (desktop 1440) | `40:3` | Built — `features/clients/ClientsListPage.tsx` |
| 3 — F-11 Nuevo cliente (modal) | `40:282` | Built — `features/clients/ClientForm.tsx` |
| 3 — F-12 Editar cliente (modal) | `40:383` | Built — `features/clients/ClientForm.tsx` (shared with F-11) |
| 3 — F-13 Desactivar (dialog) | `40:484` | Built — `features/clients/DeactivateClientDialog.tsx` |
| 3 — F-14 Detalle cliente (desktop 1440) | `40:554` | Built (partial — see gaps below) — `features/clients/ClientDetailPage.tsx` |

## Note on brand text

The Figma frames display "CobranzaApp", but confirmed with the client: the product name is **Collectify**. `LoginPage` and `Sidebar` use "Collectify" instead of matching the Figma text literally — everything else (colors, spacing, type, layout) still follows the design exactly.

## Known design/backend gaps

Standing rule from the client: build against the *real, implemented* backend contract, not the mockup. Where Figma shows something the backend doesn't support, drop it. Where the backend requires something Figma doesn't show, add it. Logged here every time it comes up, phase by phase.

**Phase 3 — Clientes**

| Figma shows | Backend reality | What we built |
|---|---|---|
| "Nombre completo" single field | `Client` entity has separate `firstName` / `lastName` columns | Two fields: Nombre + Apellido |
| No cédula field on the client form | `documentNumber` is a required column on `Client` | Added a Cédula field (required) — client explicitly asked for this: *"en el caso de la cédula, agrégalo"* |
| Correo electrónico field | No email column on `Client` | Dropped |
| Dirección field | No address column on `Client` | Dropped |
| Estado dropdown on the create/edit form | Status isn't settable via `POST`/`PATCH /clients` — it's derived from `deletedAt` (soft delete only, via `DELETE /clients/:id`) | Dropped from the form; status is shown as a read-only badge, changed only via the Desactivar action |
| "Préstamos" and "Última actividad" columns in the clients table | No loans endpoint exists yet (Phase 4) | Dropped both columns |
| "#" row-number column | Not a backend field | Added — purely a display sequence computed from `meta.page`/`meta.limit`, client-side only |
| Celular shown unformatted (`+573205704455`) | Stored/validated as-is by the backend | Added `lib/format.ts#formatPhoneNumber` — display-only, e.g. `+57 320 570 4455` |
| ~~"Todos" filter tab~~ (RESOLVED) | `GET /clients`'s `isActive` was a strict boolean (default `true`), no "both" mode | Initially dropped, but the client pushed back — without "Todos" the Estado column reads as redundant (every row in a filtered tab shows the same badge). Fixed at the source instead of working around it: `QueryClientsDto.isActive` now also accepts the literal string `'all'`, and `ClientsService.findAll` skips the `deletedAt` filter entirely when it sees that value. Fully backward compatible — omitted still defaults to `true` (active only), existing tests untouched. New unit test added in `clients.service.spec.ts`. |
| "Importar Excel" button | Excel import is explicitly Phase 8 scope | Dropped for now, revisit in Phase 8 |
| Sidebar/header show the user's full name | `GET /auth/me` returns only `{id, email, role}` — no `fullName`, even though the `User` entity has one | Sidebar shows email instead |
| Detail/edit page reachable for any client row | `ClientsService.findOne()` calls `findOneBy({id})` without `withDeleted: true`, so `GET/PATCH /clients/:id` 404 for soft-deleted clients. There's also no reactivate/restore endpoint anywhere in the API | Inactive rows show "Sin acciones disponibles" instead of Ver detalle/Editar/Desactivar — worth raising with the backend team, since inactive clients are currently a dead end (visible in the list, but nothing can be done with them) |
| F-14 detail page: KPI stats grid (Préstamos totales, Monto prestado, En mora, Mensajes enviados) + "Préstamos del cliente" table | None of this data or these endpoints exist yet — arrives with Phase 4 (loans) and Phase 7 (dashboard aggregates) | Replaced with a single placeholder note: "Los préstamos de este cliente se mostrarán aquí a partir de la Fase 4" |

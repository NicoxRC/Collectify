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
| 4 — F-16/17 Préstamos (desktop 1440) | `52:95` | Built — `features/loans/LoansListPage.tsx` |
| 4 — F-18 Nuevo préstamo (modal) | `52:415` | Built — `features/loans/LoanForm.tsx` |
| 4 — F-19 Detalle préstamo (desktop 1440) | `52:537` | Built (partial — see gaps below) — `features/loans/LoanDetailPage.tsx` |
| 4 — F-20 Registrar pago (modal) | `52:765` | Built, matches exactly — `features/installments/RegisterPaymentDialog.tsx` |
| 4 — F-22 Cambiar estado (dialog) | `52:945` | Built (replaced with a single confirmation — see gaps below) — `features/loans/MarkAsPaidDialog.tsx` |
| 4 — F-21 Mensaje manual de WhatsApp | *(not reviewed — client flagged it as likely a later phase)* | Deferred to Phase 5/9 |

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
| Figma doesn't show sort order explicitly | `ClientsService.findAll` defaulted to `client.createdAt DESC` (newest client first) | **Backend change (added later, after Phase 4 shipped), client request:** changed the default order to alphabetical, ascending, by `firstName` then `lastName`. Two issues found and fixed along the way, both confirmed empirically by the client testing real names: (1) case — Postgres text order is case-sensitive by default, so an inconsistently-capitalized "andrés" landed after "Zapata" — fixed with `LOWER()`. (2) accents/ñ — this Postgres instance compares text by raw UTF-8 byte value (no locale-aware collation configured), and accented characters are multi-byte, so they always sort after every plain ASCII letter — "José" landed after everything, and "Ñoño" sorted after all the O's instead of near the N's. Fixed with `TRANSLATE()`, folding accented characters to their plain equivalent for sort purposes only (doesn't touch the stored/displayed name). Same `addSelect`-with-alias approach as the Préstamos numeric sort fix, for the same reason (TypeORM's orderBy chokes on raw expressions containing a dot). |
| ~~"Todos" filter tab~~ (RESOLVED) | `GET /clients`'s `isActive` was a strict boolean (default `true`), no "both" mode | Initially dropped, but the client pushed back — without "Todos" the Estado column reads as redundant (every row in a filtered tab shows the same badge). Fixed at the source instead of working around it: `QueryClientsDto.isActive` now also accepts the literal string `'all'`, and `ClientsService.findAll` skips the `deletedAt` filter entirely when it sees that value. Fully backward compatible — omitted still defaults to `true` (active only), existing tests untouched. New unit test added in `clients.service.spec.ts`. |
| "Importar Excel" button | Excel import is explicitly Phase 8 scope | Dropped for now, revisit in Phase 8 |
| Sidebar/header show the user's full name | `GET /auth/me` returns only `{id, email, role}` — no `fullName`, even though the `User` entity has one | Sidebar shows email instead |
| Detail/edit page reachable for any client row | `ClientsService.findOne()` calls `findOneBy({id})` without `withDeleted: true`, so `GET/PATCH /clients/:id` 404 for soft-deleted clients. There's also no reactivate/restore endpoint anywhere in the API | Inactive rows show "Sin acciones disponibles" instead of Ver detalle/Editar/Desactivar — worth raising with the backend team, since inactive clients are currently a dead end (visible in the list, but nothing can be done with them) |
| F-14 detail page: KPI stats grid (Préstamos totales, Monto prestado, En mora, Mensajes enviados) + "Préstamos del cliente" table | None of this data or these endpoints exist yet — arrives with Phase 4 (loans) and Phase 7 (dashboard aggregates) | Replaced with a single placeholder note: "Los préstamos de este cliente se mostrarán aquí a partir de la Fase 4" |

**Phase 4 — Préstamos / Cuotas**

Every backend change below was announced to the client before being made, per their standing instruction for this phase.

| Figma shows | Backend reality | What we built |
|---|---|---|
| "Nombre" column in the Préstamos table | `GET /loans` returned bare `Loan` rows — no client name, only `clientId` | **Backend change (announced, applied):** `LoansService.findAll` now `leftJoinAndSelect`s `client` and returns a new `LoanSummary` shape (`clientFullName`, plus the three fields below) instead of raw `Loan[]`. Additive only — `Loan`'s own shape is untouched, `LoanDetail` (single-loan fetch) deliberately does *not* carry `clientFullName` since that page always already knows the client. |
| "Saldo" (outstanding balance), "Cuotas" (paid/total), "Días mora" columns | None of these were computed anywhere — only per-installment `overdueDays`/`interest`/`totalDue` existed, and only on read | **Backend change (announced, applied):** `LoansService.findAll` now aggregates each loan's installments (via the existing `enrichInstallment` helper — no formula duplicated) into `outstandingBalance`, `installmentsPaid`, and `overdueDays` (max across the loan's pending installments). Still calculated on every read, never stored. |
| Búsqueda / search box | `GET /loans` had no `search` param | **Backend change (announced, applied):** added `search` to `QueryLoansDto`, matched via `ILIKE` against `client.firstName`/`client.lastName`/`loan.promissoryNoteNumber` in `LoansService.findAll`. |
| Figma doesn't show sort order explicitly | `LoansService.findAll` defaulted to `loan.createdAt DESC` (newest loan first) | **Backend change (announced, applied), client request:** changed the default order to match how physical pagarés are already filed — by `promissoryNoteNumber`, ascending. No interactive column sorting added — client explicitly scoped this to just the default order for now. Since `promissoryNoteNumber` is free text (allows values like `"#743"`), a plain text order compared it character-by-character and put `"101"` before `"2"`; fixed by stripping non-digits and ordering by the numeric value instead (`NULLIF(regexp_replace(...), '')::bigint`, `NULLS LAST`), with the plain text order kept as a secondary tiebreaker. |
| "Rango de fechas" filter | No date-range param on `GET /loans`, and it wasn't clear which date (disbursed? due?) it meant | Dropped — not backed, and ambiguous even if it were |
| Top-right "ADMIN" role pill on the Préstamos page | Redundant with the sidebar's own role badge | Dropped |
| "Enviar mensaje" quick action per row | WhatsApp messaging is Phase 5/9 scope | Dropped for now |
| F-18 "Nuevo préstamo": no N° de pagaré or Tasa de interés fields shown | Both are required, non-nullable columns on `Loan` (`promissoryNoteNumber`, `interestRate`) | Added both fields — the form can't submit without them |
| F-18: single "Fecha de vencimiento" field | `POST /loans` doesn't accept a due date at all — it derives every installment's due date from `disbursedAt` + `installmentFrequency` server-side | **Updated per client request:** initially dropped in favor of "Fecha de inicio" (`disbursedAt`), the literal field the API takes. The client pushed back — the physical pagaré already has each installment's due date written on it, so typing "fecha de inicio" means reverse-computing a disbursement date from what's on the paper. Repurposed the field instead: the form now asks for the *first installment's* due date, and derives `disbursedAt` client-side (one period earlier — `features/loans/dueDateMath.ts`, mirroring the backend's own month/day arithmetic) before submitting. `POST /loans`'s contract is unchanged; only what the form asks the admin to type changed. |
| F-18: no per-installment amount breakdown | `installmentAmounts: number[]` is required and must sum to `principalAmount` exactly (±0.01) — the API does **not** auto-split | Added a dynamic amount-per-installment breakdown with an auto-split helper ("Repartir en partes iguales") and live sum validation, so the common case (equal installments) is a single click, and uneven schedules are still possible |
| Client asked to edit a loan's total amount and payment schedule after creation | `PATCH /loans/:id` only allows `interestRate`/`description` — changing the principal or schedule would leave already-generated installments inconsistent, and the existing Refinance flow (closes the old loan, opens a new linked one) already covers "the debt changed") | **Deferred, by the client's own choice** (`AskUserQuestion`: "Dejarlo para más adelante") — raised as a real conflict rather than silently loosening the PATCH validation; revisit as its own phase, likely alongside Refinance |
| F-19 detail page: only shows "Historial de pagos" + WhatsApp log | Phase 4's own scope explicitly requires showing each installment's `overdueDays`/`interest`/`totalDue` "exactly as returned by GET /loans/:id" | Added a "Cuotas" table above Historial de pagos, with a per-row "Pagar" action — not in Figma, but there's no other place in this design to show it |
| F-19: "Log de mensajes WhatsApp" section | Phase 5/9 scope | Replaced with a one-line placeholder, same pattern as the Fase 3 client-detail page |
| F-19: "Historial de pagos" | `GET /loans/:id/payments` didn't exist — only registering a payment did | **Backend change (announced, applied):** added `LoansService.getPayments` + `GET /loans/:id/payments` |
| F-20 "Registrar pago": simple header, no installment picker | `POST /installments/:id/payments` is per-installment — there's no loan-level "pay whatever's next" endpoint | No gap in the dialog itself (matches Figma exactly), but the *caller* has to pick an installment: the top "Registrar pago" button and the list page's quick "Pago" action both auto-target the oldest pending installment (matching Figma's simplicity); the new Cuotas table also offers a "Pagar" action per row for precision |
| F-22 "Cambiar estado": 4-way picker (Al día / Pagado / En mora / Congelado) | "Al día"/"En mora" aren't stored states at all — derived from `overdueDays` on every read (`docs/DATABASE.md`) — and "Congelado" doesn't exist anywhere on the backend | **Backend change (announced, applied):** added `LoansService.markAsPaid` + `POST /loans/:id/mark-as-paid` (admin-only), which closes the loan and marks its remaining pending installments paid, for the one real use case (client paid outside the system, e.g. cash). The dialog itself is a single confirmation instead of a 4-way picker — three of Figma's four options don't correspond to any real backend action. Raised via `AskUserQuestion`; client chose "build everything except Congelado," and this single-confirmation shape is how "Al día"/"En mora" being non-settable was resolved in the end |

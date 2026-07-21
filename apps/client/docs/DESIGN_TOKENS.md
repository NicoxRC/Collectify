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

## Note on brand text

The Figma frames display "CobranzaApp", but confirmed with the client: the product name is **Collectify**. `LoginPage` and `Sidebar` use "Collectify" instead of matching the Figma text literally — everything else (colors, spacing, type, layout) still follows the design exactly.

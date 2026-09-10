# whid10 portfolio page — plan

Working doc for `ruck.dev/whid10/`: an anonymized, dataless, static walkthrough of the
whid 10-year anniversary museum (`../webapp/packages/webapp`). Sections below marked
`[write]` are placeholders for prose; nothing in them is final copy.

---

## 1. Constraints that shape everything

| Fact | Consequence |
| --- | --- |
| ruck.dev is flat HTML + one CSS file + vanilla JS, served by GitHub Pages (CNAME), no build step. | Keep it that way. Hand-write `whid10/index.html`, `whid10/whid10.css`, `whid10/whid10.js`. No Tailwind, no Sass, no bundler. |
| Format (decided): **one page**, laid out like a long blog post, scrolling top to bottom, theme rotating section by section. | Every exhibit is a `<section data-theme>` in one HTML file. No sub-routes, no tabs, no per-exhibit pages. The sticky nav only scrolls within the page. |
| The museum is desktop-only (Chrome/Firefox on Windows) and shows a mobile warning. | The portfolio must be responsive and work in Safari. Every motif you port needs a mobile fallback. |
| The museum's theme system is CSS custom properties keyed on `[data-theme="x"]`, applied to `<html>` per route. | Port 1:1 by putting `data-theme` on each `<section>` instead. This is the whole trick. |
| Everything interesting in the museum is gated on Discord OAuth because it is member data. | The page is text and screenshots; member data is scrubbed by hand at screenshot time (section 8). |
| Five other humans contributed (git: 777 you, 142 + 22 one contributor, 13 another, 5 another, 5 Claude). | Frame it as "my work on a team project"; a credits/team beat is needed. |

---

## 2. Architecture: theme-per-section

The museum's `globals.css` (764 lines) has ten `[data-theme]` blocks. Each defines
`--background`, `--foreground`, `--primary`, `--font-header`, `--font-text`,
`--font-accent`, `--radius`, `--text-font-size`, plus nested element rules
(`h1..h6`, `p`, `a`, `ul`). CSS nesting is native in 2026 browsers, so these blocks
copy over nearly verbatim.

What changes:

1. **Root rules move to the section.** The museum sets font-family, font-size,
   background and color on `:root`. On the portfolio, one rule applies them to any
   `[data-theme]` element:
   ```css
   [data-theme] {
     background: var(--background);
     color: var(--foreground);
     font-family: var(--font-text);
     font-size: var(--text-font-size, 18px);
   }
   ```
2. **`rem` sizes become `em`.** Museum headings are sized in `rem` against a root
   whose font-size is the theme's `--text-font-size` (16/18/20px). On the portfolio
   the root is fixed, so convert heading sizes inside theme blocks to `em` or px.
3. **Drop the Tailwind-only lines.** `@theme`, `@custom-variant`, `@utility`,
   `@layer base`, `@apply`, `@source`, and the MUI chart overrides go away.
   `--color-*` aliases are not needed.
4. **Replace `@property` and `round(..., 1lh)` only if Safari complains.** Both are
   supported in current Safari; test before rewriting.
5. **Default theme** (neutral near-black, Geist) becomes the "hallway" theme for
   connective tissue and the non-exhibit sections.

Bootstrap must not load on this page. Its reboot styles would fight nine themes.

---

## 3. Fonts

Four sources. The Adobe one is the only real risk.

| Source | Families needed | How to load on ruck.dev | Notes / risk |
| --- | --- | --- | --- |
| **Adobe Fonts — new web project for ruck.dev** (decided) | `rl-horizon` (messages), `calvino` + `filmotype-yukon` (gamers), `corsario-variable` (dub accent), `ltc-goudy-text-pro` (lowlights), `fayte-pixel-hard` (you), `canada-type-gibson` (login, gift shop). Seven families. | Create the project with `ruck.dev` and `localhost` as domains, then `<link rel="stylesheet" href="https://use.typekit.net/<new-kit>.css">`. Include only the weights/styles the themes use: Gibson 300/400/700 + italics, RL Horizon 400/700 + italics, Calvino 400/700, the rest single-weight. | Cannot self-host (license). Kit stops serving if the Creative Cloud subscription lapses, and a portfolio should outlive that. Write deliberate fallback stacks for every family so the page degrades gracefully. `gamay-variable`, `ltc-flash`, `please-*`, `ltc-goudy-text-pro-shaded` are in the museum kit but unused in `src/` — leave them out. |
| **Google Fonts** (decided: link, no self-hosting) | `Fraunces` (dub body, you body, needs italic + opsz axis), `Jacquard 12`, `Jacquard 24` (you), `Geist`, `Geist Mono` (default theme, lowlights body) | One `fonts.googleapis.com/css2` link with `display=swap`, plus the `preconnect` hints. | Museum uses `next/font`, which self-hosts at build and exposes `--font-fraunces` etc. On the portfolio, the theme blocks reference the family names directly (`"Fraunces"`, `"Jacquard 12"`) instead of those variables. |
| **Fontshare** | `General Sans` variable + italic (bots) | Copy `GeneralSans-Variable.woff2` and `GeneralSans-VariableItalic.woff2` plus `GeneralSans-FFL.txt` into `whid10/fonts/`. Reuse `src/app/font-css/general-sans.css` as-is. | Museum already self-hosts under the same EULA. Keep the license file next to the font. |
| **Mozilla Twemoji** | `Twemoji Mozilla` COLR font | Copy the TTF (1.5 MB) and the `unicode-range`-gated `@font-face` from `twemoji.css`. | Optional. Only pays off if the portfolio renders unicode emoji in museum style. Skip in the first pass. |
| **System fonts** | Palatino Linotype (oc), Footlight MT Light (lowlights hero), Impact/Arial (scran demo) | Nothing to load. | Footlight MT Light is a Windows Office font; it will fall back on Mac. Either accept it or swap the lowlights hero to `ltc-goudy-text-pro`. |

---

## 4. CSS to port

Copy verbatim (after the section-2 edits):

- The nine `[data-theme]` blocks from `globals.css` plus the `:root` defaults.

Hand-port from module files (plain CSS, resolve `&` nesting, drop `composes`):

| Exhibit | File | Motifs worth keeping |
| --- | --- | --- |
| login / home | `HomepageSignedOut.module.scss`, `AnimatedHomepageLogoSlot.module.scss`, `WhidLogo.module.scss` | brand gradient text (`.text`), spinning conic-border button (`.conicButton`, uses `@property`) |
| messages | inline Tailwind on `page.tsx`; shape components | bordered white title card, primary yellow/blue/red shapes; recreate the three geometric shapes as CSS |
| bots | `CherryBlossoms*.module.scss`, `SequenceRoot`, `BotMessage` | light gray canvas, cyan primary, chat-bubble layout, per-bot color tokens (keep the token names, they are not personal data) |
| gamers | `gamers.module.scss` (152 lines) | `.spotlightGradientBackground` (noise + vignette), gold/wood `border-image` frames (needs the 4 frame SVGs), gold/wood placards, `.foldedCorner`, horizontal scroll-snap gallery |
| oc | `oc.module.css` (59 lines) | character-level reveal, growing left border (`round(var(--reveal-height), 1lh)`), paper/teal palette, Word-document chrome |
| dub | `Projected.module.scss` (227 lines), `FilmGrainOverlay.module.scss` | film-gate weave + projector flicker keyframes, grain overlay, quote projection cards |
| lowlights | `lowlights.module.scss` (271 lines) | cardboard background, spotlight gradient, `wiggle`/`vibrate`/`rectangleFunk`/`swingY` keyframes, crimson/gold awards palette, newspaper tokens |
| you / magic | inline; Three.js scene | italic Fraunces body, pixel display headers, purple haze radial gradient. The crystal ball is WebGL and stays out; see section 6. |
| gift shop | ~~`GiftShopHero.module.scss`~~ | Screenshot only (decided 2026-09-09): the shop wall is not rebuilt, only the theme tokens are kept. |

Rough size: ~600 lines of theme tokens copied, ~400 lines of motif CSS ported.

---

## 5. Assets

Safe to copy (UI chrome, no member data), with sizes from `public/`:

| Path | Size | Use |
| --- | --- | --- |
| `logos/*.svg` (8 exhibit logos) | 184 KB | section headers, nav |
| `stamps/*.png` (7) | 32 KB | ticket progress motif, nav icons |
| `ticket/ticket.svg` + `holographic-mask.webp` | 244 KB | the "Your ticket" section |
| `gamers/*.svg` (frames, line chart) | 68 KB | frames |
| ~~`gift-shop/*.webp`~~ | — | Not copied; the gift shop is carried by a screenshot (2026-09-09). |
| `personal-exhibit/01..10-*.png`, `Back.png` | 19 MB total | tarot archetypes (Chatter, Hermit, Shredder ...) — not personal data, but resize to ~400px wide and webp before shipping |
| `lowlights/Gradient For Lowlights.webp`, `cardboard/`, `TheGildedDumpies Logo.svg`, `pixilated_car.png` | part of 3.7 MB | hero + slide deck feel |
| `bots/cherry-blossoms/` sprites | part of 3.8 MB | petals |
| `../illustrator/SVG/OC Card.svg` | — | oc title card |

Do **not** copy: anything under `private/` or `public/media/` (user content),
`public/members/avatars`, `public/bots/avatars` (server-specific bot avatars),
`public/emoji/*` (custom server emoji), `public/dub/`, `gamers` clips, member
newspaper pages. Bot avatars are a judgment call; the bot names already appear as
CSS token names.

---

## 6. JavaScript: port, fake, or cut

| Behavior | Decision |
| --- | --- |
| Character-by-character reveal (oc) | Port. ~60 lines vanilla with `IntersectionObserver`; it is the exhibit's whole personality. |
| Holographic ticket tilt (`useHolographicTilt`, `useTiltState`) | **Ported** as rAF pointer tilt → CSS variables. Used in "Your ticket", You, and Thank you. `ticket.svg` is fetched and inlined at runtime so the member name renders in the webfont (falls back to `<img>` on `file://`), and the stamp drop is a WAAPI animation. |
| Scramble text (gamers `useScrambleText`) | Port, small. |
| Horizontal scroll-snap gallery (gamers) | CSS only. On mobile, fall back to vertical. |
| Projector flicker, film grain, cherry blossoms glow, lowlights wiggles | CSS only. |
| Cherry blossoms canvas | **Ported** as a canvas-2D petal swarm (`whid10.js`), paused off-screen by `IntersectionObserver`. |
| Bots "on rails" progressive reveal, lowlights slide deck | Bots: staggered bot bubbles, then Wordle speaks in tiles (WordleLetterReveal port: ALBUM scoring, red E on WORDLE starts the glass-crack/explosion glitch, crescendo vignette + pop outline on the second message). Lowlights: intro card, limo, and a cardboard diorama stage (curtains, valances, spotlight, funky title, Dumpy with cycling lines). |
| Messages primary shapes | **Ported.** Pointer handlers + `transitionend` move the three shapes with wrap-around; the triangle uses `DOMMatrix` for its perspective flip. |
| Login logo swap | **Ported.** `setTimeout` scheduler swaps the conic-gradient main logo with the exhibit alternates. |
| Crystal ball vortex sphere (you) | **Port live** (decided). The sphere is self-contained plain Three.js: `vortexShader.ts` + `vortexSharedGlsl.ts` (~200 lines GLSL), `createBiasedSphereGeometry.ts` (93 lines), and `PixelatedSphereRenderPass.tsx` (109 lines, low-res render target blitted with nearest filtering). No drei. Load `three` from cdnjs or jsdelivr via an import map, write ~80 lines of vanilla setup (renderer, camera, clock, resize, `iTime`/fog uniforms), and run it as the section's background canvas. Pause the render loop with `IntersectionObserver` when the section is off-screen. Keep a `prefers-reduced-motion` and WebGL-failure fallback: a static frame captured from the museum. |
| Tarot cards, ticket mesh, intro camera, card selection (you) | **Recording** (decided). These are ~1,300 lines of React Three Fiber and tied to per-user data. Capture a screen recording of the full intro → card selection → ticket stamp with your own account, and play it inline over the live sphere. Mute, loop, `preload="metadata"`, webm + mp4. |
| Confetti | Already on ruck.dev (`scripts/confetti.js`); reuse for the lowlights first-place beat. |

Section entrances: use `animation-timeline: view()` with a `@supports` guard so
sections fade or slide in as they scroll into view without JS.

---

## 7. Seams between themes

Decided: **no repeated ticket seam** between exhibits. Sections cut directly from one
theme to the next, blog-post style. The ticket appears once, as its own short section
right after Messages, where a museum visitor would have earned their first stamp:

- It explains the mechanic: finishing an exhibit hands you your ticket, clicking
  the ticket advances you to the next exhibit, and the ticket carries a stamped
  icon for the exhibit you just finished.
- It shows the holographic ticket with the Messages stamp on it (tilt ported as
  pointer-move to CSS variables), and the row of seven stamps.
- The sticky nav stays plain text links. Stamp icons in the nav are optional polish,
  not a seam.

---

## 8. Anonymization

Decided: the page is text and images, and anonymization happens in the screenshotting
phase, by hand. Nothing on the page reads member data at build time or runtime, so
there is no policy to enforce in the markup or CSS. The only thing the build has to
guarantee is that no museum data files, media, avatars, or emoji are copied into
`whid10/` (see section 5's exclusion list).

---

## 9. Page skeleton

Order follows `exhibit-order.md`. Each block lists: theme, the museum element to
echo, the ported motifs available, and what the prose slot covers.

### 0. Front door — `data-theme="login"`
- Echo: "Hi! Welcome to whid, the whid 10-year anniversary museum." with the
  animated logo slot and the spinning conic-gradient sign-in button, disabled.
- Motifs: brand gradient text, conic button, near-black canvas, Gibson italic headers.
- `[write]` What whid is (a friend group's Discord server turning ten). What the
  museum is (a personalized, one-night-only style web experience for members).
  Why it required login, and therefore why this page is dataless.
- `[write]` Your role in one line. Team size. Timeline (Oct 2025 – Apr 2026 build,
  public launch 26 Apr 2026, ~970 commits, 531 of them in April).

### 1. Messages — `data-theme="messages"`
- Echo: the bordered white title card with "Exhibit 1 / Messages!" and the three
  geometric shapes (blue triangle, red square, yellow circle) moving around it.
- Motifs: paper white, RL Horizon italic headers, yellow/blue/red intent palette.

### Your ticket — `data-theme="default"`
- Echo: the holographic ticket, tilting under the pointer, with the Messages stamp
  freshly applied. The seven stamp icons in a row beside it.
- `[write]` How exhibit completion works: the ticket is handed back at the end of
  each exhibit, clicking it advances to the next one, and it collects a stamp per
  exhibit finished.
- `[write]` What is behind it: localStorage progress, per-member name and role color
  on the ticket, generated stamp placement.
- `[write]` Exhibit concept: the server's message history as a time capsule.
- `[write]` What was built: stat cards (top channels, emoji, threads, pings,
  attachments, links), member-count and messages-per-year graphs, the roleup card.
- `[write]` Illustration: a scrubbed screenshot of one stat card and one graph.

### 2. Bots — `data-theme="bots"`
- Echo: chat-bubble sequence narrated by a bot, revealed on click. One or two
  bubbles with the bot's color token, then a graph frame.
- Motifs: light gray canvas, cyan primary, General Sans light headers, per-bot
  colors, cherry blossom petals, "click to continue" hint.
- `[write]` Exhibit concept: bots as tour guides for bot-usage stats.
- `[write]` What was built: intro video gate, the sequence reveal engine, the
  Wordle glitch effect, ten graph types.

### 3. Gamers — `data-theme="gamers"`
- Echo: dimly lit gallery. Title card in Filmotype Yukon, gold-framed placard, the
  horizontal scroll snap.
- Motifs: stone neutrals, rose spotlight, gold/wood frames and placards, folded
  corner letter, scramble text.
- `[write]` Exhibit concept: a memorial gallery from a fictional foundation.
- `[write]` What was built: 24 stations, Steam data, genre treemap, game mentions,
  game-clip lightboxes, the wine-bottle easter egg.

### 4. Original Content — `data-theme="oc"`
- Echo: the OC Card SVG, then a Word-document frame where text types itself in
  with the growing left border.
- Motifs: paper/teal, Palatino, character reveal, block quotes, embedded media
  frames, audio player chrome.
- `[write]` Exhibit concept: a personal letter about the creative channel.
- `[write]` What was built: the reveal engine, media embeds, the Scrandle game demo.

### 5. The Dub — `data-theme="dub"`
- Echo: a projected title card that weaves and flickers over scrolling film strips
  with grain on top.
- Motifs: warm dark, Fraunces, Corsario accent, projector flicker, film grain,
  quote projections.
- `[write]` Exhibit concept: the group's quarantine-era fan-dub series.
- `[write]` What was built: shuffle lines, editor cards, per-user contribution
  cards, the letters. Cross-link to the transcript pipeline in section 11.

### 6. Lowlights — `data-theme="lowlights"`
- Echo: the crimson/gold "LOWLIGHTS / An Awards Show" card, the limo, then one
  slide from the deck and one newspaper page frame.
- Motifs: cardboard, spotlight, wiggle/vibrate/funk animations, Gilded Dumpies
  logo, newspaper tokens, confetti.
- `[write]` Exhibit concept: an awards show for the most-upvoted posts.
- `[write]` What was built: 28-slide deck, per-member newspapers, superlatives.

### 7. You — `data-theme="magic"`
- Echo: the live pixelated vortex sphere as the section background, pixel display
  header, italic Fraunces, one tarot card (archetype art) tilting via CSS, and the
  recording of the full card-selection experience inline.
- Motifs: radial violet gradient, Jacquard fonts, tarot card frame, ticket stamp,
  the vortex shader itself.
- `[write]` Exhibit concept: a personalized reading from ten archetypes.
- `[write]` What was built: Three.js crystal ball, custom GLSL (caustic, vortex,
  holographic ticket), card selection per user, personal stats pipeline.

### 8. Gift shop — `data-theme="gift-shop"`
- Echo: a screenshot of the shop wall with shelves, hanging shirts, and the rotated
  "sold out!!!" tag. The rebuilt clone was removed on 2026-09-09; only the theme
  tokens and the section chrome stay in code.
- `[write]` Merch designed and sold: shirt designs, order form, payment methods,
  admin order tracking, fulfillment.

### 9. Thank you / outro — default theme
- Echo: stamped ticket, all seven stamps.
- `[write]` Closing, credits, link back to ruck.dev.

---

## 10. Sections not captured by the exhibit list

These are the parts of the project the museum itself never shows a visitor. Slot
them as hallway interludes (default theme) or fold them into the nearest exhibit.

1. **Front door / why it exists** (above, section 0). Privacy-first framing, the
   launch-date gate (`isAccessAllowed`), the mobile warning, the pre-launch view.
2. **Ticket and stamp progression.** Cross-cutting UX: `ExhibitCompletion`,
   holographic ticket with per-member name and role color, localStorage progress
   store, generated stamp placement. It is the museum's navigation model. Covered
   by the "Your ticket" section after Messages (section 9).
3. **Data pipeline.** Discord export from April 2016 onward, incremental PowerShell
   export with watermarks and webhook notifications, the `data` package, ~35 marimo
   notebooks, `exports/` JSON+MD pairs, and the generated typed index
   (`generateIndex.ts`, `watchExports.ts`, `coalesceType.ts`) that lets Next.js
   pages import `@whid10/data-exploration` as plain TypeScript.
4. **Manual data entry and annotation tools.** `dub-processing` (diarized
   transcripts with `SPEAKER_XX` placeholders, per-person annotation tasks,
   `reassociate.py`, timing fixes), `transcript-review` app, `message-review` app,
   `oc-annotator` app, `scran` + `scran-voter` (the Scrandle game and its voting
   backend), member avatar and Steam name mapping scripts. This is the "workflows I
   invented to get it done in time" section.
5. **Design and illustration.** The `illustrator` package: tickets, stamps, tarot
   cards, exhibit logos, gift shop wall, curtains, cherry blossoms, newspaper and
   magazine mockups. The per-exhibit theme system itself (STYLING.md: one design
   system per page, shared interaction fundamentals via shadcn in `@whid10/ui`).
6. **Writing.** `packages/scripts/writing drafts` shows scripted exhibits going
   through V1→V3. Worth a beat on tone and voice per exhibit.
7. **Engineering architecture.** pnpm monorepo (20+ packages), Next.js 16 + React 19
   + React Compiler, Tailwind 4, Convex, NextAuth Discord allowlist (`@whid10/auth`),
   Vercel, header-based theme selection in `proxy.ts`, custom ESLint rule for
   className hydration, biome + husky + lint-staged, Renovate, the
   `minimumReleaseAge` supply-chain gate.
8. **Media security.** `private/` → content-hashed `public/media/` with a typed
   manifest, `X-Robots-Tag: noindex`, `resolveMediaUrl` failing at build time
   (MEDIA_SECURITY_MIGRATION.md). This is the technical half of the privacy story.
9. **Process and velocity.** Monthly commit curve (5 → 94 → 65 → 123 → 531 in
   April), CLAUDE.md conventions, the `/style-review` skill, task files, AI-assisted
   workflow. Be explicit about what was delegated and what was hand-written.
10. **Team.** Six human contributors; who did what at a role level.
11. **Adjacent infrastructure** (optional, one paragraph): `whid-vault` file
    browser on a home server (Hono + JWT), the D&D soundtrack server, the
    `shaders` prototype package, `webapp-prototyping`.
12. **Launch and reception.** Launch day, what broke, aggregate visitor counts if
    you want any number at all, feedback.
13. **Retrospective.** What you would change; what the museum taught you.
14. **Colophon for this page.** How the portfolio page was built, font credits, and
    the anonymization statement.

---

## 11. Work order

1. Adobe Fonts: create the new web project for `ruck.dev` with the seven families
   above. Everything else can proceed while that propagates.
1b. Record the You exhibit (intro, card selection, ticket stamp) with your own
   account while the museum is still deployed. Do this early; it is the one asset
   that cannot be regenerated from the repo alone.
2. `whid10/index.html` with nine empty `<section data-theme>` blocks and the
   hallway interludes; `whid10/whid10.css` with the ported theme blocks; confirm
   fonts render per section on Chrome, Firefox, Safari, and a phone.
3. ~~Port motifs one exhibit at a time.~~ Done (2026-09-08): login logo swap,
   messages shapes, ticket tilt + stamp drop, bots bubbles + petals + glitch, gamers
   frames + scramble, oc Word-doc chrome + typed reveal, dub grain + projector,
   lowlights card/limo/dumpy, you vortex (Three.js r170 via jsDelivr import map),
   ~~gift shop rack + shelves~~ (screenshot only), thank-you stamped ticket.
   Feedback round 2026-09-09: messages shapes at museum sizes without the collage,
   square-cornered ticket, real Wordle tile sequence instead of the invented
   glitch button, full-bleed Word doc, lowlights diorama, stamp fade-in on the
   drop, logo drop/rise swap on the front door.
4. ~~"Your ticket" section.~~ Done, see 3.
5. Copy and compress assets (tarot PNGs first; gift-shop webps are no longer needed).
6. Add a "whid10" button to the ruck.dev homepage and OG tags for the new page.
7. Writing pass into the `[write]` slots.

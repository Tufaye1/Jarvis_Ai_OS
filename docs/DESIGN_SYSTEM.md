# Jarvis AI OS — Design System & Screen Specs

Extracted verbatim from the static design-tool mockup:

- `/Users/eskimibd/Documents/Jarvis AI OS design philosophy/Jervis AI OS.dc.html` (891 lines)
- `/Users/eskimibd/Documents/Jarvis AI OS design philosophy/support.js` (1911 lines — generic runtime, see §7)

The mockup is **not React source**. It is a `x-dc` design-doc export using a custom template
syntax (`sc-if`, `sc-for`, `{{ binding }}`, `onClick="{{ handler }}"`, `style-hover="css"`),
rendered at runtime by `support.js`. Every value below is a literal from the file. The product is
branded **"Jarvis"** in the top-bar wordmark and **"Jervis"** everywhere in body copy and agent
labels; both spellings are reproduced exactly as they appear.

All styling in the mockup is **inline `style` attributes**. There are no classes, no CSS variables,
and no responsive breakpoints. There is one `<style>` block (in `<helmet>`) holding resets,
scrollbar styling, and three `@keyframes`.

---

## 1. Color tokens

### 1.1 Global / surfaces

```css
--bg-canvas:        #EFEFED;  /* html/body background, top bar bg, bottom command-bar strip bg */
--surface-card:     #FFFFFF;  /* all cards, search field, dropzone icon tile, phone frame */
--surface-sunken:   #F7F7F4;  /* agents panel, Content Studio prompt box, dropzone idle bg */
--surface-muted:    #F4F4F0;  /* source chips, meta chips, palette row hover, input pills */
--surface-muted-2:  #F2F2EE;  /* Today-row chips, activity kind badge, card divider (as border) */
--surface-neutral:  #F1F1ED;  /* generic file tint (unknown ext), browser page placeholder */
--surface-hover:    #EAEAE5;  /* chip hover; dropzone bg while dragging */
--surface-hover-2:  #E6E6E2;  /* sidebar nav item hover */
--surface-hover-3:  #E9E9E4;  /* bottom-bar voice button hover */
```

### 1.2 Ink / text

```css
--ink:            #101010;  /* primary text, black buttons, active nav, logo tile, dark panels */
--ink-hover:      #262622;  /* Upload button hover bg; Content Studio output body text */
--ink-body:       #1B1B18;  /* chat answer body copy */
--ink-avatar:     #2A2A27;  /* top-bar avatar circle bg */
--ink-strong:     #3A3A36;  /* bell icon stroke; browser page body copy */
--ink-file-label: #46463F;  /* file-extension text on tinted tiles */
--ink-secondary:  #56564F;  /* inactive sidebar nav, inactive filter chips, browser URL */
--ink-muted:      #6B6B66;  /* meta chips, times, sidebar "Mobile screens", dropzone chips */
--ink-muted-2:    #7A7A74;  /* subtitles, snippets, card summaries, project tab labels */
--ink-faint:      #9A9A96;  /* placeholder text, dates, "4 open · active", search icon stroke */
--ink-eyebrow:    #A8A8A3;  /* ALL-CAPS eyebrow labels, kbd badges, checked-off suggestions */
--ink-placeholder:#B4B4AE;  /* command-palette placeholder text */
--ink-on-dark:    #FFFFFF;
--ink-on-dark-2:  #A9A9A2;  /* planner dark card meta text */
--ink-on-dark-3:  #86867E;  /* planner eyebrow, mobile status bars, voice overlay footer */
--ink-on-dark-4:  #8C8C84;  /* voice overlay phase label */
--ink-heading-ghost: #A9A9A3; /* "Good morning {name}," greeting line (desktop + mobile) */
--ink-os-badge:   #8C8C88;  /* "OS" badge text in logo lockup */
```

### 1.3 Accent & status

```css
--accent:          #F26B21;  /* orange. Logo dot, notification badge, links/link-hover, footnote
                                superscripts, planner rank numbers, "Open in chat →",
                                suggestion dot, upload progress bar (in-flight), voice orb LISTENING */
--accent-deep:     #C0532A;  /* "Today" due-date text on project open tasks */
--success:         #3E8F53;  /* agent ✓ ticks, "Active"/"Reading for you" badge text,
                                running agent dot, completed upload progress bar */
--success-bg:      #E4F1E4;  /* pill background behind --success text */
--warning:         #E0A93F;  /* "Waiting" agent dot */
--voice-thinking:  #F3D06B;  /* voice orb, THINKING phase */
--voice-speaking:  #8FD3A2;  /* voice orb, SPEAKING phase */
--dot-idle:        #C4C4BE;  /* idle agent dot; disabled browser forward arrow */
```

### 1.4 Borders & dividers

```css
--border-card:      #E5E5E1;  /* default 1px card / input / dropzone-tile border */
--border-shell:     #E3E3DF;  /* top-bar bottom border, sidebar right border, tab underline rail,
                                 bottom-bar top border */
--border-chip:      #E2E2DD;  /* inactive filter/action chips, browser nav buttons, phone frame */
--border-button:    #DEDED9;  /* secondary button border, dropzone idle border, "OS" badge,
                                 dashed "+ Add files" border */
--border-tile:      #E9E9E5;  /* small inner tiles (project tiles, generated content, dropzone chips) */
--border-kbd:       #E7E7E3;  /* ⌘K / esc key badges */
--border-hover:     #CFCFC9;  /* hover border on search field, result rows, knowledge cards */
--divider:          #F0F0EC;  /* 1px row separators inside cards; also upload progress track bg */
--divider-2:        #F2F2EE;  /* knowledge-card footer divider */
--checkbox-border:  #D6D6D0;  /* unchecked checkbox border (1.5px) */
--border-planner-dark: #262622; /* row dividers inside the black Top-3 card */
--scroll-thumb:     #DCDCD7;
--switch-track-off: #D8D8D2;  /* defined in logic, no markup consumer (see §6.7) */
```

### 1.5 Pastel tints (quick-action cards + file-type chips)

The same four pastels drive Home quick-action cards, file-extension tiles, source-chip swatches,
and knowledge-card thumbnails.

```css
--tint-blue:    #D8E8F6;  /* "Ask" card; PNG/JPG/JPEG/MP3/WAV; REC (recording/transcript) */
--tint-green:   #DCEFD9;  /* "Research" card; XLS/XLSX */
--tint-yellow:  #FBF0C4;  /* "Create" card; PDF; MD */
--tint-purple:  #E9E0F7;  /* "Plan" card; DOC/DOCX/MP4; CHAT */
--tint-neutral: #F1F1ED;  /* fallback tint for unmapped extensions; WEB, IMG, P (person) */
```

Per-card body-copy colors on the pastel cards (one dark tone matched to each tint):

```css
--on-tint-blue:   #4A5560;
--on-tint-green:  #4A5A48;
--on-tint-yellow: #5A5330;
--on-tint-purple: #504563;
```

Runtime extension → tint map (from the upload handler):

```js
{ PDF:  "#FBF0C4",
  DOC:  "#E9E0F7", DOCX: "#E9E0F7",
  XLS:  "#DCEFD9", XLSX: "#DCEFD9",
  PNG:  "#D8E8F6", JPG:  "#D8E8F6", JPEG: "#D8E8F6",
  MP4:  "#E9E0F7",
  MP3:  "#D8E8F6", WAV:  "#D8E8F6" }
// fallback: "#F1F1ED"
```

### 1.6 One-off tinted panels

```css
--panel-lilac-bg:     #F1EFFA;  /* Research → "From your knowledge" card */
--panel-lilac-border: #E3DEF6;
--panel-amber-bg:     #FDF3E4;  /* Planner → "Blocked" column */
--panel-amber-border: #F5E4CC;
--panel-cream-bg:     #FFF6EC;  /* Browser → "Jervis highlighted 3 passages…" callout */
--panel-cream-border: #F5E0C7;
```

### 1.7 Alpha values (used raw, not tokenized)

```css
rgba(255,255,255,.75)   /* ext badge pill on knowledge-card thumbnail */
rgba(0,0,0,.06)         /* dividers inside tinted panels (lilac / amber) */
rgba(0,0,0,.04)         /* bottom command-bar shadow: 0 2px 10px */
rgba(0,0,0,.07)         /* light phone frame shadow: 0 18px 40px */
rgba(0,0,0,.14)         /* dark phone frame shadow: 0 18px 40px */
rgba(0,0,0,.28)         /* command palette shadow: 0 30px 70px */
rgba(24,24,22,.34)      /* command palette scrim (+ backdrop-filter: blur(3px)) */
rgba(16,16,15,.93)      /* voice overlay scrim (+ backdrop-filter: blur(6px)) */
#000                    /* dark-phone notch pill */
```

---

## 2. Typography

### 2.1 Family

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

```css
font-family: Archivo, "Helvetica Neue", sans-serif;
-webkit-font-smoothing: antialiased;
```

Weights loaded: 400, 500, 600, 700, 800. Weights actually used in markup: **500, 600, 700**
(700 dominates for anything titled; 600 for labels/body-strong; 500 for the chat user bubble and
the two text inputs). No 800 usage in the template.

### 2.2 Scale, by role

| Role | Size | Weight | Letter-spacing | Line-height | Color | Where |
|---|---|---|---|---|---|---|
| Hero / greeting | 40px | 700 | -1.4px | 1.06 | `#A9A9A3` line 1, `#101010` line 2 | Home |
| Hero (mobile) | 27px | 700 | -0.9px | 1.1 | same pair | Mobile home |
| Voice overlay statement | 34px | 600 | -0.9px | 1.24 | `#FFFFFF` | Voice overlay |
| Project title | 34px | 700 | -1.2px | — | `#101010` | Project |
| Page title | 30px | 700 | -1px | (1.14 on Research) | `#101010` | Search / Knowledge / Research / Content Studio / Planner / Agents / Mobile |
| Browser article title | 24px | 700 | -0.7px | — | `#101010` | Browser |
| Mobile voice quote | 23px | 600 | -0.5px | 1.28 | `#FFFFFF` | Mobile voice |
| Screen title (Chat) | 22px | 700 | -0.6px | — | `#101010` | Chat header |
| Content headline | 19px | 700 | -0.4px | 1.3 | `#101010` | Content Studio output |
| Logo wordmark | 17px | 700 | -0.4px | — | `#101010` | Top bar |
| Priority row | 17px | 600 | -0.3px | — | `#FFFFFF` | Planner top-3 |
| Quick-action card title | 16px | 700 | -0.3px | — | `#101010` | Home cards |
| Palette placeholder | 16px | 500 | — | — | `#B4B4AE` | Command palette |
| Card header | 15px | 700 | -0.2px | — | `#101010` | All card titles |
| Body (answer / summary) | 15px | 400 | — | 1.62 | `#1B1B18` (chat) / inherit | Chat, Research, Project summary |
| Mobile card title | 15px | 700 | — | — | `#101010` | Mobile quick actions |
| Body (secondary) | 14.5px | 400 | — | 1.6–1.68 | `#101010` / `#262622` | Search answer, Project summary, Content output |
| Chat user bubble | 14px | 500 | — | — | `#FFFFFF` | Chat |
| Command-bar input | 14px | 500 | — | — | `#101010` | Bottom bar |
| Browser page body | 14px | 400 | — | 1.7 | `#3A3A36` | Browser |
| Nav item | 13.5px | 600 | — | — | `#FFFFFF` active / `#56564F` idle | Sidebar |
| Top-bar search placeholder | 13.5px | 400 | — | — | `#9A9A96` | Top bar |
| Row title / list item | 13.5px | 600–700 | -0.1px on results | — | `#101010` | Today rows, result titles, project tiles, palette rows |
| Subtitle under title | 13.5px | 400 | — | — | `#7A7A74` | Knowledge / Planner / Agents / Mobile subheads |
| Tab label | 13px | 700 active / 600 idle | — | — | `#101010` / `#7A7A74` | Project tabs |
| List row | 13px | 600–700 | — | — | `#101010` | Card rows, knowledge names, chips in Content Studio |
| Callout | 13px | 600 | — | — | `#101010` | Browser highlight callout |
| Card body / summary | 12.5px | 400–600 | — | 1.45–1.55 | `#7A7A74` or `#101010` | Quick-action subtitles, planner rows, agent panel rows, browser chat |
| Button label | 12.5px | 600 | — | — | `#FFFFFF` / `#101010` | Action buttons |
| Chip / filter | 12px | 600 | — | — | `#FFF` active / `#56564F` idle | Filter chips, source chips, format chips |
| Meta / timestamp | 12px | 400 | — | — | `#9A9A96` | Dates |
| Agent label ("Jervis") | 12px | 700 | 0.2px | — | `#101010` | Chat answer header |
| Voice phase label | 12px | 700 | 0.9px | — | `#8C8C84` | Voice overlay |
| Browser eyebrow | 11px | 700 | 0.6px | — | `#A8A8A3` | Browser article |
| Meta chip | 11px | 600–700 | — | — | `#6B6B66` on `#F4F4F0` | Result/project/stage chips |
| kbd badge | 11px | 600 | — | — | `#A8A8A3` + 1px `#E7E7E3` | ⌘K, esc, bar hint |
| Small meta | 11.5px | 400–700 | — | — | `#9A9A96` / `#A8A8A3` / `#F26B21` for links | Timestamps, "Open planner", "Open in chat →" |
| Eyebrow / section label | 10.5px | 700 | 0.7px | — | `#A8A8A3` (`#86867E` on dark) | SOURCES, ACTIONS, JUST ADDED, SUMMARY, INPUT, PROMPT, FORMAT, TONE & LENGTH, OUTPUT, CONTINUE, COMMANDS, EXPLORATIONS, TOP 3 PRIORITIES, ACTIONS ON THIS PAGE, SESSION CHAT, JERVIS' ANSWER |
| Micro eyebrow | 10px | 700 | 0.5px | — | `#A8A8A3` | Agent card HEALTH / QUEUE |
| Micro label | 10px | 700 | — | — | `#46463F` / `#F26B21` | Ext badges, footnote superscripts, source numbers |
| "OS" badge | 10px | 600 | 0.6px | — | `#8C8C88` | Logo lockup |
| Badge count | 9.5px | 700 | — | — | `#FFFFFF` on `#F26B21` | Bell badge |
| Ext tile label (small) | 9.5px | 700 | — | — | `#46463F` | 28–30px file tiles |

`text-wrap: pretty` is set on the long-form paragraphs (chat answer, project summary, research
summary, Content Studio output body).

---

## 3. Spacing, radii, borders

### 3.1 Border radius

```
50%   circles: logo dot, avatars, voice/bell/send buttons, quick-action icon discs, orbs, status dots
42px  phone frames (mobile screens)
20px  Planner black "TOP 3 PRIORITIES" card
18px  DEFAULT CARD RADIUS — every white content card, quick-action cards, dropzone,
      command-palette panel, agent cards, tinted panels
16px  knowledge grid cards; chat user bubble (16px 16px 4px 16px)
14px  bottom command-bar container; agents expandable panel; dropzone icon tile;
      mobile priority strip + mobile input; notch pill
12px  small inner tiles (project tiles, generated-content tiles), browser page placeholder,
      Content Studio prompt box, browser session-chat bubbles (12px 12px 4px 12px /
      12px 12px 12px 4px), browser highlight callout
11px  knowledge-card thumbnail block
10px  top-bar search field, Upload / Connect buttons, palette rows, Content Studio input rows,
      result ext tiles (34px), bottom-bar hint pill
9px   PRIMARY BUTTON + NAV RADIUS — sidebar nav items, action buttons, logo tile,
      source chips, upload ext tile (30px), browser URL bar
8px   filter/format chips, activity kind badge (26px), file ext tile (28px),
      "Mobile screens" footer item, browser nav arrows, scrollbar thumb
7px   status pills ("Active", "Project context on", "Reading for you"), Jervis mini-avatar (20px)
6px   meta chips (3px 7px padding), dropzone suggestion chips, bell badge (radius 8px),
      palette row swatches
5px   checkboxes (17px & 16px), "OS" badge, kbd badges, knowledge card tags,
      ext badge on thumbnail
4px   small color swatches on source chips (15px), Content Studio input dots (14px)
3px   upload progress track + fill; voice bars
```

### 3.2 Borders

- Standard card: `1px solid #E5E5E1`
- Shell rules (top bar / sidebar / tab rail / bottom bar): `1px solid #E3E3DF`
- Row divider inside cards: `1px solid #F0F0EC` (applied as `border-top` on each row, so the first
  row also gets a rule under the card header)
- Divider inside tinted panels: `1px solid rgba(0,0,0,.06)`
- Active tab underline: `2px solid #101010`
- Checkbox: `1.5px solid #D6D6D0`
- Dropzone: `1.5px dashed` — `#DEDED9` idle → `#101010` while dragging
- Dashed "+ Add files, web or a meeting": `1px dashed #DEDED9`
- Browser page placeholder: `1px dashed #DEDED9`

### 3.3 Padding & gaps

```
Page container:      32px 44px 28px   (Home uses 40px 44px 28px; Browser 20px 24px 24px;
                                       Mobile 32px 44px 40px)
Page max-width:      1180px (Home, Project, Knowledge, Planner, Agents)
                     1120px (Research) · 1000px (Search) · 900px (Chat)
                     none   (Content Studio, Browser, Mobile)
Card padding (lg):   22px 24px   (chat answer, research summary, Content Studio output, planner black card)
Card padding (md):   18px 20px   (most cards) · 20px 22px (project summary)
Card padding (sm):   16px 18px   (planner columns, browser side cards, JUST ADDED card)
Card padding (xs):   14px        (knowledge grid cards)
Inner tile padding:  11px 12px
Button padding:      8px 13px (action) · 10px 15px (Upload / Connect a source)
Chip padding:        6px 11px (filters) · 6px 10px (formats) · 6px 10px (source chips: 6px 10px)
Meta chip padding:   3px 7px
Tag padding:         2px 6px
Grid gap:            12px (all card grids) · 8px (inner tiles) · 7px (chip rows) · 6px (tight chips)
Row padding:         10px 0 (list rows) · 9px 0 (checkbox rows / tinted-panel rows)
Section separator:   margin-top 18–20px; padding-top 16px; border-top 1px #F0F0EC
```

### 3.4 Global resets (from the `<helmet>` `<style>`)

```css
html, body { margin:0; padding:0; background:#EFEFED;
             font-family:Archivo,"Helvetica Neue",sans-serif;
             -webkit-font-smoothing:antialiased; }
* { box-sizing:border-box; }
a { color:#101010; text-decoration:none; }
a:hover { color:#F26B21; }
input { font-family:inherit; }
::-webkit-scrollbar { width:10px; height:10px; }
::-webkit-scrollbar-thumb { background:#DCDCD7; border-radius:8px; border:3px solid #EFEFED; }
```

---

## 4. Layout shell

Root: `height:100vh; display:flex; flex-direction:column; background:#EFEFED; color:#101010; overflow:hidden;`

```
┌──────────────────────────────────────────────────────────────── 60px top bar ──┐
│ [224px logo lockup] [flex-1 max-620 ⌘K search]      [voice][bell•5][avatar]     │
├───────────────┬────────────────────────────────────────────────────────────────┤
│ 224px sidebar │  main: flex-1, min-width:0, column                              │
│  nav items    │   ┌── scroll region (flex:1; overflow:auto) ─────────────────┐  │
│  …            │   │  active screen (one sc-if branch)                        │  │
│  EXPLORATIONS │   └──────────────────────────────────────────────────────────┘  │
│  Mobile screens│  ┌── bottom command bar (flex:none) ────────────────────────┐  │
│               │   │  max-width 820, centered, 46px pill                      │  │
└───────────────┴───┴──────────────────────────────────────────────────────────┴──┘
```

### 4.1 Top bar (60px)

`height:60px; flex:none; display:flex; align-items:center; gap:18px; padding:0 18px;
background:#EFEFED; border-bottom:1px solid #E3E3DF;`

**Logo lockup** — fixed `width:224px`, flex, gap 9px (aligns with sidebar width):
- Tile `26×26`, `border-radius:9px`, `background:#101010`, centered dot `9×9`, `border-radius:50%`, `background:#F26B21`.
- Wordmark `Jarvis` — 17px / 700 / `-0.4px`.
- Badge `OS` — 10px / 600 / `0.6px`, color `#8C8C88`, `1px solid #DEDED9`, radius 5px, padding `2px 5px`.

**Search field** — `onClick={openPalette}`:
`flex:1; max-width:620px; height:36px; gap:10px; padding:0 14px; background:#FFFFFF;
border:1px solid #E5E5E1; border-radius:10px; cursor:text; color:#9A9A96; font-size:13.5px;`
hover → `border-color:#CFCFC9`.
- Leading magnifier SVG 15×15, `stroke:#9A9A96`, `stroke-width:1.6` (`circle cx7 cy7 r4.4` + `M10.4 10.4 14 14`).
- Placeholder copy: **"Search everything — projects, files, meetings, people, web"**.
- Trailing kbd badge `⌘K` — `margin-left:auto`, 11px / 600, `#A8A8A3`, `1px solid #E7E7E3`, radius 5px, padding `1px 5px`.

**Right cluster** — `margin-left:auto; gap:8px`:
1. Voice button — `32×32`, circle, `background:#101010`, white mic SVG 14×14, `onClick={openVoice}`.
2. Notification bell — `32×32`, circle, `1px solid #E5E5E1` on `#FFFFFF`, bell SVG 15×15 `stroke:#3A3A36`.
   Badge: absolutely positioned `top:-3px; right:-3px; min-width:15px; height:15px; border-radius:8px;
   background:#F26B21; color:#FFF; font-size:9.5px; font-weight:700;` content **`5`**. No click handler.
3. Avatar — `32×32`, circle, `background:#2A2A27`, `#FFF`, 12px / 700, initial **`H`**. No click handler.

There is an empty slot in the markup immediately before the voice button (the A/B `showAgentsNav`
switch referenced by the logic was removed from the template — see §6.7).

### 4.2 Left sidebar (224px)

`width:224px; flex:none; padding:14px 12px; display:flex; flex-direction:column; gap:2px;
border-right:1px solid #E3E3DF; overflow:auto;`

Nav item shape (identical for every entry):
`display:flex; align-items:center; gap:10px; height:34px; padding:0 10px; border-radius:9px;
font-size:13.5px; font-weight:600; cursor:pointer;` + 16×16 SVG, `stroke:currentColor`, `stroke-width:1.5`.

- **Active**: `background:#101010; color:#FFFFFF`
- **Inactive**: `background:transparent; color:#56564F`
- **Hover**: `background:#E6E6E2` (applied via `style-hover`, so it wins over the active black too)

Order, label, handler, and which `screen` id marks it active:

| # | Label | Handler | Active when `screen ===` | Icon |
|---|---|---|---|---|
| 1 | Home | `goHome` | `home` | house outline |
| 2 | Knowledge | `goKnowledge` | `knowledge` | heart/pin shape |
| 3 | Projects | `goProject` | `project` | folder |
| 4 | Chat | `goChat` | `chat` | speech bubble |
| 5 | Planner | `goPlanner` | `planner` | calendar |
| 6 | Research | `goResearch` | `research` | globe |
| 7 | Content Studio | `goContent` | `content` | pencil |
| 8 | Browser | `goBrowser` | `browser` | browser window |
| 9 | Voice | `openVoice` | never (opens overlay) — always `#56564F` | mic |
| 10 | Agents | `goAgents` | `agents` | robot — **rendered only when `agentsNav` is true** (`sc-if`) |
| 11 | Settings | *(none)* | never — always `#56564F` | gear |

**Footer section** — `margin-top:auto; padding-top:14px; display:flex; flex-direction:column; gap:6px;`
- Label **`EXPLORATIONS`** — 10.5px / 700 / `0.7px`, `#A8A8A3`, `padding:0 10px`.
- Item **`Mobile screens`** — `height:30px; padding:0 10px; border-radius:8px; font-size:12.5px;
  font-weight:600; color:#6B6B66;` hover `background:#E6E6E2`; `onClick={goMobile}`. No icon.

### 4.3 Main content area

`flex:1; min-width:0; display:flex; flex-direction:column;`
- Scroll region: `flex:1; min-height:0; overflow:auto;` — holds the eleven mutually exclusive
  `sc-if` screen branches. Each branch root carries `data-screen-label="…"`.
- Bottom command bar (persistent across every screen): `flex:none; padding:12px 24px 16px;
  border-top:1px solid #E3E3DF; background:#EFEFED;`
  Inner pill: `max-width:820px; margin:0 auto; display:flex; align-items:center; gap:10px;
  height:46px; background:#FFFFFF; border:1px solid #E5E5E1; border-radius:14px;
  padding:0 8px 0 16px; box-shadow:0 2px 10px rgba(0,0,0,.04);`
  - magnifier SVG 16×16 `stroke:#9A9A96`
  - `<input>` bound to `barValue` / `onBarChange` / `onBarKey`, placeholder
    **"Ask Jervis anything, or type a command"**, 14px / 500, transparent bg, no border/outline
  - hint text 11px / 600 `#A8A8A3` = `barHint`: **`⌘K`** when the input is empty, **`↵ to send`** when not
  - mic button `32×32` circle `background:#F4F4F0` (hover `#E9E9E4`), `onClick={openVoice}`
  - send button `32×32` circle `background:#101010`, `color:#FFFFFF`, glyph **`↑`** at 14px,
    `onClick={submitBar}` → navigates to Chat

---

## 5. Per-screen specs

Screens are selected by `state.screen` (string). Values:
`home | chat | search | project | knowledge | research | content | planner | browser | agents | mobile`.
Two overlays (`palette`, `voice`) render on top of any screen.

---

### 5.1 Home — `data-screen-label="Home"`

Container: `padding:40px 44px 28px; max-width:1180px;`

**Greeting** (two lines, 40px / 700 / `-1.4px` / `line-height:1.06`):
1. `Good morning {{ userName }},` — color `#A9A9A3` (`userName` prop default **"Hossain"**)
2. `what should we move forward?` — default ink, `margin-bottom:26px`

**Quick-action grid** — `grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:26px;`
Card: `border-radius:18px; padding:16px; min-height:118px; flex-column; justify-content:space-between;
cursor:pointer;` hover `filter:brightness(0.98)`.
Top: `34×34` white circle holding a 17×17 SVG `stroke:#101010`.
Bottom: title 16px / 700 / `-0.3px`; subtitle 12.5px, `margin-top:2px`, tint-matched color.

| Card | bg | subtitle | subtitle color | onClick |
|---|---|---|---|---|
| Ask | `#D8E8F6` | "Anything across your knowledge" | `#4A5560` | `goChat` |
| Research | `#DCEFD9` | "Web + your files, with sources" | `#4A5A48` | `goResearch` |
| Create | `#FBF0C4` | "Post, report, deck, email" | `#5A5330` | `goContent` |
| Plan | `#E9E0F7` | "Today, in three moves" | `#504563` | `goPlanner` |

**Lower grid** — `grid-template-columns:1.35fr 1fr; gap:12px; align-items:start;`

*Left column (gap 12px):*

**"Today" card** (white, 18px/20px padding):
Header row (baseline, gap 10, mb 12): **Today** 15px/700/`-0.2px` + **Thursday, 30 July** 12px `#9A9A96`.
Rows: `flex; gap:12px; padding:10px 0; border-top:1px solid #F0F0EC` —
time cell `width:46px`, 12px/700 `#6B6B66`; title 13.5px/600; trailing chip 11px/600 `#6B6B66`
on `#F2F2EE`, radius 6, padding `3px 7px`.

| Time | Title | Trailing |
|---|---|---|
| `10:30` | NetBet campaign review | chip "Jervis has a brief ready" |
| `14:00` | DSP onboarding call — Aurora Media | chip "2 open questions" |
| `—` | 5 tasks due · 3 documents added yesterday | link **Open planner** 11.5px/700 `#F26B21` → `goPlanner` |

**"Recent activity" card** — title 15px/700/`-0.2px`, `margin-bottom:4px`; `sc-for` over `activity`
(placeholder count 4). Row: kind badge `26×26` radius 8 on `#F2F2EE`, 10.5px/700 `#6B6B66`;
title 13px/600; `when` 11.5px `#9A9A96` right-aligned.

```js
activity = [
  { kind:"PDF", title:"NetBet July DSP report added",                when:"8m" },
  { kind:"REC", title:"Aurora Media call transcribed — 42 min",      when:"1h" },
  { kind:"IMG", title:"3 screenshots captured from TikTok Ads",      when:"Yesterday" },
  { kind:"WEB", title:"7 pages read for display benchmarks",         when:"Yesterday" },
]
```

*Right column (gap 12px):*

**"Suggestions" card** — header row: **Suggestions** 15px/700/`-0.2px` + a `5×5` `#F26B21` dot, mb 6.
`sc-for` over `suggestions` (count 4). Row: `padding:9px 0; border-top:1px solid #F0F0EC; cursor:pointer;`
`onClick={s.toggle}`.
- Checkbox `17×17`, radius 5, `1.5px solid #D6D6D0`; `background` = `#101010` when done, else `transparent`.
- Tick SVG `10×10` `stroke:#FFFFFF` `stroke-width:2`, `opacity` 1 / 0.
- Label 13px/600; when done `text-decoration:line-through` and `color:#A8A8A3`, else `#101010`.

Labels: `Finish the TikTok report`, `Research competitor CPA`, `Draft the July LinkedIn post`,
`Follow up with Aurora Media`.

**"Projects" card** — title 15px/700, mb 12. `grid-template-columns:1fr 1fr; gap:8px`.
Tile: `1px solid #E9E9E5; border-radius:12px; padding:11px 12px;` hover `border-color:#101010`.
Name 13.5px/700; meta 11.5px `#9A9A96`.
`NetBet — "4 open · active"` (onClick `goProject`) · `DSP — "2 open"` · `Agency — "6 open"` ·
`AI OS — "1 open"`.

---

### 5.2 Chat — `data-screen-label="Chat"` *(build priority)*

Container: `padding:32px 44px 28px; max-width:900px;`

**Header** (`flex`, gap 10, mb 22): title **Chat with NetBet** 22px/700/`-0.6px` + pill
**Project context on** 11.5px/600 `#6B6B66` on `#F2F2EE`, radius 7, padding `4px 8px`.

**User message bubble** — wrapper `display:flex; justify-content:flex-end; margin-bottom:20px;`
Bubble: `background:#101010; color:#FFFFFF; border-radius:16px 16px 4px 16px; padding:12px 16px;
font-size:14px; font-weight:500; max-width:70%;`
Copy: **"How are registrations doing this month?"**

**Assistant answer card** — `background:#FFFFFF; border:1px solid #E5E5E1; border-radius:18px;
padding:22px 24px;`

1. *Attribution row* (`flex`, gap 9, mb 12): mini tile `20×20` radius 7 `#101010` containing a
   `7×7` `#F26B21` dot; label **Jervis** 12px/700/`0.2px`.
2. *Paragraph 1* — 15px, `line-height:1.62`, `color:#1B1B18`, `text-wrap:pretty`:
   > Registrations are up **18%** month over month — 4,120 against 3,490 in June. The lift is almost
   > entirely TikTok: it now carries 41% of registrations at a €6.20 CPA, down from €8.40. Meta is
   > flat and Google display is the drag, with CPA at €14.10 and a 9% share.

   (`18%` is wrapped in `<strong>`.)
3. *Paragraph 2* — same type, `margin-top:12px`:
   > In the 21 July review the team agreed to shift budget away from display if CPA stayed above €12
   > for two weeks. It has.
4. **SOURCES block** — `margin-top:20px; padding-top:16px; border-top:1px solid #F0F0EC;`
   Eyebrow `SOURCES` 10.5px/700/`0.7px` `#A8A8A3`, mb 9.
   Chip row: `flex-wrap:wrap; gap:7px`. Chip: `background:#F4F4F0; border-radius:9px; padding:6px 10px;
   font-size:12px; font-weight:600; cursor:pointer; gap:7px;` hover `background:#EAEAE5`.
   Leading swatch `15×15`, radius 4, tint-colored.

   | Chip label | swatch |
   |---|---|
   | Meeting — 21 July | `#D8E8F6` |
   | DSP report — July | `#DCEFD9` |
   | TikTok campaign export | `#FBF0C4` |
   | Registrations sheet | `#E9E0F7` |

5. **ACTIONS block** — `margin-top:18px; padding-top:16px; border-top:1px solid #F0F0EC;`
   Eyebrow `ACTIONS`, mb 9. Button row `flex-wrap:wrap; gap:8px`.
   - Primary: `background:#101010; color:#FFFFFF; border-radius:9px; padding:8px 13px; 12.5px/600` —
     **"Open the July report"** (no handler in the mockup).
   - Secondary (`1px solid #DEDED9`, radius 9, same padding, hover `border-color:#101010`):
     **"Build the review deck"** → `goContent`, **"Draft the client email"** → `goContent`,
     **"Research display benchmarks"** → `goResearch`.
6. **"Completed by N agents" disclosure** — `margin-top:18px; flex; gap:8px; 12px/600; color:#6B6B66;
   cursor:pointer;` `onClick={toggleAgentsPanel}`. Copy **"Completed by 4 agents"** + caret glyph at
   10px: `▼` collapsed, `▲` expanded.
7. **Expanded panel** (`sc-if agentsPanel`) — `margin-top:10px; background:#F7F7F4; border-radius:14px;
   padding:14px 16px; display:flex; flex-direction:column; gap:8px; animation:jvFade .18s ease both;`
   Each row: `flex; gap:9px; 12.5px/600`, leading `✓` in `#3E8F53`.
   - `✓ Knowledge — read 3 files, 1 meeting transcript`
   - `✓ Memory — recalled the 21 July budget rule`
   - `✓ Research — checked two display CPA benchmarks`
   - `✓ Content — prepared the deck outline in the background`

Note: the answer card is a single static answer; there is no message list, no streaming state, and
no assistant-side input beyond the shared bottom command bar.

---

### 5.3 Search results — `data-screen-label="Search results"`

Container: `padding:32px 44px 28px; max-width:1000px;`

- Eyebrow **"One search. Everything."** 12px/600 `#9A9A96`, mb 8.
- Query heading **`“registrations”`** 30px/700/`-1px`, mb 8 (curly quotes in the copy).
- Filter chips (`gap:7px; flex-wrap:wrap; margin-bottom:22px`). Active: `background:#101010; color:#FFF;
  border-radius:8px; padding:6px 11px; 12px/600`. Inactive: `1px solid #E2E2DD; color:#56564F`, same box.
  Labels: **All 47** (active), **Files 18**, **Meetings 6**, **Conversations 11**, **People 3**, **Web 9**.
- Answer card (white, radius 18, padding `18px 20px`, mb 14): eyebrow **`JERVIS' ANSWER`**;
  body 14.5px / 1.6:
  > Registrations across NetBet are at 4,120 this month, up 18%. TikTok is the driver; display is the drag.
  > **Continue in chat →**

  The trailing sentence is a 700-weight `#F26B21` inline link, `onClick={goChat}`.
- Result rows — `sc-for` over `results` (count 6). Row: white, `1px solid #E5E5E1`, radius 14,
  `padding:14px 16px; margin-bottom:8px; display:flex; align-items:center; gap:14px; cursor:pointer;`
  hover `border-color:#CFCFC9`.
  - Ext tile `34×34`, `flex:none`, radius 10, 10px/700, `color:#46463F`, `background:{r.tint}`, text `{r.ext}`.
  - Middle (`min-width:0`): title 13.5px/700/`-0.1px`; snippet 12px `#7A7A74`, single-line ellipsis.
  - Right (`margin-left:auto; gap:10px`): project chip 11px/600 `#6B6B66` on `#F4F4F0`, radius 6,
    padding `3px 7px`; `when` 11px `#A8A8A3`.

```js
results = [
  { ext:"XLS",  tint:"#DCEFD9", title:"NetBet registrations — July.xls",
    snippet:"4,120 registrations · TikTok 41% share · CPA €6.20", project:"NetBet",   when:"8m" },
  { ext:"REC",  tint:"#D8E8F6", title:"Meeting — campaign review, 21 July",
    snippet:"“if display CPA stays above twelve for two weeks, we move the budget”",
    project:"NetBet", when:"9 days" },
  { ext:"PDF",  tint:"#FBF0C4", title:"DSP performance report — July",
    snippet:"Registrations by channel, CPA trend, creative fatigue notes", project:"DSP", when:"8m" },
  { ext:"CHAT", tint:"#E9E0F7", title:"Conversation — “which creatives beat €7 CPA?”",
    snippet:"Six creators cleared the line; two carried 60% of volume", project:"NetBet", when:"Mon" },
  { ext:"WEB",  tint:"#F1F1ED", title:"Acquisition benchmarks for regulated markets, Q2 2026",
    snippet:"Median registration CPA €7.40 across sampled operators", project:"Research", when:"Yesterday" },
  { ext:"P",    tint:"#F1F1ED", title:"Marek Novak",
    snippet:"NetBet performance lead · 14 shared files · 6 meetings", project:"People", when:"—" },
]
```

---

### 5.4 Project — `data-screen-label="Project — NetBet"`

Container: `padding:32px 44px 28px; max-width:1180px;`

**Title row** (`align-items:flex-end; gap:12px`):
- **NetBet** 34px/700/`-1.2px`
- Status pill **Active** — 12px/600 `#3E8F53` on `#E4F1E4`, radius 7, padding `4px 9px`, `margin-bottom:6px`
- Caption **"No folders. Jervis keeps this organised."** 12.5px `#9A9A96`, `margin-bottom:7px`

**Tab rail** — `display:flex; gap:20px; margin:18px 0 22px; border-bottom:1px solid #E3E3DF;`
Each tab `padding-bottom:10px`. Active (**Overview**): 13px/700 + `border-bottom:2px solid #101010`.
Inactive: 13px/600 `#7A7A74`, hover `color:#101010`.
Order & handlers: Overview *(active, none)* · Chat → `goChat` · Knowledge → `goKnowledge` ·
Tasks → `goPlanner` · Meetings *(none)* · Research → `goResearch` · Browser → `goBrowser` ·
Content → `goContent` · History *(none)*.

**Body grid** — `grid-template-columns:1.4fr 1fr; gap:12px; align-items:start;`

*Left column:*

1. **Summary card** (white, radius 18, `padding:20px 22px`):
   Eyebrow **`SUMMARY — WRITTEN 6 MINUTES AGO`**, mb 10.
   Body 14.5px / 1.62, `text-wrap:pretty`:
   > Q3 acquisition for NetBet across TikTok, Meta and Google display. Registrations up 18% MoM on a
   > €48k monthly budget. The open decision is display: CPA has been above the €12 threshold for two
   > weeks, so the 21 July agreement says the budget moves to TikTok. Draft reallocation is waiting
   > for your approval.

   Buttons (`margin-top:16px; gap:8px`): primary black **"Ask about this project"** → `goChat`;
   secondary outlined **"Approve reallocation"**.
2. **Recent files card** — title **Recent files** 15px/700, mb 4; `sc-for` over `projectFiles` (count 4).
   Row: ext tile `28×28` radius 8, 9.5px/700 `#46463F` on tint; name 13px/600; `when` 11.5px `#A8A8A3`.

   ```js
   projectFiles = [
     { ext:"XLS", tint:"#DCEFD9", name:"NetBet registrations — July.xls",        when:"8m" },
     { ext:"PDF", tint:"#FBF0C4", name:"DSP performance report — July.pdf",      when:"8m" },
     { ext:"REC", tint:"#D8E8F6", name:"Campaign review 21 July — transcript",   when:"9 days" },
     { ext:"DOC", tint:"#E9E0F7", name:"Q3 creative brief.doc",                  when:"3 weeks" },
   ]
   ```
3. **Recent conversations card** — title 15px/700; three static rows (13px/600 + right time 11.5px `#A8A8A3`):
   - "How are registrations doing this month?" · `2m` · → `goChat`
   - "Summarise the 21 July review for the client" · `Yesterday`
   - "Which creatives beat the €7 CPA line?" · `Mon`

*Right column:*

4. **Open tasks card** — title **Open tasks**; rows with an empty `16×16` radius-5 `1.5px #D6D6D0`
   checkbox, 13px/600 label, right-side due text:
   - "Approve display reallocation" · **Today** (11px/700 `#C0532A`)
   - "Send TikTok report to Marek" · `Fri` (11px `#9A9A96`)
   - "Refresh Q4 creative brief" · `Next week`
5. **Generated content card** — title mb 10; tiles (`1px solid #E9E9E5`, radius 12, `11px 12px`,
   hover `border-color:#101010`), name 13px/700 + meta 11.5px `#9A9A96`:
   - "Client email — July recap" / "Draft · needs your read"
   - "Review deck — 14 slides" / "Ready"
6. **Browser sessions card** — title mb 10; rows 13px/600 `padding:8px 0`:
   - "Display CPA benchmarks 2026 — 7 pages read" → `goBrowser`
   - "NetBet affiliate terms — saved to project" (with `border-top:1px solid #F0F0EC`)

---

### 5.5 Knowledge — `data-screen-label="Knowledge"` *(build priority)*

Container: `padding:32px 44px 28px; max-width:1180px;`

**Header row** — `display:flex; align-items:flex-end; gap:14px; margin-bottom:20px;`
- Left: title **Knowledge** 30px/700/`-1px`, mb 4; subtitle
  **`{{ knowledgeCount }} items indexed · nothing filed by hand`** 13.5px `#7A7A74`.
  `knowledgeCount = (1284 + uploads.length).toLocaleString()` → renders **"1,284"** initially.
- Right (`margin-left:auto`): primary **Upload** button — `background:#101010; color:#FFFFFF;
  border-radius:10px; padding:10px 15px; 13px/600; gap:8px;` hover `background:#262622`;
  leading upload arrow SVG 15×15; `onClick={pickFiles}`.
- Secondary **Connect a source** — `1px solid #DEDED9`, radius 10, `padding:10px 15px`, 13px/600,
  hover `border-color:#101010`. No handler.

**Dropzone** — `border:1.5px dashed {{ dropBorder }}; background:{{ dropBg }}; border-radius:18px;
padding:22px 24px; display:flex; align-items:center; gap:18px; margin-bottom:18px; cursor:pointer;`
Handlers: `onClick={pickFiles}`, `onDragOver={onDragOver}`, `onDragLeave={onDragLeave}`, `onDrop={onDrop}`.
- Idle: `dropBorder = #DEDED9`, `dropBg = #F7F7F4`
- Dragging: `dropBorder = #101010`, `dropBg = #EAEAE5`
- Left icon tile `44×44`, `flex:none`, `border-radius:14px`, `background:#FFFFFF`, `1px solid #E5E5E1`,
  containing a 19×19 upload arrow `stroke:#101010`.
- Headline **"Drop anything here"** 15px/700/`-0.2px`. (There is an empty sibling `<div>` under it in
  the markup — no subcopy.)
- Right chip cluster: `margin-left:auto; display:flex; gap:6px; flex-wrap:wrap; max-width:250px;
  justify-content:flex-end; width:308px; height:50px;` Chips: 11px/600 `#6B6B66`, `background:#FFFFFF`,
  `1px solid #E9E9E5`, radius 6, padding `4px 8px` — **Browse files**, **Paste a link**,
  **Record audio**, **Import from Drive**. (Decorative; no individual handlers.)

Hidden input immediately after: `<input type="file" multiple ref={fileRef} onChange={onFiles} style="display:none">`

**"JUST ADDED" progress card** (`sc-if hasUploads`, i.e. `uploads.length > 0`) —
white card, radius 18, `padding:16px 18px; margin-bottom:18px`.
Eyebrow **`JUST ADDED`** 10.5px/700/`0.7px` `#A8A8A3`, mb 6.
`sc-for` over `uploads`. Row: `flex; gap:12px; padding:10px 0; border-top:1px solid #F0F0EC`
- Ext tile `30×30`, `flex:none`, radius 9, 9.5px/700 `#46463F`, `background:{u.tint}`, text `{u.ext}`
  (extension = last dot-segment of the filename, uppercased, truncated to 4 chars; fallback `"FILE"`).
- Name 13px/700, single-line ellipsis; status line 11.5px `#7A7A74`.
- Progress track: `margin-left:auto; flex:none; width:132px; height:5px; border-radius:3px;
  background:#F0F0EC; overflow:hidden;` fill: `height:100%; border-radius:3px;
  background:{u.barColor}; width:{u.progress};`
- Stage badge: `flex:none; 11px/700; color:#6B6B66; background:#F4F4F0; border-radius:6px;
  padding:3px 7px; min-width:74px; text-align:center;`

**The four ingest stages** (advance automatically — see §6.4):

| step | stage badge | status copy | progress | bar color |
|---|---|---|---|---|
| 0 | `Uploading` | "Sending to Jervis…" | `22%` | `#F26B21` |
| 1 | `Reading` | "Extracting text and structure…" | `58%` | `#F26B21` |
| 2 | `Summarising` | "Writing a summary and tags…" | `84%` | `#F26B21` |
| 3 | `Indexed` | "Filed to NetBet · searchable and ready to chat" | `100%` | `#3E8F53` |

**Filter chips** — `flex; gap:7px; flex-wrap:wrap; margin-bottom:18px`. Active chip
`background:#101010; color:#FFF; border-radius:8px; padding:6px 11px; 12px/600`; inactive
`1px solid #E2E2DD; color:#56564F`. Labels in order:
**Everything** (active), **Documents**, **Videos**, **Audio**, **Screenshots**, **Transcripts**,
**Browser captures**, **Bookmarks**. No handlers wired.

**Card grid** — `display:grid; grid-template-columns:repeat(auto-fill, minmax(232px, 1fr)); gap:12px;`
`sc-for` over `knowledge` (count 8). Card: white, `1px solid #E5E5E1`, `border-radius:16px;
padding:14px; cursor:pointer;` hover `border-color:#CFCFC9`.
- Thumbnail block: `height:92px; border-radius:11px; background:{k.tint}; display:flex;
  align-items:flex-end; padding:10px; margin-bottom:12px;` containing an ext badge:
  10px/700 `#46463F` on `rgba(255,255,255,.75)`, radius 5, padding `2px 6px`.
- Name 13px/700/`-0.1px`.
- Summary 11.5px `#7A7A74`, `margin-top:4px`, `line-height:1.45`.
- Tag row (`margin-top:10px; gap:5px; flex-wrap:wrap`): two chips, 10.5px/600 `#6B6B66` on `#F4F4F0`,
  radius 5, padding `2px 6px` — `{k.project}` then `{k.tag}`.
- Footer link: `margin-top:12px; padding-top:10px; border-top:1px solid #F2F2EE; 11.5px/700; color:#F26B21`
  — **"Open in chat →"**, `onClick={goChat}`.

```js
knowledge = [
  { ext:"XLS", tint:"#DCEFD9", name:"NetBet registrations — July",
    summary:"4,120 registrations, up 18%. TikTok carries 41% at €6.20 CPA.", project:"NetBet",  tag:"Performance" },
  { ext:"REC", tint:"#D8E8F6", name:"Campaign review — 21 July",
    summary:"Budget rule agreed: display moves if CPA holds above €12.",     project:"NetBet",  tag:"Meeting" },
  { ext:"PDF", tint:"#FBF0C4", name:"DSP performance report — July",
    summary:"Channel breakdown, CPA trend, creative fatigue analysis.",      project:"DSP",     tag:"Report" },
  { ext:"MP4", tint:"#E9E0F7", name:"Aurora Media onboarding call",
    summary:"Pricing questions on managed DSP tiers, two follow-ups.",       project:"DSP",     tag:"Transcript" },
  { ext:"IMG", tint:"#F1F1ED", name:"TikTok Ads — creative breakdown",
    summary:"Screenshot set of the six creators above the €7 line.",         project:"NetBet",  tag:"Screenshot" },
  { ext:"WEB", tint:"#D8E8F6", name:"Regulated market benchmarks Q2 2026",
    summary:"Captured page. Median CPA €7.40, display weakest at €13.80.",   project:"Research",tag:"Capture" },
  { ext:"DOC", tint:"#DCEFD9", name:"Agency service catalogue 2026",
    summary:"Retainer tiers, scope boundaries, escalation paths.",           project:"Agency",  tag:"Internal" },
  { ext:"MD",  tint:"#FBF0C4", name:"AI OS — architecture notes",
    summary:"Command layer, coordinator, agent set, LLM gateway.",           project:"AI OS",   tag:"Spec" },
]
```

---

### 5.6 Research — `data-screen-label="Research"`

Container: `padding:32px 44px 28px; max-width:1120px;`

- Eyebrow **"Research"** 12px/600 `#9A9A96`, mb 6.
- Question heading 30px/700/`-1px`, `line-height:1.14; max-width:720px; margin-bottom:22px`:
  **"What CPA are competitors hitting on TikTok in regulated iGaming markets?"**
- Grid `1.5fr 1fr`, gap 12, align start.

**Summary card** (white, radius 18, `padding:22px 24px`): eyebrow **`SUMMARY`**, mb 10.
Body 15px / 1.62 with inline citation superscripts (`font-size:10px; font-weight:700; color:#F26B21;
vertical-align:super`):
> Public benchmarks for regulated markets cluster between €5 and €9 registration CPA on TikTok`¹`,
> with the tightest results from operators running creator-led video rather than static offers`³`.
> Your €6.20 sits in the strong half of that range.

Second paragraph (`margin-top:12px`):
> Two things separate the best performers: shorter hook windows, and offer rotation every 10–14 days`²`.
> NetBet currently rotates every 28 days.

Footer buttons (`margin-top:20px; padding-top:16px; border-top:1px solid #F0F0EC; gap:8px`):
primary black **"Save to NetBet"**; outlined **"Generate report"** → `goContent`;
outlined **"Generate presentation"** → `goContent`.

**Right rail:**
1. **Web sources card** — title **Web sources** 15px/700. Rows `flex; gap:10px; padding:10px 0;
   border-top:1px solid #F0F0EC`; index number 10px/700 `#F26B21` `padding-top:2px`; title 12.5px/600;
   domain 11px `#A8A8A3`.
   - `1` "iGaming acquisition benchmarks, Q2 2026" / `igamingbusiness.com`
   - `2` "Creative fatigue windows on short video" / `tiktok.com/business`
   - `3` "Creator-led performance case notes" / `Reddit r/PPC thread`
2. **"From your knowledge" card** — tinted: `background:#F1EFFA; border:1px solid #E3DEF6;` radius 18,
   `padding:18px 20px`. Title 15px/700. Rows 12.5px/600, `padding:9px 0`,
   `border-top:1px solid rgba(0,0,0,.06)`:
   - "DSP report — July · TikTok CPA €6.20"
   - "Meeting 21 July · rotation cadence discussed"
   - "Creative brief Q3 · 28-day rotation"

---

### 5.7 Content Studio — `data-screen-label="Content Studio"`

Container: `padding:32px 44px 28px;` (no max-width).
Title **Content Studio** 30px/700/`-1px`, mb 20.
Grid: `grid-template-columns:260px 300px 1fr; gap:12px; align-items:start;`

**Column 1 — INPUT** (white card, `18px 20px`): eyebrow `INPUT` mb 12; column gap 7.
Rows: `flex; gap:9px; 13px/600; background:#F4F4F0; border-radius:10px; padding:9px 11px;` each with a
leading `14×14` radius-4 `#101010` square.
- "NetBet project" · "Meeting — 21 July" · "Research — TikTok CPA"
- Add row: `color:#9A9A96; border:1px dashed #DEDED9; border-radius:10px; padding:9px 11px; cursor:pointer;`
  copy **"+ Add files, web or a meeting"**

**Column 2 — PROMPT / FORMAT / TONE** (white card, `18px 20px`):
- Eyebrow `PROMPT` mb 12; prompt box `background:#F7F7F4; border-radius:12px; padding:12px;
  font-size:13px; line-height:1.5; min-height:92px;` copy:
  **"Write the July recap for the NetBet client. Lead with registrations, be honest about display."**
- Eyebrow `FORMAT` (`margin:16px 0 8px`); chip row `flex-wrap:wrap; gap:6px`, chips `padding:6px 10px`,
  radius 8, 12px/600. Active black **LinkedIn**; inactive outlined `#E2E2DD` / `#56564F`:
  **Blog**, **Proposal**, **Email**, **Script**, **Presentation**.
- Eyebrow `TONE & LENGTH` (`margin:16px 0 8px`); chips: active **Direct**; inactive **Warm**, **Short**.

**Column 3 — OUTPUT** (white card, `padding:22px 24px; min-height:420px`):
- Header row (mb 14): eyebrow `OUTPUT`; right cluster (`margin-left:auto; gap:7px`) —
  outlined **Regenerate** (radius 8, `6px 11px`, 12px/600, hover `border-color:#101010`) and
  black **Save to NetBet**.
- Headline 19px/700/`-0.4px`, `line-height:1.3; margin-bottom:12px; max-width:560px`:
  **"Three campaigns, one honest number: registrations are up 18%."**
- Body 14.5px / 1.68, `color:#262622; max-width:620px; text-wrap:pretty` (three paragraphs separated
  by `<br><br>`):
  > July was a TikTok month. Creator-led video pulled 41% of NetBet registrations at a €6.20 CPA — a
  > third cheaper than June. Meta held steady. Display did not: €14.10 CPA against a €12 ceiling we
  > set ourselves back on 21 July.
  >
  > So we're doing the boring, correct thing and moving that budget where it already works. The
  > interesting question for August isn't channel mix, it's rotation speed — the operators beating us
  > on CPA refresh creative twice as often as we do.
  >
  > Full numbers in the deck. Happy to walk anyone through it.
- Footer: `margin-top:18px; padding-top:14px; border-top:1px solid #F0F0EC; 11.5px; color:#9A9A96` —
  **"Drawn from 3 inputs · 2 numbers verified against the DSP report"**

---

### 5.8 Planner — `data-screen-label="Planner"`

Container: `padding:32px 44px 28px; max-width:1180px;`
- Title **Today** 30px/700/`-1px`, mb 4.
- Subtitle **"You have 23 open tasks. Three of them matter today."** 13.5px `#7A7A74`, mb 20.

**Black priority card** — `background:#101010; border-radius:20px; padding:22px 24px; margin-bottom:14px;`
Eyebrow **`TOP 3 PRIORITIES`** 10.5px/700/`0.7px` `#86867E`, mb 14. Rows `flex; gap:14px`, rows 2 and 3
have `padding-top:12px; border-top:1px solid #262622`.
Rank number 12px/700 `#F26B21`, `width:16px`; title 17px/600 `#FFFFFF` `-0.3px`;
right meta 11.5px/600 `#A9A9A2`.

| # | Title | Meta |
|---|---|---|
| `01` | Approve the NetBet display reallocation | blocks 2 people |
| `02` | Finish the TikTok report before the 10:30 | draft is 80% done |
| `03` | Reply to Aurora Media on DSP pricing | waiting 3 days |

**Four-column strip** — `grid-template-columns:repeat(4,1fr); gap:12px; align-items:start;`
Cards: white, radius 18, `padding:16px 18px`. Column title 13px/700 mb 2; rows 12.5px/600,
`padding:9px 0; border-top:1px solid #F0F0EC`.
- **Morning**: "TikTok report — final pass" · "10:30 NetBet review"
- **Afternoon**: "14:00 Aurora Media call" · "Approve reallocation"
- **Evening**: "Nothing scheduled. Kept clear." (row color `#9A9A96`)
- **Blocked** — tinted card `background:#FDF3E4; border:1px solid #F5E4CC`; dividers
  `rgba(0,0,0,.06)`: "Q4 brief — waiting on client brand assets" · "Invoice #482 — waiting on finance"

---

### 5.9 Browser — `data-screen-label="AI Browser"`

Container: `padding:20px 24px 24px; height:100%; display:flex; flex-direction:column;`

**Chrome row** (`flex; gap:10px; margin-bottom:12px`):
- Back/forward buttons `26×26`, radius 8, `1px solid #E2E2DD`, `background:#FFF`, 12px glyphs
  `←` (`#6B6B66`) and `→` (`#C4C4BE`, i.e. disabled).
- URL bar: `flex:1; height:32px; background:#FFFFFF; 1px solid #E5E5E1; border-radius:9px;
  padding:0 12px; font-size:12.5px; color:#56564F;`
  value **`igamingbusiness.com/acquisition-benchmarks-q2-2026`**
- Status pill **"Reading for you"** 11.5px/600 `#3E8F53` on `#E4F1E4`, radius 7, padding `5px 9px`.

**Two-pane body** — `flex:1; min-height:0; display:grid; grid-template-columns:1fr 320px; gap:12px;`

*Left — page viewer* (white card, radius 18, `padding:26px 30px; overflow:auto`):
- Eyebrow **`BENCHMARK REPORT`** 11px/700/`0.6px` `#A8A8A3`
- Title **"Acquisition benchmarks for regulated markets, Q2 2026"** 24px/700/`-0.7px`,
  `margin:8px 0 14px; max-width:520px`
- Content placeholder: `height:190px; border-radius:12px; background:#F1F1ED; border:1px dashed #DEDED9;`
  centered label **"Page content"** 12px `#9A9A96`, mb 16
- Body 14px / 1.7 `#3A3A36`, `max-width:560px`:
  > Median registration CPA across the sampled operators fell to €7.40, with short-video channels
  > accounting for most of the improvement. Static display remained the weakest performer at €13.80…
- Callout: `margin-top:16px; background:#FFF6EC; border:1px solid #F5E0C7; border-radius:12px;
  padding:12px 14px; font-size:13px; font-weight:600;`
  **"Jervis highlighted 3 passages relevant to NetBet display CPA."**

*Right rail (320px, column, gap 12):*
1. **ACTIONS ON THIS PAGE** card (white, `16px 18px`): chip row `flex-wrap:wrap; gap:6px`; outlined chips
   (`1px solid #E2E2DD`, radius 8, `6px 10px`, 12px/600, hover `border-color:#101010`):
   **Summarise**, **Compare to NetBet**, **Extract numbers**, **Download PDF**, **Fill form**;
   plus black chip **Save to NetBet**.
2. **SESSION CHAT** card (`flex:1; min-height:0`, white, `16px 18px`, column):
   - User bubble: 13px/600, `background:#101010; color:#FFF; border-radius:12px 12px 4px 12px;
     padding:9px 12px; align-self:flex-end; max-width:85%` — **"Compare their display CPA to ours"**
   - Assistant bubble: 13px / 1.55, `background:#F4F4F0; border-radius:12px 12px 12px 4px;
     padding:10px 12px; margin-top:8px; max-width:90%` —
     **"Their median display CPA is €13.80. NetBet is at €14.10 — 2% worse, and both are far off the
     €7.40 all-channel median."**
   - Input stub: `margin-top:auto; height:34px; border:1px solid #E5E5E1; border-radius:10px;
     padding:0 11px; font-size:12.5px; color:#9A9A96` — **"What do you want me to do?"**

---

### 5.10 Agents — `data-screen-label="Agents (A/B)"` *(conditional screen)*

Container: `padding:32px 44px 28px; max-width:1180px;` Reachable via the sidebar item that only
renders when `agentsNav` is true, or via `goAgents`.

- Title **Agents** 30px/700/`-1px`, mb 4.
- Blurb 13.5px `#7A7A74`, `max-width:620px`, mb 20:
  > Option A. Kept in the sidebar, visible as a page. Option B is the collapsed "Completed by" strip
  > inside every answer — toggle the switch in the top bar to compare, then see it in
  > [Chat](#) *(anchor, `onClick={goChat}`)*.
- Grid: `repeat(auto-fill, minmax(268px, 1fr)); gap:12px;` `sc-for` over `agents` (count 6).
  Card: white, radius 18, `padding:18px 20px`.
  - Header (`flex; gap:9px`): status dot `8×8` circle `{g.dot}`; name 15px/700/`-0.2px`;
    status chip (`margin-left:auto`) 11px/700 `#6B6B66` on `#F4F4F0`, radius 6, `3px 7px`.
  - Task 13px/600 `margin-top:12px`; detail 11.5px `#9A9A96` `margin-top:3px`.
  - Footer (`margin-top:14px; padding-top:12px; border-top:1px solid #F0F0EC; gap:14px`): two stat
    blocks, micro eyebrow 10px/700/`0.5px` `#A8A8A3` (`HEALTH`, `QUEUE`) over 12.5px/700 value.

```js
agents = [
  { name:"Research",  status:"Running", dot:"#3E8F53", task:"Comparing display CPA benchmarks",
    detail:"Read 7 pages · 2 sources kept",   health:"Good",      queue:"1" },
  { name:"Knowledge", status:"Idle",    dot:"#C4C4BE", task:"Indexed 3 new documents",
    detail:"Last run 8 minutes ago",          health:"Good",      queue:"0" },
  { name:"Memory",    status:"Idle",    dot:"#C4C4BE", task:"Recalled the 21 July budget rule",
    detail:"412 facts about NetBet",          health:"Good",      queue:"0" },
  { name:"Planning",  status:"Running", dot:"#3E8F53", task:"Rebuilding today's top three",
    detail:"23 tasks weighed",                health:"Good",      queue:"2" },
  { name:"Browser",   status:"Waiting", dot:"#E0A93F", task:"Needs login for TikTok Ads export",
    detail:"Paused 4 minutes ago",            health:"Needs you", queue:"1" },
  { name:"Content",   status:"Running", dot:"#3E8F53", task:"Drafting the July client recap",
    detail:"3 inputs · direct tone",          health:"Good",      queue:"1" },
]
```

---

### 5.11 Mobile screens — `data-screen-label="Mobile"`

Container: `padding:32px 44px 40px;` Title **Mobile** 30px/700/`-1px`, mb 4; subtitle
**"Not a copy of the desktop. Voice sits in the middle, because that's what gets used."**
13.5px `#7A7A74`, mb 24. Two device frames side by side (`display:flex; gap:28px; flex-wrap:wrap`).

**Frame A — light home**
`width:340px; height:700px; border-radius:42px; background:#FFFFFF; border:1px solid #E2E2DD;
box-shadow:0 18px 40px rgba(0,0,0,.07); padding:14px 16px 0; display:flex; flex-direction:column;`
- Status bar (`space-between`, `padding:6px 6px 14px`, 12px/700): `9:41` · notch pill `78×22` radius 14
  `#101010` · `▮▮▮` in `#6B6B66`
- Greeting: 27px/700/`-0.9px`/1.1 — line 1 `Good morning {{ userName }},` in `#A9A9A3` (`padding:8px 4px 0`),
  line 2 `what should we move forward?` (`padding:0 4px 18px`)
- 2×2 quick actions (`gap:9px; padding:0 4px`): cards radius 18, `padding:13px`, `min-height:96px`,
  `justify-content:space-between`; `30×30` white circle on top; title 15px/700.
  **Ask** `#D8E8F6` · **Research** `#DCEFD9` · **Create** `#FBF0C4` · **Plan** `#E9E0F7`
- Priority strip: `margin:16px 4px 0; background:#F4F4F0; border-radius:14px; padding:13px 14px;
  font-size:12.5px; font-weight:600; color:#56564F;` — **"Top priority · Approve NetBet reallocation"**
- Input stub: `margin:14px 4px 0; height:46px; border:1px solid #E5E5E1; border-radius:14px;
  padding:0 14px; font-size:13.5px; color:#9A9A96;` — **"Ask or search for anything"**
- Tab bar (`margin-top:auto; space-between; padding:14px 10px 16px`): labels 11px/700 `#9A9A96` —
  **Home**, **Projects**, [center voice FAB `52×52` circle `#101010` with white mic SVG 20×20],
  **Chat**, **Settings**

**Frame B — dark voice**
Same box metrics, `background:#101010; border:1px solid #101010; box-shadow:0 18px 40px rgba(0,0,0,.14);
color:#FFFFFF;`
- Status bar as above but notch pill `#000` and `▮▮▮` in `#86867E`
- Centered stack (`flex:1; column; center; gap:34px`):
  - Orb container `108×108` relative; pulse layer `position:absolute; inset:0; border-radius:50%;
    background:#F26B21; opacity:.35; animation:jvPulse 2.2s ease-out infinite;`
    core `88×88` circle `#F26B21` with a 30×30 mic SVG `stroke:#101010; stroke-width:1.4`
  - Label **`LISTENING`** 12px/700/`0.7px` `#86867E`, mb 10
  - Quote 23px/600/`-0.5px`/1.28 — **`“Where did we land on NetBet display?”`**
- Footer `padding:0 4px 24px; text-align:center; 12.5px; color:#86867E` —
  **"Tap anywhere to stop · Hey Jervis works hands-free"**

---

### 5.12 Command palette overlay (`sc-if palette`)

Scrim: `position:fixed; inset:0; background:rgba(24,24,22,.34); backdrop-filter:blur(3px);
display:flex; align-items:flex-start; justify-content:center; padding-top:14vh; z-index:60;`
`onClick={closeAll}` (click-outside closes; the panel is inside, so clicks bubble — no stopPropagation).

Panel: `width:620px; background:#FFFFFF; border-radius:18px; box-shadow:0 30px 70px rgba(0,0,0,.28);
overflow:hidden; animation:jvFade .16s ease both;`

- Header row: `flex; gap:12px; padding:16px 18px; border-bottom:1px solid #F0F0EC;`
  magnifier SVG 17×17 `#9A9A96`; placeholder text **"Type a command, a question, or a name…"**
  16px/500 `#B4B4AE`; trailing kbd badge **`esc`** (11px/600 `#A8A8A3`, `1px solid #E7E7E3`, radius 5,
  `1px 5px`).
- Body `padding:8px`:
  - Group label **`CONTINUE`** 10.5px/700/`0.7px` `#A8A8A3`, `padding:8px 10px 6px`.
  - Highlighted row (pre-selected, `background:#F4F4F0`): swatch `20×20` radius 6 `#D8E8F6`;
    label **"Continue yesterday — NetBet registrations"** 13.5px/600; trailing `↵` 11px `#A8A8A3`.
    `onClick={goChat}`.
  - Group label **`COMMANDS`** (`padding:12px 10px 6px`).
  - Rows (`padding:9px 10px; border-radius:10px; cursor:pointer;` hover `background:#F4F4F0`),
    each with a `20×20` radius-6 `#F1F1ED` swatch and 13.5px/600 label:
    | Label | onClick |
    |---|---|
    | Search everything for “registrations” | `goSearch` |
    | Open NetBet | `goProject` |
    | Research TikTok CPA benchmarks | `goResearch` |
    | Create a LinkedIn post from the July recap | `goContent` |
    | Find the screenshot from Monday's call | `goKnowledge` |

---

### 5.13 Voice overlay (`sc-if voice`)

Scrim: `position:fixed; inset:0; background:rgba(16,16,15,.93); backdrop-filter:blur(6px);
display:flex; flex-direction:column; align-items:center; justify-content:center; gap:40px;
z-index:70; color:#FFFFFF; cursor:pointer;` `onClick={nextVoicePhase}` (advances the phase; `esc` closes).

- Orb: container `190×190` relative.
  - Pulse ring: `position:absolute; inset:26px; border-radius:50%; background:#F26B21; opacity:.3;
    animation:jvPulse 2.2s ease-out infinite;`
  - Core: `138×138; border-radius:50%; background:{{ voiceOrb }};` centered, `gap:5px`, containing
    four bars `width:5px; height:46px; border-radius:3px; background:#101010;` with
    `animation:jvBar 1.1s ease-in-out infinite` and stagger delays `0`, `.18s`, `.36s`, `.54s`.
- Text block (`text-align:center; max-width:620px`):
  - Phase label `{{ voiceLabel }}` 12px/700/`0.9px` `#8C8C84`, mb 14
  - Statement `{{ voiceText }}` 34px/600/`-0.9px`/1.24
- Footer hint 12.5px `#86867E` — **"Click to advance · esc to close"**

Phase cycle (`state.phase % 3`):

| phase | label | text | orb color |
|---|---|---|---|
| 0 | `LISTENING` | `“Where did we land on NetBet display?”` | `#F26B21` |
| 1 | `THINKING` | `Checking the 21 July meeting and the July DSP report…` | `#F3D06B` |
| 2 | `SPEAKING` | `Display stayed above the €12 ceiling, so the budget moves to TikTok. Want me to send it for approval?` | `#8FD3A2` |

---

## 6. Interaction patterns

### 6.1 Component state

```js
state = {
  screen: "home",     // one of home|chat|search|project|knowledge|research|content|planner|browser|agents|mobile
  palette: false,     // command palette overlay
  voice: false,       // voice overlay
  phase: 0,           // voice phase counter (mod 3)
  agentsPanel: false, // "Completed by 4 agents" disclosure in Chat
  agentsNav: null,    // null = fall back to props.showAgentsNav; else boolean override
  bar: "",            // bottom command-bar input value
  done: {},           // { [suggestionIndex]: true } — Home suggestion checkboxes
  dragging: false,    // Knowledge dropzone drag state
  uploads: []         // [{ id, name, step }] — newest first, capped at 6
}
fileInput = React.createRef()
```

Props (declared in `data-props`):
- `showAgentsNav` — boolean, default `false`, section "Structure"
- `userName` — text, default `"Hossain"`, section "Content"

### 6.2 Navigation

`go(screen)` sets `{ screen, palette: false, voice: false }` — navigating always dismisses overlays.
Handlers exposed to the template: `goHome, goChat, goSearch, goProject, goKnowledge, goResearch,
goContent, goPlanner, goBrowser, goAgents, goMobile`.

Every clickable element in the mockup is a plain `<div>` with `cursor:pointer` — no `<button>`,
`<a>` (except the single anchor on the Agents screen), or focus/active/disabled states anywhere.
Hover is the only non-click affordance and is expressed as `style-hover="…"`.

### 6.3 Keyboard

Registered on `window` in `componentDidMount`, removed on unmount:
- `⌘K` / `Ctrl+K` → `preventDefault()`, toggles `palette`, and force-closes `voice`
- `Escape` → closes both `palette` and `voice`

Bottom command bar: `onKeyDown` — `Enter` navigates to Chat. `onChange` writes `state.bar`.
`submitBar` (the `↑` button) also navigates to Chat.

### 6.4 Knowledge upload / ingest simulation

- `pickFiles()` → `fileInput.current.click()`
- `onFiles(e)` → collects `File.name` values, calls `addUploads(names)`, resets `e.target.value`
- `onDragOver(e)` → `preventDefault()`, sets `dragging: true` (only if not already)
- `onDragLeave()` → `dragging: false`
- `onDrop(e)` → `preventDefault()`, `dragging: false`, reads `dataTransfer.files` names;
  if none, falls back to a single synthetic item named **`"Dropped item.pdf"`**
- `addUploads(files)`:
  - id = `Date.now() + "-" + i`
  - Each new upload is **prepended** to the list, then the list is `.slice(0, 6)` (max 6 visible)
  - Stage advance is `setTimeout`-driven: step *n* fires at `700 * n + i * 250` ms
    (so a single file reaches `Indexed` at ~2100 ms; each additional file in the same batch is
    staggered by 250 ms per step)
- Per-row derived values come from the stage table in §5.5; `barColor` is `#3E8F53` at step 3,
  otherwise `#F26B21`; `ext` = `name.split(".").pop().slice(0,4).toUpperCase()`.
- `hasUploads = uploads.length > 0` gates the "JUST ADDED" card.
- `knowledgeCount` recomputes as `(1284 + uploads.length).toLocaleString()`.

### 6.5 Home suggestion checkboxes

`s.toggle` flips `state.done[i]`. Derived per row: `box` (`#101010` / `transparent`), `tick`
(opacity `1` / `0`), `strike` (`line-through` / `none`), `color` (`#A8A8A3` / `#101010`).

### 6.6 Chat agents disclosure

`toggleAgentsPanel` flips `state.agentsPanel`. `caret` renders `▲` when open, `▼` when closed.
The panel enters with `animation: jvFade .18s ease both`.

### 6.7 Unused / vestigial logic

`switchTrack` (`#101010` / `#D8D8D2`), `switchOffset` (`11px` / `0px`) and `toggleAgentsNav` are
computed in `renderVals()` but no element in the template consumes them — the A/B toggle switch
referenced by the Agents-screen copy ("toggle the switch in the top bar") was deleted from the top
bar markup, leaving an empty slot before the voice button. `agentsNav` itself is still read by the
`sc-if` around the sidebar Agents item, so with the default prop (`false`) the Agents nav item and
screen are unreachable from the UI.

### 6.8 Animations (`@keyframes` in `<helmet>`)

```css
@keyframes jvPulse {
  0%   { transform: scale(1);   opacity: .55; }
  70%  { transform: scale(2.1); opacity: 0;   }
  100% { transform: scale(2.1); opacity: 0;   }
}
@keyframes jvBar {
  0%, 100% { transform: scaleY(.28); }
  50%      { transform: scaleY(1);   }
}
@keyframes jvFade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none;            }
}
```

| Keyframe | Effect | Usage |
|---|---|---|
| `jvPulse` | Expanding halo — scales 1 → 2.1 while fading out, holding transparent for the last 30% of the cycle (a beat of rest between pulses) | Voice overlay ring (`inset:26px`, `opacity:.3`, `2.2s ease-out infinite`); Mobile voice-screen ring (`inset:0`, `opacity:.35`, same timing) |
| `jvBar` | Vertical audio-meter bar — `scaleY` .28 → 1 → .28 | Four `5×46px` bars inside the voice orb, `1.1s ease-in-out infinite`, staggered `0 / .18s / .36s / .54s` |
| `jvFade` | Enter transition — fade in + 8px upward slide | Chat agents panel (`.18s ease both`); Command palette panel (`.16s ease both`) |

No CSS `transition` properties are declared anywhere; hover changes are instantaneous.

### 6.9 Hover states (complete list)

| Element | `style-hover` |
|---|---|
| Top-bar search field | `border-color: #CFCFC9` |
| Every sidebar nav item + "Mobile screens" | `background: #E6E6E2` |
| Home quick-action cards | `filter: brightness(0.98)` |
| Small tiles (Home projects, Project generated content) | `border-color: #101010` |
| Secondary/outlined buttons and chips | `border-color: #101010` |
| Chat source chips | `background: #EAEAE5` |
| Search result rows, Knowledge cards | `border-color: #CFCFC9` |
| Project inactive tabs | `color: #101010` |
| Knowledge Upload button | `background: #262622` |
| Bottom-bar mic button | `background: #E9E9E4` |
| Command palette command rows | `background: #F4F4F0` |
| `a` (global CSS) | `color: #F26B21` |

---

## 7. What `support.js` actually does

`support.js` is a **generic, product-agnostic runtime for the `.dc.html` design-doc format** — the
header says `GENERATED from dc-runtime/src/*.ts — do not edit`. It contains **zero Jarvis-specific
logic**. Nothing in it needs porting; the Next.js rebuild replaces it entirely with React + Tailwind.

What it implements (module-by-module, per the `// src/*.ts` comments):

- **`react.ts` / `cdn.ts`** — lazily pulls React 18.3.1, ReactDOM 18.3.1 and `@babel/standalone`
  7.29.0 from unpkg with SRI hashes. React is not bundled with the page.
- **`parse.ts`** — finds `<x-dc>` (template HTML) and `<script data-dc-script>` (logic class + a
  `data-props` JSON schema of editable props) in the document.
- **`boot.ts`** — mounts the parsed doc into `#dc-root`, injects base CSS (skeleton/placeholder
  shimmer for streaming previews, print rules).
- **`expr.ts`** — a tiny expression resolver for `{{ … }}`: identifiers, dotted paths, numbers, and
  top-level equality comparisons. Not a full JS evaluator.
- **`encode.ts` / `compile.ts` / `walk*`** — compiles the HTML template into React elements:
  camelCase attribute recovery, inline `style="…"` string → style object, a DOM-event → React-prop
  map (`onclick→onClick`, `ondrop→onDrop`, `ondragover→onDragOver`, `onchange→onChange`,
  `onkeydown→onKeyDown`, …), and the control-flow tags:
  - `<sc-if value="{{ x }}">` — conditional subtree; `hint-placeholder-val` supplies a value only
    while streaming a preview.
  - `<sc-for list="{{ xs }}" as="k">` — maps over an array, exposing `k` and `$index` to children;
    `hint-placeholder-count` renders N skeleton rows while streaming.
- **`pseudo.ts`** — the mechanism behind `style-hover="…"`: it mints a unique class (`scpN`),
  inserts a `.scpN:hover { … !important }` rule into a runtime stylesheet, and appends the class to
  the element. Any `style-<pseudo>` attribute works the same way (`before`/`after` become
  `::before`/`::after`).
- **`logic.ts`** — defines `StreamableLogic`, aliased as both `DCLogic` and `StreamableLogic` when
  the inline `class Component extends DCLogic` script is `eval`'d via `new Function`. It is a thin
  React.Component stand-in: `props`, `state`, `setState`, `forceUpdate`, the three lifecycle hooks,
  and `renderVals()` — the flat object the template binds against.
- **`component.ts` / `registry.ts` / `runtime.ts`** — the wrapper component, hot-reload/streaming
  registry, and the multi-document component resolver (`<x-import>` / `<sc-component>` for
  cross-file imports; unused by this mockup, which is a single self-contained document).
- **`helmet.ts`** — hoists `<helmet>` children (font `<link>`s and the `<style>` block) into
  `document.head`, plus a `design_doc_mode` meta hook and canvas background handling
  (`#f0eee6` light / `#2e2c26` dark — the tool's own chrome, not the app).
- **`atomics.ts`** — a small unused atomic-class sheet (`.fx`, `.col`, `.fs14`, …) that the Jarvis
  template never references.
- **`external.ts` / `bundled.ts`** — loading arbitrary external ES modules/globals for imported
  components; not exercised here.

The only real "app logic" lives in the inline `<script data-dc-script>` at the bottom of the HTML —
that is the `class Component extends DCLogic` documented in §6, and it is the part worth porting
(screen routing, upload stage simulation, overlay/keyboard handling, checkbox and disclosure state).

# Custom Editor Overlay

A local reverse proxy for an Edge Delivery Services (EDS) page that overlays
hover/click highlighting of blocks (identified by their own CSS class, e.g.
`class="card"`) and default content (headings/paragraphs/images authored
directly in a section, outside any block), plus a lightweight field-editing
panel that saves directly back to Document Authoring (DA).

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for the full build spec and design
rationale. This README covers day-to-day usage.

## Setup

```sh
cd tools/custom-editor
cp .env.example .env   # then edit TARGET_ORIGIN / DA_ORG / DA_REPO / DA_REF
npm start
```

Open `http://localhost:4000/<path>` (e.g. `http://localhost:4000/accordion`) —
it renders the proxied page with the overlay injected.

There is no server-side token. All DA/Admin API calls are made directly from
the browser; the proxy only forwards the page and static assets.

## Using the overlay

- **Hover** any block (a `<div>` carrying its own class, e.g. `class="card"`,
  per EDS/DA convention) to see it highlighted (purple) with its block name.
  Blocks are identified by class, not by the `data-block-name` attribute
  this project's client-side decoration adds later — so highlighting works
  immediately on page load, without waiting for decoration to finish.
- Hovering non-block content (a heading, paragraph, list, or image directly
  in a section) highlights just that *specific* element — not the whole
  section or every other paragraph around it — labeled **default content
  (tagname)**, e.g. `default content (h2)`.
- **Click** a highlighted block or default-content area to select it (pink,
  persistent outline) and open the inspector panel on the right. Clicking a
  section's own padding/background (anywhere inside it that isn't a more
  specific block or piece of content) selects the **section itself** instead
  — that's how you get to its properties, see below. If a section has no
  exposed padding of its own left to click (e.g. it has no `grid` set yet,
  so its blocks stack full-width and cover it edge to edge - precisely the
  case where you'd need to select it to go fix that), its grip handle (see
  "Reordering sections" below) is always clickable to select it too. Click
  empty space (outside any section) to deselect.
- The inspector's **Connect to DA** button starts a real Adobe IMS login: it
  opens a browser window for you to log in, then captures the token
  automatically (via the same `da-auth-helper` OAuth flow the `da-auth` skill
  uses) — no copy/paste needed. If you already have a valid cached login
  (`~/.aem/da-token.json`), it resolves almost instantly with no browser
  window. A **paste a token manually** fallback field remains below it for
  cases where the login flow can't run (offline, GitHub blocked, headless
  environment, or port `9898` already in use by another process). Either way,
  the token is kept in `sessionStorage` only and clears when the tab closes.
  The one narrow exception to "the server never sees the token": `server.js`
  briefly relays the token from the `da-auth-helper` child process's stdout
  to your browser tab over `POST /__editor/auth/login` — it is never logged
  or written to disk by this tool.
- Once connected, the inspector loads the selected item's field(s) (fetched
  live from the DA Source API): a **block** shows one field per element in
  its cells (an **Image** field for each picture, a **Text** field for each
  other paragraph/heading/list item); selecting a specific piece of
  **default content** shows just its one field — not every other paragraph
  in the section.
- **Selecting a section** shows its **Section settings**: the `style`/
  `grid`/`gap`/`spacing`/`container`/`background-color` key/value rows from
  its `section-metadata` block, if it has one. Each known key gets a proper
  control instead of a raw text field — **Grid columns**/**Gap**/
  **Spacing**/**Container width** are dropdowns of the values this project's
  CSS actually supports, and **Style** is a checkbox per style token
  (`center`, `container`); any value/token this project doesn't recognize
  (a hand-authored one-off) is preserved untouched rather than dropped, just
  shown as a plain text field (or, for `style`, kept out of sight but still
  written back unchanged alongside whichever checkboxes you toggle). These
  are what turn into the extra CSS classes on the section element (e.g.
  `class="section center container grid-4 gap-xl spacing-xxl"`) — the
  `section-metadata` block itself removes itself from the page once
  decorated, so this is the only way to edit them once the page has loaded.
  A dropdown + **Add setting** button lets you add a setting the section
  doesn't have yet (creating the `section-metadata` block itself if the
  section has none at all); each existing setting has its own **×** to
  remove just that one (removing the last one removes the block). Changing,
  adding, or removing a setting redecorates the section in place (this
  project's own `decorateSection`/`loadBlock`, from `ak.js`) rather than a
  full page reload.
- Every text field is editable two ways, kept in sync live:
  - **Inline, on the page itself** — text elements inside the selected
    block get a dashed teal outline and become directly editable; click in
    and type.
  - **In the side panel** — the same content is editable as a text area.
  Editing either updates the other immediately (and updates the live page
  preview before you save). Clicking an inline image scrolls to and
  highlights its matching Image field in the panel rather than editing
  in place.
- **Fields save automatically when you leave them (on blur)** — click or tab
  away from a field you edited (inline or in the panel) and it's written
  back to DA and a preview regeneration is triggered right away, no explicit
  action needed. A field that hasn't changed doesn't trigger a save just by
  losing focus. The **Save** button still exists as an explicit "save now"
  affordance. For a **block** or **section** selection, saving refetches the
  page (through the real DA/EDS pipeline, not a local DOM patch) and re-runs
  that block's decorate script, or the section's own decoration, in place —
  no full page reload. A **default content** selection still needs a manual
  reload to see the update.
- A `401` from DA (expired/invalid token) clears the stored token and shows
  the connect prompt again.
- Inline editing only activates when the number of matching elements/images
  on the live (decorated) page equals the number of text/image fields found
  in the DA source for that block instance — if a block's own JS
  restructures things enough to break that correspondence, editing falls
  back to panel-only for that block, rather than risk editing the wrong
  element.
- A **Delete** button (block selections: "Delete block"; default content:
  "Delete") removes the whole selected block, or just the one selected
  piece of default content, from DA — asks for confirmation first, then
  saves and reloads the page automatically once done.

## Adding blocks and sections (drag & drop)

The **Add block** panel is always visible, docked on the left (it pushes the
page's own content right rather than floating over it), and lists things
you can drag onto the page: **Hero** (a block), **Card** (a block), and
**Section** (a brand-new, empty section).

- Dragging **Hero** or **Card** over the page targets individual existing
  content — a purple line shows where it'll land (before/after the nearest
  existing block or piece of content *within whatever section you're over*).
  It's inserted into that exact spot, pre-filled with placeholder content (a
  placeholder image plus "Your headline goes here" for Hero, or "Card title
  goes here" and a short description for Card).
- Dragging **Section** instead snaps to section boundaries (like reordering
  — see below) and inserts a brand-new, empty section *as a sibling of the
  existing sections*, never nested inside one.

Either way it's saved to DA and the page reloads automatically once the
preview is ready. This uses the same DA connection as the inspector
(connect once, either panel works).

New palette entries are added in `public/lib/block-templates.js`
(`BLOCK_TEMPLATES`) — each entry needs a `label`, a `kind` (`'block'`,
inserted inside a section via `insertBlockIntoSection`, or `'section'`,
inserted as a new top-level section via `insertSection` — a section must be
authored as a bare, unclassed `<div>`, never with `class="section"`, which
only client-side decoration adds), and an `html()` function returning the
canonical markup.

Known limitation: dropping a **new** block from this palette is only
supported *inside* an existing section (before/after one of its current
children) — drop a **Section** first if you need a new section to drop it
into. (This doesn't apply to moving/reordering an *existing* block, which
works across sections too — see "Reordering blocks" below.)

## Reordering sections (drag & drop)

Hover any section and a small grip handle (⠿⠿) appears at its top-left
corner. Drag it and drop it above or below another section — a purple line
spanning the page shows exactly where it'll land, snapping to whichever
section's midpoint your cursor is nearest. Drop it there and that whole
section (everything in it - blocks, default content, `section-metadata`) is
moved to that position in DA, saved, and the page reloads automatically.
Same DA connection as everything else.

## Reordering blocks (drag & drop)

Hover any block and a small grip handle (⠿, a different color from the
section grip) appears at its top-right corner. Drag it and drop it anywhere
over the page — the same purple line used for adding blocks shows exactly
where it'll land, either within its current section (reorder) or inside a
different section entirely (move across sections). For blocks laid out in a
grid row (like a row of cards), the line rotates to vertical and sits
between two cards rather than the usual horizontal line, so you can target
the exact left/right position within the row. Drop it there and the block
moves in DA, saved, and the page reloads automatically. Same DA connection
as everything else.

## Development

```sh
npm test    # unit tests for public/lib/block-patch.js (pure, no network)
npm run dev # auto-restart on file changes
```

`public/lib/block-patch.js` is loaded unmodified by both the browser and the
Node test runner — keep it free of `document`/`fetch` and of `fs`/`Buffer`.

## Known limitations

- Field splitting is structural (per top-level element in a cell: images vs.
  everything else) by default, not a content-model-aware form — see
  INSTRUCTIONS.md's non-goals. `hero` and `card` are exceptions: they have a
  real content model each (`public/lib/content-models.js`) giving their
  fields proper names/labels — `hero`: **Hero image**/**Hero image alt
  text**, **Hero title** with an h1–h3 level picker, **Hero text** as a rich
  text field; `card`: **Card image**/**Card image alt text**, **Card title**,
  **Card text** as a rich text field — applied only when the block's actual
  content still matches that model's shape, otherwise it falls back to the
  generic behavior. Other blocks don't have a model yet.
- Nested tables inside a table-form block's cell are not supported.
- No multi-user conflict handling — last write wins.

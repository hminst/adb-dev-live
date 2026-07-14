# Custom Editor Overlay — Build Instructions

## Post-implementation deviations from this spec

This spec originally called for identifying blocks via the `data-block-name`
attribute. The shipped implementation identifies blocks by their own CSS
class instead (e.g. `class="card"`), matched structurally as a `<div[class]>`
directly in a section, since that's present in the raw server-rendered markup
and doesn't depend on this project's client-side decoration (`ak.js`) having
run yet — see `getBlockName`/`BLOCK_SELECTOR` in `public/overlay.js`.

The implementation also extends beyond blocks to cover **default content**
(headings/paragraphs/images authored directly in a section, outside any
block) as a second, parallel editable unit — see `getSectionDefaultContentFields`/
`setSectionDefaultContentFields` in `public/lib/block-patch.js` and
`resolveEditable`/`fieldsIo` in `public/overlay.js`. Treat the rest of this
document as historical design rationale for the block-editing path; it
predates the default-content extension.

This spec also originally deferred a real IMS OAuth login flow (see "Browser-
side token resolution" below), on the grounds that it needs a registered IMS
client ID/redirect URI this tool doesn't have. The shipped implementation
adds a **"Connect to DA" button** that gets a real OAuth login without that
registration, by reusing `adobe-rnd/da-auth-helper` — the same CLI the
`da-auth` skill already trusts. `server.js`'s `POST /__editor/auth/login`
spawns it (`node_modules/.bin/da-auth-helper token`), which opens the user's
system browser to Adobe IMS, runs a short-lived local server on port `9898`
to catch the OAuth redirect, and prints only the raw token to stdout. This is
a **narrow, deliberate exception** to "the server never touches the token":
`server.js` holds the token in memory only long enough to relay it once from
that child process's stdout to the browser tab's pending fetch — it is never
logged, written to disk, or cached by this tool's own code. The manual
paste-a-token field remains as a fallback. See `renderConnectPrompt` in
`public/overlay.js` and `handleLogin`/`startLogin` in `server.js`.

## Audience

This document is written for an AI coding agent (e.g. Claude Code) implementing this
tool from scratch. It is a build spec, not a tutorial — follow it step by step and
check off the acceptance criteria at the end of each phase before moving on.

## Goal

Build a standalone Node.js tool, `tools/custom-editor/`, that:

1. Runs a local HTTP server which reverse-proxies a live Edge Delivery Services (EDS)
   page (e.g. `https://main--adb-dev-live--hminst.preview.da.live/accordion`).
2. Injects a client-side overlay script into the proxied HTML that:
   - Highlights every element carrying a `data-block-name` attribute on hover.
   - Lets the author click a highlighted block to select it, showing a persistent
     selection outline distinct from the hover highlight.
   - Shows an inspector panel listing the selected block's name (`data-block-name`)
     and other data attributes.
3. Lets the author edit the selected block's authored content in the inspector panel
   and save the change back to the Document Authoring (DA) source for that page, then
   trigger a preview so the change is visible on next reload.

This is a full-editing-workflow build: proxy → highlight → select → inspect → edit →
save → preview. Treat each phase below as a checkpoint; do not skip ahead if an
earlier phase's acceptance criteria aren't met.

## Non-goals

- This tool does not replace the Universal Editor or da.live's own editor. It is a
  lightweight, purpose-built overlay for a narrower workflow (e.g. rapid QA/demo
  editing of specific block types).
- No WYSIWYG rich-text editing. Editing is field-based (map block cell values to
  form inputs), not `contenteditable` free-form editing of arbitrary HTML. **Deviation:**
  once a block has a content model (`public/lib/content-models.js`) marking a field
  `richtext`, that one field *is* a `contenteditable` box with a minimal Bold/Italic/
  Link toolbar — see `renderRichTextField` in `public/overlay.js`. `hero`'s `heroText`
  is the first such field; every other field on every other block remains plain
  field-based editing.
- No multi-user concurrency handling (locking, conflict resolution). Single editor,
  single session, last-write-wins.
- No new EDS block code. This tool only edits *content* (the DA-authored HTML),
  never `/blocks/*` JS or CSS.

## Architecture overview

```
Browser
  |-- HTTP -->  Node proxy server  --HTTPS-->  EDS preview origin (aem.page/*.preview.da.live)
  |                                             (page markup + assets only — no DA credentials involved)
  |
  |-- HTTPS (direct, browser-side) -->  DA Source API (admin.da.live)
  |-- HTTPS (direct, browser-side) -->  Admin API (admin.hlx.page) — preview/publish
```

The Node server's only job is proxying the page and injecting the overlay script. It
never sees, stores, or forwards a DA/IMS token. All DA Source API and Admin API calls
are made **directly from the browser**, using a token resolved and held client-side.
There is no `/__editor/api/*` server route for save/preview — that indirection is
removed entirely.

Key facts to design around (see `tools/deepl-proxy` in this repo for an example of an
existing node proxy tool with a similar shape — reuse its patterns for structure,
`.env` handling, and `package.json` scripts where sensible):

- The proxied page is same-origin from the browser's point of view once served through
  this tool, so the injected overlay script has full, unrestricted DOM access — no
  iframe/postMessage bridging is needed.
- EDS block markup follows the canonical form: the outermost `<div>` of a block has
  `class="<block-name> [<variant>...]"` and (per this project's decoration logic)
  carries `data-block-name="<block-name>"` and `data-block-status="loaded"` once
  `scripts.js` has decorated the page. The overlay must wait for decoration to
  complete (see Phase 2) before it can reliably find blocks.
- Editing content and saving it back means writing to the **DA Source API**
  (`https://admin.da.live/source/{org}/{repo}/{path}`), NOT to the rendered preview
  origin. The rendered page is read-only output of that source. After a save, you
  must call the **Admin API** (`https://admin.hlx.page/preview/{org}/{repo}/{ref}/{path}`)
  to re-generate the preview before the change is visible when the proxy re-fetches
  the page.
- Both APIs require an Adobe IMS bearer token, resolved and used **entirely in the
  browser** (see "Browser-side token resolution" below). The token must never be
  sent to, logged by, or stored on the Node server.
- **CORS is an open verification item, not an assumption to build blindly on.**
  `admin.da.live` and `admin.hlx.page` must respond with permissive CORS headers for
  a request originating from `http://localhost:PORT` (this tool's own origin) for
  direct browser calls to succeed. da.live's own web editor calls these same APIs
  from a browser, so cross-origin support very likely exists, but verify empirically
  in Phase 4 (a real `fetch()` from the running tool, checked in devtools) before
  writing the rest of the save flow around it. If a preflight `OPTIONS` fails or the
  response lacks `Access-Control-Allow-Origin`, stop and report that back — don't
  route around it silently (e.g. by adding a hidden server proxy), since that would
  reintroduce the server-side token handling this change is explicitly removing.
- The DA Source API requires `multipart/form-data` with the file field named exactly
  `data` — any other field name silently succeeds (200 OK) without writing anything.
  This is a documented silent-failure trap; do not deviate from it.
- DA HTML documents are body fragments (no `<!DOCTYPE>`, `<html>`, `<head>`,
  `<script>`, `<style>`, or inline `style=`). When you reconstruct a document for
  re-upload after an edit, preserve this — you're patching one block's table markup
  inside the existing fragment, not regenerating the whole document.

## Browser-side token resolution

The token lives only in the browser (never in `.env`, never read by `server.js`).
Implement it as follows:

1. **Storage:** keep the resolved IMS token in `sessionStorage` (not `localStorage`)
   under a namespaced key, e.g. `custom-editor:da-token`, plus its known expiry if
   available. `sessionStorage` limits the token's lifetime to the tab, which is a
   reasonable default for a local dev tool — don't upgrade to `localStorage` without
   the user asking for persistence across tab restarts, since that trades safety for
   convenience.
2. **Resolution UI:** the inspector panel (Phase 4) includes a small auth status
   area:
   - If no token is present, show a "Connect to DA" prompt with a field to paste an
     IMS bearer token (obtained by the user out-of-band, e.g. via the `da-auth`
     skill's flow or by copying it from an authenticated da.live session's devtools)
     and a "Save token" button that writes it to `sessionStorage`.
   - If a token is present, show a short status indicator ("Connected") and a
     "Disconnect" action that clears it.
   - This paste-a-token flow is the pragmatic default for this build. A full IMS
     OAuth popup/redirect flow (proper SSO, no manual copy/paste) is a reasonable
     future upgrade but requires a registered IMS client ID and redirect URI that
     this tool does not currently have — do not attempt to build that flow unless
     the user explicitly provides those credentials/registration details.
3. **Using the token:** every direct call to `admin.da.live` or `admin.hlx.page` from
   `overlay.js` reads the token from `sessionStorage` immediately before the request
   (don't cache it in a long-lived JS variable across the session — always re-read,
   so a "Disconnect" takes effect on the next call rather than requiring a reload).
4. **Expiry handling:** if a DA/Admin API call returns `401` with an empty body (the
   documented silent-expiry signature), clear the stored token, show the "Connect to
   DA" prompt again, and surface a clear message ("Your DA session expired — please
   reconnect") rather than retrying or failing silently.
5. **Never** send the token to the Node server in any request (no query param,
   header, or body field on `/__editor/*` routes should ever carry it) — there is no
   longer any server route that needs it.

## Configuration

Add a `.env` (git-ignored, with a `.env.example` committed) supporting only
non-secret proxy config — no token belongs here:

```
# Origin to proxy (EDS preview URL for the target repo/branch)
TARGET_ORIGIN=https://main--adb-dev-live--hminst.preview.da.live

# DA org/repo/ref this content lives in (non-secret — used to build Source/Admin API
# URLs; safe to expose to the browser, e.g. via a small inline config script or a
# GET /__editor/config JSON endpoint)
DA_ORG=hminst
DA_REPO=adb-dev-live
DA_REF=main

# Local port for this proxy server
PORT=4000
```

There is no `DA_TOKEN` in server config. Read-only browsing (highlight/select/inspect)
works with no token at all; only the Save action requires the browser to have a token
in `sessionStorage`.

## Phase 1 — Reverse proxy server

**Build:** `tools/custom-editor/server.js` (Node, no framework required, or Express if
this repo already depends on it elsewhere — check `package.json` first) that:

- Listens on `PORT`.
- For every incoming request, fetches the same path from `TARGET_ORIGIN`, forwarding
  method, relevant headers, and body.
- Streams back the response unchanged for all non-HTML content types (JS, CSS, images,
  fonts) — these must pass through byte-for-byte so the page's own blocks/styles keep
  working.
- For HTML responses (`content-type: text/html`), buffer the body, and inject
  `<script src="/__editor/overlay.js" defer></script>` immediately before `</body>`.
  If `</body>` is not found, append at the end of the document instead of failing.
- Serves `/__editor/overlay.js` and any other editor assets (`/__editor/overlay.css`,
  `/__editor/inspector.html` if used) directly from this tool's own static files,
  not proxied.
- Serves `GET /__editor/config` returning `{ daOrg, daRepo, daRef }` (the non-secret
  values from `.env`) as JSON, so `overlay.js` knows which Source/Admin API URLs to
  build. This is the *only* editor-specific server route — there is no save/preview
  route; those calls go straight from the browser to `admin.da.live` /
  `admin.hlx.page`.

**Acceptance criteria:**
- Visiting `http://localhost:PORT/accordion` renders visually identical to
  `TARGET_ORIGIN/accordion`, with the overlay script tag present in view-source.
- Non-HTML assets (check at least one JS, one CSS, one image) load with correct
  content-type and are byte-identical to the origin.
- `server.js` contains no reference to a DA/IMS token anywhere in its source, and
  proxy request logs (if any) never include an `Authorization` header value.

## Phase 2 — Hover highlight

**Build:** `tools/custom-editor/public/overlay.js`, injected into the page.

- On load, wait for EDS decoration: poll (or use a `MutationObserver`) until
  `document.body.dataset.blockStatus` / individual blocks report
  `data-block-status="loaded"`, or simply wait for `window.addEventListener('load')`
  plus a short settle delay — verify empirically against the target page which signal
  is reliable, since this project's `scripts.js` controls decoration timing.
- Query all elements with `[data-block-name]` inside `main`.
- On `mouseover`/`mouseout` (delegated at `document` level, not per-element listeners,
  since blocks can be re-decorated), toggle a highlight state on the element currently
  under the cursor.
- Render the highlight as a non-intrusive overlay: prefer an absolutely-positioned
  sibling `<div>` (a "highlight box") matching the target's `getBoundingClientRect()`,
  repositioned on scroll/resize, rather than mutating the target's own `style` or
  `class` — this avoids fighting with the block's own CSS or triggering reflow of
  the underlying block.
- Show a small label near the highlight box with the block name, e.g. `card`.
- Debounce/guard so rapid mouse movement across nested elements doesn't flicker
  between parent/child — only the nearest ancestor with `data-block-name` should
  highlight (use `element.closest('[data-block-name]')`).

**Acceptance criteria:**
- Hovering over the card component at `/accordion` (or whichever page has a `card`
  block) shows a highlight outline that tightly tracks the card's bounds, labeled
  `card`.
- Hovering over nested content inside the card highlights the card, not an inner
  element, unless the inner element itself has its own `data-block-name`.
- Scrolling the page while hovering keeps the highlight aligned (or hides it if the
  target scrolls out of view — either is acceptable, but it must not visually detach).

## Phase 3 — Click to select

**Build:** extend `overlay.js`.

- On `click` of an element resolving via `closest('[data-block-name]')`, prevent the
  page's default click behavior (`event.preventDefault()`), mark that element as
  "selected" (single-selection model — selecting a new block deselects the previous
  one), and render a **visually distinct** persistent outline (e.g. solid accent-color
  border + subtle fill) that stays even when the mouse moves away, as opposed to the
  hover highlight which disappears on mouseout.
- Clicking empty page background (not inside any `[data-block-name]`) clears the
  selection.
- Clicking the currently-selected block again keeps it selected (idempotent), it does
  not toggle deselection — deselection only happens via clicking elsewhere or an
  explicit "close" affordance in the inspector panel (Phase 4).
- Keep hover highlighting active independently of selection — both states can be
  visible at once (hovering over a different block while another is selected).
- Suppress link/button default actions only within the *editor's own* interaction;
  don't globally disable the page's interactivity, since the goal is later to inspect
  real authored content, not to break the page. A reasonable approach: `preventDefault`
  only on the top-level click, not on subsequent synthetic interactions.

**Acceptance criteria:**
- Clicking the card component gives it a persistent selection outline distinct in
  color/style from the hover highlight.
- Clicking a different block moves the selection there and removes it from the
  previous block.
- Clicking outside any block clears selection entirely.
- The card's own links/buttons are not permanently broken for later manual testing —
  document any tradeoff made here.

## Phase 4 — Inspector panel + save-back workflow

**Build:** extend `overlay.js` plus a small panel UI (can be plain DOM built in JS,
or a separate `inspector.css`; keep dependencies minimal — no framework needed for
this scope).

1. **Inspector panel.** On selection, show a fixed-position side panel (e.g. right
   edge of viewport) displaying:
   - An auth status area at the top (see "Browser-side token resolution" above):
     "Connect to DA" prompt + token paste field when disconnected, a short
     "Connected" indicator + "Disconnect" action when a token is present.
   - The block name (`data-block-name`) and any other `data-*` attributes on the
     block, read-only.
   - The block's authored field values, editable. To populate these, the overlay
     needs to know the block's *content model* (field names/order) — reuse this
     project's existing block content model if available (check `component-models.json`
     at the repo root and `blocks/<name>/` for existing authoring conventions) rather
     than inventing a new one. For an unmapped block, fall back to listing raw
     text nodes/cell values by position with generic labels ("Field 1", "Field 2", …).
   - A "Save" button (disabled while disconnected) and a "Cancel"/"Close" button.

2. **Save flow**, triggered by "Save" — entirely in the browser, in `overlay.js` /
   `public/lib/da-source.js` / `public/lib/admin-api.js`:
   - Read the token from `sessionStorage`; if absent, show the "Connect to DA" prompt
     instead of attempting the call.
   - Fetch `GET /__editor/config` (same-origin, no token needed) once per page load to
     get `{ daOrg, daRepo, daRef }`.
   - a. Fetch the current DA source HTML for the page directly from the browser:
        `GET https://admin.da.live/source/{daOrg}/{daRepo}/{path}.html`
        (`Authorization: Bearer <token>`) — verify the correct source extension/format
        against the `da-content` skill reference and by inspecting a real fetched
        document before assuming.
     b. Locate the corresponding block instance in the source fragment (match by
        block name + ordinal index, since DA source uses either the canonical
        `<div class="block-name ...">` form or the table alternate — handle whichever
        form the source actually uses; do not assume one without checking).
     c. Rewrite only that block's cell content with the edited values, using the
        §3.9 inline-tag-preserve rules from the `da-content` skill (don't introduce
        `<span>`, raw `<b>`/`<i>`, etc. — normalize to the tags DA's pipeline expects).
        Leave everything else in the document byte-for-byte untouched. This rewriting
        logic (`block-patch.js`) is pure and framework-free so it can run unmodified
        in the browser.
     d. `PUT` the modified fragment directly to
        `https://admin.da.live/source/{daOrg}/{daRepo}/{path}`
        (`Authorization: Bearer <token>`) as `multipart/form-data` with field name
        `data` (exactly — see the silent-failure rule above). Browser `fetch` with a
        `FormData` body sets the correct multipart headers automatically — don't set
        `Content-Type` manually or the boundary will be wrong.
     e. On success, `POST` directly to
        `https://admin.hlx.page/preview/{daOrg}/{daRepo}/{daRef}/{path}`
        (`Authorization: Bearer <token>`) to regenerate the preview.
     f. Show a toast/inline status in the panel ("Saved" / "Save failed: <reason>").
   - After a successful save, prompt the user to reload the proxied page (or
     auto-reload after a short delay) to see the update, since the change went
     through DA + preview regeneration on the real origin, not a local DOM patch.

3. **Error handling** (only for realistic failure modes, not hypothetical ones):
   - No token in `sessionStorage` → show "Connect to DA" instead of attempting any
     network call.
   - `401` with empty body on any DA/Admin API call → treat as expired token: clear
     `sessionStorage`, show "Connect to DA" again, with the message "Your DA session
     expired — please reconnect."
   - CORS failure (the `fetch` rejects with a generic network error, or a preflight
     `OPTIONS` 4xx/5xx) → surface this distinctly from a 401, e.g. "Could not reach
     DA directly from the browser (possible CORS restriction) — see Architecture
     overview in INSTRUCTIONS.md", since this is architecturally different from an
     auth problem and needs a different fix.
   - DA Source API 404 (page not found at expected path) → surface the path that was
     requested so the mismatch is debuggable.
   - Admin API preview call failing (e.g. `409` from oversized assets, unrelated to
     this tool but part of the documented contract) → surface DA's error message
     verbatim rather than swallowing it.

**Acceptance criteria:**
- Selecting the card block populates the inspector with its current field values.
- With no token connected, clicking Save does nothing but prompt to connect (no
  network call is made).
- After pasting a valid token and editing a text field, clicking Save results in the
  DA source document being updated (verify by re-fetching the source via the API, or
  by reloading `da.live`'s own editor for that page) and the preview being
  regenerated — confirmed via the browser's Network tab showing requests going
  directly to `admin.da.live` / `admin.hlx.page`, not through the Node server.
- The Node server (`server.js` and its logs) never receives or stores the token —
  confirm by checking that no `/__editor/*` request in the Network tab carries an
  `Authorization` header.
- Simulating a `401` (e.g. an intentionally invalid pasted token) triggers the
  "reconnect" prompt rather than a silent failure or crash.

## Suggested file layout

```
tools/custom-editor/
  server.js              # proxy + injection + GET /__editor/config (no DA calls, no token)
  package.json
  .env.example
  README.md              # end-user usage docs (separate from this build spec)
  public/
    overlay.js            # hover/select/inspector client logic + save-flow orchestration
    overlay.css
    lib/
      da-source.js         # browser-side: fetch/patch/PUT DA source documents directly
      admin-api.js          # browser-side: preview/publish calls directly
      block-patch.js        # locate + rewrite a block's cells in a DA fragment (pure, isomorphic)
  test/
    block-patch.test.js    # unit tests for the fragment-rewriting logic (pure functions, no network,
                            # imports public/lib/block-patch.js directly since it has no browser-only APIs)
```

`block-patch.js` must stay dependency-free and free of both Node-only APIs (`fs`,
`Buffer`, etc.) and browser-only APIs (`document`, `fetch`) so the same file is
loaded by both the browser (`<script type="module">` from `public/lib/`) and the
Node test runner without a build step.

## Build order (do not reorder)

1. Phase 1 (proxy) — verify byte-identical passthrough before writing any overlay code.
2. Phase 2 (hover highlight) — verify visually in a real browser against the target
   URL before adding selection.
3. Phase 3 (click select) — verify selection/deselection behavior manually.
4. Phase 4 (inspector + save) — build `public/lib/block-patch.js` as pure,
   unit-testable functions first (given a DA fragment string + block index + new
   values, return the rewritten fragment string), then verify the CORS assumption
   with a real browser `fetch()` against `admin.da.live` before wiring up the rest of
   the save flow, so the trickiest logic (block matching + safe rewriting) and the
   riskiest architectural assumption (direct browser-to-DA calls succeeding) are both
   validated early and independently.

## Testing expectations

Per this project's `testing-blocks` conventions: write unit tests for
`public/lib/block-patch.js` (pure logic, easy to get wrong, high value to test) using
fixtures for both the canonical div form and the table alternate. Browser-test
Phases 2–4 manually against the real proxied `/accordion` page (or via Playwright if
already set up in this repo) rather than writing brittle DOM-highlighting unit tests.
Do not write tests for the raw proxy passthrough beyond a basic smoke check. Do not
write unit tests for `da-source.js`/`admin-api.js` (thin network-call wrappers) —
verify those manually against the real APIs as described in Phase 4's acceptance
criteria.

/**
 * Canonical DA source HTML for things the palette can drop onto the page,
 * pre-filled with placeholder content so they render sensibly before an
 * author replaces it. Pure string generation - no document/fetch - same
 * "loaded unmodified by browser and Node test runner" rule as block-patch.js.
 *
 * Two distinct `kind`s, handled very differently on drop (see overlay.js):
 *  - 'block'   inserted *inside* an existing section (insertBlockIntoSection).
 *    Shape matches what that block's own decoration JS expects - see
 *    blocks/<name>/<name>.js. Keep these two things in sync if a block's
 *    expected markup changes.
 *  - 'section' inserted as a brand-new sibling of the existing sections,
 *    directly under `<main>` (insertSection). A section must never end up
 *    nested inside another section.
 */

/**
 * blocks/hero/hero.js: last `:scope > div` row is the foreground (must
 * contain a heading, optionally preceded by a "detail" element); an earlier
 * row, if present, is the background (a picture). Placeholder image is a
 * real, reachable URL (placehold.co) so EDS preview can build a proper
 * `<picture>` from it instead of producing `about:error`.
 */
export function heroBlockHtml() {
  return [
    '<div class="hero">',
    '<div><div><picture><img src="https://placehold.co/1600x900/6d5efc/ffffff?text=Hero+Image" alt="Placeholder hero image"></picture></div></div>',
    '<div><div><h1>Your headline goes here</h1><p>Add a short supporting sentence about this hero section.</p></div></div>',
    '</div>',
  ].join('\n');
}

/**
 * A brand-new, empty content section. A section only gains
 * `class="section"` from client-side decoration (ak.js) - authoring it with
 * that class already present would be wrong (and confusable with the
 * decorated state); the authored form is just a bare, unclassed `<div>`.
 */
export function plainSectionHtml() {
  return [
    '<div>',
    '<h2>Section heading</h2>',
    '<p>Some placeholder content for this section.</p>',
    '</div>',
  ].join('\n');
}

export const BLOCK_TEMPLATES = {
  hero: { label: 'Hero', kind: 'block', html: heroBlockHtml },
  section: { label: 'Section', kind: 'section', html: plainSectionHtml },
};

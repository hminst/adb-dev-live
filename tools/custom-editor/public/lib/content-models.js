/**
 * Per-block field metadata layered on top of the purely structural fields
 * `getBlockFields` (block-patch.js) returns. `getBlockFields` only knows a
 * field's position and raw shape (`image` vs `text` + wrapper tag) - it has
 * no idea what a field *means* for a given block. This registry supplies
 * that meaning: a human label, and (for `heading`/`richtext`) a more
 * specific editing behavior than a plain textarea.
 *
 * Pure, framework-free (no `document`/`fetch`) - loaded unmodified by both
 * the browser and the Node test runner, same rule as block-patch.js and
 * block-templates.js.
 */

import { normalizeBlockName } from './block-patch.js';

/**
 * Field descriptors are matched to a block occurrence's structural fields
 * *positionally*, in the same document order getBlockFields already
 * produces - see applyContentModel. Each descriptor:
 *   { name, kind: 'image'|'heading'|'richtext'|'text', label, altLabel?, headingLevels? }
 * `name` is a stable identifier for the field (not shown in the UI - `label`
 * is); `altLabel` only applies to `image`; `headingLevels` only to `heading`.
 */
export const CONTENT_MODELS = {
  hero: {
    fields: [
      {
        name: 'heroImage', kind: 'image', label: 'Hero image', altLabel: 'Hero image alt text',
      },
      {
        name: 'heroTitle', kind: 'heading', label: 'Hero title', headingLevels: ['h1', 'h2', 'h3'],
      },
      { name: 'heroText', kind: 'richtext', label: 'Hero text' },
    ],
  },
  card: {
    fields: [
      {
        name: 'cardImage', kind: 'image', label: 'Card image', altLabel: 'Card image alt text',
      },
      // Card's title (`<p><strong>...</strong></p>`, not a heading tag - see
      // blocks/card/card.js) has no heading level to pick, unlike hero's.
      { name: 'cardTitle', kind: 'text', label: 'Card title' },
      { name: 'cardText', kind: 'richtext', label: 'Card text' },
    ],
  },
};

/**
 * Content model for a section's section-metadata key/value rows (see
 * block-patch.js's getSectionMetadataFields/setSectionMetadataFields) -
 * keyed by the row's own `key` (case-insensitive), not by block name, since
 * a section-metadata row isn't a block occurrence and each row is
 * independent (no fixed shape/count to match positionally the way
 * CONTENT_MODELS/applyContentModel do above). Reflects exactly what
 * blocks/section-metadata/section-metadata.js and its .css actually do with
 * each key - see that file before changing an options list here.
 *   - 'select': a single value from `options` (always includes '' for "off"/
 *     unset); `grid`/`gap`/`spacing`/`container` are one CSS class each.
 *   - 'multiselect': independent boolean tokens, comma-separated in the
 *     field's raw value (e.g. "center, container"); `style` is the only key
 *     authored this way.
 *   - 'color': free text - a CSS color or this project's `color-token-*`
 *     convention (see handleBackground) - no fixed enum to select from.
 */
export const SECTION_METADATA_MODELS = {
  style: { label: 'Style', kind: 'multiselect', options: ['center', 'container'] },
  grid: { label: 'Grid columns', kind: 'select', options: ['', '2', '3', '4', '5', '6'] },
  gap: { label: 'Gap', kind: 'select', options: ['', 'xs', 's', 'm', 'l', 'xl', 'xxl'] },
  spacing: { label: 'Spacing', kind: 'select', options: ['', 'xs', 's', 'm', 'l', 'xl', 'xxl'] },
  container: { label: 'Container width', kind: 'select', options: ['', '2', '4', '6'] },
  'background-color': { label: 'Background color', kind: 'color' },
};

/**
 * Layer SECTION_METADATA_MODELS onto a section's metadata fields (as
 * returned by getSectionMetadataFields). Unlike applyContentModel, this
 * matches per-field by `key` rather than requiring the whole set to match a
 * fixed shape/count - each section-metadata row is independent. A key with
 * no registered model (a hand-authored one-off) is returned unchanged,
 * falling back to a plain text field.
 */
export function applySectionMetadataModel(fields) {
  return fields.map((field) => {
    const model = SECTION_METADATA_MODELS[field.key.toLowerCase()];
    return model ? { ...field, model } : field;
  });
}

function structuralKindMatches(modelKind, structuralField) {
  if (modelKind === 'image') return structuralField.kind === 'image';
  // 'heading', 'richtext', and plain 'text' model fields all back onto a
  // structural 'text' field (an element that isn't a <picture>/<img>).
  return structuralField.kind === 'text';
}

/**
 * Layer a block's content model onto its structural fields (as returned by
 * getBlockFields), in document order. Returns new field objects - the
 * original structural properties (kind/rowIndex/cellIndex/elementIndex/
 * value/src/alt/wrapperTag - whatever setBlockFields needs to write back)
 * untouched, plus a `.model` descriptor - when the model's shape matches
 * the occurrence's actual fields exactly (same count, compatible kind at
 * every position). If the block's content has drifted from the model (e.g.
 * an extra hand-added paragraph, or a field kind mismatch), returns the
 * structural fields completely unchanged so the caller falls back to the
 * generic per-position Text/Image labels rather than mis-render.
 */
export function applyContentModel(blockName, structuralFields) {
  const model = CONTENT_MODELS[normalizeBlockName(blockName)];
  if (!model) return structuralFields;
  if (model.fields.length !== structuralFields.length) return structuralFields;
  const matches = model.fields.every(
    (modelField, i) => structuralKindMatches(modelField.kind, structuralFields[i]),
  );
  if (!matches) return structuralFields;
  return structuralFields.map((field, i) => ({ ...field, model: model.fields[i] }));
}

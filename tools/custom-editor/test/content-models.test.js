import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBlockFields, getSectionMetadataFields } from '../public/lib/block-patch.js';
import { heroBlockHtml, cardBlockHtml } from '../public/lib/block-templates.js';
import { applyContentModel, applySectionMetadataModel } from '../public/lib/content-models.js';

const PAGE = (main) => `<body><header></header><main>${main}</main><footer></footer></body>`;

test('applyContentModel annotates hero\'s three fields with its model, in order', () => {
  const html = PAGE(`<div>${heroBlockHtml()}</div>`);
  const structural = getBlockFields(html, 'hero', 0);
  const fields = applyContentModel('hero', structural);

  assert.equal(fields.length, 3);
  assert.equal(fields[0].kind, 'image');
  assert.equal(fields[0].model.name, 'heroImage');
  assert.equal(fields[0].model.label, 'Hero image');
  assert.equal(fields[0].model.altLabel, 'Hero image alt text');

  assert.equal(fields[1].kind, 'text');
  assert.equal(fields[1].wrapperTag, 'h1');
  assert.equal(fields[1].model.name, 'heroTitle');
  assert.deepEqual(fields[1].model.headingLevels, ['h1', 'h2', 'h3']);

  assert.equal(fields[2].kind, 'text');
  assert.equal(fields[2].wrapperTag, 'p');
  assert.equal(fields[2].model.name, 'heroText');
  assert.equal(fields[2].model.kind, 'richtext');
});

test('applyContentModel preserves the original structural properties setBlockFields needs', () => {
  const html = PAGE(`<div>${heroBlockHtml()}</div>`);
  const structural = getBlockFields(html, 'hero', 0);
  const fields = applyContentModel('hero', structural);
  fields.forEach((field, i) => {
    const { model, ...rest } = field;
    assert.deepEqual(rest, structural[i]);
  });
});

test('applyContentModel falls back to unmodified fields when the field count drifted from the model', () => {
  const html = PAGE(`<div><div class="hero"><div><div><picture><img src="a.jpg" alt="a"></picture></div></div><div><div><h1>Title</h1><p>Text</p><p>Extra unmodeled paragraph</p></div></div></div></div>`);
  const structural = getBlockFields(html, 'hero', 0);
  const fields = applyContentModel('hero', structural);
  assert.deepEqual(fields, structural);
  assert.ok(fields.every((f) => !('model' in f)));
});

test('applyContentModel falls back when a position\'s kind is incompatible with the model', () => {
  // Model expects image, heading, richtext (in that order) - here the first
  // field is text, not an image, so the model does not apply.
  const html = PAGE(`<div><div class="hero"><div><div><p>Not an image</p></div></div><div><div><h1>Title</h1><p>Text</p></div></div></div></div>`);
  const structural = getBlockFields(html, 'hero', 0);
  const fields = applyContentModel('hero', structural);
  assert.deepEqual(fields, structural);
});

test('applyContentModel passes through fields for a block with no registered model unchanged', () => {
  const html = PAGE('<div><div class="accordion"><div><div><p>Some text</p></div></div></div></div>');
  const structural = getBlockFields(html, 'accordion', 0);
  const fields = applyContentModel('accordion', structural);
  assert.deepEqual(fields, structural);
});

test('applyContentModel annotates card\'s three fields with its model, in order', () => {
  const html = PAGE(`<div>${cardBlockHtml()}</div>`);
  const structural = getBlockFields(html, 'card', 0);
  const fields = applyContentModel('card', structural);

  assert.equal(fields.length, 3);
  assert.equal(fields[0].kind, 'image');
  assert.equal(fields[0].model.name, 'cardImage');
  assert.equal(fields[0].model.label, 'Card image');
  assert.equal(fields[0].model.altLabel, 'Card image alt text');

  assert.equal(fields[1].kind, 'text');
  assert.equal(fields[1].wrapperTag, 'p');
  assert.equal(fields[1].model.name, 'cardTitle');
  assert.equal(fields[1].model.kind, 'text');

  assert.equal(fields[2].kind, 'text');
  assert.equal(fields[2].wrapperTag, 'p');
  assert.equal(fields[2].model.name, 'cardText');
  assert.equal(fields[2].model.kind, 'richtext');
});

test('applyContentModel falls back to unmodified fields for a card with a drifted field count', () => {
  const html = PAGE('<div><div class="card"><div><div><p><picture><img src="a.jpg" alt="a"></picture></p><p><strong>Title</strong></p><p>Text</p><p>Extra unmodeled paragraph</p></div></div></div></div>');
  const structural = getBlockFields(html, 'card', 0);
  const fields = applyContentModel('card', structural);
  assert.deepEqual(fields, structural);
});

const SECTION_METADATA_HTML = `<main><div>
  <p>Content</p>
  <div class="section-metadata">
    <div><div>style</div><div>center, container</div></div>
    <div><div>grid</div><div>4</div></div>
    <div><div>background-color</div><div>color-token-brand</div></div>
    <div><div>custom-key</div><div>anything</div></div>
  </div>
</div></main>`;

test('applySectionMetadataModel attaches the right model kind/options to each recognized key', () => {
  const fields = applySectionMetadataModel(getSectionMetadataFields(SECTION_METADATA_HTML, 0));

  const style = fields.find((f) => f.key === 'style');
  assert.equal(style.model.kind, 'multiselect');
  assert.deepEqual(style.model.options, ['center', 'container']);

  const grid = fields.find((f) => f.key === 'grid');
  assert.equal(grid.model.kind, 'select');
  assert.deepEqual(grid.model.options, ['', '2', '3', '4', '5', '6']);

  const bg = fields.find((f) => f.key === 'background-color');
  assert.equal(bg.model.kind, 'color');
});

test('applySectionMetadataModel leaves an unrecognized key unchanged (no model, falls back to plain text)', () => {
  const fields = applySectionMetadataModel(getSectionMetadataFields(SECTION_METADATA_HTML, 0));
  const custom = fields.find((f) => f.key === 'custom-key');
  assert.ok(!('model' in custom));
});

test('applySectionMetadataModel preserves the original structural properties setSectionMetadataFields needs', () => {
  const structural = getSectionMetadataFields(SECTION_METADATA_HTML, 0);
  const fields = applySectionMetadataModel(structural);
  fields.forEach((field, i) => {
    const { model, ...rest } = field;
    assert.deepEqual(rest, structural[i]);
  });
});

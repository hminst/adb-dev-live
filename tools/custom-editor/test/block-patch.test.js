import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBlockName,
  listOccurrences,
  getBlockCells,
  setBlockCells,
  getBlockFields,
  setBlockFields,
  getSectionDefaultContentFields,
  setSectionDefaultContentFields,
  deleteSectionDefaultContentElement,
  getSectionMetadataFields,
  setSectionMetadataFields,
  getSectionChildCount,
  insertBlockIntoSection,
  deleteBlockOccurrence,
  getSectionCount,
  moveSection,
  insertSection,
} from '../public/lib/block-patch.js';

// Captured verbatim from the real rendered /accordion page's first card, via
// `curl https://main--adb-dev-live--hminst.preview.da.live/accordion` - the
// actual shape this tool has to handle, not a guessed one.
const REAL_CARD_HTML = `<div class="card">
          <div>
            <div>
              <p>
                <picture>
                  <source type="image/webp" srcset="./media_1300083772e9645ea9463e3ff16e3a87fec824b7c.jpg?width=2000&#x26;format=webply&#x26;optimize=medium" media="(min-width: 600px)">
                  <source type="image/webp" srcset="./media_1300083772e9645ea9463e3ff16e3a87fec824b7c.jpg?width=750&#x26;format=webply&#x26;optimize=medium">
                  <source type="image/jpeg" srcset="./media_1300083772e9645ea9463e3ff16e3a87fec824b7c.jpg?width=2000&#x26;format=jpg&#x26;optimize=medium" media="(min-width: 600px)">
                  <img loading="lazy" alt="A fast-moving Tunnel" src="./media_1300083772e9645ea9463e3ff16e3a87fec824b7c.jpg?width=750&#x26;format=jpg&#x26;optimize=medium" width="1600" height="909">
                </picture>
              </p>
              <p><strong>Unmatched speed</strong></p>
              <p>AEM is the fastest way to publish, create, and serve websites.</p>
            </div>
          </div>
        </div>`;

test('normalizeBlockName lowercases and hyphenates', () => {
  assert.equal(normalizeBlockName('Card'), 'card');
  assert.equal(normalizeBlockName('Hero Banner'), 'hero-banner');
  assert.equal(normalizeBlockName(' card '), 'card');
});

test('div form: finds a single block occurrence and reads its cells', () => {
  const html = `
    <div class="section">
      <div class="card">
        <div>
          <div><picture><img src="/image.png" alt="Alt text"></picture></div>
          <div><p>Some card text</p></div>
        </div>
      </div>
    </div>
  `;
  const occurrences = listOccurrences(html, 'card');
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].form, 'div');

  const cells = getBlockCells(html, 'card', 0);
  assert.equal(cells.length, 2);
  assert.match(cells[0], /<picture>/);
  assert.match(cells[1], /Some card text/);
});

test('div form: matches multiple separate instances in document order', () => {
  const html = `
    <div class="card"><div><div>A1</div><div>A2</div></div></div>
    <div class="unrelated"><div>x</div></div>
    <div class="card"><div><div>B1</div><div>B2</div></div></div>
  `;
  const occurrences = listOccurrences(html, 'card');
  assert.equal(occurrences.length, 2);

  assert.deepEqual(getBlockCells(html, 'card', 0), ['A1', 'A2']);
  assert.deepEqual(getBlockCells(html, 'card', 1), ['B1', 'B2']);
});

test('div form: variant classes are ignored, block name matches first token only', () => {
  const html = '<div class="card highlight"><div><div>x</div><div>y</div></div></div>';
  assert.equal(listOccurrences(html, 'card').length, 1);
});

test('div form: setBlockCells rewrites only the targeted cells', () => {
  const html = '<div class="card"><div><div>old image</div><div>old text</div></div></div>';
  const updated = setBlockCells(html, 'card', 0, ['new image', 'new text']);
  assert.equal(
    updated,
    '<div class="card"><div><div>new image</div><div>new text</div></div></div>',
  );
});

test('div form: setBlockCells leaves surrounding document untouched', () => {
  const html = `
    <div class="section-metadata"><div>keep me</div></div>
    <div class="card"><div><div>old</div><div>text</div></div></div>
    <div class="metadata"><div>also keep</div></div>
  `;
  const updated = setBlockCells(html, 'card', 0, ['NEW', 'TEXT']);
  assert.match(updated, /section-metadata"><div>keep me<\/div>/);
  assert.match(updated, /class="metadata"><div>also keep<\/div>/);
  assert.match(updated, /<div class="card"><div><div>NEW<\/div><div>TEXT<\/div><\/div><\/div>/);
});

test('div form: setBlockCells throws on a value-count mismatch', () => {
  const html = '<div class="card"><div><div>a</div><div>b</div></div></div>';
  assert.throws(() => setBlockCells(html, 'card', 0, ['only one']));
});

test('div form: nested divs inside a cell do not break matching', () => {
  const html = `
    <div class="card">
      <div>
        <div><div class="nested"><span>deep</span></div></div>
        <div><p>text</p></div>
      </div>
    </div>
  `;
  const cells = getBlockCells(html, 'card', 0);
  assert.equal(cells.length, 2);
  assert.match(cells[0], /nested/);
});

test('missing occurrence throws a clear error', () => {
  const html = '<div class="other"><div><div>a</div></div></div>';
  assert.throws(() => getBlockCells(html, 'card', 0), /not found/);
});

test('table form: header row identifies the block, data row supplies cells', () => {
  const html = `
    <table>
      <tr><td colspan="2">Card</td></tr>
      <tr><td>image cell</td><td>text cell</td></tr>
    </table>
  `;
  const occurrences = listOccurrences(html, 'card');
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].form, 'table');

  const cells = getBlockCells(html, 'card', 0);
  assert.deepEqual(cells, ['image cell', 'text cell']);
});

test('table form: header text with a variant in parentheses still matches', () => {
  const html = `
    <table>
      <tr><td>Card (highlight)</td></tr>
      <tr><td>only cell</td></tr>
    </table>
  `;
  assert.equal(listOccurrences(html, 'card').length, 1);
});

test('table form: setBlockCells rewrites only the data row', () => {
  const html = `<table><tr><td colspan="2">Card</td></tr><tr><td>old img</td><td>old text</td></tr></table>`;
  const updated = setBlockCells(html, 'card', 0, ['new img', 'new text']);
  assert.equal(
    updated,
    '<table><tr><td colspan="2">Card</td></tr><tr><td>new img</td><td>new text</td></tr></table>',
  );
});

test('div and table occurrences of the same block name are both found, in document order', () => {
  const html = `
    <div class="card"><div><div>div-a</div></div></div>
    <table><tr><td>Card</td></tr><tr><td>table-a</td></tr></table>
  `;
  const occurrences = listOccurrences(html, 'card');
  assert.equal(occurrences.length, 2);
  assert.equal(occurrences[0].form, 'div');
  assert.equal(occurrences[1].form, 'table');
});

test('getBlockFields splits a real single-cell card into image/title/body fields', () => {
  const fields = getBlockFields(REAL_CARD_HTML, 'card', 0);
  assert.equal(fields.length, 3);

  assert.equal(fields[0].kind, 'image');
  assert.equal(fields[0].src, './media_1300083772e9645ea9463e3ff16e3a87fec824b7c.jpg?width=750&format=jpg&optimize=medium');
  assert.equal(fields[0].alt, 'A fast-moving Tunnel');

  assert.equal(fields[1].kind, 'text');
  assert.equal(fields[1].wrapperTag, 'p');
  assert.equal(fields[1].value, '<strong>Unmatched speed</strong>');

  assert.equal(fields[2].kind, 'text');
  assert.equal(fields[2].wrapperTag, 'p');
  assert.equal(fields[2].value, 'AEM is the fastest way to publish, create, and serve websites.');

  // all three fields came from the same (only) cell
  assert.deepEqual(fields.map((f) => f.cellIndex), [0, 0, 0]);
  assert.deepEqual(fields.map((f) => f.elementIndex), [0, 1, 2]);
});

test('setBlockFields round-trips edited title/body text back into the source', () => {
  const fields = getBlockFields(REAL_CARD_HTML, 'card', 0);
  fields[1].value = '<strong>Blazing speed</strong>';
  fields[2].value = 'Updated body copy.';

  const updated = setBlockFields(REAL_CARD_HTML, 'card', 0, fields);
  const reread = getBlockFields(updated, 'card', 0);

  assert.equal(reread[1].value, '<strong>Blazing speed</strong>');
  assert.equal(reread[2].value, 'Updated body copy.');
  // image field untouched
  assert.equal(reread[0].src, fields[0].src);
  assert.equal(reread[0].alt, fields[0].alt);
});

test('setBlockFields round-trips an edited image src/alt', () => {
  const fields = getBlockFields(REAL_CARD_HTML, 'card', 0);
  fields[0].src = '/media/new-image.jpg';
  fields[0].alt = 'A new alt text';

  const updated = setBlockFields(REAL_CARD_HTML, 'card', 0, fields);
  const reread = getBlockFields(updated, 'card', 0);

  assert.equal(reread[0].kind, 'image');
  assert.equal(reread[0].src, '/media/new-image.jpg');
  assert.equal(reread[0].alt, 'A new alt text');
  assert.match(updated, /<picture><img src="\/media\/new-image.jpg" alt="A new alt text"><\/picture>/);
});

test('getBlockFields: a cell with a single element behaves like the whole-cell case', () => {
  const html = '<div class="card"><div><div><p>only one paragraph</p></div></div></div>';
  const fields = getBlockFields(html, 'card', 0);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].kind, 'text');
  assert.equal(fields[0].value, 'only one paragraph');
});

test('getBlockFields: a multi-cell block (image cell + text cell) still splits per cell', () => {
  const html = `
    <div class="card">
      <div>
        <div><picture><img src="/a.png" alt="A"></picture></div>
        <div><p>Some text</p></div>
      </div>
    </div>
  `;
  const fields = getBlockFields(html, 'card', 0);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].kind, 'image');
  assert.equal(fields[0].cellIndex, 0);
  assert.equal(fields[1].kind, 'text');
  assert.equal(fields[1].cellIndex, 1);
});

test('setBlockFields escapes attribute-breaking characters in image src/alt', () => {
  const html = '<div class="card"><div><div><picture><img src="/a.png" alt="old"></picture></div></div></div>';
  const fields = getBlockFields(html, 'card', 0);
  fields[0].alt = 'Quote " and & ampersand';
  const updated = setBlockFields(html, 'card', 0, fields);
  assert.match(updated, /alt="Quote &quot; and &amp; ampersand"/);
});

const SECTION_WITH_DEFAULT_CONTENT_HTML = `<main>
  <div>
    <h2>Let's do this</h2>
    <p><a href="https://example.com">New window</a></p>
    <div class="card"><div><div>A1</div><div>A2</div></div></div>
    <div class="card"><div><div>B1</div><div>B2</div></div></div>
  </div>
</main>`;

test('getSectionDefaultContentFields returns only non-block top-level children', () => {
  const fields = getSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 0);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].kind, 'text');
  assert.equal(fields[0].wrapperTag, 'h2');
  assert.equal(fields[0].value, "Let's do this");
  assert.equal(fields[1].kind, 'text');
  assert.equal(fields[1].wrapperTag, 'p');
  assert.equal(fields[1].value, '<a href="https://example.com">New window</a>');
});

test('getSectionDefaultContentFields numbers elementIndex among default-content elements only, skipping blocks', () => {
  const fields = getSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 0);
  assert.deepEqual(fields.map((f) => f.elementIndex), [0, 1]);
});

test('getSectionDefaultContentFields: elementIndex is unaffected by blocks interleaved before/between default content', () => {
  const html = `<main><div>
    <div class="card"><div><div>A1</div></div></div>
    <h2>First</h2>
    <div class="section-metadata"><div><div>style</div><div>center</div></div></div>
    <p>Second</p>
    <div class="card"><div><div>B1</div></div></div>
  </div></main>`;
  const fields = getSectionDefaultContentFields(html, 0);
  assert.deepEqual(fields.map((f) => f.value), ['First', 'Second']);
  assert.deepEqual(fields.map((f) => f.elementIndex), [0, 1]);
});

test('setSectionDefaultContentFields writes a single field without disturbing the other default-content elements', () => {
  const fields = getSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 0);
  const onlySecondField = [fields[1]];
  onlySecondField[0].value = '<a href="https://example.com">Updated</a>';
  const updated = setSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 0, onlySecondField);
  assert.match(updated, /<h2>Let's do this<\/h2>/); // first field untouched
  assert.match(updated, /<p><a href="https:\/\/example.com">Updated<\/a><\/p>/);
});

test('deleteSectionDefaultContentElement removes just the one element, keeping blocks and other default content', () => {
  const updated = deleteSectionDefaultContentElement(SECTION_WITH_DEFAULT_CONTENT_HTML, 0, 0);
  assert.doesNotMatch(updated, /Let's do this/);
  assert.match(updated, /<p><a href="https:\/\/example.com">New window<\/a><\/p>/);
  assert.equal(listOccurrences(updated, 'card').length, 2);

  const remainingFields = getSectionDefaultContentFields(updated, 0);
  assert.equal(remainingFields.length, 1);
  assert.equal(remainingFields[0].elementIndex, 0); // renumbered after the delete
});

test('deleteSectionDefaultContentElement throws a clear error for an out-of-range index', () => {
  assert.throws(
    () => deleteSectionDefaultContentElement(SECTION_WITH_DEFAULT_CONTENT_HTML, 0, 5),
    /no default-content element at index 5/,
  );
});

test('setSectionDefaultContentFields rewrites default content and leaves blocks untouched', () => {
  const fields = getSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 0);
  fields[0].value = 'Updated heading';
  const updated = setSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 0, fields);

  assert.match(updated, /<h2>Updated heading<\/h2>/);
  assert.match(updated, /<p><a href="https:\/\/example.com">New window<\/a><\/p>/);
  assert.match(updated, /<div class="card"><div><div>A1<\/div><div>A2<\/div><\/div><\/div>/);
  assert.match(updated, /<div class="card"><div><div>B1<\/div><div>B2<\/div><\/div><\/div>/);

  // re-reading gives back the edited value, and blocks are still found correctly
  const reread = getSectionDefaultContentFields(updated, 0);
  assert.equal(reread[0].value, 'Updated heading');
  assert.equal(listOccurrences(updated, 'card').length, 2);
});

test('getSectionDefaultContentFields: a section with only blocks has no default-content fields', () => {
  const html = '<main><div><div class="card"><div><div>x</div></div></div></div></main>';
  assert.deepEqual(getSectionDefaultContentFields(html, 0), []);
});

test('findSection: missing <main> throws a clear error', () => {
  assert.throws(() => getSectionDefaultContentFields('<div><p>no main here</p></div>', 0), /<main>/);
});

test('findSection: out-of-range sectionIndex throws a clear error', () => {
  assert.throws(() => getSectionDefaultContentFields(SECTION_WITH_DEFAULT_CONTENT_HTML, 5), /Section 5 not found/);
});

// Matches the real shape observed on the live /accordion page via curl.
const TWO_SECTIONS_WITH_METADATA_HTML = `<main>
  <div>
    <div class="card"><div><div>A1</div></div></div>
    <div class="section-metadata">
      <div><div>style</div><div>center, container</div></div>
      <div><div>grid</div><div>4</div></div>
      <div><div>gap</div><div>xl</div></div>
      <div><div>spacing</div><div>xxl</div></div>
    </div>
  </div>
  <div>
    <p>No metadata in this section.</p>
  </div>
  <div>
    <p>Second section with metadata.</p>
    <div class="section-metadata">
      <div><div>style</div><div>light-scheme</div></div>
    </div>
  </div>
</main>`;

test('getSectionMetadataFields reads key/value rows for the matching section only', () => {
  const fields = getSectionMetadataFields(TWO_SECTIONS_WITH_METADATA_HTML, 0);
  assert.deepEqual(fields.map((f) => f.key), ['style', 'grid', 'gap', 'spacing']);
  assert.deepEqual(fields.map((f) => f.value), ['center, container', '4', 'xl', 'xxl']);
});

test('getSectionMetadataFields returns [] for a section with no section-metadata block', () => {
  assert.deepEqual(getSectionMetadataFields(TWO_SECTIONS_WITH_METADATA_HTML, 1), []);
});

test('getSectionMetadataFields scopes correctly to a later section with its own metadata', () => {
  const fields = getSectionMetadataFields(TWO_SECTIONS_WITH_METADATA_HTML, 2);
  assert.deepEqual(fields.map((f) => f.key), ['style']);
  assert.deepEqual(fields.map((f) => f.value), ['light-scheme']);
});

test('setSectionMetadataFields rewrites only the edited value, keeps the key and other sections untouched', () => {
  const fields = getSectionMetadataFields(TWO_SECTIONS_WITH_METADATA_HTML, 0);
  fields[1].value = '6'; // grid: 4 -> 6
  const updated = setSectionMetadataFields(TWO_SECTIONS_WITH_METADATA_HTML, 0, fields);

  assert.match(updated, /<div>grid<\/div><div>6<\/div>/);
  assert.match(updated, /<div>style<\/div><div>center, container<\/div>/); // untouched row
  assert.match(updated, /<div>style<\/div><div>light-scheme<\/div>/); // section 2's metadata untouched
  assert.match(updated, /<div class="card"><div><div>A1<\/div><\/div><\/div>/); // block untouched

  const reread = getSectionMetadataFields(updated, 0);
  assert.equal(reread[1].value, '6');
});

test('setSectionMetadataFields throws a clear error for a section with no section-metadata block', () => {
  assert.throws(
    () => setSectionMetadataFields(TWO_SECTIONS_WITH_METADATA_HTML, 1, []),
    /no section-metadata block/,
  );
});

test('getSectionChildCount counts all top-level children, blocks included', () => {
  assert.equal(getSectionChildCount(SECTION_WITH_DEFAULT_CONTENT_HTML, 0), 4); // h2, p, card, card
});

test('insertBlockIntoSection inserts at the start, middle, and end correctly', () => {
  const html = '<main><div><p>A</p><p>B</p></div></main>';
  const newBlock = '<div class="hero"><div><div>X</div></div></div>';

  const atStart = insertBlockIntoSection(html, 0, 0, newBlock);
  assert.match(atStart, /<div class="hero">.*<\/div>\n<p>A<\/p>\n<p>B<\/p>/s);

  const inMiddle = insertBlockIntoSection(html, 0, 1, newBlock);
  assert.match(inMiddle, /<p>A<\/p>\n<div class="hero">.*<\/div>\n<p>B<\/p>/s);

  const atEnd = insertBlockIntoSection(html, 0, 2, newBlock);
  assert.match(atEnd, /<p>A<\/p>\n<p>B<\/p>\n<div class="hero">/s);
});

test('insertBlockIntoSection clamps an out-of-range index rather than throwing', () => {
  const html = '<main><div><p>A</p></div></main>';
  const updated = insertBlockIntoSection(html, 0, 99, '<div class="hero">X</div>');
  assert.match(updated, /<p>A<\/p>\n<div class="hero">X<\/div>/);
});

test('insertBlockIntoSection leaves other sections untouched', () => {
  const html = '<main><div><p>A</p></div><div><p>B</p></div></main>';
  const updated = insertBlockIntoSection(html, 1, 0, '<div class="hero">X</div>');
  assert.match(updated, /<div><p>A<\/p><\/div>/);
  assert.match(updated, /<div class="hero">X<\/div>\n<p>B<\/p>/);
});

test('heroBlockHtml produces markup that inserts, and reads back as expected image/text fields', async () => {
  const { heroBlockHtml } = await import('../public/lib/block-templates.js');
  const html = '<main><div><p>Existing content</p></div></main>';
  const updated = insertBlockIntoSection(html, 0, 1, heroBlockHtml());

  assert.equal(listOccurrences(updated, 'hero').length, 1);
  const fields = getBlockFields(updated, 'hero', 0);
  // row 0 (background): 1 image field; row 1 (foreground): heading + paragraph text fields
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map((f) => f.rowIndex), [0, 1, 1]);
  assert.equal(fields[0].kind, 'image');
  assert.match(fields[0].src, /^https:\/\/placehold\.co\//);
  assert.equal(fields[1].kind, 'text');
  assert.match(fields[1].value, /Your headline goes here/);
  assert.equal(fields[2].kind, 'text');
  assert.match(fields[2].value, /supporting sentence/);
});

test('setBlockFields writes edits across multiple rows of a multi-row block (hero)', async () => {
  const { heroBlockHtml } = await import('../public/lib/block-templates.js');
  const html = insertBlockIntoSection('<main><div></div></main>', 0, 0, heroBlockHtml());

  const fields = getBlockFields(html, 'hero', 0);
  fields[0].src = '/media/real-hero.jpg'; // row 0
  fields[0].alt = 'Real hero image';
  fields[1].value = 'A real headline'; // row 1

  const updated = setBlockFields(html, 'hero', 0, fields);
  const reread = getBlockFields(updated, 'hero', 0);
  assert.equal(reread[0].src, '/media/real-hero.jpg');
  assert.equal(reread[0].alt, 'Real hero image');
  assert.equal(reread[1].value, 'A real headline');
  assert.match(reread[2].value, /supporting sentence/); // untouched
});

test('deleteBlockOccurrence removes the whole block, leaving surrounding content and other occurrences untouched', () => {
  const html = `
    <div class="section-metadata"><div>keep me</div></div>
    <div class="card"><div><div>A1</div></div></div>
    <div class="card"><div><div>B1</div></div></div>
  `;
  const updated = deleteBlockOccurrence(html, 'card', 0);
  assert.equal(listOccurrences(updated, 'card').length, 1);
  assert.match(updated, /<div>B1<\/div>/);
  assert.doesNotMatch(updated, /A1/);
  assert.match(updated, /section-metadata"><div>keep me<\/div>/);
});

test('deleteBlockOccurrence works on the table alternate form too', () => {
  const html = '<table><tr><td colspan="2">Card</td></tr><tr><td>img</td><td>text</td></tr></table><p>after</p>';
  const updated = deleteBlockOccurrence(html, 'card', 0);
  assert.equal(listOccurrences(updated, 'card').length, 0);
  assert.match(updated, /<p>after<\/p>/);
});

test('deleteBlockOccurrence throws a clear error for a missing occurrence', () => {
  const html = '<div class="card"><div><div>A1</div></div></div>';
  assert.throws(() => deleteBlockOccurrence(html, 'card', 1), /not found/);
});

const THREE_SECTIONS_HTML = '<main><div><p>Section A</p></div><div><p>Section B</p></div><div><p>Section C</p></div></main>';

test('getSectionCount counts sections', () => {
  assert.equal(getSectionCount(THREE_SECTIONS_HTML), 3);
});

function sectionOrder(html) {
  const matches = [...html.matchAll(/Section ([A-Z])/g)];
  return matches.map((m) => m[1]);
}

test('moveSection moves a later section to the front', () => {
  const updated = moveSection(THREE_SECTIONS_HTML, 2, 0);
  assert.deepEqual(sectionOrder(updated), ['C', 'A', 'B']);
});

test('moveSection moves the first section to the end', () => {
  const updated = moveSection(THREE_SECTIONS_HTML, 0, 3);
  assert.deepEqual(sectionOrder(updated), ['B', 'C', 'A']);
});

test('moveSection moves a section into the middle', () => {
  const updated = moveSection(THREE_SECTIONS_HTML, 0, 2);
  assert.deepEqual(sectionOrder(updated), ['B', 'A', 'C']);
});

test('moveSection swapping adjacent sections both directions', () => {
  assert.deepEqual(sectionOrder(moveSection(THREE_SECTIONS_HTML, 1, 0)), ['B', 'A', 'C']);
  assert.deepEqual(sectionOrder(moveSection(THREE_SECTIONS_HTML, 0, 1)), ['A', 'B', 'C']); // adjacent forward move is a no-op position-wise
});

test('moveSection throws a clear error for an out-of-range fromIndex', () => {
  assert.throws(() => moveSection(THREE_SECTIONS_HTML, 5, 0), /Section 5 not found/);
});

test('moveSection preserves each section\'s own content exactly', () => {
  const html = '<main><div><div class="card"><div><div>A1</div></div></div></div><div><p>B</p></div></main>';
  const updated = moveSection(html, 1, 0);
  assert.match(updated, /<div><p>B<\/p><\/div>\n<div><div class="card"><div><div>A1<\/div><\/div><\/div><\/div>/);
});

test('insertSection adds a new section as a sibling of existing sections, not nested inside one', () => {
  const newSection = '<div><h2>New</h2></div>';
  const updated = insertSection(THREE_SECTIONS_HTML, 1, newSection);
  assert.equal(getSectionCount(updated), 4);
  // new section lands between A and B: <main><div>A</div><div>New</div><div>B</div><div>C</div></main>
  assert.match(
    updated,
    /<div><p>Section A<\/p><\/div>\n<div><h2>New<\/h2><\/div>\n<div><p>Section B<\/p><\/div>\n<div><p>Section C<\/p><\/div>/,
  );
});

test('insertSection at the front and at the end', () => {
  const newSection = '<div><p>front</p></div>';
  assert.deepEqual(sectionOrder(insertSection(THREE_SECTIONS_HTML, 0, newSection)), ['A', 'B', 'C']);
  assert.match(insertSection(THREE_SECTIONS_HTML, 0, newSection), /^<main><div><p>front<\/p><\/div>\n<div><p>Section A/);
  assert.match(insertSection(THREE_SECTIONS_HTML, 3, newSection), /Section C<\/p><\/div>\n<div><p>front<\/p><\/div><\/main>$/);
});

test('insertSection clamps an out-of-range index rather than throwing', () => {
  const updated = insertSection(THREE_SECTIONS_HTML, 99, '<div><p>end</p></div>');
  assert.deepEqual(sectionOrder(updated), ['A', 'B', 'C']);
  assert.match(updated, /Section C<\/p><\/div>\n<div><p>end<\/p><\/div><\/main>$/);
});

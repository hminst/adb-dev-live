/**
 * Pure, framework-free helpers for locating a block instance inside a DA
 * source HTML fragment and rewriting its cell content, without disturbing
 * anything else in the document byte-for-byte.
 *
 * No Node-only APIs (fs, Buffer) and no browser-only APIs (document, fetch) -
 * this file is loaded unmodified both by the browser (as an ES module) and by
 * the Node test runner.
 *
 * Supports both accepted DA block shapes (see da-content skill reference):
 *  - canonical div form: <div class="name ..."><div>row<div>cell</div>...</div></div>
 *  - table alternate:    <table><tr><td colspan=N>Name</td></tr><tr><td>cell</td>...</tr></table>
 *
 * Known limitation: nested tables inside a cell are not supported (rare in
 * practice); rows/cells of an outer table may be misattributed if a cell
 * contains its own <table>.
 */

export function normalizeBlockName(name) {
  return String(name).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function firstClassToken(attrs) {
  const match = /class\s*=\s*"([^"]*)"|class\s*=\s*'([^']*)'/i.exec(attrs);
  const value = match ? (match[1] ?? match[2] ?? '') : '';
  return value.trim().split(/\s+/)[0] || '';
}

/**
 * Stack-based scan for every complete `<tagName>...</tagName>` node in html,
 * tracking nesting of that tag only. Returns all nodes (not just top-level),
 * each with absolute offsets into the original html string plus a `children`
 * array (direct children of the same tag, sorted in document order).
 */
function scanTagForest(html, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}\\s*>`, 'gi');
  const stack = [];
  const all = [];
  let match = re.exec(html);
  while (match) {
    const isClose = match[0][1] === '/';
    if (!isClose) {
      const node = {
        attrs: match[0].slice(tagName.length + 1, -1),
        openStart: match.index,
        openEnd: re.lastIndex,
        children: [],
        parent: stack[stack.length - 1] || null,
      };
      if (node.parent) node.parent.children.push(node);
      stack.push(node);
    } else {
      const node = stack.pop();
      if (!node) {
        match = re.exec(html);
        // eslint-disable-next-line no-continue
        continue;
      }
      node.closeStart = match.index;
      node.closeEnd = re.lastIndex;
      node.innerHTML = html.slice(node.openEnd, node.closeStart);
      node.outerHTML = html.slice(node.openStart, node.closeEnd);
      all.push(node);
    }
    match = re.exec(html);
  }
  for (const node of all) node.children.sort((a, b) => a.openStart - b.openStart);
  all.sort((a, b) => a.openStart - b.openStart);
  return all;
}

function withinRange(child, parent) {
  return child.openStart >= parent.openEnd && child.closeEnd <= parent.closeStart;
}

function findDivBlocks(html, normalizedName) {
  const divs = scanTagForest(html, 'div');
  return divs
    .filter((node) => normalizeBlockName(firstClassToken(node.attrs)) === normalizedName)
    .map((node) => ({ form: 'div', node }));
}

function findTableBlocks(html, normalizedName) {
  const tables = scanTagForest(html, 'table');
  const trs = scanTagForest(html, 'tr');
  const tds = scanTagForest(html, 'td');

  const matches = [];
  for (const table of tables) {
    const rows = trs.filter((tr) => withinRange(tr, table)).sort((a, b) => a.openStart - b.openStart);
    if (rows.length === 0) continue;
    const headerCells = tds.filter((td) => withinRange(td, rows[0])).sort((a, b) => a.openStart - b.openStart);
    if (headerCells.length === 0) continue;
    const headerText = stripTags(headerCells[0].innerHTML).replace(/\(.*/, '').trim();
    if (normalizeBlockName(headerText) === normalizedName) {
      matches.push({ form: 'table', node: table, rows, tds });
    }
  }
  return matches;
}

/**
 * List every occurrence of a block (by name) in document order, regardless
 * of which of the two accepted forms it's authored in.
 */
export function listOccurrences(html, blockName) {
  const normalized = normalizeBlockName(blockName);
  const occurrences = [
    ...findDivBlocks(html, normalized),
    ...findTableBlocks(html, normalized),
  ];
  occurrences.sort((a, b) => a.node.openStart - b.node.openStart);
  return occurrences;
}

function getRowsAndCells(occurrence) {
  if (occurrence.form === 'div') {
    const rows = occurrence.node.children;
    return rows.map((row) => ({ row, cells: row.children }));
  }
  // table form: skip the header row (index 0); each remaining <tr>'s <td>s are one row's cells.
  const dataRows = occurrence.rows.slice(1);
  return dataRows.map((row) => ({
    row,
    cells: occurrence.tds.filter((td) => withinRange(td, row)).sort((a, b) => a.openStart - b.openStart),
  }));
}

/**
 * Get the cell content (innerHTML, trimmed) of a block occurrence's row, in
 * document order. Defaults to the first (and, for most blocks, only) row.
 */
export function getBlockCells(html, blockName, occurrenceIndex = 0, rowIndex = 0) {
  const occurrences = listOccurrences(html, blockName);
  const occurrence = occurrences[occurrenceIndex];
  if (!occurrence) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} not found`);
  }
  const rowsAndCells = getRowsAndCells(occurrence);
  const row = rowsAndCells[rowIndex];
  if (!row) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} has no row ${rowIndex}`);
  }
  return row.cells.map((cell) => cell.innerHTML.trim());
}

/**
 * Replace a block occurrence's row's cell content with `values` (must be the
 * same length as the cells currently there - use getBlockCells first to know
 * the count). Returns a new html string; everything outside the targeted
 * cells is preserved byte-for-byte.
 */
export function setBlockCells(html, blockName, occurrenceIndex, values, rowIndex = 0) {
  const occurrences = listOccurrences(html, blockName);
  const occurrence = occurrences[occurrenceIndex];
  if (!occurrence) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} not found`);
  }
  const rowsAndCells = getRowsAndCells(occurrence);
  const row = rowsAndCells[rowIndex];
  if (!row) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} has no row ${rowIndex}`);
  }
  if (values.length !== row.cells.length) {
    throw new Error(
      `Expected ${row.cells.length} values for block "${blockName}" occurrence ${occurrenceIndex} row ${rowIndex}, got ${values.length}`,
    );
  }

  const edits = row.cells
    .map((cell, i) => ({ start: cell.openEnd, end: cell.closeStart, value: values[i] }))
    .sort((a, b) => b.start - a.start); // apply right-to-left so earlier offsets stay valid

  let result = html;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  }
  return result;
}

/* --------------------------------------------------------- field splitting */
/**
 * A "cell" (as returned by getBlockCells) is often not itself the smallest
 * useful editing unit - e.g. a `card` block's single cell packs an image
 * paragraph, a title paragraph, and a body paragraph together. The
 * getBlockFields/setBlockFields pair below split each cell into its
 * top-level child elements (by tag nesting, not by tag name) and classify
 * each one as an `image` field (a <picture>/<img>) or a `text` field
 * (anything else, addressed by its own wrapper tag so <p>, <li>, <h2>, etc.
 * all round-trip correctly).
 *
 * A cell with only one top-level element behaves identically to treating
 * the whole cell as one field - no behavior change for simple blocks.
 */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Split an HTML fragment into its top-level elements (elements not nested
 * inside another element of the fragment), preserving each one's exact
 * outerHTML. Insignificant whitespace between elements is dropped.
 */
function splitTopLevelElementRanges(html) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  const elements = [];
  let depth = 0;
  let elementStart = -1;
  let match = tagRe.exec(html);
  while (match) {
    const [full, closing, rawName, selfClosingSlash] = match;
    const name = rawName.toLowerCase();
    const isVoid = VOID_ELEMENTS.has(name) || selfClosingSlash === '/';
    if (!closing) {
      if (depth === 0) elementStart = match.index;
      if (!isVoid) {
        depth += 1;
      } else if (depth === 0) {
        elements.push({ start: elementStart, end: match.index + full.length });
        elementStart = -1;
      }
    } else {
      depth -= 1;
      if (depth === 0) {
        elements.push({ start: elementStart, end: match.index + full.length });
        elementStart = -1;
      }
    }
    match = tagRe.exec(html);
  }
  return elements;
}

/** Trimmed outerHTML strings for each range splitTopLevelElementRanges finds. */
function splitTopLevelElements(html) {
  return splitTopLevelElementRanges(html).map(({ start, end }) => html.slice(start, end).trim()).filter(Boolean);
}

function unwrapWrapper(elementHtml) {
  const match = /^<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>([\s\S]*)<\/\1\s*>$/i.exec(elementHtml.trim());
  if (match) return { wrapperTag: match[1].toLowerCase(), value: match[2] };
  return { wrapperTag: null, value: elementHtml };
}

function unwrapSingleP(elementHtml) {
  const match = /^<p\b[^>]*>([\s\S]*)<\/p\s*>$/i.exec(elementHtml.trim());
  return match ? match[1] : elementHtml;
}

function isImageElement(elementHtml) {
  const inner = unwrapSingleP(elementHtml).trim();
  return /^<picture\b[\s\S]*<\/picture\s*>$/i.test(inner) || /^<img\b[^>]*>$/i.test(inner);
}

/**
 * Attribute values in the source may already contain HTML entities (e.g. a
 * srcset-style querystring authored as `?a=1&#x26;b=2`). Decode on read and
 * re-encode on write (escapeAttr) so round-tripping an unedited value is
 * stable instead of double-escaping it.
 */
function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractImage(elementHtml) {
  const match = /<img\b([^>]*)>/i.exec(elementHtml);
  if (!match) return { src: '', alt: '' };
  const attrs = match[1];
  const src = /\bsrc\s*=\s*"([^"]*)"|\bsrc\s*=\s*'([^']*)'/i.exec(attrs);
  const alt = /\balt\s*=\s*"([^"]*)"|\balt\s*=\s*'([^']*)'/i.exec(attrs);
  return {
    src: src ? decodeEntities(src[1] ?? src[2] ?? '') : '',
    alt: alt ? decodeEntities(alt[1] ?? alt[2] ?? '') : '',
  };
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function rewrapField(field) {
  if (field.kind === 'image') {
    return `<picture><img src="${escapeAttr(field.src)}" alt="${escapeAttr(field.alt)}"></picture>`;
  }
  if (field.wrapperTag) return `<${field.wrapperTag}>${field.value}</${field.wrapperTag}>`;
  return field.value;
}

/**
 * Get every editable field across ALL of a block occurrence's rows, split
 * down to per-element granularity - most blocks (e.g. `card`) have a single
 * row, but multi-row blocks (e.g. `hero`: a background row, then a
 * foreground row) need every row covered, not just the first. Each field is
 * one of:
 *   { kind: 'image', rowIndex, cellIndex, elementIndex, src, alt }
 *   { kind: 'text', rowIndex, cellIndex, elementIndex, wrapperTag, value }
 * `rowIndex`/`cellIndex`/`elementIndex` identify where the field came from
 * and must be passed back unchanged to setBlockFields.
 */
export function getBlockFields(html, blockName, occurrenceIndex = 0) {
  const occurrences = listOccurrences(html, blockName);
  const occurrence = occurrences[occurrenceIndex];
  if (!occurrence) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} not found`);
  }
  const fields = [];
  getRowsAndCells(occurrence).forEach((row, rowIndex) => {
    row.cells.forEach((cell, cellIndex) => {
      const cellHtml = cell.innerHTML.trim();
      const elements = splitTopLevelElements(cellHtml);
      const items = elements.length ? elements : [cellHtml];
      items.forEach((elementHtml, elementIndex) => {
        if (isImageElement(elementHtml)) {
          const { src, alt } = extractImage(elementHtml);
          fields.push({
            kind: 'image', rowIndex, cellIndex, elementIndex, src, alt,
          });
        } else {
          const { wrapperTag, value } = unwrapWrapper(elementHtml);
          fields.push({
            kind: 'text', rowIndex, cellIndex, elementIndex, wrapperTag, value,
          });
        }
      });
    });
  });
  return fields;
}

/**
 * Write fields (as obtained from getBlockFields, with some values edited)
 * back into the block occurrence. `fields` may cover a subset of
 * rows/cells - only those are touched; anything not represented is
 * preserved byte-for-byte (read via getBlockCells so it reflects any prior
 * edits already applied to `html` in this same call chain).
 */
export function setBlockFields(html, blockName, occurrenceIndex, fields) {
  const rowIndices = [...new Set(fields.map((f) => f.rowIndex))];
  let result = html;
  for (const rowIndex of rowIndices) {
    const rowFields = fields.filter((f) => f.rowIndex === rowIndex);
    const byCell = new Map();
    for (const field of rowFields) {
      if (!byCell.has(field.cellIndex)) byCell.set(field.cellIndex, []);
      byCell.get(field.cellIndex)[field.elementIndex] = rewrapField(field);
    }
    const existingCells = getBlockCells(result, blockName, occurrenceIndex, rowIndex);
    const cellValues = existingCells.map((existingHtml, cellIndex) => (
      byCell.has(cellIndex) ? byCell.get(cellIndex).join('') : existingHtml
    ));
    result = setBlockCells(result, blockName, occurrenceIndex, cellValues, rowIndex);
  }
  return result;
}

/* ----------------------------------------------------- default content */
/**
 * "Default content" is anything authored directly in a section, outside of
 * any named block: headings, paragraphs, lists, images. A section (per the
 * da-content skill glossary) is a `<div>` directly inside `<main>` in a DA
 * document. This mirrors getBlockFields/setBlockFields but scoped to a
 * section's non-block top-level children instead of a block's cell.
 */

function isBlockDiv(elementHtml) {
  const match = /^<div\b([^>]*)>/i.exec(elementHtml.trim());
  return match ? firstClassToken(match[1]) !== '' : false;
}

function findAllSections(html) {
  const mains = scanTagForest(html, 'main');
  if (mains.length === 0) {
    throw new Error('No <main> element found in source - is this a full DA document?');
  }
  const main = mains[0];
  const divs = scanTagForest(html, 'div');
  const sectionCandidates = divs.filter((d) => withinRange(d, main));
  const sections = sectionCandidates
    .filter((d) => !sectionCandidates.some((other) => other !== d && withinRange(d, other)))
    .sort((a, b) => a.openStart - b.openStart);
  return { main, sections };
}

function findSection(html, sectionIndex) {
  const { sections } = findAllSections(html);
  const section = sections[sectionIndex];
  if (!section) {
    throw new Error(`Section ${sectionIndex} not found`);
  }
  return section;
}

/**
 * Get a section's default-content fields (non-block top-level children),
 * split and classified the same way getBlockFields splits a cell: an
 * `image` field per picture/img, a `text` field per other element. Blocks
 * within the section are skipped, but `elementIndex` still reflects each
 * field's position among ALL of the section's top-level children (blocks
 * included) - pass fields back to setSectionDefaultContentFields unchanged
 * except for edited values.
 */
export function getSectionDefaultContentFields(html, sectionIndex) {
  const section = findSection(html, sectionIndex);
  const topLevel = splitTopLevelElements(section.innerHTML);
  const fields = [];
  let elementIndex = -1;
  topLevel.forEach((elementHtml) => {
    if (isBlockDiv(elementHtml)) return; // blocks (incl. section-metadata) don't consume a content index slot
    elementIndex += 1;
    if (isImageElement(elementHtml)) {
      const { src, alt } = extractImage(elementHtml);
      fields.push({
        kind: 'image', elementIndex, src, alt,
      });
    } else {
      const { wrapperTag, value } = unwrapWrapper(elementHtml);
      fields.push({
        kind: 'text', elementIndex, wrapperTag, value,
      });
    }
  });
  return fields;
}

/**
 * Write default-content fields (as obtained from
 * getSectionDefaultContentFields, with some values edited) back into the
 * section. `fields` may be a subset (e.g. just the one field the caller
 * wants to change) - only those elementIndex positions are touched; blocks
 * and any other default-content element not present in `fields` are
 * preserved byte-for-byte.
 */
export function setSectionDefaultContentFields(html, sectionIndex, fields) {
  const section = findSection(html, sectionIndex);
  const topLevel = splitTopLevelElements(section.innerHTML);
  const byIndex = new Map(fields.map((field) => [field.elementIndex, field]));
  let elementIndex = -1;
  const rebuilt = topLevel
    .map((elementHtml) => {
      if (isBlockDiv(elementHtml)) return elementHtml;
      elementIndex += 1;
      const field = byIndex.get(elementIndex);
      return field ? rewrapField(field) : elementHtml;
    })
    .join('');
  return html.slice(0, section.openEnd) + rebuilt + html.slice(section.closeStart);
}

/**
 * Remove one default-content element (by the same content-only elementIndex
 * getSectionDefaultContentFields uses) from a section entirely. Blocks and
 * every other default-content element are preserved byte-for-byte.
 */
export function deleteSectionDefaultContentElement(html, sectionIndex, elementIndex) {
  const section = findSection(html, sectionIndex);
  const topLevel = splitTopLevelElements(section.innerHTML);
  let contentIndex = -1;
  let found = false;
  const filtered = topLevel.filter((elementHtml) => {
    if (isBlockDiv(elementHtml)) return true;
    contentIndex += 1;
    if (contentIndex === elementIndex) {
      found = true;
      return false;
    }
    return true;
  });
  if (!found) {
    throw new Error(`Section ${sectionIndex} has no default-content element at index ${elementIndex}`);
  }
  const rebuilt = filtered.join('\n');
  return html.slice(0, section.openEnd) + rebuilt + html.slice(section.closeStart);
}

/* ----------------------------------------------------- section metadata */
/**
 * A `section-metadata` block's rows (`style`, `grid`, `gap`, `spacing`,
 * `container`, `background-color`, ...) get converted by
 * blocks/section-metadata/section-metadata.js into CSS classes added
 * directly to the enclosing section element (e.g. `class="section center
 * container grid grid-4 gap-xl spacing-xxl"`), and the block itself is then
 * removed from the rendered DOM - so it can't be selected/edited the normal
 * way once decoration has run. This exposes its key/value rows as editable
 * fields keyed to the *section*, independent of whether the block element
 * still exists live on the page.
 */

function findSectionMetadataOccurrence(html, section) {
  const occurrences = listOccurrences(html, 'section-metadata');
  const index = occurrences.findIndex((o) => withinRange(o.node, section));
  return { occurrences, index };
}

/**
 * Get a section's `section-metadata` block rows as key/value fields (empty
 * array if the section has no such block). `value` is editable; `key` and
 * `keyHtml` are read-only (the key cell is written back unchanged).
 *
 * A value cell authored through DA's own editor is always wrapped in a
 * block-level element (typically `<p>`) - same as any other DA table/cell
 * text - so the raw innerHTML would otherwise show that wrapper tag as
 * literal text (e.g. `<p>center, container</p>`) once rendered into a plain
 * input. `value` here is unwrapped down to the bare text (or comma-separated
 * tokens, for a multi-value key like `style`); `valueWrapperTag` remembers
 * what to re-wrap it in on save (null if the cell had no such wrapper).
 */
export function getSectionMetadataFields(html, sectionIndex) {
  const section = findSection(html, sectionIndex);
  const { occurrences, index } = findSectionMetadataOccurrence(html, section);
  if (index === -1) return [];
  const rowsAndCells = getRowsAndCells(occurrences[index]);
  return rowsAndCells.map((row, rowIndex) => {
    const keyHtml = (row.cells[0]?.innerHTML ?? '').trim();
    const rawValueHtml = (row.cells[1]?.innerHTML ?? '').trim();
    const { wrapperTag, value } = unwrapWrapper(rawValueHtml);
    return {
      rowIndex, key: stripTags(keyHtml), keyHtml, value, valueWrapperTag: wrapperTag,
    };
  });
}

/**
 * Write a full set of section-metadata fields (as obtained from
 * getSectionMetadataFields, with some `value`s edited) back into the
 * section's section-metadata block - re-wrapping each value in its original
 * `valueWrapperTag` (see getSectionMetadataFields), if any, so a round-trip
 * without editing the value is byte-for-byte unchanged. Throws if the
 * section has no such block - check getSectionMetadataFields returns a
 * non-empty array first.
 */
export function setSectionMetadataFields(html, sectionIndex, fields) {
  const section = findSection(html, sectionIndex);
  const { index } = findSectionMetadataOccurrence(html, section);
  if (index === -1) {
    throw new Error(`Section ${sectionIndex} has no section-metadata block`);
  }
  let result = html;
  for (const field of fields) {
    const valueHtml = field.valueWrapperTag ? `<${field.valueWrapperTag}>${field.value}</${field.valueWrapperTag}>` : field.value;
    result = setBlockCells(result, 'section-metadata', index, [field.keyHtml, valueHtml], field.rowIndex);
  }
  return result;
}

/**
 * Add a new key/value row to a section's section-metadata block, creating
 * the block itself (as the section's last top-level child, matching where
 * decoration expects to find it - see insertBlockIntoSection's known
 * limitation above) if the section doesn't have one yet. The value is
 * wrapped in a `<p>`, matching how DA's own editor authors table cell text
 * (see getSectionMetadataFields), so it round-trips through DA the same way
 * a hand-authored row would. Only supports the div block form for appending
 * to an existing block - a table-form section-metadata (rare, likely
 * hand-imported content) isn't a shape this project authors fresh, so
 * appending to it isn't supported.
 */
export function addSectionMetadataField(html, sectionIndex, key, value) {
  const section = findSection(html, sectionIndex);
  const { occurrences, index } = findSectionMetadataOccurrence(html, section);
  const rowHtml = `<div><div>${key}</div><div><p>${value}</p></div></div>`;
  if (index === -1) {
    const blockHtml = `<div class="section-metadata">${rowHtml}</div>`;
    return insertBlockIntoSection(html, sectionIndex, getSectionChildCount(html, sectionIndex), blockHtml);
  }
  const occurrence = occurrences[index];
  if (occurrence.form !== 'div') {
    throw new Error('Adding a section-metadata field is only supported for the div block form');
  }
  return html.slice(0, occurrence.node.closeStart) + rowHtml + html.slice(occurrence.node.closeStart);
}

/**
 * Remove one section-metadata row by index (as obtained from
 * getSectionMetadataFields). Removing the block's only remaining row removes
 * the whole block, rather than leaving an empty one behind.
 */
export function removeSectionMetadataField(html, sectionIndex, rowIndex) {
  const section = findSection(html, sectionIndex);
  const { occurrences, index } = findSectionMetadataOccurrence(html, section);
  if (index === -1) {
    throw new Error(`Section ${sectionIndex} has no section-metadata block`);
  }
  const occurrence = occurrences[index];
  const rowsAndCells = getRowsAndCells(occurrence);
  const row = rowsAndCells[rowIndex];
  if (!row) {
    throw new Error(`Section ${sectionIndex}'s section-metadata has no row ${rowIndex}`);
  }
  if (rowsAndCells.length === 1) {
    return deleteBlockOccurrence(html, 'section-metadata', index);
  }
  if (occurrence.form !== 'div') {
    throw new Error('Removing a section-metadata field is only supported for the div block form');
  }
  return html.slice(0, row.row.openStart) + html.slice(row.row.closeEnd);
}

/* --------------------------------------------------------- inserting blocks */

/**
 * Count of a section's top-level children (blocks and default content
 * alike, in document order) - the valid range for insertBeforeIndex below
 * is 0..count (count means "append at the end").
 */
export function getSectionChildCount(html, sectionIndex) {
  const section = findSection(html, sectionIndex);
  return splitTopLevelElements(section.innerHTML).length;
}

/**
 * Insert a new top-level child (typically a block, e.g. from
 * heroBlockHtml()) into a section, before the child currently at
 * `insertBeforeIndex` (0 = insert as the section's first child;
 * getSectionChildCount(html, sectionIndex) = append as the last child).
 * `blockHtml` is inserted verbatim - the caller is responsible for it being
 * well-formed canonical block markup.
 *
 * Known limitation: this indexes against ALL of a section's top-level
 * children including a `section-metadata` block if present. Since
 * section-metadata removes itself from the live DOM once decorated (see
 * above), a caller computing insertBeforeIndex from the live page will only
 * be off if that section's section-metadata isn't its last child - the
 * conventional (and, in this project, observed) position.
 */
export function insertBlockIntoSection(html, sectionIndex, insertBeforeIndex, blockHtml) {
  const section = findSection(html, sectionIndex);
  const topLevel = splitTopLevelElements(section.innerHTML);
  const clamped = Math.max(0, Math.min(insertBeforeIndex, topLevel.length));
  const rebuilt = [...topLevel.slice(0, clamped), blockHtml, ...topLevel.slice(clamped)].join('\n');
  return html.slice(0, section.openEnd) + rebuilt + html.slice(section.closeStart);
}

/**
 * Remove a block occurrence entirely (its whole outer element, whichever
 * form it's authored in) from the source. Everything else - including
 * other occurrences of the same block name and the rest of the section's
 * content - is preserved byte-for-byte.
 */
export function deleteBlockOccurrence(html, blockName, occurrenceIndex) {
  const occurrences = listOccurrences(html, blockName);
  const occurrence = occurrences[occurrenceIndex];
  if (!occurrence) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} not found`);
  }
  return html.slice(0, occurrence.node.openStart) + html.slice(occurrence.node.closeEnd);
}

/**
 * Relocate an existing block occurrence to a new position: within its
 * current section (reorder) or into a different section (move across).
 * `target` is `{ sectionIndex, insertBeforeIndex }`, expressed in the
 * ORIGINAL (pre-move) child ordering of the destination section - the same
 * shape/semantics insertBlockIntoSection (and a live-DOM drop-target
 * calculation) already use. Moving a block back onto its own original slot
 * is a logical no-op, mirroring moveSection's index-shift handling below.
 */
export function moveBlockOccurrence(html, blockName, occurrenceIndex, target) {
  const occurrences = listOccurrences(html, blockName);
  const occurrence = occurrences[occurrenceIndex];
  if (!occurrence) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} not found`);
  }
  const blockHtml = occurrence.node.outerHTML;

  const { sections } = findAllSections(html);
  const fromSectionIndex = sections.findIndex((s) => withinRange(occurrence.node, s));
  if (fromSectionIndex === -1) {
    throw new Error(`Block "${blockName}" occurrence ${occurrenceIndex} is not inside any section`);
  }
  const fromSection = sections[fromSectionIndex];
  const relativeStart = occurrence.node.openStart - fromSection.openEnd;
  const fromChildIndex = splitTopLevelElementRanges(fromSection.innerHTML)
    .filter((range) => range.start < relativeStart).length;

  const removedHtml = html.slice(0, occurrence.node.openStart) + html.slice(occurrence.node.closeEnd);

  const insertBeforeIndex = (fromSectionIndex === target.sectionIndex && target.insertBeforeIndex > fromChildIndex)
    ? target.insertBeforeIndex - 1
    : target.insertBeforeIndex;

  return insertBlockIntoSection(removedHtml, target.sectionIndex, insertBeforeIndex, blockHtml);
}

/* ------------------------------------------------------------- reordering sections */

/** Number of sections (direct div children of `<main>`) in the document. */
export function getSectionCount(html) {
  return findAllSections(html).sections.length;
}

/**
 * Move a whole section to a new position among its siblings.
 * `toBeforeIndex` is expressed in the ORIGINAL (pre-move) section ordering -
 * e.g. moveSection(html, 3, 0) moves section 3 to be the new first section;
 * moveSection(html, 0, 3) moves section 0 to sit where section 3 currently
 * is (i.e. just after the section currently at index 2, once 0 is removed).
 * A no-op (fromIndex effectively unchanged) returns `html` unmodified.
 */
export function moveSection(html, fromIndex, toBeforeIndex) {
  const { main, sections } = findAllSections(html);
  if (!sections[fromIndex]) {
    throw new Error(`Section ${fromIndex} not found`);
  }
  const sectionHtmls = sections.map((s) => html.slice(s.openStart, s.closeEnd));
  const [moved] = sectionHtmls.splice(fromIndex, 1);
  let insertAt = toBeforeIndex > fromIndex ? toBeforeIndex - 1 : toBeforeIndex;
  insertAt = Math.max(0, Math.min(insertAt, sectionHtmls.length));
  sectionHtmls.splice(insertAt, 0, moved);
  const rebuilt = sectionHtmls.join('\n');
  return html.slice(0, main.openEnd) + rebuilt + html.slice(main.closeStart);
}

/**
 * Remove a whole section (and everything inside it - blocks and default
 * content alike) from the document. Every other section is preserved
 * byte-for-byte and keeps its original relative order.
 */
export function deleteSection(html, sectionIndex) {
  const { sections } = findAllSections(html);
  const section = sections[sectionIndex];
  if (!section) {
    throw new Error(`Section ${sectionIndex} not found`);
  }
  return html.slice(0, section.openStart) + html.slice(section.closeEnd);
}

/**
 * Insert a brand-new section - `sectionHtml` must be a bare, unclassed
 * `<div>...</div>` (a section only gets `class="section"` from client-side
 * decoration; authoring it with that class already on it would be wrong) -
 * as a sibling of the document's existing sections, direct child of
 * `<main>`. Not to be confused with insertBlockIntoSection, which inserts
 * *inside* one existing section; a section must never end up nested inside
 * another section.
 */
export function insertSection(html, insertBeforeIndex, sectionHtml) {
  const { main, sections } = findAllSections(html);
  const sectionHtmls = sections.map((s) => html.slice(s.openStart, s.closeEnd));
  const clamped = Math.max(0, Math.min(insertBeforeIndex, sectionHtmls.length));
  sectionHtmls.splice(clamped, 0, sectionHtml);
  const rebuilt = sectionHtmls.join('\n');
  return html.slice(0, main.openEnd) + rebuilt + html.slice(main.closeStart);
}

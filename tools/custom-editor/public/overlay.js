import {
  getBlockFields, setBlockFields,
  getSectionDefaultContentFields, setSectionDefaultContentFields, deleteSectionDefaultContentElement,
  getSectionMetadataFields, setSectionMetadataFields, addSectionMetadataField, removeSectionMetadataField,
  insertBlockIntoSection, deleteBlockOccurrence,
  moveSection, insertSection, deleteSection, moveBlockOccurrence,
  normalizeBlockName,
} from './lib/block-patch.js';
import { getSource, putSource, DaAuthError } from './lib/da-source.js';
import { triggerPreview } from './lib/admin-api.js';
import { BLOCK_TEMPLATES } from './lib/block-templates.js';
import { applyContentModel, applySectionMetadataModel, SECTION_METADATA_MODELS } from './lib/content-models.js';

const TOKEN_STORAGE_KEY = 'custom-editor:da-token';

/**
 * A block, per EDS/DA authoring convention, is a `<div>` with its own class
 * (the class is the block name, e.g. `class="card"`). In the raw
 * server-rendered markup it sits directly inside a section `<div>` directly
 * inside `<main>`. This project's client-side decoration (`ak.js`,
 * `groupChildren`/`decorateSections`) wraps each section's div children in
 * an extra `<div class="block-content">` the moment it runs, pushing the
 * block one level deeper - so we match both the pre- and post-decoration
 * shape. Either way, identifying blocks by class means hover/select work
 * immediately without waiting for decoration to run or finish loading any
 * given block's JS/CSS. `data-block-name` (set later, once a block's own
 * script has been dispatched) is intentionally not used for identification.
 *
 * Known limitation: during the brief window a section is actively being
 * decorated (its div children are being reparented into `.block-content`),
 * a querySelectorAll snapshot could double-count a block that's mid-move.
 * This resolves itself within milliseconds and is very unlikely to overlap
 * a real hover/click, so it's accepted rather than engineered around.
 */
const BLOCK_SELECTOR = 'main > div > div[class]:not(.block-content):not(.default-content), main .block-content > div[class]';

// A section is a `<div>` directly inside `<main>` (da-content skill glossary).
const SECTION_SELECTOR = 'main > div';

function getBlockName(element) {
  return element.classList[0];
}

/**
 * A section's default-content elements, in document order, matching exactly
 * the "content-only" numbering block-patch.js's getSectionDefaultContentFields
 * uses (blocks - including a since-removed `section-metadata` block - don't
 * consume a slot in this list either, on either side, so the two stay
 * aligned regardless of a block's position among the section's children).
 */
function getSectionDefaultContentElements(sectionEl) {
  const elements = [];
  for (const child of sectionEl.children) {
    if (child.classList.contains('default-content')) {
      elements.push(...child.children);
    } else if (child.classList.contains('block-content') || child.className) {
      // a block-content wrapper, or (pre-decoration) a classed div block root - skip
    } else {
      elements.push(child); // pre-decoration: unclassed direct child is default content
    }
  }
  return elements;
}

/**
 * ALL of a section's top-level children (blocks and default content alike),
 * flattened out of the `.block-content`/`.default-content` wrapper groups,
 * matching block-patch.js's insertBlockIntoSection indexing. Used to
 * compute where a dragged block should land - see computeDropTarget.
 *
 * Known limitation: same as insertBlockIntoSection - if a `section-metadata`
 * block isn't a section's last child, this list (which won't include it,
 * since it removes itself from the DOM once decorated) is missing a slot
 * that still exists in the source, and the resulting insertBeforeIndex can
 * be off by one relative to that block.
 */
function getSectionAllChildren(sectionEl) {
  const children = [];
  for (const child of sectionEl.children) {
    if (child.classList.contains('block-content') || child.classList.contains('default-content')) {
      children.push(...child.children);
    } else {
      children.push(child);
    }
  }
  return children;
}

/**
 * Resolve a raw event target to whichever editable unit it belongs to: a
 * block (by class) takes priority; otherwise, if it's inside a section, the
 * *specific* default-content element (not the whole section or wrapper) the
 * target is inside - so selecting one heading doesn't also surface every
 * other paragraph in that section; failing that, the section itself (its own
 * padding/whitespace, or a section made up entirely of blocks with no
 * default-content to click) - selecting the section is how its own
 * properties (section-metadata: style/grid/gap/spacing/...) are edited, see
 * fieldsIo. Returns null for anything outside `<main>`'s sections entirely
 * (header, footer, our own chrome).
 */
function resolveEditable(rawTarget) {
  const blockEl = rawTarget.closest(BLOCK_SELECTOR);
  if (blockEl) return { type: 'block', el: blockEl };
  const section = rawTarget.closest(SECTION_SELECTOR);
  if (!section) return null;
  const contentElements = getSectionDefaultContentElements(section);
  const elementIndex = contentElements.findIndex((el) => el === rawTarget || el.contains(rawTarget));
  if (elementIndex !== -1) return { type: 'default-content', el: contentElements[elementIndex], elementIndex };
  return { type: 'section', el: section };
}

function getLabel(selection) {
  if (selection.type === 'block') return getBlockName(selection.el);
  if (selection.type === 'section') return `section ${sectionOrdinal(selection.el) + 1}`;
  return `default content (${selection.el.tagName.toLowerCase()})`;
}

function sameSelection(a, b) {
  return !!a && !!b && a.el === b.el && a.type === b.type;
}

let config = null; // { daOrg, daRepo, daRef } - fetched once from /__editor/config
let hovered = null; // { type: 'block' | 'default-content', el }
let selected = null; // { type: 'block' | 'default-content', el }
let activeInlineBinding = null; // cleanup() for the currently selected unit's inline-editable DOM hooks

/* ---------------------------------------------------------------- setup */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}

function buildChrome() {
  const hoverBox = el('div', { id: 'ce-hover-box' });
  const hoverLabel = el('div', { id: 'ce-hover-label' });
  const selectionBox = el('div', { id: 'ce-selection-box' });
  const selectionLabel = el('div', { id: 'ce-selection-label' });
  const inspector = el('div', { id: 'ce-inspector' });
  const palette = el('div', { id: 'ce-palette' });
  const dropIndicator = el('div', { id: 'ce-drop-indicator' });
  const sectionHandle = el('div', { id: 'ce-section-handle', draggable: true, textContent: '⠿⠿' });
  const blockHandle = el('div', { id: 'ce-block-handle', draggable: true, textContent: '⠿' });
  document.body.append(
    hoverBox,
    hoverLabel,
    selectionBox,
    selectionLabel,
    inspector,
    palette,
    dropIndicator,
    sectionHandle,
    blockHandle,
  );
  return {
    hoverBox, hoverLabel, selectionBox, selectionLabel, inspector, palette, dropIndicator, sectionHandle, blockHandle,
  };
}

/* ------------------------------------------------------------- highlight */

function positionBox(box, label, target, text) {
  const rect = target.getBoundingClientRect();
  box.style.display = 'block';
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;

  label.style.display = 'block';
  label.textContent = text;
  const labelTop = rect.top > 20 ? rect.top - 20 : rect.bottom + 2;
  label.style.top = `${labelTop}px`;
  label.style.left = `${rect.left}px`;
}

function hideBox(box, label) {
  box.style.display = 'none';
  label.style.display = 'none';
}

/**
 * Select `resolved` and open its inspector - shared between the generic
 * click-anywhere handler below and the section grip handle's own click
 * (see setupSectionDragHandle), which is the only reliable way to select a
 * section that has no exposed pixel of its own left to click (e.g. it has
 * no `grid` set yet, so its blocks stack full-width and cover it edge to
 * edge - exactly the case where a user most needs to select the section to
 * go fix that).
 */
function selectUnit(chrome, resolved) {
  if (sameSelection(resolved, selected)) return;
  selected = resolved;
  positionBox(chrome.selectionBox, chrome.selectionLabel, resolved.el, getLabel(resolved));
  openInspector(chrome, resolved);
}

function setupHoverAndSelection(chrome) {
  const reposition = () => {
    if (hovered) positionBox(chrome.hoverBox, chrome.hoverLabel, hovered.el, getLabel(hovered));
    if (selected) positionBox(chrome.selectionBox, chrome.selectionLabel, selected.el, getLabel(selected));
  };

  document.addEventListener('mouseover', (event) => {
    const resolved = resolveEditable(event.target);
    if (!resolved || sameSelection(resolved, hovered)) return;
    hovered = resolved;
    positionBox(chrome.hoverBox, chrome.hoverLabel, resolved.el, getLabel(resolved));
  });

  document.addEventListener('mouseout', (event) => {
    if (!hovered) return;
    const leavingTo = event.relatedTarget;
    if (leavingTo && hovered.el.contains(leavingTo)) return;
    hovered = null;
    hideBox(chrome.hoverBox, chrome.hoverLabel);
  });

  document.addEventListener('click', (event) => {
    // Our own chrome, not the page - in particular the section/block grip
    // handles have their own click handling (selecting/dragging), which
    // this capture-phase listener would otherwise pre-empt since it runs
    // before the handle's own (bubble-phase) click listener ever fires.
    if (event.target.closest('#ce-inspector, #ce-section-handle, #ce-block-handle')) return;
    const resolved = resolveEditable(event.target);
    if (!resolved) {
      selected = null;
      hideBox(chrome.selectionBox, chrome.selectionLabel);
      closeInspector(chrome);
      return;
    }
    if (sameSelection(resolved, selected)) return; // let inline editing / normal interaction inside the already-selected unit proceed
    event.preventDefault();
    selectUnit(chrome, resolved);
  }, true);

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
}

/* ------------------------------------------------------------- auth */

function getToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

/* -------------------------------------------------------------- inspector */

function closeInspector(chrome) {
  if (activeInlineBinding) {
    activeInlineBinding.cleanup();
    activeInlineBinding = null;
  }
  chrome.inspector.classList.remove('ce-open');
  chrome.inspector.innerHTML = '';
}

function blockOrdinal(target) {
  const name = normalizeBlockName(getBlockName(target));
  const siblings = [...document.querySelectorAll(BLOCK_SELECTOR)]
    .filter((el) => normalizeBlockName(getBlockName(el)) === name);
  return siblings.indexOf(target);
}

function sectionOrdinal(target) {
  const section = target.closest(SECTION_SELECTOR);
  return [...document.querySelectorAll(SECTION_SELECTOR)].indexOf(section);
}

function renderStatus(container, kind, message) {
  const existing = container.querySelector('.ce-status');
  if (existing) existing.remove();
  if (!message) return;
  container.append(el('div', { className: `ce-status ce-${kind}`, textContent: message }));
}

/**
 * Redecorate a block in place after one of its fields is saved, instead of a
 * full page reload: refetch the page (now that the preview has propagated),
 * pull out the same block occurrence in its fresh, pre-decoration markup,
 * swap it in at the same DOM position, and re-run its own decorate script -
 * the same two steps `loadBlock` (this project's `ak.js`) does on first
 * load. A block's decorate function generally assumes it's starting from
 * that raw div/cell shape, not whatever it left behind last time it ran, so
 * re-running decorate on the still-decorated live element directly isn't
 * safe - the fresh fetch is what supplies a clean starting point.
 */
async function redecorateBlock(selection) {
  const name = getBlockName(selection.el);
  const normalizedName = normalizeBlockName(name);
  const ordinal = blockOrdinal(selection.el);
  const res = await fetch(window.location.pathname + window.location.search, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not refetch page (${res.status})`);
  const freshDoc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const freshBlock = [...freshDoc.querySelectorAll(BLOCK_SELECTOR)]
    .filter((candidate) => normalizeBlockName(getBlockName(candidate)) === normalizedName)[ordinal];
  if (!freshBlock) throw new Error('Could not locate refreshed block markup');
  const newBlock = document.importNode(freshBlock, true);
  selection.el.replaceWith(newBlock);
  selection.el = newBlock;
  newBlock.dataset.blockName = name; // loadBlock (ak.js) sets this too - some block JS/CSS may depend on it
  const blockPath = `/blocks/${name}/${name}`;
  if (!document.querySelector(`head > link[href="${blockPath}.css"]`)) {
    document.head.append(el('link', { rel: 'stylesheet', href: `${blockPath}.css` }));
  }
  await (await import(`${blockPath}.js`)).default(newBlock);
  return newBlock;
}

/**
 * Redecorate a section in place after one of its section-metadata settings
 * is added/removed/changed, instead of a full page reload - same idea as
 * `redecorateBlock` above, but for the section wrapper itself: refetch the
 * page, pull the same section occurrence in its fresh, pre-decoration
 * markup, then run it through `loadArea` (from `ak.js`, exported unmodified)
 * before swapping it into the live page.
 *
 * `loadArea` normally decorates every top-level section of `document`, but
 * its `decorateSections(area, isDoc)` helper switches to a `:scope > div`
 * selector whenever `area` isn't `document` itself - so passing a detached
 * wrapper `<div>` containing just this one fresh section runs the exact same
 * decoration/loadBlock pipeline scoped to it alone, with nothing exported
 * from ak.js beyond the `loadArea` entry point every page already uses.
 */
async function redecorateSection(selection) {
  const ordinal = sectionOrdinal(selection.el);
  const res = await fetch(window.location.pathname + window.location.search, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not refetch page (${res.status})`);
  const freshDoc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const freshSection = [...freshDoc.querySelectorAll(SECTION_SELECTOR)][ordinal];
  if (!freshSection) throw new Error('Could not locate refreshed section markup');
  const newSection = document.importNode(freshSection, true);
  const { loadArea } = await import('/scripts/ak.js');
  const wrapper = document.createElement('div');
  wrapper.append(newSection);
  await loadArea({ area: wrapper });
  selection.el.replaceWith(newSection);
  selection.el = newSection;
  return newSection;
}

/**
 * Shared tail end of every block/section-metadata save: wait for the preview
 * to propagate, redecorate in place (via `redecorateBlock`/`redecorateSection`
 * above) and reopen the inspector against the fresh element, falling back to
 * the old "reload the page" message if the redecoration itself fails for any
 * reason (e.g. the block/section couldn't be relocated in the refetched page).
 */
async function saveAndRedecorate(chrome, selection, redecorate, successPrefix) {
  renderStatus(chrome.inspector, 'info', `${successPrefix} Redecorating…`);
  try {
    await new Promise((resolve) => { setTimeout(resolve, 400); }); // let the preview propagate
    await redecorate(selection);
    positionBox(chrome.selectionBox, chrome.selectionLabel, selection.el, getLabel(selection));
    openInspector(chrome, selection); // rebuilds the panel (+ inline bindings, for a block) against the fresh element
  } catch (err) {
    console.error('redecorate failed', err); // TEMP DEBUG
    renderStatus(chrome.inspector, 'ok', `${successPrefix} Reload the page to see the update.`);
  }
}

/**
 * Drives the "not connected" state shared by the inspector panel and the
 * palette panel: a primary login button that spawns the server-side
 * `da-auth-helper` OAuth flow (opens a real browser window for Adobe IMS
 * login, no manual copy/paste), plus the manual paste-a-token field kept as
 * a fallback (offline, GitHub blocked, headless environment, or port 9898
 * already in use). `onConnected` is called once a token has been stored.
 */
function renderConnectPrompt(onConnected) {
  const container = el('div', {});
  const status = el('div', { className: 'ce-field' });

  let abortController = null;

  function setBusy(busy) {
    connectButton.disabled = busy;
    connectButton.textContent = busy ? 'Waiting for Adobe login…' : 'Connect to DA';
  }

  async function startLogin() {
    setBusy(true);
    abortController = new AbortController();
    renderStatus(status, 'info', null);
    const cancelLink = el('a', {
      href: '#',
      textContent: 'Cancel',
      onclick: (e) => {
        e.preventDefault();
        abortController?.abort();
      },
    });
    status.append(el('div', { className: 'ce-status ce-info' }, [
      document.createTextNode('A browser window should have opened for Adobe login. '),
      cancelLink,
    ]));
    try {
      const response = await fetch('/__editor/auth/login', { method: 'POST', signal: abortController.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Login failed (${response.status})`);
      if (!body.token) throw new Error('Login did not return a token.');
      status.innerHTML = '';
      setToken(body.token);
      onConnected();
    } catch (err) {
      setBusy(false);
      status.innerHTML = '';
      const message = err.name === 'AbortError' ? 'Login cancelled.' : `Could not connect: ${err.message}`;
      renderStatus(status, 'error', message);
    }
  }

  const connectButton = el('button', {
    className: 'ce-primary',
    textContent: 'Connect to DA',
    onclick: startLogin,
  });

  const input = el('input', { type: 'text', placeholder: 'Paste IMS bearer token' });
  container.append(
    connectButton,
    status,
    el('div', { className: 'ce-field' }, [
      el('label', { textContent: 'or paste a token manually' }),
      input,
    ]),
    el('button', {
      className: 'ce-secondary',
      textContent: 'Save token',
      onclick: () => {
        if (!input.value.trim()) return;
        setToken(input.value.trim());
        onConnected();
      },
    }),
  );
  return container;
}

function renderAuthSection(chrome, selection) {
  const section = el('div', { className: 'ce-section' });
  if (getToken()) {
    section.append(
      el('div', { className: 'ce-attr-row', innerHTML: '<span>DA connection</span><span>Connected</span>' }),
      el('button', {
        className: 'ce-secondary',
        textContent: 'Disconnect',
        onclick: () => {
          setToken('');
          openInspector(chrome, selection); // re-render in disconnected state
        },
      }),
    );
  } else {
    section.append(renderConnectPrompt(() => openInspector(chrome, selection)));
  }
  return section;
}

/**
 * Find the live DOM elements inside the decorated block that correspond to
 * `fields`' text/image entries, in the same order block-patch produced them.
 * Only used for inline (on-page) editing - the panel form works regardless.
 * If the counts don't line up (decoration restructured things more than this
 * project's `card` block does) we skip inline binding for that field kind
 * and fall back to panel-only editing, rather than risk editing the wrong
 * element.
 */
const TEXT_CANDIDATE_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, dt, dd';

function findInlineNodes(target, fields) {
  const textFields = fields.filter((f) => f.kind === 'text');
  const imageFields = fields.filter((f) => f.kind === 'image');

  // For a block, `target` is the wrapper div and candidates are descendants.
  // For default content, `target` may itself be the specific p/h2/etc. that
  // was selected - include it directly, not just its (nonexistent) children.
  const rawTextCandidates = target.matches(TEXT_CANDIDATE_SELECTOR)
    ? [target] : [...target.querySelectorAll(TEXT_CANDIDATE_SELECTOR)];
  const textCandidates = rawTextCandidates
    .filter((node) => !node.closest('picture') && !node.querySelector('picture, img, table'));
  const imageCandidates = target.matches('img') ? [target] : [...target.querySelectorAll('img')];

  return {
    textPairs: textCandidates.length === textFields.length
      ? textFields.map((field, i) => ({ field, node: textCandidates[i] })) : [],
    imagePairs: imageCandidates.length === imageFields.length
      ? imageFields.map((field, i) => ({ field, node: imageCandidates[i] })) : [],
  };
}

function flashField(fieldEl) {
  fieldEl.classList.add('ce-flash');
  fieldEl.querySelector('input, textarea')?.focus();
  fieldEl.scrollIntoView({ block: 'nearest' });
  setTimeout(() => fieldEl.classList.remove('ce-flash'), 800);
}

/**
 * Wire up two-way sync between the panel form controls and the matching
 * live DOM elements inside `target`, so editing either surface updates the
 * other and both stay in sync with the shared `fields` array (the single
 * source of truth read at save time). Also saves on blur (see `onBlur`) -
 * leaving any of these controls persists the field's current value.
 * Returns a cleanup() to undo it.
 */
function bindInlineEditing(target, fields, fieldRefs, markDirty, onBlur) {
  const { textPairs, imagePairs } = findInlineNodes(target, fields);
  const teardown = [];

  for (const { field, node } of textPairs) {
    const ref = fieldRefs.get(field);
    node.contentEditable = 'true';
    node.classList.add('ce-inline-editable');

    const onNodeInput = () => {
      field.value = node.innerHTML;
      markDirty();
      if (ref?.textarea) ref.textarea.value = field.value;
      else if (ref?.richtext) ref.richtext.innerHTML = field.value;
    };
    node.addEventListener('input', onNodeInput);
    node.addEventListener('blur', onBlur);

    let onPanelInput;
    const panelEditor = ref?.textarea ?? ref?.richtext;
    if (panelEditor) {
      onPanelInput = () => {
        node.innerHTML = ref.textarea ? ref.textarea.value : ref.richtext.innerHTML;
      };
      panelEditor.addEventListener('input', onPanelInput);
    }

    teardown.push(() => {
      node.contentEditable = 'false';
      node.classList.remove('ce-inline-editable');
      node.removeEventListener('input', onNodeInput);
      node.removeEventListener('blur', onBlur);
      if (onPanelInput) panelEditor.removeEventListener('input', onPanelInput);
    });
  }

  for (const { field, node } of imagePairs) {
    const ref = fieldRefs.get(field);
    node.classList.add('ce-inline-image');

    const onClick = (event) => {
      event.stopPropagation();
      if (ref?.fieldEl) flashField(ref.fieldEl);
    };
    node.addEventListener('click', onClick);

    let onSrcChange;
    let onAltInput;
    if (ref?.srcInput) {
      onSrcChange = () => { node.src = ref.srcInput.value; };
      ref.srcInput.addEventListener('change', onSrcChange);
    }
    if (ref?.altInput) {
      onAltInput = () => { node.alt = ref.altInput.value; };
      ref.altInput.addEventListener('input', onAltInput);
    }

    teardown.push(() => {
      node.classList.remove('ce-inline-image');
      node.removeEventListener('click', onClick);
      if (onSrcChange) ref.srcInput.removeEventListener('change', onSrcChange);
      if (onAltInput) ref.altInput.removeEventListener('input', onAltInput);
    });
  }

  return {
    cleanup: () => teardown.forEach((fn) => fn()),
  };
}

function renderTextField(field, index, markDirty, onBlur, labelOverride) {
  const textarea = el('textarea', { value: field.value });
  textarea.addEventListener('input', () => {
    field.value = textarea.value;
    markDirty();
  });
  textarea.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: labelOverride ?? `Text ${index + 1}` }),
    textarea,
  ]);
  return { fieldEl, refs: { textarea, fieldEl } };
}

/**
 * A `heading` content-model field: the same raw-value textarea as a plain
 * text field (write-back is unchanged - still just `field.value`), plus a
 * `<select>` restricted to `headingLevels` and bound to `field.wrapperTag`.
 * Changing the level is structural (an element's tag name can't be mutated
 * live the way a value can) - `onLevelChange` (save + reload) is the
 * caller's job, not this render function's.
 */
function renderHeadingField(field, label, headingLevels, markDirty, onBlur, onLevelChange) {
  const textarea = el('textarea', { value: field.value });
  textarea.addEventListener('input', () => { field.value = textarea.value; markDirty(); });
  textarea.addEventListener('blur', onBlur);

  // If existing content was authored outside the model's allowed levels,
  // keep it selected rather than silently defaulting to the first option.
  const levels = headingLevels.includes(field.wrapperTag) ? headingLevels : [field.wrapperTag, ...headingLevels];
  const select = el('select', {}, levels.map((level) => el('option', {
    value: level,
    textContent: level.toUpperCase(),
    selected: level === field.wrapperTag,
  })));
  select.addEventListener('change', () => {
    field.wrapperTag = select.value;
    markDirty();
    onLevelChange();
  });

  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: label }),
    textarea,
    el('label', { textContent: 'Heading level' }),
    select,
  ]);
  return { fieldEl, refs: { textarea, fieldEl } };
}

/**
 * A `richtext` content-model field: a contenteditable box (value = raw
 * innerHTML, same convention as a text field) with a minimal Bold/Italic/
 * Link toolbar via `document.execCommand`. Browsers may produce
 * presentational `<b>`/`<i>` rather than `<strong>`/`<em>` - harmless, since
 * DA's cell-normalization pass rewrites those to their semantic equivalents
 * on preview/publish regardless (da-content skill §3.9).
 */
function renderRichTextField(field, label, markDirty, onBlur) {
  const editor = el('div', {
    className: 'ce-richtext', contentEditable: 'true', innerHTML: field.value,
  });
  const sync = () => { field.value = editor.innerHTML; markDirty(); };
  const exec = (command, value = null) => {
    editor.focus();
    document.execCommand(command, false, value);
    sync();
  };
  const toolbar = el('div', { className: 'ce-richtext-toolbar' }, [
    el('button', {
      type: 'button', className: 'ce-rt-btn', textContent: 'B', title: 'Bold', onclick: (e) => { e.preventDefault(); exec('bold'); },
    }),
    el('button', {
      type: 'button', className: 'ce-rt-btn', textContent: 'I', title: 'Italic', onclick: (e) => { e.preventDefault(); exec('italic'); },
    }),
    el('button', {
      type: 'button',
      className: 'ce-rt-btn',
      textContent: 'Link',
      title: 'Link',
      onclick: (e) => {
        e.preventDefault();
        // eslint-disable-next-line no-alert
        const url = window.prompt('Link URL');
        if (url) exec('createLink', url);
      },
    }),
  ]);
  editor.addEventListener('input', sync);
  editor.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: label }),
    toolbar,
    editor,
  ]);
  return { fieldEl, refs: { richtext: editor, fieldEl } };
}

function renderImageField(field, index, markDirty, onBlur, labelOverride, altLabelOverride) {
  const srcInput = el('input', { type: 'text', value: field.src, placeholder: 'Image URL' });
  const altInput = el('input', { type: 'text', value: field.alt, placeholder: 'Alt text' });
  srcInput.addEventListener('change', () => { field.src = srcInput.value; markDirty(); });
  altInput.addEventListener('input', () => { field.alt = altInput.value; markDirty(); });
  srcInput.addEventListener('blur', onBlur);
  altInput.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: labelOverride ?? `Image ${index + 1}` }),
    srcInput,
    el('label', { textContent: altLabelOverride ?? 'Alt text' }),
    altInput,
  ]);
  return { fieldEl, refs: { srcInput, altInput, fieldEl } };
}

function settingFieldLabelRow(field, onRemove) {
  const labelRow = el('div', { className: 'ce-field-label-row' }, [
    el('label', { textContent: field.model?.label ?? field.key }),
  ]);
  if (onRemove) {
    const removeBtn = el('button', { className: 'ce-field-remove', title: `Remove "${field.key}"`, textContent: '×' });
    removeBtn.addEventListener('click', onRemove);
    labelRow.append(removeBtn);
  }
  return labelRow;
}

/** Plain free-text setting field - the fallback for a key with no registered model (e.g. background-color, or a hand-authored one-off). */
function renderSettingField(field, markDirty, onBlur, onRemove) {
  const input = el('input', { type: 'text', value: field.value });
  input.addEventListener('input', () => { field.value = input.value; markDirty(); });
  input.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [settingFieldLabelRow(field, onRemove), input]);
  return { fieldEl, refs: { input, fieldEl } };
}

/**
 * Single-value setting field (grid/gap/spacing/container) - a dropdown of
 * the model's known options. The field's current value is always included
 * even if it isn't one of the known options (a legacy or hand-authored
 * value), so selecting/saving never silently changes or discards it.
 */
function renderSettingSelectField(field, markDirty, onBlur, onRemove) {
  const { options } = field.model;
  const allOptions = options.includes(field.value) ? options : [field.value, ...options];
  const select = el('select', {}, allOptions.map((opt) => el('option', {
    value: opt,
    textContent: opt === '' ? '(none)' : opt,
    selected: opt === field.value,
  })));
  select.addEventListener('change', () => {
    field.value = select.value;
    markDirty();
    onBlur();
  });
  const fieldEl = el('div', { className: 'ce-field' }, [settingFieldLabelRow(field, onRemove), select]);
  return { fieldEl, refs: { select, fieldEl } };
}

/**
 * Multi-value setting field (style) - a checkbox per known option; the
 * field's raw value is comma-separated tokens (see
 * blocks/section-metadata/section-metadata.js's handleStyle). Any existing
 * token that isn't one of the known options is preserved untouched (kept in
 * the underlying set, just never shown as its own checkbox) rather than
 * dropped when another checkbox is toggled.
 */
function renderSettingMultiSelectField(field, markDirty, onBlur, onRemove) {
  const { options } = field.model;
  const selected = new Set(field.value.split(',').map((v) => v.trim()).filter(Boolean));
  const checkboxes = options.map((opt) => {
    const checkbox = el('input', { type: 'checkbox', checked: selected.has(opt) });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(opt); else selected.delete(opt);
      field.value = [...selected].join(', ');
      markDirty();
      onBlur();
    });
    return el('label', { className: 'ce-checkbox-label' }, [checkbox, document.createTextNode(opt)]);
  });
  const fieldEl = el('div', { className: 'ce-field' }, [settingFieldLabelRow(field, onRemove), ...checkboxes]);
  return { fieldEl, refs: { fieldEl } };
}

/**
 * section-metadata keys blocks/section-metadata/section-metadata.js knows
 * how to handle (style, grid, gap, spacing, container all become CSS
 * classes; background-color/background-image/background are handled
 * together by the same code path - background-color is offered here as the
 * one representative entry point for that group).
 */
const SECTION_METADATA_KEYS = ['style', 'grid', 'gap', 'spacing', 'container', 'background-color'];

/** Read fields from + write fields back to source, branching on selection type. */
function fieldsIo(selection) {
  if (selection.type === 'block') {
    const blockName = getBlockName(selection.el);
    const ordinal = blockOrdinal(selection.el);
    return {
      get: (source) => applyContentModel(blockName, getBlockFields(source, blockName, ordinal)),
      set: (source, fields) => setBlockFields(source, blockName, ordinal, fields),
    };
  }
  if (selection.type === 'section') {
    // The section's own properties only (style/grid/gap/spacing/... - these
    // become CSS classes on the section element, e.g. class="section center
    // container grid-4 gap-xl spacing-xxl", via a section-metadata block
    // that removes itself from the DOM once decorated, so it's only
    // reachable through the source, not the page) - not any content inside
    // it, which is edited by selecting that specific content instead.
    const ordinal = sectionOrdinal(selection.el);
    return {
      get: (source) => applySectionMetadataModel(getSectionMetadataFields(source, ordinal).map((f) => ({ ...f, kind: 'setting' }))),
      set: (source, fields) => setSectionMetadataFields(source, ordinal, fields),
    };
  }
  // default-content: just the one element the user selected, not every
  // paragraph/heading in the section.
  const ordinal = sectionOrdinal(selection.el);
  return {
    get: (source) => getSectionDefaultContentFields(source, ordinal)
      .filter((f) => f.elementIndex === selection.elementIndex),
    set: (source, fields) => setSectionDefaultContentFields(source, ordinal, fields),
  };
}

async function loadFieldsSection(chrome, selection) {
  const io = fieldsIo(selection);
  const pagePath = window.location.pathname;
  const token = getToken();

  const section = el('div', { className: 'ce-section' });
  section.append(el('div', { textContent: 'Loading fields…', className: 'ce-status ce-info' }));
  chrome.inspector.append(section);

  let fields;
  try {
    const source = await getSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token,
    });
    fields = io.get(source);
  } catch (err) {
    section.innerHTML = '';
    if (err instanceof DaAuthError) {
      setToken('');
      openInspector(chrome, selection);
      return;
    }
    section.append(el('div', { className: 'ce-status ce-error', textContent: `Could not load fields: ${err.message}` }));
    return;
  }

  section.innerHTML = '';
  if (fields.length === 0 && selection.type !== 'section') {
    section.append(el('div', { className: 'ce-status ce-info', textContent: 'Nothing editable found here.' }));
    return;
  }

  let dirty = false;
  let saving = false;
  const markDirty = () => { dirty = true; };

  const actions = el('div', { className: 'ce-actions' });
  const saveBtn = el('button', { className: 'ce-primary', textContent: 'Save' });
  actions.append(saveBtn);

  // Fields save automatically when they lose focus (blur) - see renderTextField/
  // renderImageField/bindInlineEditing below. The button remains as an explicit,
  // always-on "save now" affordance (bypasses the dirty check via `force`).
  const saveFields = async ({ force = false } = {}) => {
    if (!force && !dirty) return;
    if (saving) return; // already in flight; it reads `fields` fresh so it'll pick up any edits made since it started
    saving = true;
    dirty = false;
    saveBtn.disabled = true;
    renderStatus(chrome.inspector, 'info', 'Saving…');
    try {
      const currentSource = await getSource({
        daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token: getToken(),
      });
      const updatedSource = io.set(currentSource, fields);
      await putSource({
        daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updatedSource, token: getToken(),
      });
      await triggerPreview({
        daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
      });
      if (selection.type === 'block') {
        await saveAndRedecorate(chrome, selection, redecorateBlock, 'Saved.');
      } else if (selection.type === 'section') {
        await saveAndRedecorate(chrome, selection, redecorateSection, 'Saved.');
      } else {
        renderStatus(chrome.inspector, 'ok', 'Saved. Reload the page to see the update.');
      }
    } catch (err) {
      if (err instanceof DaAuthError) {
        setToken('');
        openInspector(chrome, selection);
        return;
      }
      dirty = true; // didn't actually persist - retry on the next blur or Save click
      renderStatus(chrome.inspector, 'error', `Save failed: ${err.message}`);
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  };

  const fieldRefs = new Map(); // field -> { textarea } or { srcInput, altInput, fieldEl } or { input, fieldEl }
  let textCount = 0;
  let imageCount = 0;
  if (selection.type === 'section') {
    section.append(el('div', { className: 'ce-field-group-label', textContent: 'Section settings' }));
  }
  for (const field of fields) {
    let rendered;
    if (field.model?.kind === 'heading') {
      // Heading fields only ever come from a block's content model (hero/card
      // - see fieldsIo), so saveFields' own block redecoration (below) is
      // enough to show the new tag; no separate reload needed here.
      rendered = renderHeadingField(field, field.model.label, field.model.headingLevels, markDirty, saveFields, () => {
        saveFields({ force: true });
      });
    } else if (field.model?.kind === 'richtext') {
      rendered = renderRichTextField(field, field.model.label, markDirty, saveFields);
    } else if (field.kind === 'image') {
      rendered = renderImageField(field, imageCount++, markDirty, saveFields, field.model?.label, field.model?.altLabel);
    } else if (field.kind === 'setting') {
      const ordinal = sectionOrdinal(selection.el);
      const onRemove = async () => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Remove the "${field.key}" setting? This can't be undone from here.`)) return;
        renderStatus(chrome.inspector, 'info', 'Removing…');
        try {
          const currentSource = await getSource({
            daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token: getToken(),
          });
          const updatedSource = removeSectionMetadataField(currentSource, ordinal, field.rowIndex);
          await putSource({
            daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updatedSource, token: getToken(),
          });
          await triggerPreview({
            daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
          });
          await saveAndRedecorate(chrome, selection, redecorateSection, 'Removed.');
        } catch (err) {
          if (err instanceof DaAuthError) {
            setToken('');
            openInspector(chrome, selection);
            return;
          }
          renderStatus(chrome.inspector, 'error', `Could not remove setting: ${err.message}`);
        }
      };
      if (field.model?.kind === 'select') {
        rendered = renderSettingSelectField(field, markDirty, saveFields, onRemove);
      } else if (field.model?.kind === 'multiselect') {
        rendered = renderSettingMultiSelectField(field, markDirty, saveFields, onRemove);
      } else {
        rendered = renderSettingField(field, markDirty, saveFields, onRemove);
      }
    } else {
      rendered = renderTextField(field, textCount++, markDirty, saveFields, field.model?.label);
    }
    fieldRefs.set(field, rendered.refs);
    section.append(rendered.fieldEl);
  }

  if (selection.type === 'section') {
    const existingKeys = new Set(fields.map((f) => f.key));
    const availableKeys = SECTION_METADATA_KEYS.filter((key) => !existingKeys.has(key));
    if (availableKeys.length > 0) {
      const keySelect = el('select', {}, availableKeys.map((key) => el('option', {
        value: key, textContent: SECTION_METADATA_MODELS[key]?.label ?? key,
      })));
      const addBtn = el('button', { className: 'ce-secondary', textContent: 'Add setting' });
      addBtn.addEventListener('click', async () => {
        addBtn.disabled = true;
        renderStatus(chrome.inspector, 'info', 'Adding…');
        try {
          const currentSource = await getSource({
            daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token: getToken(),
          });
          const updatedSource = addSectionMetadataField(currentSource, sectionOrdinal(selection.el), keySelect.value, '');
          await putSource({
            daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updatedSource, token: getToken(),
          });
          await triggerPreview({
            daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
          });
          await saveAndRedecorate(chrome, selection, redecorateSection, 'Added.');
        } catch (err) {
          if (err instanceof DaAuthError) {
            setToken('');
            openInspector(chrome, selection);
            return;
          }
          renderStatus(chrome.inspector, 'error', `Could not add setting: ${err.message}`);
          addBtn.disabled = false;
        }
      });
      section.append(el('div', { className: 'ce-field' }, [keySelect, addBtn]));
    }
  }

  activeInlineBinding = bindInlineEditing(selection.el, fields, fieldRefs, markDirty, saveFields);

  saveBtn.addEventListener('click', () => saveFields({ force: true }));

  // Remove a single section-metadata setting via its own "×" button above
  // instead - it isn't handled through this delete action.
  const deleteAction = selection.type === 'block'
    ? {
      label: 'Delete block',
      confirmText: `Delete this "${getBlockName(selection.el)}" block? This can't be undone from here.`,
      run: (source) => deleteBlockOccurrence(source, getBlockName(selection.el), blockOrdinal(selection.el)),
    }
    : selection.type === 'default-content'
      ? {
        label: 'Delete',
        confirmText: 'Delete this content? This can\'t be undone from here.',
        run: (source) => deleteSectionDefaultContentElement(source, sectionOrdinal(selection.el), selection.elementIndex),
      }
      : selection.type === 'section'
        ? {
          label: 'Delete section',
          confirmText: 'Delete this whole section, including everything inside it? This can\'t be undone from here.',
          run: (source) => deleteSection(source, sectionOrdinal(selection.el)),
        }
        : null;

  if (!deleteAction) {
    section.append(actions);
    return;
  }

  const deleteBtn = el('button', { className: 'ce-secondary ce-danger', textContent: deleteAction.label });
  deleteBtn.addEventListener('click', async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(deleteAction.confirmText)) return;
    deleteBtn.disabled = true;
    saveBtn.disabled = true;
    renderStatus(chrome.inspector, 'info', 'Deleting…');
    try {
      const currentSource = await getSource({
        daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token: getToken(),
      });
      const updatedSource = deleteAction.run(currentSource);
      await putSource({
        daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updatedSource, token: getToken(),
      });
      await triggerPreview({
        daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
      });
      renderStatus(chrome.inspector, 'ok', 'Deleted. Reloading…');
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      if (err instanceof DaAuthError) {
        setToken('');
        openInspector(chrome, selection);
        return;
      }
      renderStatus(chrome.inspector, 'error', `Delete failed: ${err.message}`);
      deleteBtn.disabled = false;
      saveBtn.disabled = false;
    }
  });
  actions.append(deleteBtn);

  section.append(actions);
}

function openInspector(chrome, selection) {
  if (activeInlineBinding) {
    activeInlineBinding.cleanup();
    activeInlineBinding = null;
  }
  chrome.inspector.innerHTML = '';
  chrome.inspector.classList.add('ce-open');

  const header = el('h2', {}, [
    document.createTextNode(getLabel(selection)),
  ]);
  const closeBtn = el('button', { className: 'ce-close', textContent: '×' });
  closeBtn.addEventListener('click', () => {
    selected = null;
    hideBox(chrome.selectionBox, chrome.selectionLabel);
    closeInspector(chrome);
  });
  header.append(closeBtn);
  chrome.inspector.append(header);

  const attrsSection = el('div', { className: 'ce-section' });
  if (selection.type === 'block') {
    attrsSection.append(el('div', { className: 'ce-attr-row' }, [
      el('span', { textContent: 'class' }),
      el('code', { textContent: selection.el.className }),
    ]));
    for (const { name, value } of [...selection.el.attributes].filter((a) => a.name.startsWith('data-'))) {
      attrsSection.append(el('div', { className: 'ce-attr-row' }, [
        el('span', { textContent: name }),
        el('code', { textContent: value }),
      ]));
    }
  } else {
    attrsSection.append(el('div', { className: 'ce-attr-row' }, [
      el('span', { textContent: 'section' }),
      el('code', { textContent: String(sectionOrdinal(selection.el)) }),
    ]));
  }
  chrome.inspector.append(attrsSection);
  chrome.inspector.append(renderAuthSection(chrome, selection));

  if (getToken()) {
    loadFieldsSection(chrome, selection);
  } else {
    chrome.inspector.append(el('div', {
      className: 'ce-status ce-info',
      textContent: 'Connect to DA above to load and edit this content’s fields.',
    }));
  }
}

/* -------------------------------------------------------- add-block palette */

/**
 * Where a dragged block would land if dropped at (clientX, clientY): which
 * section, and which of its existing top-level children (blocks and
 * default content alike) it should be inserted before - matching
 * insertBlockIntoSection's indexing. Returns null outside any section (drag
 * targets outside an existing section aren't supported yet - see
 * INSTRUCTIONS.md / block-patch.js for this scope limitation).
 *
 * Children aren't always stacked vertically - a "list of cards" is typically
 * a grid row of same-width blocks sitting side by side. If clientY falls
 * within a child's own vertical span, the drop is resolved *within that row*
 * by comparing clientX against each same-row child's horizontal midpoint
 * (before the first one the cursor is left of, or after the row's last child
 * if the cursor is right of all of them) - never by falling through to a
 * different row, since the cursor is verifiably still over this one.
 * Otherwise (the cursor is in the vertical gap between rows/children), the
 * target is resolved the simple vertical way, same as before.
 */
function computeDropTarget(clientX, clientY) {
  const elAtPoint = document.elementFromPoint(clientX, clientY);
  const section = elAtPoint?.closest(SECTION_SELECTOR);
  if (!section) return null;

  const sectionIndex = [...document.querySelectorAll(SECTION_SELECTOR)].indexOf(section);
  const children = getSectionAllChildren(section);
  const sectionRect = section.getBoundingClientRect();
  const rects = children.map((child) => child.getBoundingClientRect());

  const rowAnchor = rects.findIndex((r) => clientY >= r.top && clientY <= r.bottom);

  if (rowAnchor !== -1) {
    const rowTop = rects[rowAnchor].top;
    const rowIndices = [];
    rects.forEach((r, i) => { if (Math.abs(r.top - rowTop) < 2) rowIndices.push(i); });

    const before = rowIndices.find((i) => clientX < rects[i].left + rects[i].width / 2);
    if (before !== undefined) {
      const rect = rects[before];
      return {
        sectionIndex,
        insertBeforeIndex: before,
        indicatorRect: {
          orientation: 'vertical', left: rect.left, top: rect.top, height: rect.height,
        },
      };
    }
    const last = rowIndices[rowIndices.length - 1];
    const rect = rects[last];
    return {
      sectionIndex,
      insertBeforeIndex: last + 1,
      indicatorRect: {
        orientation: 'vertical', left: rect.right, top: rect.top, height: rect.height,
      },
    };
  }

  let insertBeforeIndex = children.length;
  let indicatorTop = sectionRect.bottom;
  for (let i = 0; i < children.length; i += 1) {
    if (clientY < rects[i].top + rects[i].height / 2) {
      insertBeforeIndex = i;
      indicatorTop = rects[i].top;
      break;
    }
  }

  return {
    sectionIndex,
    insertBeforeIndex,
    indicatorRect: {
      orientation: 'horizontal', left: sectionRect.left, width: sectionRect.width, top: indicatorTop,
    },
  };
}

/**
 * Renders the drop indicator either as a horizontal line spanning a
 * section's width (the default, and the only form computeSectionDropTarget
 * produces) or, when computeDropTarget resolved the drop *within* a grid row
 * of same-width children (e.g. a row of cards), as a vertical line spanning
 * that row's height at the exact before/after boundary between two cards.
 */
function showDropIndicator(dropIndicator, rect) {
  dropIndicator.style.display = 'block';
  dropIndicator.style.left = `${rect.left}px`;
  dropIndicator.style.top = `${rect.top}px`;
  if (rect.orientation === 'vertical') {
    dropIndicator.style.width = '';
    dropIndicator.style.height = `${rect.height}px`;
    dropIndicator.classList.add('ce-drop-indicator--vertical');
  } else {
    dropIndicator.style.width = `${rect.width}px`;
    dropIndicator.style.height = '';
    dropIndicator.classList.remove('ce-drop-indicator--vertical');
  }
}

/**
 * Where a dragged *section* (not a new block) would land at clientY: which
 * section-boundary index to move it before, snapping to whichever section's
 * midpoint the cursor is above/below - coarser than computeDropTarget,
 * since a section move only makes sense relative to other whole sections.
 */
function computeSectionDropTarget(clientY) {
  const sections = [...document.querySelectorAll(SECTION_SELECTOR)];
  if (sections.length === 0) return null;

  const main = document.querySelector('main');
  const mainRect = main.getBoundingClientRect();

  let insertBeforeIndex = sections.length;
  let indicatorTop = sections[sections.length - 1].getBoundingClientRect().bottom;
  for (let i = 0; i < sections.length; i += 1) {
    const rect = sections[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      insertBeforeIndex = i;
      indicatorTop = rect.top;
      break;
    }
  }

  return {
    insertBeforeIndex,
    indicatorRect: { left: mainRect.left, width: mainRect.width, top: indicatorTop },
  };
}

function hideDropIndicator(dropIndicator) {
  dropIndicator.style.display = 'none';
}

function renderPaletteStatus(container, kind, message) {
  const existing = container.querySelector('.ce-status');
  if (existing) existing.remove();
  if (!message) return;
  container.append(el('div', { className: `ce-status ce-${kind}`, textContent: message }));
}

/**
 * Add whatever was dropped - a block into an existing section, or a whole
 * new section as a sibling of the others - branching only on the patch
 * step; everything else (auth check, fetch/save/preview/reload) is shared.
 */
async function addDroppedItem(templateKey, target, statusContainer) {
  const template = BLOCK_TEMPLATES[templateKey];
  if (!template || !target) return;

  const token = getToken();
  if (!token) {
    renderPaletteStatus(statusContainer, 'error', 'Connect to DA above first.');
    return;
  }

  renderPaletteStatus(statusContainer, 'info', `Adding ${template.label}…`);
  const pagePath = window.location.pathname;
  try {
    const source = await getSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token,
    });
    const updated = template.kind === 'section'
      ? insertSection(source, target.insertBeforeIndex, template.html())
      : insertBlockIntoSection(source, target.sectionIndex, target.insertBeforeIndex, template.html());
    await putSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updated, token: getToken(),
    });
    await triggerPreview({
      daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
    });
    renderPaletteStatus(statusContainer, 'ok', `${template.label} added. Reloading…`);
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    if (err instanceof DaAuthError) {
      setToken('');
      renderPaletteStatus(statusContainer, 'error', 'Your DA session expired - reconnect above.');
      return;
    }
    renderPaletteStatus(statusContainer, 'error', `Could not add ${template.label}: ${err.message}`);
  }
}

async function moveDroppedSection(fromIndex, target, statusContainer) {
  if (!target) return;

  const token = getToken();
  if (!token) {
    renderPaletteStatus(statusContainer, 'error', 'Connect to DA above first to move sections.');
    return;
  }

  renderPaletteStatus(statusContainer, 'info', 'Moving section…');
  const pagePath = window.location.pathname;
  try {
    const source = await getSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token,
    });
    const updated = moveSection(source, fromIndex, target.insertBeforeIndex);
    await putSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updated, token: getToken(),
    });
    await triggerPreview({
      daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
    });
    renderPaletteStatus(statusContainer, 'ok', 'Section moved. Reloading…');
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    if (err instanceof DaAuthError) {
      setToken('');
      renderPaletteStatus(statusContainer, 'error', 'Your DA session expired - reconnect above.');
      return;
    }
    renderPaletteStatus(statusContainer, 'error', `Could not move section: ${err.message}`);
  }
}

async function moveDroppedBlock(blockName, occurrenceIndex, target, statusContainer) {
  if (!target) return;

  const token = getToken();
  if (!token) {
    renderPaletteStatus(statusContainer, 'error', 'Connect to DA above first to move blocks.');
    return;
  }

  renderPaletteStatus(statusContainer, 'info', 'Moving block…');
  const pagePath = window.location.pathname;
  try {
    const source = await getSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, token,
    });
    const updated = moveBlockOccurrence(source, blockName, occurrenceIndex, target);
    await putSource({
      daOrg: config.daOrg, daRepo: config.daRepo, path: pagePath, html: updated, token: getToken(),
    });
    await triggerPreview({
      daOrg: config.daOrg, daRepo: config.daRepo, daRef: config.daRef, path: pagePath, token: getToken(),
    });
    renderPaletteStatus(statusContainer, 'ok', 'Block moved. Reloading…');
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    if (err instanceof DaAuthError) {
      setToken('');
      renderPaletteStatus(statusContainer, 'error', 'Your DA session expired - reconnect above.');
      return;
    }
    renderPaletteStatus(statusContainer, 'error', `Could not move block: ${err.message}`);
  }
}

function renderPaletteAuthSection(rerender) {
  const container = el('div', { className: 'ce-section' });
  if (getToken()) {
    container.append(
      el('div', { className: 'ce-attr-row', innerHTML: '<span>DA connection</span><span>Connected</span>' }),
      el('button', {
        className: 'ce-secondary',
        textContent: 'Disconnect',
        onclick: () => { setToken(''); rerender(); },
      }),
    );
  } else {
    container.append(renderConnectPrompt(rerender));
  }
  return container;
}

function buildPalette(chrome) {
  const render = () => {
    chrome.palette.innerHTML = '';
    chrome.palette.append(el('h2', { textContent: 'Add block' }));
    chrome.palette.append(renderPaletteAuthSection(render));

    const list = el('div', { className: 'ce-palette-list' });
    for (const [templateKey, template] of Object.entries(BLOCK_TEMPLATES)) {
      const item = el('div', {
        className: 'ce-palette-item', draggable: true, textContent: template.label,
      });
      const dragDataType = template.kind === 'section' ? 'text/ce-add-section' : 'text/ce-add-block';
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData(dragDataType, templateKey);
        event.dataTransfer.effectAllowed = 'copy';
      });
      list.append(item);
    }
    chrome.palette.append(list);
    chrome.palette.append(el('div', { className: 'ce-palette-status' }));
  };
  render();
}

/**
 * Auto-scrolls the window while dragging near the top/bottom viewport edge -
 * native browser drag auto-scroll is inconsistent across engines, and
 * without this a long page (e.g. moving a block between two sections far
 * apart) may be impossible to reach without the drag stalling at whatever
 * position happened to be on-screen when the drop was released.
 */
const AUTO_SCROLL_EDGE = 60;
const AUTO_SCROLL_SPEED = 18;

function autoScrollForDrag(clientY) {
  if (clientY < AUTO_SCROLL_EDGE) {
    window.scrollBy(0, -AUTO_SCROLL_SPEED);
  } else if (clientY > window.innerHeight - AUTO_SCROLL_EDGE) {
    window.scrollBy(0, AUTO_SCROLL_SPEED);
  }
}

/**
 * Recomputes the drop target fresh from the event's own clientX/clientY at
 * decision time - used both live during dragover (to position the
 * indicator) and again at drop (rather than trusting whatever the last
 * dragover happened to cache), since dragover firing is throttled/coalesced
 * by the browser and a fast final movement or an in-progress auto-scroll
 * could otherwise leave a stale target from an earlier cursor position.
 */
function resolveDropTarget(event, isSectionMove, isAddSection) {
  return (isSectionMove || isAddSection)
    ? computeSectionDropTarget(event.clientY)
    : computeDropTarget(event.clientX, event.clientY);
}

/**
 * Four distinct drag kinds share this page-level drag/drop wiring, told
 * apart by dataTransfer type (readable during dragover, unlike the actual
 * value, which only becomes readable on drop):
 *  - 'text/ce-section-move'  an existing section being reordered
 *  - 'text/ce-add-section'   a new section from the palette (section-level target)
 *  - 'text/ce-add-block'     a new block from the palette (element-level target,
 *                            inserted inside whichever section it's dropped on)
 *  - 'text/ce-block-move'    an existing block being reordered/moved to another
 *                            section (element-level target, same as ce-add-block)
 */
function setupDragAndDrop(chrome) {
  document.addEventListener('dragover', (event) => {
    const types = event.dataTransfer.types;
    const isSectionMove = types.includes('text/ce-section-move');
    const isAddSection = types.includes('text/ce-add-section');
    const isAddBlock = types.includes('text/ce-add-block');
    const isBlockMove = types.includes('text/ce-block-move');
    if (!isSectionMove && !isAddSection && !isAddBlock && !isBlockMove) return;
    event.preventDefault(); // required to allow a drop
    autoScrollForDrag(event.clientY);
    const target = resolveDropTarget(event, isSectionMove, isAddSection);
    if (target) showDropIndicator(chrome.dropIndicator, target.indicatorRect);
    else hideDropIndicator(chrome.dropIndicator);
  });

  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) hideDropIndicator(chrome.dropIndicator); // left the window entirely
  });

  document.addEventListener('drop', (event) => {
    const statusContainer = chrome.palette.querySelector('.ce-palette-status');
    const types = event.dataTransfer.types;
    const isSectionMove = types.includes('text/ce-section-move');
    const isAddSection = types.includes('text/ce-add-section');

    const sectionMoveData = event.dataTransfer.getData('text/ce-section-move');
    if (sectionMoveData !== '') {
      event.preventDefault();
      hideDropIndicator(chrome.dropIndicator);
      moveDroppedSection(Number(sectionMoveData), resolveDropTarget(event, isSectionMove, isAddSection), statusContainer);
      return;
    }

    const blockMoveData = event.dataTransfer.getData('text/ce-block-move');
    if (blockMoveData !== '') {
      event.preventDefault();
      hideDropIndicator(chrome.dropIndicator);
      const { name, occurrenceIndex } = JSON.parse(blockMoveData);
      moveDroppedBlock(name, occurrenceIndex, resolveDropTarget(event, isSectionMove, isAddSection), statusContainer);
      return;
    }

    const addSectionData = event.dataTransfer.getData('text/ce-add-section');
    const addBlockData = event.dataTransfer.getData('text/ce-add-block');
    const templateKey = addSectionData || addBlockData;
    if (!templateKey) return;
    event.preventDefault();
    hideDropIndicator(chrome.dropIndicator);
    addDroppedItem(templateKey, resolveDropTarget(event, isSectionMove, isAddSection), statusContainer);
  });

  document.addEventListener('dragend', () => hideDropIndicator(chrome.dropIndicator));
}

/**
 * A small grip handle that follows whichever section the mouse is over
 * (skipping our own chrome), draggable to reorder that whole section among
 * its siblings - see computeSectionDropTarget/moveDroppedSection.
 */
function setupSectionDragHandle(chrome) {
  let currentSection = null;

  const reposition = () => {
    if (!currentSection) return;
    const rect = currentSection.getBoundingClientRect();
    chrome.sectionHandle.style.top = `${rect.top + 8}px`;
    chrome.sectionHandle.style.left = `${rect.left + 8}px`;
  };

  document.addEventListener('mouseover', (event) => {
    if (event.target.closest('#ce-inspector, #ce-palette, #ce-section-handle')) return;
    const section = event.target.closest(SECTION_SELECTOR);
    if (!section || section === currentSection) return;
    currentSection = section;
    chrome.sectionHandle.style.display = 'flex';
    reposition();
  });

  document.addEventListener('mouseout', (event) => {
    if (!currentSection) return;
    const leavingTo = event.relatedTarget;
    if (leavingTo && (currentSection.contains(leavingTo) || leavingTo.closest?.('#ce-section-handle'))) return;
    currentSection = null;
    chrome.sectionHandle.style.display = 'none';
  });

  chrome.sectionHandle.addEventListener('dragstart', (event) => {
    if (!currentSection) return;
    const sectionIndex = [...document.querySelectorAll(SECTION_SELECTOR)].indexOf(currentSection);
    event.dataTransfer.setData('text/ce-section-move', String(sectionIndex));
    event.dataTransfer.effectAllowed = 'move';
  });

  // A section with no exposed pixel of its own (e.g. no `grid` set yet, so
  // its blocks stack full-width and cover it edge to edge - precisely the
  // case where selecting the section to go fix that is otherwise
  // impossible) can still always be selected via its own grip handle.
  chrome.sectionHandle.addEventListener('click', (event) => {
    if (!currentSection) return;
    event.stopPropagation();
    selectUnit(chrome, { type: 'section', el: currentSection });
  });

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
}

/**
 * A small grip handle that follows whichever block the mouse is over
 * (skipping our own chrome and the section grip), draggable to reorder that
 * block within its section or move it into a different section entirely -
 * see computeDropTarget/moveDroppedBlock. Positioned at the block's
 * top-right corner (vs. the section grip's top-left) so the two don't
 * overlap when a block is a section's only/first child.
 */
function setupBlockDragHandle(chrome) {
  let currentBlock = null;

  const reposition = () => {
    if (!currentBlock) return;
    const rect = currentBlock.getBoundingClientRect();
    chrome.blockHandle.style.top = `${rect.top + 8}px`;
    chrome.blockHandle.style.left = `${rect.right - 28}px`;
  };

  document.addEventListener('mouseover', (event) => {
    if (event.target.closest('#ce-inspector, #ce-palette, #ce-section-handle, #ce-block-handle')) return;
    const blockEl = event.target.closest(BLOCK_SELECTOR);
    if (!blockEl || blockEl === currentBlock) return;
    currentBlock = blockEl;
    chrome.blockHandle.style.display = 'flex';
    reposition();
  });

  document.addEventListener('mouseout', (event) => {
    if (!currentBlock) return;
    const leavingTo = event.relatedTarget;
    if (leavingTo && (currentBlock.contains(leavingTo) || leavingTo.closest?.('#ce-block-handle'))) return;
    currentBlock = null;
    chrome.blockHandle.style.display = 'none';
  });

  chrome.blockHandle.addEventListener('dragstart', (event) => {
    if (!currentBlock) return;
    const name = normalizeBlockName(getBlockName(currentBlock));
    const occurrenceIndex = blockOrdinal(currentBlock);
    event.dataTransfer.setData('text/ce-block-move', JSON.stringify({ name, occurrenceIndex }));
    event.dataTransfer.effectAllowed = 'move';
  });

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
}

/* ------------------------------------------------------------------ boot */

async function loadConfig() {
  const response = await fetch('/__editor/config');
  return response.json();
}

async function init() {
  config = await loadConfig();
  // Block roots (main > div > div[class]) are present in the raw
  // server-rendered markup, so no need to wait on client-side decoration.
  const chrome = buildChrome();
  setupHoverAndSelection(chrome);
  buildPalette(chrome);
  setupDragAndDrop(chrome);
  setupSectionDragHandle(chrome);
  setupBlockDragHandle(chrome);
  document.body.classList.add('ce-has-palette'); // shifts page content right, out from under the palette
}

init();

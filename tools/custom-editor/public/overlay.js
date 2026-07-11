import {
  getBlockFields, setBlockFields,
  getSectionDefaultContentFields, setSectionDefaultContentFields, deleteSectionDefaultContentElement,
  getSectionMetadataFields, setSectionMetadataFields,
  insertBlockIntoSection, deleteBlockOccurrence,
  moveSection, insertSection,
  normalizeBlockName,
} from './lib/block-patch.js';
import { getSource, putSource, DaAuthError } from './lib/da-source.js';
import { triggerPreview } from './lib/admin-api.js';
import { BLOCK_TEMPLATES } from './lib/block-templates.js';

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
 * other paragraph in that section. Returns null for anything outside
 * `<main>`'s sections entirely (header, footer, our own chrome), or for a
 * click that lands on section padding/whitespace that isn't part of any
 * specific default-content element.
 */
function resolveEditable(rawTarget) {
  const blockEl = rawTarget.closest(BLOCK_SELECTOR);
  if (blockEl) return { type: 'block', el: blockEl };
  const section = rawTarget.closest(SECTION_SELECTOR);
  if (!section) return null;
  const contentElements = getSectionDefaultContentElements(section);
  const elementIndex = contentElements.findIndex((el) => el === rawTarget || el.contains(rawTarget));
  if (elementIndex === -1) return null;
  return { type: 'default-content', el: contentElements[elementIndex], elementIndex };
}

function getLabel(selection) {
  if (selection.type === 'block') return getBlockName(selection.el);
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
  document.body.append(
    hoverBox,
    hoverLabel,
    selectionBox,
    selectionLabel,
    inspector,
    palette,
    dropIndicator,
    sectionHandle,
  );
  return {
    hoverBox, hoverLabel, selectionBox, selectionLabel, inspector, palette, dropIndicator, sectionHandle,
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
    if (event.target.closest('#ce-inspector')) return; // interacting with our own panel, not the page
    const resolved = resolveEditable(event.target);
    if (!resolved) {
      selected = null;
      hideBox(chrome.selectionBox, chrome.selectionLabel);
      closeInspector(chrome);
      return;
    }
    if (sameSelection(resolved, selected)) return; // let inline editing / normal interaction inside the already-selected unit proceed
    event.preventDefault();
    selected = resolved;
    positionBox(chrome.selectionBox, chrome.selectionLabel, resolved.el, getLabel(resolved));
    openInspector(chrome, resolved);
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
    };
    node.addEventListener('input', onNodeInput);
    node.addEventListener('blur', onBlur);

    let onPanelInput;
    if (ref?.textarea) {
      onPanelInput = () => { node.innerHTML = ref.textarea.value; };
      ref.textarea.addEventListener('input', onPanelInput);
    }

    teardown.push(() => {
      node.contentEditable = 'false';
      node.classList.remove('ce-inline-editable');
      node.removeEventListener('input', onNodeInput);
      node.removeEventListener('blur', onBlur);
      if (onPanelInput) ref.textarea.removeEventListener('input', onPanelInput);
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

function renderTextField(field, index, markDirty, onBlur) {
  const textarea = el('textarea', { value: field.value });
  textarea.addEventListener('input', () => {
    field.value = textarea.value;
    markDirty();
  });
  textarea.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: `Text ${index + 1}` }),
    textarea,
  ]);
  return { fieldEl, refs: { textarea, fieldEl } };
}

function renderImageField(field, index, markDirty, onBlur) {
  const srcInput = el('input', { type: 'text', value: field.src, placeholder: 'Image URL' });
  const altInput = el('input', { type: 'text', value: field.alt, placeholder: 'Alt text' });
  srcInput.addEventListener('change', () => { field.src = srcInput.value; markDirty(); });
  altInput.addEventListener('input', () => { field.alt = altInput.value; markDirty(); });
  srcInput.addEventListener('blur', onBlur);
  altInput.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: `Image ${index + 1}` }),
    srcInput,
    el('label', { textContent: 'Alt text' }),
    altInput,
  ]);
  return { fieldEl, refs: { srcInput, altInput, fieldEl } };
}

function renderSettingField(field, markDirty, onBlur) {
  const input = el('input', { type: 'text', value: field.value });
  input.addEventListener('input', () => { field.value = input.value; markDirty(); });
  input.addEventListener('blur', onBlur);
  const fieldEl = el('div', { className: 'ce-field' }, [
    el('label', { textContent: field.key }),
    input,
  ]);
  return { fieldEl, refs: { input, fieldEl } };
}

/** Read fields from + write fields back to source, branching on selection type. */
function fieldsIo(selection) {
  if (selection.type === 'block') {
    const blockName = getBlockName(selection.el);
    const ordinal = blockOrdinal(selection.el);
    return {
      get: (source) => getBlockFields(source, blockName, ordinal),
      set: (source, fields) => setBlockFields(source, blockName, ordinal, fields),
    };
  }
  // Section: just the one default-content element the user selected (not
  // every paragraph/heading in the section) plus, if present, the
  // section-metadata block's key/value rows (style/grid/gap/spacing/... -
  // these become CSS classes on the section element, e.g. class="section
  // center container grid-4 gap-xl spacing-xxl", and the block removes
  // itself from the DOM once decorated, so it's only reachable through the
  // source, not the page) - settings are section-wide, so they're shown
  // regardless of which specific element was selected.
  const ordinal = sectionOrdinal(selection.el);
  return {
    get: (source) => [
      ...getSectionDefaultContentFields(source, ordinal)
        .filter((f) => f.elementIndex === selection.elementIndex)
        .map((f) => ({ ...f, group: 'content' })),
      ...getSectionMetadataFields(source, ordinal).map((f) => ({ ...f, group: 'settings', kind: 'setting' })),
    ],
    set: (source, fields) => {
      const contentFields = fields.filter((f) => f.group === 'content');
      const settingsFields = fields.filter((f) => f.group === 'settings');
      let result = setSectionDefaultContentFields(source, ordinal, contentFields);
      if (settingsFields.length > 0) {
        result = setSectionMetadataFields(result, ordinal, settingsFields);
      }
      return result;
    },
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
  if (fields.length === 0) {
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
      renderStatus(chrome.inspector, 'ok', 'Saved. Reload the page to see the update.');
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
  let settingsHeaderShown = false;
  for (const field of fields) {
    if (field.kind === 'setting' && !settingsHeaderShown) {
      section.append(el('div', { className: 'ce-field-group-label', textContent: 'Section settings' }));
      settingsHeaderShown = true;
    }
    let rendered;
    if (field.kind === 'image') rendered = renderImageField(field, imageCount++, markDirty, saveFields);
    else if (field.kind === 'setting') rendered = renderSettingField(field, markDirty, saveFields);
    else rendered = renderTextField(field, textCount++, markDirty, saveFields);
    fieldRefs.set(field, rendered.refs);
    section.append(rendered.fieldEl);
  }

  activeInlineBinding = bindInlineEditing(selection.el, fields, fieldRefs, markDirty, saveFields);

  saveBtn.addEventListener('click', () => saveFields({ force: true }));

  const deleteAction = selection.type === 'block'
    ? {
      label: 'Delete block',
      confirmText: `Delete this "${getBlockName(selection.el)}" block? This can't be undone from here.`,
      run: (source) => deleteBlockOccurrence(source, getBlockName(selection.el), blockOrdinal(selection.el)),
    }
    : {
      label: 'Delete',
      confirmText: 'Delete this content? This can\'t be undone from here.',
      run: (source) => deleteSectionDefaultContentElement(source, sectionOrdinal(selection.el), selection.elementIndex),
    };

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
 */
function computeDropTarget(clientX, clientY) {
  const elAtPoint = document.elementFromPoint(clientX, clientY);
  const section = elAtPoint?.closest(SECTION_SELECTOR);
  if (!section) return null;

  const sectionIndex = [...document.querySelectorAll(SECTION_SELECTOR)].indexOf(section);
  const children = getSectionAllChildren(section);
  const sectionRect = section.getBoundingClientRect();

  let insertBeforeIndex = children.length;
  let indicatorTop = sectionRect.bottom;
  for (let i = 0; i < children.length; i += 1) {
    const rect = children[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      insertBeforeIndex = i;
      indicatorTop = rect.top;
      break;
    }
  }

  return {
    sectionIndex,
    insertBeforeIndex,
    indicatorRect: { left: sectionRect.left, width: sectionRect.width, top: indicatorTop },
  };
}

function showDropIndicator(dropIndicator, rect) {
  dropIndicator.style.display = 'block';
  dropIndicator.style.left = `${rect.left}px`;
  dropIndicator.style.width = `${rect.width}px`;
  dropIndicator.style.top = `${rect.top}px`;
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
 * Three distinct drag kinds share this page-level drag/drop wiring, told
 * apart by dataTransfer type (readable during dragover, unlike the actual
 * value, which only becomes readable on drop):
 *  - 'text/ce-section-move'  an existing section being reordered
 *  - 'text/ce-add-section'   a new section from the palette (section-level target)
 *  - 'text/ce-add-block'     a new block from the palette (element-level target,
 *                            inserted inside whichever section it's dropped on)
 */
function setupDragAndDrop(chrome) {
  let currentTarget = null;

  document.addEventListener('dragover', (event) => {
    const types = event.dataTransfer.types;
    const isSectionMove = types.includes('text/ce-section-move');
    const isAddSection = types.includes('text/ce-add-section');
    const isAddBlock = types.includes('text/ce-add-block');
    if (!isSectionMove && !isAddSection && !isAddBlock) return;
    event.preventDefault(); // required to allow a drop
    currentTarget = (isSectionMove || isAddSection)
      ? computeSectionDropTarget(event.clientY)
      : computeDropTarget(event.clientX, event.clientY);
    if (currentTarget) showDropIndicator(chrome.dropIndicator, currentTarget.indicatorRect);
    else hideDropIndicator(chrome.dropIndicator);
  });

  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) hideDropIndicator(chrome.dropIndicator); // left the window entirely
  });

  document.addEventListener('drop', (event) => {
    const statusContainer = chrome.palette.querySelector('.ce-palette-status');

    const sectionMoveData = event.dataTransfer.getData('text/ce-section-move');
    if (sectionMoveData !== '') {
      event.preventDefault();
      hideDropIndicator(chrome.dropIndicator);
      moveDroppedSection(Number(sectionMoveData), currentTarget, statusContainer);
      currentTarget = null;
      return;
    }

    const addSectionData = event.dataTransfer.getData('text/ce-add-section');
    const addBlockData = event.dataTransfer.getData('text/ce-add-block');
    const templateKey = addSectionData || addBlockData;
    if (!templateKey) return;
    event.preventDefault();
    hideDropIndicator(chrome.dropIndicator);
    addDroppedItem(templateKey, currentTarget, statusContainer);
    currentTarget = null;
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
  document.body.classList.add('ce-has-palette'); // shifts page content right, out from under the palette
}

init();

import { loadArea } from '../../scripts/ak.js';

function replaceDotMedia(path, doc) {
  const resetAttributeBase = (tag, attr) => {
    doc.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((el) => {
      el[attr] = new URL(el.getAttribute(attr), new URL(path, window.location)).href;
    });
  };
  resetAttributeBase('img', 'src');
  resetAttributeBase('source', 'srcset');
}

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  const resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) throw Error(`Couldn't fetch ${path}.plain.html`);

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Make images cacheable
  replaceDotMedia(path, doc);

  const sections = doc.body.querySelectorAll(':scope > div');
  const fragment = document.createElement('div');
  fragment.classList.add('fragment-content');
  fragment.append(...sections);

  await loadArea({ area: fragment });

  return fragment;
}

/**
 *
 * @param {Element}} a the fragment link
 * @returns the element that can be replaced
 */
function getReplaceEl(a) {
  let count = 0;
  let current = a;
  const parent = a.closest('.section');

  // Walk up the DOM tree from child to parent
  while (current && current !== parent) {
    current = current.parentElement;
    if (current && current !== parent) {
      count += 1;
    }
  }

  if (count > 1) return a;

  const { children } = parent;
  if (children.length > 1) return a;

  const { children: containerChildren } = children[0];
  if (containerChildren.length > 1) return a;

  return parent;
}

export default async function init(a) {
  const path = a.getAttribute('href');
  const fragment = await loadFragment(path);
  if (fragment) {
    const elToReplace = getReplaceEl(a);
    const sections = fragment.querySelectorAll(':scope > .section');
    const children = sections.length === 1
      ? fragment.querySelectorAll(':scope > *')
      : [fragment];
    for (const child of children) {
      elToReplace.insertAdjacentElement('afterend', child);
    }
    elToReplace.remove();
  }
}

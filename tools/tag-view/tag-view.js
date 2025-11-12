import { loadStyle } from '../../scripts/ak.js';

const DIALOG_NAME = 'sk-view-tags-dialog';

function toggleDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  } else {
    dialog.showModal();
  }
}

function getTags() {
  const metaTags = [...document.head.querySelectorAll('[property="article:tag"]')];
  const tagEls = metaTags.map((el) => {
    const para = document.createElement('p');
    para.textContent = el.getAttribute('content');
    return para;
  });
  const wrapper = document.createElement('div');
  wrapper.className = 'tag-list-wrapper';
  wrapper.append(...tagEls);
  return wrapper;
}

function getNewDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = DIALOG_NAME;
  dialog.setAttribute('closedby', 'any');

  const title = document.createElement('p');
  title.className = 'tags-view-title';
  title.innerText = 'Tags';

  const closeBtn = document.createElement('button');
  closeBtn.addEventListener('click', () => { dialog.close(); });
  closeBtn.innerText = 'Close';

  const tagWrapper = getTags();

  dialog.append(title, closeBtn, tagWrapper);
  document.body.append(dialog);

  return dialog;
}

export default async function toggleTags() {
  await loadStyle(`${import.meta.url.replace('js', 'css')}`);

  // If dialog already exists, use it.
  const dialog = document.querySelector(`dialog.${DIALOG_NAME}`) || getNewDialog();

  toggleDialog(dialog);
}
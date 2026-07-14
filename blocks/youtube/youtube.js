import observe from '../../scripts/utils/observer.js';

function decorate(el) {
  el.innerHTML = `<iframe src="${el.dataset.src}" class="youtube"
  webkitallowfullscreen mozallowfullscreen allowfullscreen
  allow="encrypted-media; accelerometer; gyroscope; picture-in-picture"
  scrolling="no"
  title="Youtube Video">`;
}

function embedSrc(url) {
  const params = new URLSearchParams(url.search);
  const id = params.get('v') || url.pathname.split('/').pop();
  params.append('rel', '0');
  params.delete('v');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

/**
 * Two authored shapes reach this block: an auto-linked youtube URL (the
 * widgets pathway in scripts/ak.js - `el` is the `<a>` itself), or a
 * canonical `youtube` block authored as a div with a link in its cell
 * (`el` is the block's wrapper div, per the usual block convention of
 * pulling the link out via `querySelector('a')` - see e.g. blocks/card).
 */
export default function init(el) {
  const isLink = el.tagName === 'A';
  const link = isLink ? el : el.querySelector('a');
  if (!link) return;

  const div = document.createElement('div');
  div.className = 'video';
  div.dataset.src = embedSrc(new URL(link.href));

  if (isLink) {
    el.parentElement.replaceChild(div, el);
  } else {
    el.innerHTML = '';
    el.append(div);
  }
  observe(div, decorate);
}

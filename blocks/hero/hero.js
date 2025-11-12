function decorateBackground(hero, bg) {
  const bgPic = bg.querySelector('picture');
  const bgImgLink = bgPic.closest('a');
  if (bgImgLink) {
    const { href } = bgImgLink;
    if (!href.includes('.mp4')) return;
    const video = document.createElement('video');
    video.setAttribute('muted', true);
    video.setAttribute('autoplay', true);
    video.setAttribute('playsinline', true);
    video.setAttribute('loop', true);
    video.setAttribute('src', href);
    video.addEventListener('play', () => {
      bgPic.remove();
    });

    bgImgLink.parentElement.append(video, bgPic);
    bgImgLink.remove();
  }
}

function decorateForeground(fg) {
  const heading = fg.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.classList.add('hero-heading');
    const detail = heading.previousElementSibling;
    if (detail) {
      detail.classList.add('hero-detail');
    }
  }
}

export default async function init(el) {
  const rows = [...el.querySelectorAll(':scope > div')];
  const fg = rows.pop();
  fg.classList.add('hero-foreground');
  decorateForeground(fg);
  if (rows.length) {
    const bg = rows.pop();
    bg.classList.add('hero-background');
    decorateBackground(el, bg);
  }
}

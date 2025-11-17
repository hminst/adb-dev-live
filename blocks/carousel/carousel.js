import observe from '../../scripts/utils/observer.js';

function createButton(label, className, ariaLabel) {
  const button = document.createElement('button');
  button.className = className;
  button.setAttribute('aria-label', ariaLabel);
  button.setAttribute('type', 'button');
  button.innerHTML = `<span>${label}</span>`;
  return button;
}

function createIndicator(index, isActive) {
  const button = document.createElement('button');
  button.className = `carousel-indicator ${isActive ? 'is-active' : ''}`;
  button.setAttribute('aria-label', `Go to slide ${index + 1}`);
  button.setAttribute('type', 'button');
  button.setAttribute('data-slide', index);
  return button;
}

function updateIndicators(container, currentIndex) {
  const indicators = container.querySelectorAll('.carousel-indicator');
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', index === currentIndex);
  });
}

function updateSlides(container, currentIndex) {
  const slides = container.querySelectorAll('.carousel-slide');
  slides.forEach((slide, index) => {
    slide.classList.toggle('is-active', index === currentIndex);
    slide.setAttribute('aria-hidden', index !== currentIndex);
  });
}

function goToSlide(container, index, totalSlides) {
  const currentIndex = parseInt(container.dataset.currentIndex || '0', 10);
  let newIndex = index;
  
  if (index < 0) {
    newIndex = totalSlides - 1;
  } else if (index >= totalSlides) {
    newIndex = 0;
  }
  
  container.dataset.currentIndex = newIndex;
  updateSlides(container, newIndex);
  updateIndicators(container, newIndex);
}

function nextSlide(container, totalSlides) {
  const currentIndex = parseInt(container.dataset.currentIndex || '0', 10);
  goToSlide(container, currentIndex + 1, totalSlides);
}

function prevSlide(container, totalSlides) {
  const currentIndex = parseInt(container.dataset.currentIndex || '0', 10);
  goToSlide(container, currentIndex - 1, totalSlides);
}

function setupCarousel(el) {
  const slides = [...el.querySelectorAll(':scope > div')];
  if (slides.length === 0) return;

  // Wrap slides in container
  const slidesContainer = document.createElement('div');
  slidesContainer.className = 'carousel-slides';
  
  slides.forEach((slide, index) => {
    slide.classList.add('carousel-slide');
    slide.setAttribute('aria-hidden', index !== 0);
    if (index === 0) slide.classList.add('is-active');
    
    // Restructure slide content: separate image from text
    const innerDiv = slide.querySelector(':scope > div');
    if (innerDiv) {
      // Find picture (might be directly in div or inside a paragraph)
      const pictureElement = innerDiv.querySelector('picture');
      const pictureParent = pictureElement?.closest('p, div');
      
      // Find all text elements (exclude elements containing pictures)
      const allChildren = [...innerDiv.children];
      const textElements = allChildren.filter(
        child => !child.querySelector('picture') && child !== pictureParent
      );
      
      // Create image container
      const imageContainer = document.createElement('div');
      imageContainer.className = 'carousel-slide-image';
      if (pictureElement && pictureParent) {
        // Move the picture parent (p or div) to image container
        imageContainer.append(pictureParent);
      } else if (pictureElement) {
        imageContainer.append(pictureElement);
      }
      
      // Create text container
      const textContainer = document.createElement('div');
      textContainer.className = 'carousel-slide-text';
      if (textElements.length > 0) {
        textContainer.append(...textElements);
      }
      
      // Clear and rebuild slide structure
      slide.innerHTML = '';
      if (imageContainer.children.length > 0) {
        slide.append(imageContainer);
      }
      if (textElements.length > 0) {
        slide.append(textContainer);
      }
    }
    
    slidesContainer.append(slide);
  });

  // Create navigation
  const nav = document.createElement('div');
  nav.className = 'carousel-nav';
  
  const prevBtn = createButton('Previous', 'carousel-button carousel-button-prev', 'Previous slide');
  const nextBtn = createButton('Next', 'carousel-button carousel-button-next', 'Next slide');
  
  nav.append(prevBtn, nextBtn);

  // Create indicators if more than one slide
  let indicatorsContainer = null;
  if (slides.length > 1) {
    indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'carousel-indicators';
    
    slides.forEach((_, index) => {
      const indicator = createIndicator(index, index === 0);
      indicatorsContainer.append(indicator);
    });
  }

  // Set initial state
  el.dataset.currentIndex = '0';
  el.classList.add('carousel-initialized');

  // Clear and rebuild
  el.innerHTML = '';
  el.append(slidesContainer);
  if (indicatorsContainer) {
    el.append(indicatorsContainer);
  }
  el.append(nav);

  // Add event listeners
  prevBtn.addEventListener('click', () => prevSlide(el, slides.length));
  nextBtn.addEventListener('click', () => nextSlide(el, slides.length));
  
  if (indicatorsContainer) {
    indicatorsContainer.addEventListener('click', (e) => {
      const indicator = e.target.closest('.carousel-indicator');
      if (indicator) {
        const slideIndex = parseInt(indicator.dataset.slide, 10);
        goToSlide(el, slideIndex, slides.length);
      }
    });
  }

  // Keyboard navigation
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide(el, slides.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide(el, slides.length);
    }
  });

  // Touch/swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  el.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        nextSlide(el, slides.length);
      } else {
        prevSlide(el, slides.length);
      }
    }
  }

  // Auto-play support (if autoplay class is present)
  if (el.classList.contains('autoplay')) {
    const interval = parseInt(el.dataset.interval || '5000', 10);
    let autoPlayInterval = setInterval(() => {
      nextSlide(el, slides.length);
    }, interval);

    // Pause on hover
    el.addEventListener('mouseenter', () => {
      clearInterval(autoPlayInterval);
    });

    el.addEventListener('mouseleave', () => {
      autoPlayInterval = setInterval(() => {
        nextSlide(el, slides.length);
      }, interval);
    });
  }
}

export default function init(el) {
  observe(el, () => setupCarousel(el));
}


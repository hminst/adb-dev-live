import { getConfig } from '../ak.js';

const { codeBase } = getConfig();

/**
 * Map of icon placeholder names to their SVG file names
 * Add new icons here as needed
 */
const ICON_MAP = {
  logo: 'logo',
  toggle: 'toggle',
  globe: 'globe',
  more: 'more',
  helix: 'helix',
  'helix-color': 'helix-color',
};

/**
 * Replace icon placeholders (e.g., :logo:, :toggle:) with SVG icons in text content
 * @param {HTMLElement} element - The element to process (searches all text nodes within)
 */
export function replaceIconPlaceholders(element) {
  if (!element) return;

  // Pattern to match :word: placeholders
  const placeholderPattern = /:(\w+):/g;
  
  // Walk through all text nodes in the element
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip empty text nodes
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        
        // Skip text nodes in script/style tags
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip section-metadata blocks
        if (parent && (parent.classList.contains('section-metadata') || 
            parent.closest('.section-metadata'))) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  // Process each text node
  textNodes.forEach((textNode) => {
    const text = textNode.textContent;
    const matches = [...text.matchAll(placeholderPattern)];
    
    if (matches.length === 0) return;

    // Create a document fragment to hold the replacement nodes
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach((match) => {
      const iconName = match[1].toLowerCase();
      
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        if (textBefore) {
          fragment.appendChild(document.createTextNode(textBefore));
        }
      }

      // Check if this icon exists in our map
      if (ICON_MAP[iconName]) {
        // Create icon element
        const iconSpan = document.createElement('span');
        iconSpan.className = `icon icon-${ICON_MAP[iconName]}`;
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.setAttribute('role', 'img');
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', `icon icon-${ICON_MAP[iconName]}`);
        svg.setAttribute('aria-hidden', 'true');
        
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `${codeBase}/img/icons/${ICON_MAP[iconName]}.svg#${ICON_MAP[iconName]}`);
        
        svg.appendChild(use);
        iconSpan.appendChild(svg);
        fragment.appendChild(iconSpan);
      } else {
        // Icon not found, keep the placeholder as-is
        fragment.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = match.index + match[0].length;
    });

    // Add remaining text after the last match
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    // Replace the text node with the fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  });
}

/**
 * Process icon placeholders in all blocks within an element
 * @param {HTMLElement} element - The element containing blocks to process
 */
export function processIconPlaceholdersInBlocks(element) {
  if (!element) return;
  
  // Process all blocks
  const blocks = element.querySelectorAll('.block');
  blocks.forEach((block) => {
    replaceIconPlaceholders(block);
  });
  
  // Also process any text content outside of blocks
  replaceIconPlaceholders(element);
}


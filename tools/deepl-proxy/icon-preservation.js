/**
 * Icon Element Preservation Module
 * 
 * Preserves icon HTML elements (e.g., <span class="icon icon-logo"></span>) 
 * during translation by replacing them with placeholders before translation
 * and restoring them after translation. This prevents translation services
 * from reordering or modifying icon elements.
 */

/**
 * Preserve icon HTML elements by replacing them with placeholders
 * @param {string} html - The HTML string to process
 * @returns {Object} Object with preservedHtml and iconElements array
 */
export function preserveIconElements(html) {
  const iconElements = [];
  let preservedHtml = html;
  let index = 0;
  
  // Pattern 1: Match self-closing icon tags: <span class="icon icon-logo" />
  const selfClosingPattern = /<([a-z]+)([^>]*class\s*=\s*["']?[^"'>]*\bicon\b[^"'>]*["']?[^>]*?)\s*\/\s*>/gi;
  
  preservedHtml = preservedHtml.replace(selfClosingPattern, (match, tagName, attributes) => {
    // Skip if this is a section-metadata element
    if (/class\s*=\s*["']?[^"'>]*section-metadata[^"'>]*["']?/i.test(attributes)) {
      return match;
    }
    
    // Wrap placeholder in XML-style tags that DeepL will ignore
    // Using a custom tag name that DeepL won't translate
    const placeholder = `ICONELEMENT${String(index).padStart(3, '0')}`;
    const wrappedPlaceholder = `<notranslate data-icon="${placeholder}"></notranslate>`;
    
    iconElements.push({
      placeholder,
      wrappedPlaceholder,
      original: match,
      tagName,
      attributes,
      content: '',
      isSelfClosing: true,
      index,
    });
    
    index++;
    return wrappedPlaceholder;
  });
  
  // Pattern 2: Match paired icon tags: <span class="icon icon-logo">content</span>
  // We need to match the opening tag and find the corresponding closing tag
  const openingTagPattern = /<([a-z]+)([^>]*class\s*=\s*["']?[^"'>]*\bicon\b[^"'>]*["']?[^>]*?)>/gi;
  const matches = [];
  
  // First pass: find all opening tags
  let match;
  while ((match = openingTagPattern.exec(preservedHtml)) !== null) {
    const tagName = match[1];
    const attributes = match[2];
    const startPos = match.index;
    const fullOpeningTag = match[0];
    
    // Skip if this is a section-metadata element
    if (/class\s*=\s*["']?[^"'>]*section-metadata[^"'>]*["']?/i.test(attributes)) {
      continue;
    }
    
    // Find the corresponding closing tag
    const closingTag = `</${tagName}>`;
    const afterOpening = preservedHtml.substring(startPos + fullOpeningTag.length);
    const closingPos = afterOpening.indexOf(closingTag);
    
    if (closingPos !== -1) {
      const content = afterOpening.substring(0, closingPos);
      const fullElement = preservedHtml.substring(startPos, startPos + fullOpeningTag.length + content.length + closingTag.length);
      
      matches.push({
        fullElement,
        startPos,
        tagName,
        attributes,
        content,
        index: index++,
      });
    }
  }
  
  // Replace matches in reverse order to preserve positions
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullElement, tagName, attributes, content, index: idx } = matches[i];
    // Wrap placeholder in XML-style tags that DeepL will ignore
    const placeholder = `ICONELEMENT${String(idx).padStart(3, '0')}`;
    const wrappedPlaceholder = `<notranslate data-icon="${placeholder}"></notranslate>`;
    
    iconElements.push({
      placeholder,
      wrappedPlaceholder,
      original: fullElement,
      tagName,
      attributes,
      content,
      isSelfClosing: false,
      index: idx,
    });
    
    preservedHtml = preservedHtml.substring(0, matches[i].startPos) +
                    wrappedPlaceholder +
                    preservedHtml.substring(matches[i].startPos + fullElement.length);
  }
  
  if (iconElements.length > 0) {
    console.log(`  Preserving ${iconElements.length} icon element(s) as placeholders`);
    iconElements.forEach(({ placeholder, tagName }) => {
      console.log(`    ${placeholder} -> <${tagName} class="icon...">`);
    });
  }
  
  return { preservedHtml, iconElements };
}

/**
 * Restore icon elements from placeholders after translation
 * @param {string} html - The translated HTML string with placeholders
 * @param {Array} iconElements - Array of icon element metadata from preserveIconElements
 * @returns {string} HTML with icon elements restored
 */
export function restoreIconElements(html, iconElements) {
  let restoredHtml = html;
  let totalRestored = 0;
  
  // Restore in reverse order to avoid conflicts
  const reversedElements = [...iconElements].reverse();
  
  reversedElements.forEach(({ placeholder, wrappedPlaceholder, original, index }) => {
    // First try to find the wrapped placeholder (XML tag)
    const wrappedPattern = new RegExp(
      `<notranslate\\s+data-icon="${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"></notranslate>`,
      'gi'
    );
    const wrappedMatches = restoredHtml.match(wrappedPattern);
    
    if (wrappedMatches && wrappedMatches.length > 0) {
      restoredHtml = restoredHtml.replace(wrappedPattern, original);
      totalRestored += wrappedMatches.length;
      console.log(`  ✓ Restored ${wrappedMatches.length} icon element(s) using wrapped placeholder ${placeholder}`);
    } else {
      // Fallback: try unwrapped placeholder (in case DeepL removed the wrapper)
      const exactEscaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactRegex = new RegExp(exactEscaped, 'g');
      const exactMatches = restoredHtml.match(exactRegex);
      
      if (exactMatches && exactMatches.length > 0) {
        restoredHtml = restoredHtml.replace(exactRegex, original);
        totalRestored += exactMatches.length;
        console.log(`  ✓ Restored ${exactMatches.length} icon element(s) using unwrapped placeholder ${placeholder}`);
      } else {
        console.warn(`  ✗ Could not restore icon element: ${placeholder}`);
      }
    }
  });
  
  if (totalRestored > 0) {
    console.log(`  ✓ Total icon elements restored: ${totalRestored}`);
  } else if (iconElements.length > 0) {
    console.warn(`  ✗ Warning: Could not restore any of ${iconElements.length} icon element(s).`);
  }
  
  return restoredHtml;
}


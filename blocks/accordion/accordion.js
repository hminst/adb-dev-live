/**
 * Creates an accordion item from a row in the block
 * @param {HTMLElement} row - The row containing title and content
 * @param {boolean} isSingleOpen - Whether this accordion uses single-open mode
 * @returns {HTMLElement} The decorated accordion item
 */
function createAccordionItem(row, isSingleOpen) {
  const item = document.createElement('div');
  item.className = 'accordion-item';

  const [titleCell, contentCell] = row.children;
  
  if (!titleCell || !contentCell) return null;

  // Create button for the header (for accessibility and keyboard support)
  const button = document.createElement('button');
  button.className = 'accordion-button';
  button.setAttribute('type', 'button');
  button.setAttribute('aria-expanded', 'false');
  
  // Extract text content from title cell (handles bold text, headings, etc.)
  const titleText = titleCell.textContent.trim();
  button.textContent = titleText;
  
  // Generate unique ID for ARIA relationship
  const itemId = `accordion-${Math.random().toString(36).substr(2, 9)}`;
  button.setAttribute('aria-controls', itemId);

  // Create header container
  const header = document.createElement('div');
  header.className = 'accordion-header';
  header.append(button);

  // Create content panel
  const panel = document.createElement('div');
  panel.className = 'accordion-panel';
  panel.id = itemId;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', button.id || itemId);
  panel.hidden = true;

  // Move content from cell to panel
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.innerHTML = contentCell.innerHTML;
  panel.append(content);

  item.append(header, panel);
  
  return item;
}

/**
 * Toggles an accordion item open/closed
 * @param {HTMLElement} item - The accordion item to toggle
 * @param {HTMLElement} block - The accordion block element
 */
function toggleItem(item, block) {
  const button = item.querySelector('.accordion-button');
  const panel = item.querySelector('.accordion-panel');
  const isOpen = button.getAttribute('aria-expanded') === 'true';
  const isSingleOpen = block.classList.contains('single-open');

  if (isSingleOpen && !isOpen) {
    // Close all other items first
    const allItems = block.querySelectorAll('.accordion-item');
    allItems.forEach((otherItem) => {
      if (otherItem !== item) {
        const otherButton = otherItem.querySelector('.accordion-button');
        const otherPanel = otherItem.querySelector('.accordion-panel');
        otherButton.setAttribute('aria-expanded', 'false');
        otherPanel.hidden = true;
        otherItem.classList.remove('is-open');
      }
    });
  }

  // Toggle current item
  const newState = !isOpen;
  button.setAttribute('aria-expanded', newState);
  panel.hidden = !newState;
  item.classList.toggle('is-open', newState);
}

/**
 * Decorates the accordion block
 * @param {Element} block The accordion block element
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  
  if (rows.length === 0) return;

  const isSingleOpen = block.classList.contains('single-open');
  
  // Create accordion items from rows
  const items = rows
    .map((row) => createAccordionItem(row, isSingleOpen))
    .filter((item) => item !== null);

  // Clear block and add items
  block.innerHTML = '';
  items.forEach((item) => block.append(item));

  // Add click event listeners
  block.addEventListener('click', (e) => {
    const button = e.target.closest('.accordion-button');
    if (button) {
      const item = button.closest('.accordion-item');
      toggleItem(item, block);
    }
  });

  // Keyboard support (Enter and Space)
  block.addEventListener('keydown', (e) => {
    const button = e.target.closest('.accordion-button');
    if (button && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const item = button.closest('.accordion-item');
      toggleItem(item, block);
    }
  });

  // Mark as initialized
  block.classList.add('accordion-initialized');
}


import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { LitElement, html, nothing } from 'da-lit';
import { getDASourceURL } from '../shared/api-config.js';

// Super Lite components
import 'https://da.live/nx/public/sl/components.js';

// Application styles
import loadStyle from '../../scripts/utils/styles.js';

// Load mammoth.js for DOCX parsing
const mammothScript = document.createElement('script');
mammothScript.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
document.head.appendChild(mammothScript);

const styles = await loadStyle(import.meta.url);

class ADLDocxToPages extends LitElement {
  static properties = {
    path: { attribute: false },
    token: { attribute: false },
    _file: { state: true },
    _pages: { state: true },
    _status: { state: true },
    _processing: { state: true },
    _basePath: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [styles];
    this._pages = [];
    this._status = undefined;
    this._processing = false;
    this._basePath = this.path || '/content';
  }

  handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      this._status = { type: 'error', message: 'Please select a .docx file' };
      this.requestUpdate();
      return;
    }

    this._file = file;
    this._status = { type: 'info', message: `File selected: ${file.name}` };
    this.requestUpdate();
  }

  async parseDocx(file) {
    return new Promise((resolve, reject) => {
      if (!window.mammoth) {
        // Wait for mammoth to load
        setTimeout(() => {
          if (!window.mammoth) {
            reject(new Error('Mammoth.js failed to load'));
            return;
          }
          this.parseDocx(file).then(resolve).catch(reject);
        }, 100);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await window.mammoth.convertToHtml({ arrayBuffer });
          resolve(result.value);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  convertHtmlToAEMFormat(html) {
    // Parse HTML and convert to AEM Edge Delivery Services format
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    const pages = [];
    let currentPage = {
      title: '',
      path: '',
      content: [],
    };

    // Process content node by node
    const processNode = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        // Headings indicate new sections or pages
        if (tagName.match(/^h[1-6]$/)) {
          const level = parseInt(tagName[1]);
          const text = node.textContent.trim();
          
          // H1 indicates a new page
          if (level === 1 && text) {
            if (currentPage.title) {
              pages.push({ ...currentPage });
            }
            currentPage = {
              title: text,
              path: this.slugify(text),
              content: [],
            };
          } else if (text) {
            // Other headings are sections
            currentPage.content.push({
              type: 'heading',
              level,
              text,
            });
          }
        } else if (tagName === 'p') {
          const text = node.textContent.trim();
          if (text) {
            currentPage.content.push({
              type: 'paragraph',
              text,
            });
          }
        } else if (tagName === 'ul' || tagName === 'ol') {
          const items = Array.from(node.querySelectorAll('li')).map(li => li.textContent.trim());
          if (items.length > 0) {
            currentPage.content.push({
              type: tagName === 'ul' ? 'unordered-list' : 'ordered-list',
              items,
            });
          }
        } else if (tagName === 'table') {
          // Handle tables
          const rows = Array.from(node.querySelectorAll('tr')).map(tr => 
            Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent.trim())
          );
          if (rows.length > 0) {
            currentPage.content.push({
              type: 'table',
              rows,
            });
          }
        } else {
          // Process child nodes
          Array.from(node.childNodes).forEach(processNode);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text && !currentPage.content.length) {
          // First text content becomes a paragraph if no structure yet
          currentPage.content.push({
            type: 'paragraph',
            text,
          });
        }
      }
    };

    Array.from(body.childNodes).forEach(processNode);
    
    // Add the last page
    if (currentPage.title) {
      pages.push(currentPage);
    }

    return pages;
  }

  slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  generateAEMHTML(page) {
    // AEM Edge Delivery Services expects HTML content
    // Create document structure like tag-gen does: body > main > div (section)
    const doc = document.implementation.createHTMLDocument();
    const body = doc.createElement('body');
    const main = doc.createElement('main');
    const section = doc.createElement('div');
    
    // Add page title as H1
    const h1 = doc.createElement('h1');
    h1.textContent = page.title;
    section.appendChild(h1);
    
    page.content.forEach(item => {
      switch (item.type) {
        case 'heading':
          const headingTag = `h${Math.min(item.level, 6)}`;
          const heading = doc.createElement(headingTag);
          heading.textContent = item.text;
          section.appendChild(heading);
          break;
        case 'paragraph':
          const p = doc.createElement('p');
          p.textContent = item.text.trim();
          if (p.textContent) {
            section.appendChild(p);
          }
          break;
        case 'unordered-list':
          const ul = doc.createElement('ul');
          item.items.forEach(itemText => {
            const cleanText = itemText.trim();
            if (cleanText) {
              const li = doc.createElement('li');
              li.textContent = cleanText;
              ul.appendChild(li);
            }
          });
          if (ul.children.length > 0) {
            section.appendChild(ul);
          }
          break;
        case 'ordered-list':
          const ol = doc.createElement('ol');
          item.items.forEach(itemText => {
            const cleanText = itemText.trim();
            if (cleanText) {
              const li = doc.createElement('li');
              li.textContent = cleanText;
              ol.appendChild(li);
            }
          });
          if (ol.children.length > 0) {
            section.appendChild(ol);
          }
          break;
        case 'table':
          if (item.rows.length > 0) {
            const table = doc.createElement('table');
            const thead = doc.createElement('thead');
            const tbody = doc.createElement('tbody');
            
            // Header row
            const headerRow = doc.createElement('tr');
            item.rows[0].forEach(cellText => {
              const th = doc.createElement('th');
              th.textContent = (cellText || '').trim();
              headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Data rows
            item.rows.slice(1).forEach(rowData => {
              const tr = doc.createElement('tr');
              rowData.forEach(cellText => {
                const td = doc.createElement('td');
                td.textContent = (cellText || '').trim();
                tr.appendChild(td);
              });
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            section.appendChild(table);
          }
          break;
      }
    });
    
    main.appendChild(section);
    body.appendChild(main);
    
    // Return body.outerHTML like tag-gen does
    return body.outerHTML;
  }

  async processDocx() {
    if (!this._file) {
      this._status = { type: 'error', message: 'Please select a file first' };
      return;
    }

    this._processing = true;
    this._status = { type: 'info', message: 'Processing DOCX file...' };

    try {
      // Parse DOCX to HTML
      const html = await this.parseDocx(this._file);
      
      // Convert HTML to AEM format
      const pages = this.convertHtmlToAEMFormat(html);
      
      if (pages.length === 0) {
        this._status = { type: 'error', message: 'No pages found in document. Ensure your document has H1 headings for page breaks.' };
        this._processing = false;
        return;
      }

      this._pages = pages;
      this._status = { type: 'success', message: `Found ${pages.length} page(s) in document` };
    } catch (error) {
      this._status = { type: 'error', message: `Error processing file: ${error.message}` };
    } finally {
      this._processing = false;
    }
  }

  async createPages() {
    if (!this._pages || this._pages.length === 0) {
      this._status = { type: 'error', message: 'No pages to create. Please process a DOCX file first.' };
      return;
    }

    this._processing = true;
    this._status = { type: 'info', message: `Creating ${this._pages.length} page(s)...` };

    try {
      const { context } = await DA_SDK;
      const { org, repo } = context;
      
      const basePath = this._basePath || '/content';
      const createdPages = [];

      for (const page of this._pages) {
        const pagePath = `${basePath}/${page.path}`;
        const html = this.generateAEMHTML(page);
        
        // Create page using DA API
        // Path format: /{org}/{repo}/path/to/page.html
        const fullPath = `/${org}/${repo}${pagePath}.html`;
        const url = getDASourceURL(fullPath);
        
        // Use FormData like other tools do
        const body = new FormData();
        const data = new Blob([html], { type: 'text/html' });
        body.append('data', data);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
          body: body,
        });

        if (response.ok) {
          createdPages.push(pagePath);
        } else {
          const errorText = await response.text();
          throw new Error(`Failed to create ${pagePath}: ${errorText}`);
        }
      }

      this._status = { 
        type: 'success', 
        message: `Successfully created ${createdPages.length} page(s): ${createdPages.join(', ')}` 
      };
      
      // Clear pages after successful creation
      this._pages = [];
    } catch (error) {
      this._status = { type: 'error', message: `Error creating pages: ${error.message}` };
    } finally {
      this._processing = false;
    }
  }

  render() {
    return html`
      <div class="container">
        <h1>DOCX to Pages</h1>
        <p class="description">Upload a DOCX file to create multiple pages. Use H1 headings to separate pages.</p>

        <div class="path-section">
          <label for="base-path-input" class="path-label">
            Base Path:
          </label>
          <input 
            type="text" 
            id="base-path-input"
            class="path-input"
            .value=${this._basePath}
            @input=${(e) => {
              this._basePath = e.target.value || '/content';
            }}
            placeholder="/content"
            ?disabled=${this._processing}
          />
          <p class="path-hint">Pages will be created under this path (e.g., /content/page-name)</p>
        </div>

        <div class="upload-section">
          <label class="file-label">
            <input 
              type="file" 
              id="file-input" 
              accept=".docx"
              @change=${(e) => {
                e.stopPropagation();
                this.handleFileSelect(e);
              }}
              ?disabled=${this._processing}
            />
            <span>${this._file ? html`Selected: ${this._file.name}` : html`Choose DOCX file`}</span>
          </label>
          
          <button 
            class="btn-primary"
            @click=${this.processDocx}
            ?disabled=${!this._file || this._processing}
          >
            Process File
          </button>
        </div>

        ${this._pages && this._pages.length > 0 ? html`
          <div class="pages-preview">
            <h2>Pages Found (${this._pages.length})</h2>
            <ul class="pages-list">
              ${this._pages.map((page, index) => html`
                <li>
                  <strong>${page.title}</strong>
                  <span class="path">${this._basePath || '/content'}/${page.path}</span>
                </li>
              `)}
            </ul>
            
            <button 
              class="btn-gradient"
              @click=${this.createPages}
              ?disabled=${this._processing}
            >
              Create ${this._pages.length} Page(s)
            </button>
          </div>
        ` : nothing}

        ${this._status ? html`
          <div class="status status-${this._status.type}">
            ${this._status.message}
          </div>
        ` : nothing}

        ${this._processing ? html`
          <div class="status-container">
            <sl-spinner></sl-spinner>
            <p class="status">Processing...</p>
          </div>
        ` : nothing}
      </div>
    `;
  }
}

customElements.define('adl-docx-to-pages', ADLDocxToPages);

// Initialize DA SDK and render component
(async () => {
  const { context, token } = await DA_SDK;
  const { org, repo, path } = context;
  
  const app = document.createElement('adl-docx-to-pages');
  app.path = path || '/content';
  app.token = token;
  app._basePath = path || '/content';
  
  document.body.appendChild(app);
})();


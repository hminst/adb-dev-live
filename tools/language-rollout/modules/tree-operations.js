/**
 * Tree Operations Module
 * Handles tree crawling, preview, and structure building
 */

import { crawl } from 'https://da.live/nx/public/utils/tree.js';
import { getOpts } from '/tools/shared/publish-utils.js';
import { getDASourceURL } from '/tools/shared/api-config.js';
import { checkPageExists } from './page-operations.js';

// Language codes for filtering
const LANGUAGE_CODES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ja', 'zh', 'ko', 'ar', 'ru', 'pl', 'sv', 'da', 'no', 'fi'];

/**
 * Check if a path is a language-specific path (e.g., /de/, /fr/)
 * @param {string} path - Path to check
 * @returns {boolean} True if path is language-specific
 */
export function isLanguagePath(path) {
  const parts = path.split('/').filter(p => p);
  return parts.length > 0 && LANGUAGE_CODES.includes(parts[0].toLowerCase());
}

/**
 * Build tree structure with language-rollout specific metadata
 * @param {Array} files - Array of file objects with path, exists, and existsByLanguage properties
 * @param {string} basePath - Base path
 * @param {string} sourcePath - Source path
 * @param {string} targetLanguage - Target language code (for preview display)
 * @param {Array<string>} allLanguages - All selected languages for rollout
 * @returns {Object} Tree structure
 */
export function buildTreeStructure(files, basePath, sourcePath, targetLanguage, allLanguages = []) {
  const tree = {};
  // Normalize allLanguages - if empty array, use targetLanguage as single language
  const languages = allLanguages.length > 0 ? allLanguages : [targetLanguage];
  
  files.forEach((item) => {
    const relativePath = item.path.replace(basePath + sourcePath, '');
    const parts = relativePath.split('/').filter(p => p);
    const targetPath = `/${targetLanguage}${sourcePath}${relativePath}`;
    const fullSourcePath = `${sourcePath}${relativePath}`;
    
    let current = tree;
    parts.forEach((part, index) => {
      if (!current[part]) {
        if (index === parts.length - 1) {
          // File node
          current[part] = {
            __file: true,
            path: item.path,
            sourcePath: fullSourcePath,
            targetPath,
            exists: item.exists || false,
            existsByLanguage: item.existsByLanguage || {},
            allLanguages: languages,
          };
        } else {
          // Folder node
          current[part] = {
            allLanguages: languages,
          };
        }
      }
      current = current[part];
    });
  });
  
  return tree;
}

/**
 * Render tree node with language-rollout specific formatting
 * @param {Object} node - Tree node
 * @param {string} name - Node name
 * @param {number} level - Nesting level
 * @param {string} basePath - Base path
 * @param {string} parentPath - Parent path
 * @returns {string} HTML string
 */
export function renderTreeNode(node, name, level, basePath, parentPath = '') {
  const allLanguages = node.allLanguages || [];
  const existsByLanguage = node.existsByLanguage || {};
  const indent = '  '.repeat(level);
  const isFile = node.__file;
  const currentPath = parentPath ? `${parentPath}/${name}` : name;
  
  if (isFile) {
    const existsClass = node.exists ? ' exists' : '';
    
    // Build existence indicators for all languages
    const existenceIndicators = allLanguages.map(lang => {
      const exists = existsByLanguage[lang] || false;
      if (exists) {
        return `<span class="exists-badge exists-badge-${lang}" title="Page already exists for ${lang.toUpperCase()} - will be overwritten">⚠️ ${lang.toUpperCase()}</span>`;
      }
      return '';
    }).filter(Boolean).join(' ');
    
    const existsIndicator = existenceIndicators || '';
    
    // Show target paths for all languages
    const targetPaths = allLanguages.map(lang => {
      const targetPath = `/${lang}${node.sourcePath}`;
      const exists = existsByLanguage[lang] || false;
      const existsClass = exists ? ' exists' : '';
      return `<div class="tree-target${existsClass}">
        <span class="tree-arrow">→</span>
        <span class="tree-target-path">${targetPath}</span>
        ${exists ? '<span class="exists-badge-small">⚠️</span>' : ''}
      </div>`;
    }).join('');
    
    return `
      <div class="tree-node tree-file-item${existsClass}" data-level="${level}" data-path="${currentPath}">
        <div class="tree-node-content">
          <span class="tree-connector">${indent}</span>
          <input type="checkbox" 
                 class="file-checkbox" 
                 data-path="${currentPath}"
                 data-source="${node.sourcePath}" 
                 data-target="${node.targetPath}" 
                 data-exists="${node.exists}"
                 id="file-${currentPath.replace(/\//g, '-')}"
                 checked>
          <label for="file-${currentPath.replace(/\//g, '-')}" class="tree-name">📄 ${name}</label>
          ${existsIndicator}
        </div>
        ${targetPaths}
      </div>
    `;
  } else {
    let html = `
      <div class="tree-node tree-folder-item" data-level="${level}" data-path="${currentPath}">
        <div class="tree-node-content">
          <span class="tree-connector">${indent}</span>
          <input type="checkbox" 
                 class="folder-checkbox" 
                 data-path="${currentPath}" 
                 id="folder-${currentPath.replace(/\//g, '-')}"
                 checked>
          <label for="folder-${currentPath.replace(/\//g, '-')}" class="tree-name">📁 ${name}</label>
        </div>
      </div>
    `;
    
    const children = Object.keys(node).filter(k => k !== '__file' && k !== 'allLanguages' && k !== 'existsByLanguage').sort();
    children.forEach(childName => {
      const childNode = node[childName];
      // Ensure child nodes inherit allLanguages if not set
      if (!childNode.allLanguages && allLanguages.length > 0) {
        childNode.allLanguages = allLanguages;
      }
      html += renderTreeNode(childNode, childName, level + 1, basePath, currentPath);
    });
    
    return html;
  }
}

/**
 * Preview page tree - scan directory and show tree structure
 * @param {string} basePath - Base path (org/repo)
 * @param {string} sourcePath - Source path to scan
 * @param {string|Array<string>} targetLanguages - Target language code(s) - can be single string or array
 * @param {string} token - Authentication token
 * @param {Function} updateProgress - Progress update function
 * @param {Function} setupCheckboxListeners - Function to setup checkbox listeners
 * @param {Function} updateSelectionCount - Function to update selection count display
 * @returns {Promise<void>}
 */
export async function previewPageTree(basePath, sourcePath, targetLanguages, token, updateProgress, setupCheckboxListeners, updateSelectionCount) {
  // Normalize to array
  const languages = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
  const previewLanguage = languages[0]; // Use first language for preview target path display
  const treePreview = document.getElementById('tree-preview');
  const treePreviewList = document.getElementById('tree-preview-list');
  const treePreviewLoading = document.getElementById('tree-preview-loading');
  
  if (!treePreview || !treePreviewList) return;
  
  // Show loading state
  treePreview.style.display = 'block';
  treePreviewLoading.style.display = 'flex';
  treePreviewList.innerHTML = '';
  
  const fullSourcePath = `${basePath}${sourcePath}`;
  
  try {
    // Collect all HTML files, excluding language-specific directories
    const htmlFiles = [];
    const callback = async (item) => {
      if (item.ext !== 'html') return null;
      
      // Skip files that are in language directories
      const relativePath = item.path.replace(basePath, '');
      if (isLanguagePath(relativePath)) {
        console.log(`Skipping language-specific page: ${relativePath}`);
        return null;
      }
      
      htmlFiles.push(item);
      return item;
    };
    
    const { results } = await crawl({ path: fullSourcePath, callback, throttle: 10 });
    await results;
    
    if (htmlFiles.length === 0) {
      treePreviewLoading.style.display = 'none';
      treePreviewList.innerHTML = '<div class="preview-empty">No HTML pages found in this directory.</div>';
      return;
    }
    
    // Check if target pages exist for all selected languages
    if (updateProgress) updateProgress(`Checking existing pages for ${languages.length} language(s)...`);
    const existenceChecks = htmlFiles.map(async (item) => {
      const relativePath = item.path.replace(basePath + sourcePath, '');
      const existsByLanguage = {};
      
      // Check existence for each language
      for (const lang of languages) {
        const targetPath = `${basePath}/${lang}${sourcePath}${relativePath}`;
        existsByLanguage[lang] = await checkPageExists(targetPath, token);
      }
      
      return { ...item, exists: existsByLanguage[previewLanguage], existsByLanguage };
    });
    
    const htmlFilesWithExistence = await Promise.all(existenceChecks);
    
    // Hide loading
    treePreviewLoading.style.display = 'none';
    
    // Count existing vs new pages (for preview language)
    const existingCount = htmlFilesWithExistence.filter(f => f.exists).length;
    const newCount = htmlFilesWithExistence.length - existingCount;
    
    // Count existing pages per language
    const existingByLanguage = {};
    languages.forEach(lang => {
      existingByLanguage[lang] = htmlFilesWithExistence.filter(f => f.existsByLanguage?.[lang]).length;
    });
    
    const totalExisting = Object.values(existingByLanguage).reduce((sum, count) => sum + count, 0);
    const existingSummary = languages.map(lang => {
      const count = existingByLanguage[lang] || 0;
      return count > 0 ? `${count} in ${lang.toUpperCase()}` : null;
    }).filter(Boolean).join(', ');
    
    // Build tree structure with multi-language existence info
    const tree = buildTreeStructure(htmlFilesWithExistence, basePath, sourcePath, previewLanguage, languages);
    
    // Render tree
    let treeHTML = '';
    const rootKeys = Object.keys(tree).sort();
    rootKeys.forEach((key) => {
      treeHTML += renderTreeNode(tree[key], key, 0, basePath + sourcePath, '');
    });
    
    const existsWarning = totalExisting > 0 ? `
      <div class="preview-warning">
        ⚠️ ${totalExisting} page${totalExisting !== 1 ? 's' : ''} already exist${totalExisting === 1 ? 's' : ''} (${existingSummary}) and will be overwritten
      </div>
    ` : '';
    
    // Build stats summary for all languages
    const statsByLanguage = languages.map(lang => {
      const langNew = htmlFilesWithExistence.length - (existingByLanguage[lang] || 0);
      const langExisting = existingByLanguage[lang] || 0;
      return `${lang.toUpperCase()}: ${langNew} new, ${langExisting} existing`;
    }).join(' | ');
    
    treePreviewList.innerHTML = `
      <div class="preview-count">
        <span class="preview-note">(excluding language-specific pages)</span>
        <span class="preview-stats">${statsByLanguage}</span>
      </div>
      ${existsWarning}
      <div class="tree-view">${treeHTML}</div>
    `;
    
    // Add checkbox event listeners
    if (setupCheckboxListeners) {
      setupCheckboxListeners();
    }
    
    // Show submit button after tree is loaded
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.style.display = 'block';
    }
    
    // Show selection summary
    const selectionSummary = document.getElementById('selection-summary');
    if (selectionSummary) {
      selectionSummary.style.display = 'block';
      if (updateSelectionCount) {
        updateSelectionCount();
      }
    }
  } catch (error) {
    treePreviewLoading.style.display = 'none';
    const errorDiv = document.getElementById('preview-error');
    if (errorDiv) {
      errorDiv.textContent = `Error scanning directory: ${error.message}`;
      errorDiv.style.display = 'block';
    }
    console.error('Error previewing page tree:', error);
  }
}


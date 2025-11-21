import { crawl } from 'https://da.live/nx/public/utils/tree.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// Define available languages for rollout
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'de', name: 'German / Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French / Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish / Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italian / Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese / Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch / Nederlands', flag: '🇳🇱' },
  { code: 'ja', name: 'Japanese / 日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese / 中文', flag: '🇨🇳' },
  { code: 'ko', name: 'Korean / 한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic / العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian / Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polish / Polski', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish / Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Danish / Dansk', flag: '🇩🇰' },
  { code: 'no', name: 'Norwegian / Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Finnish / Suomi', flag: '🇫🇮' },
];

// Add this helper function
function getOpts(token, method = 'GET') {
    return {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

// Check if a page exists
async function checkPageExists(path, token) {
  try {
    const opts = getOpts(token, 'HEAD');
    const resp = await fetch(`https://admin.da.live/source${path}`, opts);
    return resp.ok;
  } catch (error) {
    console.error(`Error checking if page exists: ${path}`, error);
    return false;
  }
}
  
  // Function to copy a page
  async function copyPage(sourcePath, targetPath, token) {
    // 1. Fetch the source document
    const fetchOpts = getOpts(token, 'GET');
    const resp = await fetch(`https://admin.da.live/source${sourcePath}`, fetchOpts);
    
    if (!resp.ok) {
      return { 
        success: false, 
        message: `Could not fetch source: ${sourcePath}`, 
        status: resp.status 
      };
    }
    
    const html = await resp.text();
    
    // 2. Save to target location
    const body = new FormData();
    const data = new Blob([html], { type: 'text/html' });
    body.append('data', data);
    
    const saveOpts = getOpts(token, 'POST');
    saveOpts.body = body;
    
    const saveResp = await fetch(`https://admin.da.live/source${targetPath}`, saveOpts);
    
    if (!saveResp.ok) {
      return { 
        success: false, 
        message: `Could not save to: ${targetPath}`, 
        status: saveResp.status 
      };
    }
    
    return { 
      success: true, 
      message: `Successfully copied ${sourcePath} to ${targetPath}`, 
      status: saveResp.status 
    };
  }
  

// Progress tracking
let progressState = {
  total: 0,
  completed: 0,
  failed: 0,
};

function updateProgress(message) {
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  
  if (progressText) {
    progressText.textContent = message;
  }
  
  if (progressBar && progressState.total > 0) {
    const percentage = (progressState.completed / progressState.total) * 100;
    progressBar.style.width = `${percentage}%`;
  }
}

function showProgress() {
  const progressSection = document.getElementById('progress-section');
  const submitButton = document.querySelector('button[type="submit"]');
  if (progressSection) {
    progressSection.style.display = 'block';
  }
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
  }
}

function hideProgress() {
  const progressSection = document.getElementById('progress-section');
  const submitButton = document.querySelector('button[type="submit"]');
  if (progressSection) {
    progressSection.style.display = 'none';
  }
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = 'Rollout';
  }
  progressState = { total: 0, completed: 0, failed: 0 };
}

// Show results
function showResults(result, type = 'success') {
  const resultsSection = document.getElementById('results-section');
  const resultsContent = document.getElementById('results-content');
  
  if (!resultsSection || !resultsContent) return;
  
  const iconMap = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };
  
  const icon = iconMap[type] || iconMap.info;
  
  let html = `<div class="result-${type}">`;
  html += `<div class="result-header">${icon} ${result.title || 'Rollout Complete'}</div>`;
  
  if (result.summary) {
    html += `<div class="result-summary">${result.summary}</div>`;
  }
  
  if (result.stats) {
    html += '<div class="result-stats">';
    result.stats.forEach(stat => {
      html += `<div class="result-stat"><strong>${stat.label}:</strong> ${stat.value}</div>`;
    });
    html += '</div>';
  }
  
  if (result.details && result.details.length > 0) {
    html += '<details class="result-details">';
    html += '<summary>View Details</summary>';
    html += '<div class="result-details-content">';
    result.details.forEach(detail => {
      const detailIcon = detail.status === 'success' ? '✓' : '✗';
      const detailClass = detail.status === 'success' ? 'detail-success' : 'detail-error';
      html += `<div class="result-detail ${detailClass}"><span class="detail-icon">${detailIcon}</span> ${detail.message}</div>`;
    });
    html += '</div>';
    html += '</details>';
  }
  
  html += '</div>';
  
  resultsContent.innerHTML = html;
  resultsSection.style.display = 'block';
  
  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide results
function hideResults() {
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    resultsSection.style.display = 'none';
  }
}

// Callback for crawling pages
const createCrawlCallback = (basePath, sourcePath, targetLanguage, token) => async (item) => {
  if (item.ext !== 'html') return null;
  
  // Skip files that are in language directories
  const fullRelativePath = item.path.replace(basePath, '');
  if (isLanguagePath(fullRelativePath)) {
    console.log(`Skipping language-specific page during copy: ${fullRelativePath}`);
    return null;
  }
  
  // Calculate relative path from source
  const relativePath = item.path.replace(basePath + sourcePath, '');
  const targetPath = `${basePath}/${targetLanguage}${sourcePath}${relativePath}`;
  
  console.log(`Copying: ${item.path} → ${targetPath}`);
  
  try {
    const result = await copyPage(item.path, targetPath, token);
    
    if (result.success) {
      progressState.completed++;
      updateProgress(`Copied ${progressState.completed}/${progressState.total} pages: ${relativePath || '/'}`);
      return { ...item, status: 'success', targetPath };
    }
    progressState.failed++;
    console.error(`Failed to copy ${item.path}:`, result.message);
    return { ...item, status: 'failed', error: result.message };
  } catch (error) {
    progressState.failed++;
    console.error(`Error copying ${item.path}:`, error);
    return { ...item, status: 'error', error: error.message };
  }
};

// Copy entire page tree
async function copyPageTree(sourcePath, targetLanguage, token, basePath) {
  // Get selected files from checkboxes
  const selectedCheckboxes = Array.from(document.querySelectorAll('.file-checkbox:checked'));
  
  if (selectedCheckboxes.length === 0) {
    return {
      success: false,
      total: 0,
      successful: 0,
      failed: 0,
      details: [],
      message: 'No pages selected',
    };
  }
  
  console.log(`Starting copy of ${selectedCheckboxes.length} selected pages`);
  
  showProgress();
  progressState.total = selectedCheckboxes.length;
  progressState.completed = 0;
  progressState.failed = 0;
  
  const results = [];
  
  try {
    // Copy each selected file
    for (const checkbox of selectedCheckboxes) {
      const sourcePath = checkbox.dataset.source;
      const targetPath = checkbox.dataset.target;
      // Ensure proper path joining with slash
      const fullSourcePath = sourcePath.startsWith('/') ? `${basePath}${sourcePath}` : `${basePath}/${sourcePath}`;
      const fullTargetPath = targetPath.startsWith('/') ? `${basePath}${targetPath}` : `${basePath}/${targetPath}`;
      
      console.log(`Copy paths: ${fullSourcePath} → ${fullTargetPath}`);
      updateProgress(`Copying ${progressState.completed + 1}/${progressState.total}: ${sourcePath}`);
      
      try {
        const result = await copyPage(fullSourcePath, fullTargetPath, token);
        
        if (result.success) {
          progressState.completed++;
          results.push({ 
            path: sourcePath, 
            status: 'success', 
            targetPath: fullTargetPath 
          });
        } else {
          progressState.failed++;
          results.push({ 
            path: sourcePath, 
            status: 'failed', 
            error: result.message 
          });
        }
      } catch (error) {
        progressState.failed++;
        results.push({ 
          path: sourcePath, 
          status: 'error', 
          error: error.message 
        });
      }
    }
    
    hideProgress();
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
    
    return {
      success: failed.length === 0,
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      details: results,
    };
  } catch (error) {
    hideProgress();
    console.error('Error during tree copy:', error);
    throw error;
  }
}

// Populate language dropdown
function populateLanguageDropdown() {
  const select = document.getElementById('rollout-language');
  if (!select) return;
  
  LANGUAGES.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.flag} ${lang.name} (${lang.code})`;
    select.appendChild(option);
  });
}

// Build tree structure from flat file list
function buildTreeStructure(files, basePath, sourcePath, targetLanguage) {
  const tree = {};
  
  files.forEach((item) => {
    const relativePath = item.path.replace(basePath + sourcePath, '');
    const parts = relativePath.split('/').filter(p => p);
    const targetPath = `/${targetLanguage}${sourcePath}${relativePath}`;
    // Store full source path (formSourcePath + relativePath) for copying
    const fullSourcePath = `${sourcePath}${relativePath}`;
    
    let current = tree;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          name: part,
          isFile: index === parts.length - 1,
          children: {},
          sourcePath: fullSourcePath, // Full path from form root
          targetPath,
          exists: item.exists || false,
        };
      }
      current = current[part].children;
    });
  });
  
  return tree;
}

// Render tree node recursively
function renderTreeNode(node, level = 0, isLast = true, prefix = '', parentPath = '') {
  const indent = '  '.repeat(level);
  const connector = level === 0 ? '' : (isLast ? '└─ ' : '├─ ');
  const icon = node.isFile ? '📄' : '📁';
  const existsClass = node.exists ? ' tree-node-exists' : '';
  const existsIndicator = node.exists ? '<span class="exists-badge" title="Page already exists - will be overwritten">⚠️ Exists</span>' : '';
  
  // Generate unique ID for checkbox (works for both files and folders)
  const nodePath = node.isFile ? node.sourcePath : `${parentPath}/${node.name}`.replace(/^\/+/, '');
  const nodeId = `node-${nodePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const checkboxClass = node.isFile ? 'file-checkbox' : 'folder-checkbox';
  
  const checkbox = `
    <input type="checkbox" 
           class="${checkboxClass}" 
           id="${nodeId}" 
           data-path="${nodePath}"
           ${node.isFile ? `data-source="${node.sourcePath}" data-target="${node.targetPath}" data-exists="${node.exists}"` : ''}
           checked>
  `;
  
  let html = `
    <div class="tree-node${existsClass}" data-level="${level}" data-node-path="${nodePath}">
      <div class="tree-node-content">
        ${checkbox}
        <span class="tree-connector">${prefix}${connector}</span>
        <span class="tree-icon">${icon}</span>
        <label class="tree-name" for="${nodeId}">${node.name}</label>
        ${node.isFile ? existsIndicator : ''}
      </div>
      ${node.isFile ? `
        <div class="tree-target">
          <span class="tree-arrow">→</span>
          <span class="tree-target-path">${node.targetPath}</span>
        </div>
      ` : ''}
    </div>
  `;
  
  // Render children
  const childKeys = Object.keys(node.children);
  childKeys.forEach((key, index) => {
    const isChildLast = index === childKeys.length - 1;
    const childPrefix = prefix + (level === 0 ? '' : (isLast ? '   ' : '│  '));
    html += renderTreeNode(node.children[key], level + 1, isChildLast, childPrefix, nodePath);
  });
  
  return html;
}

// Check if a path contains a language directory
function isLanguagePath(path) {
  const languageCodes = LANGUAGES.map(lang => lang.code);
  const pathParts = path.split('/').filter(p => p);
  
  // Check if any part of the path matches a language code
  return pathParts.some(part => languageCodes.includes(part));
}

// Preview pages in tree
async function previewPageTree(sourcePath, targetLanguage, basePath, token) {
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
    
    // Check if target pages exist
    updateProgress('Checking existing pages...');
    const existenceChecks = htmlFiles.map(async (item) => {
      const relativePath = item.path.replace(basePath + sourcePath, '');
      const targetPath = `${basePath}/${targetLanguage}${sourcePath}${relativePath}`;
      const exists = await checkPageExists(targetPath, token);
      return { ...item, exists };
    });
    
    const htmlFilesWithExistence = await Promise.all(existenceChecks);
    
    // Hide loading
    treePreviewLoading.style.display = 'none';
    
    // Count existing vs new pages
    const existingCount = htmlFilesWithExistence.filter(f => f.exists).length;
    const newCount = htmlFilesWithExistence.length - existingCount;
    
    // Build tree structure
    const tree = buildTreeStructure(htmlFilesWithExistence, basePath, sourcePath, targetLanguage);
    
    // Render tree
    let treeHTML = '';
    const rootKeys = Object.keys(tree);
    rootKeys.forEach((key, index) => {
      const isLast = index === rootKeys.length - 1;
      treeHTML += renderTreeNode(tree[key], 0, isLast);
    });
    
    const existsWarning = existingCount > 0 ? `
      <div class="preview-warning">
        ⚠️ ${existingCount} page${existingCount !== 1 ? 's' : ''} already exist${existingCount === 1 ? 's' : ''} and will be overwritten
      </div>
    ` : '';
    
    treePreviewList.innerHTML = `
      <div class="preview-count">
        <span id="selection-count">
          <strong>${htmlFilesWithExistence.length}</strong> of ${htmlFilesWithExistence.length} page${htmlFilesWithExistence.length !== 1 ? 's' : ''} selected
        </span>
        <span class="preview-note">(excluding language-specific pages)</span>
        <span class="preview-stats">${newCount} new, ${existingCount} existing</span>
      </div>
      ${existsWarning}
      <div class="tree-view">${treeHTML}</div>
    `;
    
    // Add checkbox event listeners
    setupCheckboxListeners();
  } catch (error) {
    treePreviewLoading.style.display = 'none';
    treePreviewList.innerHTML = `<div class="preview-error">❌ Error scanning directory: ${error.message}</div>`;
    console.error('Error previewing tree:', error);
  }
}

// Get all child checkboxes for a given node path
function getChildCheckboxes(nodePath) {
  const allNodes = document.querySelectorAll('.tree-node');
  const children = [];
  
  Array.from(allNodes).forEach(node => {
    const nodePathAttr = node.getAttribute('data-node-path');
    if (nodePathAttr && nodePathAttr.startsWith(nodePath + '/')) {
      const checkbox = node.querySelector('.file-checkbox, .folder-checkbox');
      if (checkbox) {
        children.push(checkbox);
      }
    }
  });
  
  return children;
}

// Get parent folder checkbox for a given node path
function getParentCheckbox(nodePath) {
  const pathParts = nodePath.split('/').filter(p => p);
  if (pathParts.length <= 1) return null;
  
  pathParts.pop(); // Remove last part
  const parentPath = pathParts.join('/');
  
  const parentNode = document.querySelector(`.tree-node[data-node-path="${parentPath}"]`);
  return parentNode ? parentNode.querySelector('.folder-checkbox') : null;
}

// Update parent checkbox state based on children
function updateParentCheckbox(checkbox) {
  const nodePath = checkbox.getAttribute('data-path');
  const parentCheckbox = getParentCheckbox(nodePath);
  
  if (!parentCheckbox) return;
  
  const parentPath = parentCheckbox.getAttribute('data-path');
  const siblings = getChildCheckboxes(parentPath);
  
  if (siblings.length === 0) return;
  
  const checkedCount = siblings.filter(cb => cb.checked).length;
  
  if (checkedCount === 0) {
    parentCheckbox.checked = false;
    parentCheckbox.indeterminate = false;
  } else if (checkedCount === siblings.length) {
    parentCheckbox.checked = true;
    parentCheckbox.indeterminate = false;
  } else {
    parentCheckbox.checked = false;
    parentCheckbox.indeterminate = true;
  }
  
  // Recursively update parent's parent
  updateParentCheckbox(parentCheckbox);
}

// Handle folder checkbox change
function handleFolderCheckboxChange(checkbox) {
  const nodePath = checkbox.getAttribute('data-path');
  const isChecked = checkbox.checked;
  
  // Update all child checkboxes
  const children = getChildCheckboxes(nodePath);
  children.forEach(child => {
    child.checked = isChecked;
    child.indeterminate = false;
  });
  
  // Update parent state
  updateParentCheckbox(checkbox);
  
  // Update count
  updateSelectionCount();
}

// Handle file checkbox change
function handleFileCheckboxChange(checkbox) {
  // Update parent state
  updateParentCheckbox(checkbox);
  
  // Update count
  updateSelectionCount();
}

// Update selection count
function updateSelectionCount() {
  const fileCheckboxes = document.querySelectorAll('.file-checkbox');
  const checked = Array.from(fileCheckboxes).filter(cb => cb.checked);
  const total = fileCheckboxes.length;
  
  const countEl = document.getElementById('selection-count');
  if (countEl) {
    countEl.innerHTML = `<strong>${checked.length}</strong> of ${total} page${total !== 1 ? 's' : ''} selected`;
  }
}

// Setup checkbox listeners
function setupCheckboxListeners() {
  // File checkboxes
  const fileCheckboxes = document.querySelectorAll('.file-checkbox');
  fileCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => handleFileCheckboxChange(checkbox));
  });
  
  // Folder checkboxes
  const folderCheckboxes = document.querySelectorAll('.folder-checkbox');
  folderCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => handleFolderCheckboxChange(checkbox));
  });
}

// Update destination preview
function updateDestinationPreview(basePath, token) {
  const sourceInput = document.getElementById('rollout-source');
  const languageSelect = document.getElementById('rollout-language');
  const treeCheckbox = document.getElementById('rollout-tree');
  const destinationPreview = document.getElementById('destination-preview');
  const destinationPath = document.getElementById('destination-path');
  const treePreview = document.getElementById('tree-preview');
  
  const source = sourceInput?.value || '';
  const language = languageSelect?.value || '';
  const isTree = treeCheckbox?.checked || false;
  
  if (source && language) {
    const fullDestination = `${basePath}/${language}${source}`;
    const treeIndicator = isTree ? ' (+ all child pages)' : '';
    destinationPath.textContent = fullDestination + treeIndicator;
    destinationPreview.style.display = 'block';
    
    // Show tree preview if tree mode is enabled
    if (isTree) {
      previewPageTree(source, language, basePath, token);
    } else {
      if (treePreview) treePreview.style.display = 'none';
    }
  } else {
    destinationPreview.style.display = 'none';
    if (treePreview) treePreview.style.display = 'none';
  }
}

// Handle form submission
function handleRollout(event, token, basePath) {
  event.preventDefault();
  
  const form = event.target;
  const sourcePath = form['rollout-source'].value;
  const targetLanguage = form['rollout-language'].value;
  const copyTree = form['rollout-tree'].checked;
  
  if (!sourcePath || !targetLanguage) {
    alert('Please fill in all fields');
    return;
  }
  
  console.log('Rollout initiated:');
  console.log('  Source:', sourcePath);
  console.log('  Language:', targetLanguage);
  console.log('  Copy Tree:', copyTree);
  
  if (copyTree) {
    // Copy entire page tree (only selected files)
    hideResults(); // Clear previous results
    
    copyPageTree(sourcePath, targetLanguage, token, basePath)
      .then((result) => {
        if (result.total === 0) {
          showResults({
            title: 'No Pages Selected',
            summary: 'Please select at least one page to rollout.',
          }, 'warning');
          return;
        }
        
        const type = result.success ? 'success' : 'warning';
        const details = result.details
          .filter(d => d.status !== 'success' || result.failed > 0) // Show all if there are failures, otherwise hide success details
          .map(d => ({
            status: d.status,
            message: `${d.path} ${d.status === 'success' ? '→ ' + d.targetPath : '- ' + (d.error || 'Failed')}`,
          }));
        
        showResults({
          title: result.success ? 'Rollout Successful' : 'Rollout Completed with Errors',
          summary: result.success 
            ? `Successfully copied ${result.successful} page${result.successful !== 1 ? 's' : ''} to ${targetLanguage.toUpperCase()}.`
            : `Copied ${result.successful} page${result.successful !== 1 ? 's' : ''}, but ${result.failed} failed.`,
          stats: [
            { label: 'Total', value: result.total },
            { label: 'Successful', value: result.successful },
            { label: 'Failed', value: result.failed },
          ],
          details: result.failed > 0 ? details : [],
        }, type);
        
        console.log('Tree rollout completed:', result);
        
        if (result.success) {
          // Reset form on complete success
          setTimeout(() => {
            form.reset();
            document.getElementById('destination-preview').style.display = 'none';
            document.getElementById('tree-preview').style.display = 'none';
          }, 500);
        }
      })
      .catch((error) => {
        showResults({
          title: 'Rollout Error',
          summary: error.message,
        }, 'error');
        console.error('Tree rollout error:', error);
        hideProgress();
      });
  } else {
    // Copy single page
    hideResults(); // Clear previous results
    
    const fullSourcePath = `${basePath}${sourcePath}`;
    const fullDestinationPath = `${basePath}/${targetLanguage}${sourcePath}`;
    
    console.log('  Full Source Path:', fullSourcePath);
    console.log('  Full Destination Path:', fullDestinationPath);
    
    copyPage(fullSourcePath, fullDestinationPath, token)
      .then((result) => {
        if (result.success) {
          showResults({
            title: 'Page Copied Successfully',
            summary: `Successfully copied page to ${targetLanguage.toUpperCase()}.`,
            stats: [
              { label: 'Source', value: sourcePath },
              { label: 'Target', value: `/${targetLanguage}${sourcePath}` },
            ],
          }, 'success');
          
          console.log('Rollout successful:', result);
          
          // Reset form
          setTimeout(() => {
            form.reset();
            document.getElementById('destination-preview').style.display = 'none';
          }, 500);
        } else {
          showResults({
            title: 'Copy Failed',
            summary: result.message,
            stats: [
              { label: 'Status', value: result.status || 'Error' },
            ],
          }, 'error');
          
          console.error('Rollout failed:', result);
        }
      })
      .catch((error) => {
        showResults({
          title: 'Rollout Error',
          summary: error.message,
        }, 'error');
        
        console.error('Rollout error:', error);
      });
  }
}

  (async function init() {
    const { context, token } = await DA_SDK;
    const { org, repo, path } = context;
  
    const cmp = document.createElement('language-rollout');
    cmp.path = `/${org}/${repo}`;
    cmp.token = token;

    console.log('Current path:', path);
    console.log('Base path:', cmp.path);
    
    // Populate the language dropdown
    populateLanguageDropdown();
    
    // Setup form submission handler
    const form = document.getElementById('rollout-form');
    if (form) {
      form.addEventListener('submit', (event) => handleRollout(event, token, cmp.path));
    }
    
    // Setup live preview for destination path
    const sourceInput = document.getElementById('rollout-source');
    const languageSelect = document.getElementById('rollout-language');
    const treeCheckbox = document.getElementById('rollout-tree');
    const refreshPreviewBtn = document.getElementById('refresh-preview');
    
    if (sourceInput && languageSelect) {
      sourceInput.addEventListener('input', () => updateDestinationPreview(cmp.path, token));
      languageSelect.addEventListener('change', () => updateDestinationPreview(cmp.path, token));
    }
    
    if (treeCheckbox) {
      treeCheckbox.addEventListener('change', () => updateDestinationPreview(cmp.path, token));
    }
    
    if (refreshPreviewBtn) {
      refreshPreviewBtn.addEventListener('click', () => {
        const source = sourceInput?.value || '';
        const language = languageSelect?.value || '';
        if (source && language && treeCheckbox?.checked) {
          previewPageTree(source, language, cmp.path, token);
        }
      });
    }
    
    // Setup select all/deselect all buttons
    const selectAllBtn = document.getElementById('select-all');
    const deselectAllBtn = document.getElementById('deselect-all');
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const allCheckboxes = document.querySelectorAll('.file-checkbox, .folder-checkbox');
        allCheckboxes.forEach(cb => { 
          cb.checked = true;
          cb.indeterminate = false;
        });
        updateSelectionCount();
      });
    }
    
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        const allCheckboxes = document.querySelectorAll('.file-checkbox, .folder-checkbox');
        allCheckboxes.forEach(cb => { 
          cb.checked = false;
          cb.indeterminate = false;
        });
        updateSelectionCount();
      });
    }

    document.body.append(cmp);
  }());
  
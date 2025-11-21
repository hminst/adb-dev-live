import { crawl } from 'https://da.live/nx/public/utils/tree.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { getOpts, pushPage } from '/tools/shared/publish-utils.js';

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
  pushedPreview: 0,
  pushedLive: 0,
  pushFailedPreview: 0,
  pushFailedLive: 0,
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
  progressState = { total: 0, completed: 0, failed: 0, pushedPreview: 0, pushedLive: 0, pushFailedPreview: 0, pushFailedLive: 0 };
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
async function copyPageTree(sourcePath, targetLanguage, token, basePath, pushOptions = {}) {
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
  
  const { preview = false, live = false } = pushOptions;
  const shouldPush = preview || live;
  
  console.log(`Starting copy of ${selectedCheckboxes.length} selected pages`);
  if (shouldPush) {
    console.log(`Will push to: ${preview ? 'preview' : ''}${preview && live ? ', ' : ''}${live ? 'live' : ''}`);
  }
  
  showProgress();
  progressState.total = selectedCheckboxes.length;
  progressState.completed = 0;
  progressState.failed = 0;
  progressState.pushedPreview = 0;
  progressState.pushedLive = 0;
  progressState.pushFailedPreview = 0;
  progressState.pushFailedLive = 0;
  
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
          const resultItem = { 
            path: sourcePath, 
            status: 'success', 
            targetPath: fullTargetPath,
            pushResults: null
          };
          
          // Push to preview/live if requested
          if (shouldPush) {
            updateProgress(`Pushing ${progressState.completed}/${progressState.total}: ${targetPath}`);
            const pushResults = await pushPage(fullTargetPath, token, { preview, live });
            resultItem.pushResults = pushResults;
            
            console.log('Push results:', pushResults);
            console.log('Preview requested:', preview, 'Live requested:', live);
            
            // Track push results
            let pushSuccess = true;
            if (preview && pushResults.preview) {
              console.log('Preview result:', pushResults.preview);
              if (pushResults.preview.success) {
                progressState.pushedPreview++;
                console.log('Preview push succeeded, count:', progressState.pushedPreview);
              } else {
                progressState.pushFailedPreview++;
                pushSuccess = false;
              }
            }
            if (live && pushResults.live) {
              console.log('Live result:', pushResults.live);
              if (pushResults.live.success) {
                progressState.pushedLive++;
                console.log('Live push succeeded, count:', progressState.pushedLive);
              } else {
                progressState.pushFailedLive++;
                pushSuccess = false;
              }
            }
            
            if (!pushSuccess) {
              resultItem.status = 'success-push-failed';
            }
          }
          
          results.push(resultItem);
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
    
    // Capture push counts before hiding progress (which resets progressState)
    const pushedPreviewCount = progressState.pushedPreview;
    const pushedLiveCount = progressState.pushedLive;
    const pushFailedPreviewCount = progressState.pushFailedPreview;
    const pushFailedLiveCount = progressState.pushFailedLive;
    
    hideProgress();
    
    const successful = results.filter(r => r.status === 'success' || r.status === 'success-push-failed');
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
    const pushFailed = results.filter(r => r.status === 'success-push-failed');
    
    console.log('Final pushed preview:', pushedPreviewCount);
    console.log('Final pushed live:', pushedLiveCount);
    console.log('Final push failed preview:', pushFailedPreviewCount);
    console.log('Final push failed live:', pushFailedLiveCount);
    
    return {
      success: failed.length === 0,
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      pushedPreview: pushedPreviewCount,
      pushedLive: pushedLiveCount,
      pushFailedPreview: pushFailedPreviewCount,
      pushFailedLive: pushFailedLiveCount,
      details: results,
      hadPushOption: shouldPush,
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
          };
        } else {
          // Folder node
          current[part] = {};
        }
      }
      current = current[part];
    });
  });
  
  return tree;
}

// Render tree node recursively
function renderTreeNode(node, name, level, basePath, parentPath = '') {
  const indent = '  '.repeat(level);
  const isFile = node.__file;
  const currentPath = parentPath ? `${parentPath}/${name}` : name;
  
  if (isFile) {
    const existsClass = node.exists ? ' exists' : '';
    const existsIndicator = node.exists ? '<span class="exists-badge" title="Page already exists - will be overwritten">⚠️ Exists</span>' : '';
    
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
        <div class="tree-target">
          <span class="tree-arrow">→</span>
          <span class="tree-target-path">${node.targetPath}</span>
        </div>
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
    
    const children = Object.keys(node).filter(k => k !== '__file').sort();
    children.forEach(childName => {
      const childNode = node[childName];
      html += renderTreeNode(childNode, childName, level + 1, basePath, currentPath);
    });
    
    return html;
  }
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
    const rootKeys = Object.keys(tree).sort();
    rootKeys.forEach((key) => {
      treeHTML += renderTreeNode(tree[key], key, 0, basePath + sourcePath, '');
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
  const node = document.querySelector(`.tree-node[data-path="${nodePath}"]`);
  if (!node) return [];
  
  const children = [];
  let currentNode = node.nextElementSibling;
  const nodeLevel = parseInt(node.dataset.level, 10);
  
  while (currentNode && currentNode.classList.contains('tree-node')) {
    const currentLevel = parseInt(currentNode.dataset.level, 10);
    if (currentLevel <= nodeLevel) break;
    
    const checkbox = currentNode.querySelector('.file-checkbox, .folder-checkbox');
    if (checkbox) children.push(checkbox);
    
    currentNode = currentNode.nextElementSibling;
  }
  
  return children;
}

// Get parent folder checkbox for a given node path
function getParentCheckbox(nodePath) {
  const parts = nodePath.split('/').filter(p => p);
  if (parts.length <= 1) return null;
  
  const parentPath = parts.slice(0, -1).join('/');
  return document.querySelector(`.folder-checkbox[data-path="${parentPath}"]`);
}

// Update parent checkbox state based on children
function updateParentCheckbox(checkbox) {
  const nodePath = checkbox.dataset.path;
  const parentCheckbox = getParentCheckbox(nodePath);
  
  if (!parentCheckbox) return;
  
  const siblings = getChildCheckboxes(parentCheckbox.dataset.path);
  const checkedSiblings = siblings.filter(cb => cb.checked);
  
  if (checkedSiblings.length === 0) {
    parentCheckbox.checked = false;
    parentCheckbox.indeterminate = false;
  } else if (checkedSiblings.length === siblings.length) {
    parentCheckbox.checked = true;
    parentCheckbox.indeterminate = false;
  } else {
    parentCheckbox.checked = false;
    parentCheckbox.indeterminate = true;
  }
  
  updateParentCheckbox(parentCheckbox);
}

// Handle folder checkbox change
function handleFolderCheckboxChange(checkbox) {
  const isChecked = checkbox.checked;
  const nodePath = checkbox.dataset.path;
  const children = getChildCheckboxes(nodePath);
  
  children.forEach(child => {
    child.checked = isChecked;
    child.indeterminate = false;
  });
  
  updateParentCheckbox(checkbox);
  updateSelectionCount();
}

// Handle file checkbox change
function handleFileCheckboxChange(checkbox) {
  updateParentCheckbox(checkbox);
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
  const pushPreview = form['push-preview']?.checked || false;
  const pushLive = form['push-live']?.checked || false;
  
  if (!sourcePath || !targetLanguage) {
    alert('Please fill in all fields');
    return;
  }
  
  console.log('Rollout initiated:');
  console.log('  Source:', sourcePath);
  console.log('  Language:', targetLanguage);
  console.log('  Copy Tree:', copyTree);
  console.log('  Push to Preview:', pushPreview);
  console.log('  Push to Live:', pushLive);
  
  if (copyTree) {
    // Copy entire page tree (only selected files)
    hideResults(); // Clear previous results
    
    copyPageTree(sourcePath, targetLanguage, token, basePath, { preview: pushPreview, live: pushLive })
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
          .filter(d => d.status !== 'success' || result.failed > 0 || (result.pushFailed && result.pushFailed > 0))
          .map(d => {
            let message = `${d.path} ${d.status === 'success' || d.status === 'success-push-failed' ? '→ ' + d.targetPath : '- ' + (d.error || 'Failed')}`;
            
            // Add push details if applicable
            if (d.pushResults) {
              const pushDetails = [];
              if (d.pushResults.preview) {
                pushDetails.push(`preview: ${d.pushResults.preview.success ? '✓' : '✗'}`);
              }
              if (d.pushResults.live) {
                pushDetails.push(`live: ${d.pushResults.live.success ? '✓' : '✗'}`);
              }
              if (pushDetails.length > 0) {
                message += ` (${pushDetails.join(', ')})`;
              }
            }
            
            return {
              status: d.status === 'success-push-failed' ? 'error' : d.status,
              message,
            };
          });
        
        // Build summary message
        let summary = result.success 
          ? `Successfully copied ${result.successful} page${result.successful !== 1 ? 's' : ''} to ${targetLanguage.toUpperCase()}.`
          : `Copied ${result.successful} page${result.successful !== 1 ? 's' : ''}, but ${result.failed} failed.`;
        
        if (result.hadPushOption) {
          const pushedPreviewCount = result.pushedPreview || 0;
          const pushedLiveCount = result.pushedLive || 0;
          const pushFailedPreviewCount = result.pushFailedPreview || 0;
          const pushFailedLiveCount = result.pushFailedLive || 0;
          
          const pushSummary = [];
          if (pushPreview) {
            const previewTotal = result.successful;
            pushSummary.push(`${pushedPreviewCount}/${previewTotal} to preview`);
          }
          if (pushLive) {
            const liveTotal = result.successful;
            pushSummary.push(`${pushedLiveCount}/${liveTotal} to live`);
          }
          
          if (pushSummary.length > 0) {
            summary += ` Pushed ${pushSummary.join(' and ')}.`;
          }
          
          const totalPushFailed = pushFailedPreviewCount + pushFailedLiveCount;
          if (totalPushFailed > 0) {
            summary += ` ${totalPushFailed} push operation${totalPushFailed !== 1 ? 's' : ''} failed.`;
          }
        }
        
        const stats = [
          { label: 'Total Pages', value: result.total },
          { label: 'Copied', value: result.successful },
          { label: 'Failed', value: result.failed },
        ];
        
        if (result.hadPushOption) {
          const pushedPreviewCount = result.pushedPreview || 0;
          const pushedLiveCount = result.pushedLive || 0;
          const pushFailedPreviewCount = result.pushFailedPreview || 0;
          const pushFailedLiveCount = result.pushFailedLive || 0;
          
          if (pushPreview) {
            stats.push({ label: 'Pushed to Preview', value: pushedPreviewCount });
            if (pushFailedPreviewCount > 0) {
              stats.push({ label: 'Preview Push Failed', value: pushFailedPreviewCount });
            }
          }
          if (pushLive) {
            stats.push({ label: 'Pushed to Live', value: pushedLiveCount });
            if (pushFailedLiveCount > 0) {
              stats.push({ label: 'Live Push Failed', value: pushFailedLiveCount });
            }
          }
        }
        
        showResults({
          title: result.success ? 'Rollout Successful' : 'Rollout Completed with Errors',
          summary,
          stats,
          details: result.failed > 0 || result.pushFailed > 0 ? details : [],
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
      .then(async (result) => {
        if (result.success) {
          let pushResults = null;
          let pushSuccess = true;
          
          // Push to preview/live if requested
          if (pushPreview || pushLive) {
            pushResults = await pushPage(fullDestinationPath, token, { preview: pushPreview, live: pushLive });
            
            // Check if any push failed
            if (pushPreview && pushResults.preview && !pushResults.preview.success) {
              pushSuccess = false;
            }
            if (pushLive && pushResults.live && !pushResults.live.success) {
              pushSuccess = false;
            }
          }
          
          const stats = [
            { label: 'Source', value: sourcePath },
            { label: 'Target', value: `/${targetLanguage}${sourcePath}` },
          ];
          
          if (pushResults) {
            if (pushResults.preview) {
              stats.push({ label: 'Preview', value: pushResults.preview.success ? '✓ Pushed' : '✗ Failed' });
            }
            if (pushResults.live) {
              stats.push({ label: 'Live', value: pushResults.live.success ? '✓ Published' : '✗ Failed' });
            }
          }
          
          showResults({
            title: pushSuccess ? 'Page Copied Successfully' : 'Page Copied (Push Failed)',
            summary: pushSuccess 
              ? `Successfully copied page to ${targetLanguage.toUpperCase()}${pushResults ? ' and pushed.' : '.'}` 
              : `Successfully copied page to ${targetLanguage.toUpperCase()}, but push failed.`,
            stats,
          }, pushSuccess ? 'success' : 'warning');
          
          console.log('Rollout successful:', result, pushResults);
          
          // Reset form
          if (pushSuccess) {
            setTimeout(() => {
              form.reset();
              document.getElementById('destination-preview').style.display = 'none';
            }, 500);
          }
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
  
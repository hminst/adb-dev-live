import { crawl } from 'https://da.live/nx/public/utils/tree.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { pushPage, buildTreeStructure, renderTreeNode } from '/tools/shared/publish-utils.js';
import { createProgressManager, createResultsManager } from '/tools/shared/ui-utils.js';

// Initialize progress and results managers
const progressManager = createProgressManager({
  progressSection: () => document.getElementById('progress-section'),
  progressBar: () => document.getElementById('progress-bar'),
  progressText: () => document.getElementById('progress-text'),
  submitButton: () => document.querySelector('button[type="submit"]'),
}, {
  processingText: 'Publishing...',
  defaultButtonText: 'Publish',
});

const resultsManager = createResultsManager({
  resultsSection: () => document.getElementById('results-section'),
  resultsContent: () => document.getElementById('results-content'),
});

// Progress tracking
let progressState = {
  total: 0,
  completed: 0,
  failed: 0,
};

function updateProgress(message) {
  progressManager.setProgressState(progressState);
  progressManager.updateProgress(message);
  progressState = progressManager.getProgressState();
}

function showProgress() {
  progressManager.showProgress();
}

function hideProgress() {
  progressManager.hideProgress();
  progressState = { total: 0, completed: 0, failed: 0 };
  progressManager.resetProgressState(progressState);
}

function showResults(result, type = 'success') {
  resultsManager.showResults(result, type);
}

function hideResults() {
  resultsManager.hideResults();
}

// Scan and preview tree
async function scanTree(basePath, sourcePath, token) {
  console.log('scanTree called with:', { basePath, sourcePath, token: token ? 'present' : 'missing' });
  
  const previewList = document.getElementById('tree-preview-list');
  const previewLoading = document.getElementById('tree-preview-loading');
  const treePreview = document.getElementById('tree-preview');
  const submitButton = document.querySelector('button[type="submit"]');
  
  console.log('Elements found:', { previewList: !!previewList, previewLoading: !!previewLoading, treePreview: !!treePreview, submitButton: !!submitButton });
  
  if (!previewList || !previewLoading || !treePreview) {
    console.error('Missing required elements');
    return;
  }
  
  // Show loading state
  treePreview.style.display = 'block';
  previewLoading.style.display = 'flex';
  previewList.innerHTML = '';
  submitButton.style.display = 'none';
  
  try {
    const fullSourcePath = `${basePath}${sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`}`;
    console.log('Scanning path:', fullSourcePath);
    
    const files = [];
    let itemCount = 0;
    
    const callback = async (item) => {
      itemCount++;
      console.log('Crawl item:', item);
      if (item.path && item.path.endsWith('.html')) {
        console.log('  -> Adding HTML file:', item.path);
        files.push(item);
      } else {
        console.log('  -> Skipping (not HTML):', item.path);
      }
    };
    
    const { results } = await crawl({ path: fullSourcePath, callback, throttle: 10 });
    await results;
    
    console.log(`Scanned ${itemCount} total items`);
    console.log(`Found ${files.length} HTML files`);
    console.log('Files array:', files);
    
    if (files.length === 0) {
      previewList.innerHTML = '<div class="preview-empty">No HTML pages found in this directory.</div>';
      previewLoading.style.display = 'none';
      return;
    }
    
    // Build and render tree structure
    const tree = buildTreeStructure(files, fullSourcePath);
    let html = '';
    
    Object.keys(tree).sort().forEach(rootName => {
      html += renderTreeNode(tree[rootName], rootName, 0, fullSourcePath, '');
    });
    
    previewList.innerHTML = html;
    previewLoading.style.display = 'none';
    submitButton.style.display = 'block';
    
    // Setup checkbox event listeners
    setupCheckboxListeners();
    updateSelectionCount();
    
  } catch (error) {
    console.error('Error scanning tree:', error);
    previewList.innerHTML = `<div class="preview-error">Error: ${error.message}</div>`;
    previewLoading.style.display = 'none';
  }
}

// Get child checkboxes
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

// Get parent checkbox
function getParentCheckbox(nodePath) {
  const parts = nodePath.split('/').filter(p => p);
  if (parts.length <= 1) return null;
  
  const parentPath = parts.slice(0, -1).join('/');
  return document.querySelector(`.folder-checkbox[data-path="${parentPath}"]`);
}

// Update parent checkbox state
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
  const selectedCount = document.querySelectorAll('.file-checkbox:checked').length;
  const summary = document.getElementById('selection-summary');
  const countElement = document.getElementById('selection-count');
  
  if (summary && countElement) {
    countElement.textContent = `${selectedCount} page${selectedCount !== 1 ? 's' : ''} selected`;
    summary.style.display = selectedCount > 0 ? 'block' : 'none';
  }
}

// Setup checkbox event listeners
function setupCheckboxListeners() {
  document.querySelectorAll('.folder-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => handleFolderCheckboxChange(checkbox));
  });
  
  document.querySelectorAll('.file-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => handleFileCheckboxChange(checkbox));
  });
}

// Publish selected pages
async function publishPages(token, options = {}) {
  const { preview = false, live = false } = options;
  const selectedCheckboxes = Array.from(document.querySelectorAll('.file-checkbox:checked'));
  
  if (selectedCheckboxes.length === 0) {
    return {
      success: false,
      total: 0,
      completed: 0,
      failed: 0,
      details: [],
      message: 'No pages selected',
    };
  }
  
  if (!preview && !live) {
    return {
      success: false,
      total: 0,
      completed: 0,
      failed: 0,
      details: [],
      message: 'Please select at least one action (Preview or Live)',
    };
  }
  
  console.log(`Starting publish of ${selectedCheckboxes.length} selected pages`);
  
  showProgress();
  progressState.total = selectedCheckboxes.length;
  progressState.completed = 0;
  progressState.failed = 0;
  
  const results = [];
  
  try {
    for (const checkbox of selectedCheckboxes) {
      const fullPath = checkbox.dataset.path;
      const fileName = fullPath.split('/').pop();
      
      updateProgress(`Processing ${progressState.completed + 1}/${progressState.total}: ${fileName}`);
      
      try {
        const pushResults = await pushPage(fullPath, token, { preview, live });
        
        let success = true;
        const pushDetails = [];
        
        if (preview && pushResults.preview) {
          if (pushResults.preview.success) {
            pushDetails.push('preview: ✓');
          } else {
            pushDetails.push('preview: ✗');
            success = false;
          }
        }
        
        if (live && pushResults.live) {
          if (pushResults.live.success) {
            pushDetails.push('live: ✓');
          } else {
            pushDetails.push('live: ✗');
            success = false;
          }
        }
        
        if (success) {
          progressState.completed++;
          results.push({
            path: fullPath,
            status: 'success',
            details: pushDetails.join(', '),
          });
        } else {
          progressState.failed++;
          results.push({
            path: fullPath,
            status: 'failed',
            details: pushDetails.join(', '),
          });
        }
      } catch (error) {
        progressState.failed++;
        results.push({
          path: fullPath,
          status: 'error',
          error: error.message,
        });
      }
    }
    
    hideProgress();
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
    
    return {
      success: failed.length === 0,
      total: results.length,
      completed: successful.length,
      failed: failed.length,
      details: results,
    };
  } catch (error) {
    hideProgress();
    console.error('Error during publish:', error);
    throw error;
  }
}

// Handle form submission
function handleSubmit(event, token, basePath) {
  event.preventDefault();
  
  const form = event.target;
  const pushPreview = form['push-preview']?.checked || false;
  const pushLive = form['push-live']?.checked || false;
  
  hideResults();
  
  publishPages(token, { preview: pushPreview, live: pushLive })
    .then((result) => {
      if (result.total === 0) {
        showResults({
          title: result.message || 'No Pages Selected',
          summary: 'Please select at least one page and one action.',
        }, 'warning');
        return;
      }
      
      const type = result.success ? 'success' : 'warning';
      const actions = [];
      if (pushPreview) actions.push('preview');
      if (pushLive) actions.push('live');
      
      const details = result.details
        .filter(d => d.status !== 'success' || result.failed > 0)
        .map(d => ({
          status: d.status,
          message: `${d.path} ${d.details ? '(' + d.details + ')' : (d.error ? '- ' + d.error : '')}`,
        }));
      
      showResults({
        title: result.success ? 'Publish Successful' : 'Publish Completed with Errors',
        summary: result.success 
          ? `Successfully pushed ${result.completed} page${result.completed !== 1 ? 's' : ''} to ${actions.join(' and ')}.`
          : `Pushed ${result.completed} page${result.completed !== 1 ? 's' : ''}, but ${result.failed} failed.`,
        stats: [
          { label: 'Total Pages', value: result.total },
          { label: 'Successful', value: result.completed },
          { label: 'Failed', value: result.failed },
        ],
        details: result.failed > 0 ? details : [],
      }, type);
      
      console.log('Publish completed:', result);
    })
    .catch((error) => {
      showResults({
        title: 'Publish Error',
        summary: error.message,
      }, 'error');
      console.error('Publish error:', error);
      hideProgress();
    });
}

// Initialize when SDK is ready
(async function init() {
  console.log('Initializing Tree Publish Tool');
  
  const { context, token } = await DA_SDK;
  const { org, repo, path } = context;
  
  console.log('Tree Publish Tool initialized');
  console.log('Context:', context);
  console.log('Org:', org, 'Repo:', repo, 'Path:', path);
  console.log('Token:', token ? 'present' : 'missing');
  
  const basePath = `/${org}/${repo}`;
  console.log('Base path:', basePath);
  
  // Setup form submission handler
  const form = document.getElementById('publish-form');
  if (form) {
    form.addEventListener('submit', (event) => handleSubmit(event, token, basePath));
  }
  
  // Setup scan button
  const scanButton = document.getElementById('scan-button');
  const sourcePathInput = document.getElementById('source-path');
  
  console.log('Scan button:', scanButton);
  console.log('Source path input:', sourcePathInput);
  
  if (scanButton && sourcePathInput) {
    console.log('Setting up scan button click handler');
    scanButton.addEventListener('click', () => {
      console.log('Scan button clicked');
      const sourcePath = sourcePathInput.value.trim();
      console.log('Source path:', sourcePath);
      if (!sourcePath) {
        alert('Please enter a source path');
        return;
      }
      console.log('Calling scanTree with:', basePath, sourcePath);
      scanTree(basePath, sourcePath, token);
    });
  } else {
    console.error('Could not find scan button or source path input');
  }
  
  // Setup refresh button
  const refreshButton = document.getElementById('refresh-scan');
  if (refreshButton && sourcePathInput) {
    refreshButton.addEventListener('click', () => {
      const sourcePath = sourcePathInput.value.trim();
      if (sourcePath) {
        scanTree(basePath, sourcePath, token);
      }
    });
  }
  
  // Setup select/deselect all buttons
  const selectAllButton = document.getElementById('select-all');
  const deselectAllButton = document.getElementById('deselect-all');
  
  if (selectAllButton) {
    selectAllButton.addEventListener('click', () => {
      document.querySelectorAll('.file-checkbox, .folder-checkbox').forEach(cb => {
        cb.checked = true;
        cb.indeterminate = false;
      });
      updateSelectionCount();
    });
  }
  
  if (deselectAllButton) {
    deselectAllButton.addEventListener('click', () => {
      document.querySelectorAll('.file-checkbox, .folder-checkbox').forEach(cb => {
        cb.checked = false;
        cb.indeterminate = false;
      });
      updateSelectionCount();
    });
  }
})();


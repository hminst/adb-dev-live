import { crawl } from 'https://da.live/nx/public/utils/tree.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { getOpts, pushPage } from '/tools/shared/publish-utils.js';
import { API_BASE_URLS, getDASourceURL } from '/tools/shared/api-config.js';
import { createProgressManager, createResultsManager } from '/tools/shared/ui-utils.js';
import { translateText, translateHTML } from './modules/translation.js';
import { copyPage, checkPageExists } from './modules/page-operations.js';
import { previewPageTree, isLanguagePath, buildTreeStructure, renderTreeNode } from './modules/tree-operations.js';

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

// checkPageExists is now imported from modules/page-operations.js

// Initialize progress and results managers
const progressManager = createProgressManager({
  progressSection: () => document.getElementById('progress-section'),
  progressBar: () => document.getElementById('progress-bar'),
  progressText: () => document.getElementById('progress-text'),
  submitButton: () => document.querySelector('button[type="submit"]'),
}, {
  processingText: 'Processing...',
  defaultButtonText: 'Rollout',
});

// Track current language being processed for progress messages
let currentLanguage = null;

const resultsManager = createResultsManager({
  resultsSection: () => document.getElementById('results-section'),
  resultsContent: () => document.getElementById('results-content'),
});

// Progress tracking - extended state for language-rollout
let progressState = {
  total: 0,
  completed: 0,
  failed: 0,
  pushedPreview: 0,
  pushedLive: 0,
  pushFailedPreview: 0,
  pushFailedLive: 0,
};

// Wrapper functions that use shared managers but maintain extended state
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
  progressState = { total: 0, completed: 0, failed: 0, pushedPreview: 0, pushedLive: 0, pushFailedPreview: 0, pushFailedLive: 0 };
  progressManager.resetProgressState(progressState);
}

function showResults(result, type = 'success') {
  resultsManager.showResults(result, type);
}

function hideResults() {
  resultsManager.hideResults();
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
  
  const { preview = false, live = false, translate = false } = pushOptions;
  const shouldPush = preview || live;
  
  console.log(`Starting copy of ${selectedCheckboxes.length} selected pages`);
  if (translate) {
    console.log(`Will translate content to: ${targetLanguage}`);
  }
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
      // Recalculate target path for current language (don't use stored target which is for preview language)
      // sourcePath is like "/fragments/nav/header.html", sourcePath param is "/fragments"
      // We need: "/{targetLanguage}/fragments/nav/header.html"
      const targetPath = `/${targetLanguage}${sourcePath}`;
      
      // Ensure proper path joining with slash
      const fullSourcePath = sourcePath.startsWith('/') ? `${basePath}${sourcePath}` : `${basePath}/${sourcePath}`;
      const fullTargetPath = targetPath.startsWith('/') ? `${basePath}${targetPath}` : `${basePath}/${targetPath}`;
      
      console.log(`Copy paths: ${fullSourcePath} → ${fullTargetPath}`);
      const langPrefix = currentLanguage ? `[${currentLanguage.toUpperCase()}] ` : '';
      updateProgress(`${langPrefix}${translate ? 'Translating & copying' : 'Copying'} ${progressState.completed + 1}/${progressState.total}: ${sourcePath}`);
      
      try {
        const result = await copyPage(fullSourcePath, fullTargetPath, token, {
          translate,
          targetLang: targetLanguage
        });
    
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
            const langPrefix = currentLanguage ? `[${currentLanguage.toUpperCase()}] ` : '';
            updateProgress(`${langPrefix}Pushing ${progressState.completed}/${progressState.total}: ${targetPath}`);
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

// buildTreeStructure, renderTreeNode, isLanguagePath, and previewPageTree are now imported from modules/tree-operations.js

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

// Update destination preview (removed - no longer needed since tree copy is always enabled)

// Handle form submission
async function handleRollout(event, token, basePath) {
  event.preventDefault();
  
  const form = event.target;
  const sourcePath = form['rollout-source'].value;
  const languageSelect = form['rollout-language'];
  const selectedLanguages = Array.from(languageSelect.selectedOptions).map(opt => opt.value);
  const copyTree = true; // Always copy entire tree (default behavior)
  const translateContent = form['translate-content']?.checked || false;
  const pushPreview = form['push-preview']?.checked || false;
  const pushLive = form['push-live']?.checked || false;
  
  if (!sourcePath || selectedLanguages.length === 0) {
    alert('Please enter a source path and select at least one target language');
    return;
  }
  
  console.log('Rollout initiated:');
  console.log('  Source:', sourcePath);
  console.log('  Languages:', selectedLanguages);
  console.log('  Copy Tree:', copyTree);
  console.log('  Translate Content:', translateContent);
  console.log('  Push to Preview:', pushPreview);
  console.log('  Push to Live:', pushLive);
  
  if (copyTree) {
    // Copy entire page tree (only selected files) for each language
    hideResults(); // Clear previous results
    
    // Aggregate results across all languages
    const allResults = {
      total: 0,
      successful: 0,
      failed: 0,
      pushedPreview: 0,
      pushedLive: 0,
      pushFailedPreview: 0,
      pushFailedLive: 0,
      details: [],
      languages: []
    };
    
    try {
      showProgress();
  
      // Get selected checkboxes to calculate total pages
      const selectedCheckboxes = Array.from(document.querySelectorAll('.file-checkbox:checked'));
      
      // Calculate total pages across all languages for overall progress
      const totalPagesAcrossLanguages = selectedCheckboxes.length * selectedLanguages.length;
      progressManager.setProgressState({ total: totalPagesAcrossLanguages, completed: 0, failed: 0 });
      
      let overallCompleted = 0;
      
      // Process each language sequentially
      for (const targetLanguage of selectedLanguages) {
      console.log(`\n=== Processing language: ${targetLanguage} ===`);
      currentLanguage = targetLanguage; // Set current language for progress messages
      
      try {
        const result = await copyPageTree(sourcePath, targetLanguage, token, basePath, { 
          preview: pushPreview, 
          live: pushLive,
          translate: translateContent
        });
        
        if (result.total === 0) {
          allResults.languages.push({
            language: targetLanguage,
            status: 'warning',
            message: 'No pages selected'
          });
          continue;
        }
        
        // Aggregate results for this language
        allResults.total += result.total;
        allResults.successful += result.successful;
        allResults.failed += result.failed;
        allResults.pushedPreview += result.pushedPreview || 0;
        allResults.pushedLive += result.pushedLive || 0;
        allResults.pushFailedPreview += result.pushFailedPreview || 0;
        allResults.pushFailedLive += result.pushFailedLive || 0;
        
        // Add language-specific details
        const langDetails = result.details.map(d => ({
          ...d,
          language: targetLanguage,
          message: `[${targetLanguage.toUpperCase()}] ${d.path} ${d.status === 'success' || d.status === 'success-push-failed' ? '→ ' + d.targetPath : '- ' + (d.error || 'Failed')}`
        }));
        allResults.details.push(...langDetails);
        
        allResults.languages.push({
          language: targetLanguage,
          status: result.success ? 'success' : 'warning',
          successful: result.successful,
          failed: result.failed,
          total: result.total
        });
        
        overallCompleted += result.successful;
        const overallProgress = Math.round((overallCompleted / totalPagesAcrossLanguages) * 100);
        updateProgress(`[${targetLanguage.toUpperCase()}] Completed: ${result.successful}/${result.total} pages | Overall: ${overallCompleted}/${totalPagesAcrossLanguages} (${overallProgress}%)`);
        
      } catch (error) {
        console.error(`Error processing language ${targetLanguage}:`, error);
        allResults.languages.push({
          language: targetLanguage,
          status: 'error',
          message: error.message || 'Unknown error'
        });
      } finally {
        currentLanguage = null; // Clear current language after processing
      }
    }
    
    hideProgress();
    
    // Show aggregated results
    if (allResults.total === 0) {
      showResults({
        title: 'No Pages Selected',
        summary: 'Please select at least one page to rollout.',
      }, 'warning');
      return;
    }
    
    const type = allResults.failed === 0 ? 'success' : 'warning';
    const details = allResults.details
      .filter(d => d.status !== 'success' || allResults.failed > 0 || (allResults.pushFailedPreview + allResults.pushFailedLive > 0))
      .map(d => {
        let message = d.message || `${d.path} ${d.status === 'success' || d.status === 'success-push-failed' ? '→ ' + d.targetPath : '- ' + (d.error || 'Failed')}`;
        
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
    
    // Build summary message for all languages
    const langSummary = allResults.languages.map(l => 
      `${l.language.toUpperCase()}: ${l.successful || 0}/${l.total || 0}`
    ).join(', ');
    
    let summary = allResults.failed === 0
      ? `Successfully copied ${allResults.successful} page${allResults.successful !== 1 ? 's' : ''} across ${selectedLanguages.length} language${selectedLanguages.length !== 1 ? 's' : ''} (${langSummary}).`
      : `Copied ${allResults.successful} page${allResults.successful !== 1 ? 's' : ''}, but ${allResults.failed} failed across ${selectedLanguages.length} language${selectedLanguages.length !== 1 ? 's' : ''}.`;
    
    // Add translation status if translation was enabled
    if (translateContent) {
      summary += ` All content was translated to target languages.`;
    }
    
    if (pushPreview || pushLive) {
      const pushSummary = [];
      if (pushPreview) {
        pushSummary.push(`${allResults.pushedPreview}/${allResults.successful} to preview`);
      }
      if (pushLive) {
        pushSummary.push(`${allResults.pushedLive}/${allResults.successful} to live`);
      }
      
      if (pushSummary.length > 0) {
        summary += ` Pushed ${pushSummary.join(' and ')}.`;
      }
      
      const totalPushFailed = allResults.pushFailedPreview + allResults.pushFailedLive;
      if (totalPushFailed > 0) {
        summary += ` ${totalPushFailed} push operation${totalPushFailed !== 1 ? 's' : ''} failed.`;
      }
    }
    
    const stats = [
      { label: 'Languages', value: `${selectedLanguages.length} (${selectedLanguages.map(l => l.toUpperCase()).join(', ')})` },
      { label: 'Total Pages', value: allResults.total },
      { label: 'Copied', value: allResults.successful },
      { label: 'Failed', value: allResults.failed },
    ];
    
    // Add translation status if translation was enabled
    if (translateContent) {
      stats.push({ label: 'Translation', value: 'Enabled ✓' });
    }
    
    if (pushPreview || pushLive) {
      const pushedPreviewCount = allResults.pushedPreview || 0;
      const pushedLiveCount = allResults.pushedLive || 0;
      const pushFailedPreviewCount = allResults.pushFailedPreview || 0;
      const pushFailedLiveCount = allResults.pushFailedLive || 0;
      
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
      title: allResults.failed === 0 ? 'Rollout Successful' : 'Rollout Completed with Errors',
      summary,
      stats,
      details: allResults.failed > 0 || (allResults.pushFailedPreview + allResults.pushFailedLive > 0) ? details : [],
    }, type);
    
    console.log('Multi-language rollout completed:', allResults);
    
    if (allResults.failed === 0) {
      // Reset form on complete success
      setTimeout(() => {
        form.reset();
        // Destination preview removed - tree copy is always enabled
        document.getElementById('tree-preview').style.display = 'none';
      }, 500);
      }
    } catch (error) {
      showResults({
        title: 'Rollout Error',
        summary: error.message,
      }, 'error');
      console.error('Multi-language rollout error:', error);
      hideProgress();
    }
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
    
    // Setup scan button (similar to tree-publish)
    const sourceInput = document.getElementById('rollout-source');
    const languageSelect = document.getElementById('rollout-language');
    const scanButton = document.getElementById('scan-button');
    const refreshScanBtn = document.getElementById('refresh-scan');
    const rolloutButton = document.querySelector('button[type="submit"]');
    
    if (scanButton && sourceInput && languageSelect) {
      scanButton.addEventListener('click', () => {
        const source = sourceInput.value || '';
        const selectedLanguages = Array.from(languageSelect.selectedOptions).map(opt => opt.value);
        if (!source || selectedLanguages.length === 0) {
          alert('Please enter a source path and select at least one target language.');
          return;
        }
        // Preview with all selected languages to check existence for each
        previewPageTree(cmp.path, source, selectedLanguages, token, updateProgress, setupCheckboxListeners, updateSelectionCount);
        if (rolloutButton) rolloutButton.style.display = 'block'; // Show rollout button after scan
      });
    }
    
    if (refreshScanBtn) {
      refreshScanBtn.addEventListener('click', () => {
        const source = sourceInput?.value || '';
        const selectedLanguages = Array.from(languageSelect.selectedOptions).map(opt => opt.value);
        if (source && selectedLanguages.length > 0) {
          previewPageTree(cmp.path, source, selectedLanguages, token, updateProgress, setupCheckboxListeners, updateSelectionCount);
        }
      });
    }
    
    // Hide rollout button initially (will show after scan)
    if (rolloutButton) {
      rolloutButton.style.display = 'none';
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
  
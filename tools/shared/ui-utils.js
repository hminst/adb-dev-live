/**
 * Shared UI Utilities
 * Common UI functions for progress tracking and results display
 * Used by language-rollout and tree-publish tools
 */

/**
 * Creates a progress manager for tracking and displaying progress
 * @param {Object} selectors - Object with selector functions/strings
 * @param {Function|string} selectors.progressSection - Selector for progress section
 * @param {Function|string} selectors.progressBar - Selector for progress bar
 * @param {Function|string} selectors.progressText - Selector for progress text
 * @param {Function|string} selectors.submitButton - Selector for submit button
 * @param {Object} options - Configuration options
 * @param {string} options.processingText - Text to show when processing
 * @param {string} options.defaultButtonText - Default button text
 * @returns {Object} Progress manager with methods
 */
export function createProgressManager(selectors, options = {}) {
  const {
    processingText = 'Processing...',
    defaultButtonText = 'Submit',
  } = options;

  let progressState = {
    total: 0,
    completed: 0,
    failed: 0,
  };

  function getElement(selector) {
    if (typeof selector === 'function') {
      return selector();
    }
    return typeof selector === 'string' ? document.querySelector(selector) : selector;
  }

  function updateProgress(message) {
    const progressText = getElement(selectors.progressText);
    const progressBar = getElement(selectors.progressBar);
    
    if (progressText) {
      progressText.textContent = message;
    }
    
    if (progressBar && progressState.total > 0) {
      const percentage = ((progressState.completed + progressState.failed) / progressState.total) * 100;
      progressBar.style.width = `${percentage}%`;
    }
  }

  function showProgress() {
    const progressSection = getElement(selectors.progressSection);
    const submitButton = getElement(selectors.submitButton);
    
    if (progressSection) {
      progressSection.style.display = 'block';
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = processingText;
    }
  }

  function hideProgress() {
    const progressSection = getElement(selectors.progressSection);
    const submitButton = getElement(selectors.submitButton);
    
    if (progressSection) {
      progressSection.style.display = 'none';
    }
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = defaultButtonText;
    }
    // Reset progress state - extend with additional fields if needed
    progressState = { total: 0, completed: 0, failed: 0 };
  }

  function resetProgressState(newState = {}) {
    progressState = { total: 0, completed: 0, failed: 0, ...newState };
  }

  function getProgressState() {
    return { ...progressState };
  }

  function setProgressState(newState) {
    progressState = { ...progressState, ...newState };
  }

  return {
    updateProgress,
    showProgress,
    hideProgress,
    resetProgressState,
    getProgressState,
    setProgressState,
  };
}

/**
 * Creates a results manager for displaying operation results
 * @param {Object} selectors - Object with selector functions/strings
 * @param {Function|string} selectors.resultsSection - Selector for results section
 * @param {Function|string} selectors.resultsContent - Selector for results content
 * @returns {Object} Results manager with methods
 */
export function createResultsManager(selectors) {
  function getElement(selector) {
    if (typeof selector === 'function') {
      return selector();
    }
    return typeof selector === 'string' ? document.querySelector(selector) : selector;
  }

  const iconMap = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };

  function showResults(result, type = 'success') {
    const resultsSection = getElement(selectors.resultsSection);
    const resultsContent = getElement(selectors.resultsContent);
    
    if (!resultsSection || !resultsContent) return;
    
    const icon = iconMap[type] || iconMap.info;
    
    let html = `<div class="result-${type}">`;
    html += `<div class="result-header">${icon} ${result.title || 'Complete'}</div>`;
    
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

  function hideResults() {
    const resultsSection = getElement(selectors.resultsSection);
    if (resultsSection) {
      resultsSection.style.display = 'none';
    }
  }

  return {
    showResults,
    hideResults,
  };
}


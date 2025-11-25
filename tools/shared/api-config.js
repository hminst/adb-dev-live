/**
 * API Configuration
 * Centralized configuration for all API endpoints
 */

export const API_BASE_URLS = {
  // Document Authoring (DA) API
  DA_SOURCE: 'https://admin.da.live',
  
  // Helix Admin API
  HLX_ADMIN: 'https://admin.hlx.page',
  
  // DeepL Translation Proxy
  DEEPL_PROXY: 'https://deepl-proxy.h-minst.workers.dev',
  
  // DA SDK endpoints
  DA_SDK: 'https://da.live/nx/utils/sdk.js',
  DA_TREE_UTILS: 'https://da.live/nx/public/utils/tree.js',
};

/**
 * Build a full URL for DA source API
 * @param {string} path - The path (should start with /)
 * @returns {string} Full URL
 */
export function getDASourceURL(path) {
  return `${API_BASE_URLS.DA_SOURCE}/source${path}`;
}

/**
 * Build a full URL for Helix Admin preview
 * @param {string} org - Organization name
 * @param {string} repo - Repository name
 * @param {string} path - Page path (without .html extension)
 * @returns {string} Full URL
 */
export function getHLXPreviewURL(org, repo, path) {
  return `${API_BASE_URLS.HLX_ADMIN}/preview/${org}/${repo}/main${path}`;
}

/**
 * Build a full URL for Helix Admin live/publish
 * @param {string} org - Organization name
 * @param {string} repo - Repository name
 * @param {string} path - Page path (without .html extension)
 * @returns {string} Full URL
 */
export function getHLXLiveURL(org, repo, path) {
  return `${API_BASE_URLS.HLX_ADMIN}/live/${org}/${repo}/main${path}`;
}


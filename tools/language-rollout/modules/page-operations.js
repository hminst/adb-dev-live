/**
 * Page Operations Module
 * Handles page copying and related operations
 */

import { getOpts } from '/tools/shared/publish-utils.js';
import { getDASourceURL } from '/tools/shared/api-config.js';
import { translateHTML } from './translation.js';

/**
 * Check if a page exists
 * @param {string} path - Page path to check
 * @param {string} token - Authentication token
 * @returns {Promise<boolean>} True if page exists
 */
export async function checkPageExists(path, token) {
  try {
    const opts = getOpts(token, 'HEAD');
    const resp = await fetch(getDASourceURL(path), opts);
    return resp.ok;
  } catch (error) {
    console.error(`Error checking if page exists: ${path}`, error);
    return false;
  }
}

/**
 * Copy a single page from source to target path
 * @param {string} sourcePath - Source page path
 * @param {string} targetPath - Target page path
 * @param {string} token - Authentication token
 * @param {Object} options - Options
 * @param {boolean} options.translate - Whether to translate the page
 * @param {string} options.targetLang - Target language for translation
 * @returns {Promise<Object>} Result object with success status
 */
export async function copyPage(sourcePath, targetPath, token, options = {}) {
  const { translate = false, targetLang = 'en' } = options;
  
  // 1. Fetch the source document
  const fetchOpts = getOpts(token, 'GET');
  const resp = await fetch(getDASourceURL(sourcePath), fetchOpts);
  
  if (!resp.ok) {
    return { 
      success: false, 
      message: `Could not fetch source: ${sourcePath}`, 
      status: resp.status 
    };
  }
  
  let html = await resp.text();
  
  // 2. Translate if requested
  if (translate && targetLang) {
    console.log(`Translating ${sourcePath} to ${targetLang}`);
    html = await translateHTML(html, targetLang);
  }
  
  // 3. Save to target location
  const body = new FormData();
  const data = new Blob([html], { type: 'text/html' });
  body.append('data', data);
  
  const saveOpts = getOpts(token, 'POST');
  saveOpts.body = body;
  
  const saveResp = await fetch(getDASourceURL(targetPath), saveOpts);
  
  if (!saveResp.ok) {
    return { 
      success: false, 
      message: `Could not save to: ${targetPath}`, 
      status: saveResp.status 
    };
  }
  
  return { 
    success: true, 
    message: `Successfully copied ${sourcePath} to ${targetPath}${translate ? ' (translated)' : ''}`, 
    status: saveResp.status 
  };
}


/**
 * Translation Module
 * Handles text and HTML translation using DeepL proxy
 */

import { API_BASE_URLS } from '/tools/shared/api-config.js';

const DEEPL_PROXY_URL = API_BASE_URLS.DEEPL_PROXY;

/**
 * Translate plain text using DeepL proxy
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, targetLang) {
  if (!text || !text.trim()) return text;
  
  try {
    const sourceLang = 'en'; // Assume source is English
    
    const response = await fetch(DEEPL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        source: sourceLang,
        target: targetLang
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Translation proxy error:', errorData);
      return text;
    }
    
    const data = await response.json();
    
    if (data.success && data.translatedText) {
      return data.translatedText;
    }
    
    console.warn('Translation failed for text:', text, 'Response:', data);
    return text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

/**
 * Translate HTML content - sends entire document to DeepL
 * @param {string} html - HTML content to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated HTML
 */
export async function translateHTML(html, targetLang) {
  try {
    console.log('Translating entire HTML document...');
    
    // Send entire HTML document to DeepL proxy with isHTML flag
    const response = await fetch(DEEPL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: html,
        source: 'en',
        target: targetLang,
        isHTML: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('HTML translation proxy error:', errorData);
      return html;
    }
    
    const data = await response.json();
    
    if (data.success && data.translatedText) {
      return data.translatedText;
    }
    
    console.warn('HTML translation failed. Response:', data);
    return html;
  } catch (error) {
    console.error('HTML translation error:', error);
    return html;
  }
}


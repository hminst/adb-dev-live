/**
 * DeepL Translation Proxy - Cloudflare Worker
 * 
 * A Cloudflare Worker that forwards translation requests to DeepL API.
 * This keeps the API key secure and runs on Cloudflare's edge network.
 * 
 * Environment Variables:
 * - DEEPL_API_KEY: Your DeepL API key (set in Cloudflare dashboard or wrangler.toml)
 */

import { preserveIconElements, restoreIconElements } from './icon-preservation.js';

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

// Language code mapping
const LANGUAGE_MAP = {
  'en': 'EN',
  'de': 'DE',
  'fr': 'FR',
  'es': 'ES',
  'it': 'IT',
  'pt': 'PT-PT',
  'nl': 'NL',
  'ja': 'JA',
  'zh': 'ZH',
  'ko': 'KO',
  'ar': 'AR',
  'ru': 'RU',
  'pl': 'PL',
  'sv': 'SV',
  'da': 'DA',
  'no': 'NB',
  'fi': 'FI',
};

function mapToDeepLCode(langCode) {
  return LANGUAGE_MAP[langCode] || langCode.toUpperCase();
}

// Preserve special patterns like :logo:, :toggle:, :globe: from translation
function preservePatterns(text) {
  const pattern = /:\w+:/g;
  const matches = [];
  let preservedText = text;
  
  // Find all unique :word: patterns
  const uniquePatterns = new Set();
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    uniquePatterns.add(match[0]);
  }
  
  // Create simple numeric placeholders that don't include the pattern
  const patternArray = Array.from(uniquePatterns);
  
  patternArray.forEach((originalPattern, index) => {
    const placeholder = `ICON${String(index).padStart(3, '0')}`;
    matches.push({ placeholder, original: originalPattern, index });
  });
  
  // Replace all occurrences of each pattern with its placeholder
  matches.forEach(({ placeholder, original }) => {
    const escapedPattern = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPattern, 'g');
    preservedText = preservedText.replace(regex, placeholder);
  });
  
  return { preservedText, matches };
}

// Restore preserved patterns after translation
function restorePatterns(text, matches) {
  let restoredText = text;
  let totalRestored = 0;
  
  // Restore patterns in reverse order to avoid conflicts
  const reversedMatches = [...matches].reverse();
  
  reversedMatches.forEach(({ placeholder, original, index }) => {
    // Strategy 1: Try exact placeholder match
    const exactEscaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(exactEscaped, 'g');
    const exactMatches = restoredText.match(exactRegex);
    
    if (exactMatches && exactMatches.length > 0) {
      restoredText = restoredText.replace(exactRegex, original);
      totalRestored += exactMatches.length;
    } else {
      // Strategy 2: Try case variations
      const variations = [
        placeholder.toLowerCase(),
        placeholder.toUpperCase(),
        placeholder.charAt(0).toUpperCase() + placeholder.slice(1).toLowerCase(),
        `ICON_${index}`,
        `ICON${index}`,
        `icon_${index}`,
        `icon${index}`,
      ];
      
      for (const variation of variations) {
        const varEscaped = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const varRegex = new RegExp(varEscaped, 'gi');
        const varMatches = restoredText.match(varRegex);
        if (varMatches && varMatches.length > 0) {
          restoredText = restoredText.replace(varRegex, original);
          totalRestored += varMatches.length;
          break;
        }
      }
    }
  });
  
  return restoredText;
}

// Prepare HTML for translation by adding translate="no" to section-metadata elements
function prepareHTMLForTranslation(html) {
  let prepared = html;
  let modifiedCount = 0;
  
  const openTagPattern = /<([a-z]+)([^>]*class\s*=\s*["']?[^"'>]*section-metadata[^"'>]*["']?[^>]*)>/gi;
  
  prepared = prepared.replace(openTagPattern, (match, tagName, attributes) => {
    if (/translate\s*=\s*["']?no["']?/i.test(attributes)) {
      return match;
    }
    
    modifiedCount++;
    const isSelfClosing = attributes.trim().endsWith('/');
    const cleanAttributes = isSelfClosing 
      ? attributes.trim().slice(0, -1).trim() 
      : attributes.trim();
    
    if (cleanAttributes) {
      return `<${tagName} ${cleanAttributes} translate="no"${isSelfClosing ? ' /' : ''}>`;
    } else {
      return `<${tagName} translate="no"${isSelfClosing ? ' /' : ''}>`;
    }
  });
  
  return prepared;
}

async function translateText(text, sourceLang, targetLang, apiKey, options = {}) {
  const { isHTML = false } = options;
  
  let textToTranslate = text;
  
  // Prepare HTML if needed
  if (isHTML) {
    textToTranslate = prepareHTMLForTranslation(text);
  }
  
  // Preserve icon elements before translation
  let iconElements = [];
  if (isHTML) {
    const iconResult = preserveIconElements(textToTranslate);
    textToTranslate = iconResult.preservedHtml;
    iconElements = iconResult.iconElements;
  }
  
  // Preserve special patterns before translation
  const { preservedText, matches } = preservePatterns(textToTranslate);
  
  const formData = new URLSearchParams();
  formData.append('text', preservedText);
  formData.append('source_lang', sourceLang);
  formData.append('target_lang', targetLang);
  formData.append('auth_key', apiKey);
  
  // If HTML mode, tell DeepL to handle HTML tags and ignore certain elements
  if (isHTML) {
    formData.append('tag_handling', 'html');
    formData.append('ignore_tags', 'script,style,notranslate');
    formData.append('outline_detection', '1');
    formData.append('preserve_formatting', '1');
    formData.append('split_sentences', '0');
  }

  try {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (data.translations && data.translations.length > 0) {
      let translatedText = data.translations[0].text;
      
      // Restore preserved patterns in the translated text
      translatedText = restorePatterns(translatedText, matches);
      
      // Restore icon elements after restoring patterns
      if (isHTML && iconElements.length > 0) {
        translatedText = restoreIconElements(translatedText, iconElements);
      }
      
      return {
        success: true,
        translatedText,
      };
    } else {
      throw new Error('No translations in DeepL response');
    }
  } catch (error) {
    throw {
      success: false,
      error: error.message || 'Translation failed',
    };
  }
}

/**
 * Cloudflare Worker entry point
 */
export default {
  async fetch(request, env) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Get API key from environment
    const API_KEY = env.DEEPL_API_KEY;
    
    if (!API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'DeepL API key not configured. Set DEEPL_API_KEY in Cloudflare Workers environment.',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    try {
      // Parse request body
      const body = await request.text();
      
      if (!body || body.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Empty request body' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const { text, source, target, isHTML = false } = JSON.parse(body);

      if (!text || !target) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters: text, target' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const sourceLang = source || 'EN';
      const targetLang = mapToDeepLCode(target);

      const result = await translateText(text, sourceLang, targetLang, API_KEY, { isHTML });
      
      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      // Check if it's a JSON parse error
      if (error instanceof SyntaxError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid JSON: ${error.message}`,
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: error.error || error.message || 'Translation failed',
        }),
        {
          status: error.statusCode || 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};


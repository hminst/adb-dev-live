#!/usr/bin/env node

/**
 * DeepL Translation Proxy Server
 * 
 * A simple proxy server that forwards translation requests to DeepL API.
 * This keeps the API key secure on the server side.
 * 
 * Usage: node server.js [API_KEY]
 * Or set DEEPL_API_KEY environment variable
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

// Get API key from command line argument or environment variable
const API_KEY = process.argv[2] || process.env.DEEPL_API_KEY || 'cd122b52-2feb-45f2-ae4e-7f3a01b1dab3:fx';

if (!API_KEY) {
  console.error('Error: DeepL API key not provided');
  console.error('Usage: node server.js [API_KEY]');
  console.error('Or set DEEPL_API_KEY environment variable');
  process.exit(1);
}

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
  
  // Create placeholders that include the original pattern
  // This makes restoration more reliable since we can search for the pattern itself
  const patternArray = Array.from(uniquePatterns);
  
  patternArray.forEach((originalPattern, index) => {
    // Use a format that includes the pattern but in a way DeepL won't translate
    // Format: [PATTERN_INDEX:original] - the brackets and structure make it less likely to be modified
    const placeholder = `[PATTERN_${index}:${originalPattern}]`;
    matches.push({ placeholder, original: originalPattern, index });
  });
  
  // Log preserved patterns for debugging
  if (matches.length > 0) {
    console.log(`  Preserving ${matches.length} unique pattern(s):`, matches.map(m => m.original).join(', '));
  }
  
  // Replace all occurrences of each pattern with its placeholder (global replace)
  matches.forEach(({ placeholder, original }) => {
    // Escape special regex characters and use global flag
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
  
  // Restore patterns - try multiple strategies
  matches.forEach(({ placeholder, original, index }) => {
    let found = false;
    let restoredCount = 0;
    
    // Strategy 1: Try exact placeholder match
    const exactRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const exactMatches = restoredText.match(exactRegex);
    
    if (exactMatches && exactMatches.length > 0) {
      restoredText = restoredText.replace(exactRegex, original);
      restoredCount = exactMatches.length;
      console.log(`  Restored ${restoredCount} occurrence(s) of ${original} using exact placeholder`);
      found = true;
    } else {
      // Strategy 2: Try variations of the placeholder format
      const variations = [
        // Brackets might be changed
        placeholder.replace(/\[/g, '(').replace(/\]/g, ')'), // [ to (
        placeholder.replace(/\[/g, '{').replace(/\]/g, '}'), // [ to {
        // Case variations
        placeholder.toLowerCase(),
        placeholder.toUpperCase(),
        // Spaces instead of underscores
        placeholder.replace(/_/g, ' '),
        // Without brackets
        placeholder.replace(/^\[|\]$/g, ''),
        // Pattern with just the original (in case DeepL kept the pattern but removed the wrapper)
        `PATTERN_${index}:${original}`,
        `[PATTERN${index}:${original}]`,
        `(PATTERN_${index}:${original})`,
      ];
      
      for (const variation of variations) {
        const varRegex = new RegExp(variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const varMatches = restoredText.match(varRegex);
        if (varMatches && varMatches.length > 0) {
          restoredText = restoredText.replace(varRegex, original);
          restoredCount = varMatches.length;
          console.log(`  Restored ${restoredCount} occurrence(s) of ${original} using variation: ${variation}`);
          found = true;
          break;
        }
      }
      
      // Strategy 3: Search for the pattern itself (in case DeepL kept it but modified the wrapper)
      // This is a fallback - search for patterns that look like our placeholders
      if (!found) {
        const patternSearch = new RegExp(`\\[?PATTERN[_\\s]*${index}[_\\s]*:${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?`, 'gi');
        const patternMatches = restoredText.match(patternSearch);
        if (patternMatches && patternMatches.length > 0) {
          restoredText = restoredText.replace(patternSearch, original);
          restoredCount = patternMatches.length;
          console.log(`  Restored ${restoredCount} occurrence(s) of ${original} using pattern search`);
          found = true;
        }
      }
      
      // Strategy 4: Search for just the pattern with any wrapper (most flexible)
      // This catches cases where DeepL modified the wrapper but kept the pattern
      if (!found) {
        // Look for the pattern with any kind of bracket or wrapper around it
        const flexiblePattern = new RegExp(`[\\[\\{\\(]?PATTERN[_\\s]*${index}[_\\s]*:${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\]\\}\\)]?`, 'gi');
        const flexibleMatches = restoredText.match(flexiblePattern);
        if (flexibleMatches && flexibleMatches.length > 0) {
          restoredText = restoredText.replace(flexiblePattern, original);
          restoredCount = flexibleMatches.length;
          console.log(`  Restored ${restoredCount} occurrence(s) of ${original} using flexible pattern search`);
          found = true;
        }
      }
    }
    
    if (found) {
      totalRestored += restoredCount;
    } else {
      console.warn(`  Could not restore pattern: ${original} (placeholder: ${placeholder})`);
      // Log a sample of the text to help debug
      const sample = restoredText.substring(0, 1000);
      if (sample.includes('PATTERN') || sample.includes(original)) {
        console.warn(`  Found pattern-related text in sample:`, sample);
      }
    }
  });
  
  if (totalRestored > 0) {
    console.log(`  Total patterns restored: ${totalRestored}`);
  } else if (matches.length > 0) {
    console.warn(`  Warning: Could not restore any of ${matches.length} pattern(s).`);
    console.warn(`  Sample of translated text (first 500 chars):`, restoredText.substring(0, 500));
  }
  
  return restoredText;
}

// Prepare HTML for translation by adding translate="no" to section-metadata elements
// According to DeepL docs: https://developers.deepl.com/docs/xml-and-html-handling/html
function prepareHTMLForTranslation(html) {
  // Add translate="no" attribute to section-metadata elements
  // This uses DeepL's native support for preventing translation
  let prepared = html;
  let modifiedCount = 0;
  
  // Find all opening tags with section-metadata class
  // Match various formats: class="section-metadata", class='section-metadata', class=section-metadata
  // This pattern matches the tag name and all attributes including the class with section-metadata
  const openTagPattern = /<([a-z]+)([^>]*class\s*=\s*["']?[^"'>]*section-metadata[^"'>]*["']?[^>]*)>/gi;
  
  // Replace opening tags to add translate="no" attribute
  prepared = prepared.replace(openTagPattern, (match, tagName, attributes) => {
    // Skip if translate="no" is already present
    if (/translate\s*=\s*["']?no["']?/i.test(attributes)) {
      return match;
    }
    
    modifiedCount++;
    // Check if it's a self-closing tag
    const isSelfClosing = attributes.trim().endsWith('/');
    // Remove trailing / if present and trim
    const cleanAttributes = isSelfClosing 
      ? attributes.trim().slice(0, -1).trim() 
      : attributes.trim();
    
    // Add translate="no" attribute
    // If there are existing attributes, add a space before translate="no"
    if (cleanAttributes) {
      return `<${tagName} ${cleanAttributes} translate="no"${isSelfClosing ? ' /' : ''}>`;
    } else {
      // No other attributes, just add translate="no"
      return `<${tagName} translate="no"${isSelfClosing ? ' /' : ''}>`;
    }
  });
  
  if (modifiedCount > 0) {
    console.log(`  Added translate="no" to ${modifiedCount} section-metadata element(s)`);
  } else {
    console.log(`  Warning: No section-metadata elements found to modify`);
  }
  
  return prepared;
}

function translateText(text, sourceLang, targetLang, options = {}) {
  return new Promise((resolve, reject) => {
    const { isHTML = false } = options;
    
    let textToTranslate = text;
    
    // Prepare HTML if needed
    if (isHTML) {
      textToTranslate = prepareHTMLForTranslation(text);
    }
    
    // Preserve special patterns before translation
    const { preservedText, matches } = preservePatterns(textToTranslate);
    
    const formData = new URLSearchParams();
    formData.append('text', preservedText);
    formData.append('source_lang', sourceLang);
    formData.append('target_lang', targetLang);
    formData.append('auth_key', API_KEY);
    
    // If HTML mode, tell DeepL to handle HTML tags and ignore certain elements
    if (isHTML) {
      formData.append('tag_handling', 'html');
      // Ignore script and style tags
      // DeepL will respect translate="no" attribute automatically (per their docs)
      formData.append('ignore_tags', 'script,style');
      // Use outline_detection for better HTML handling
      formData.append('outline_detection', '1');
      // Preserve formatting
      formData.append('preserve_formatting', '1');
      
      // Log if we have translate="no" attributes in the prepared text
      if (preservedText.includes('translate="no"')) {
        const translateNoCount = (preservedText.match(/translate\s*=\s*["']no["']/gi) || []).length;
        console.log(`  Sending HTML with ${translateNoCount} element(s) marked translate="no" to DeepL`);
      }
    }

    const postData = formData.toString();
    const url = new URL(DEEPL_API_URL);

    const requestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Check if response is empty
          if (!data || data.trim() === '') {
            reject({
              success: false,
              error: 'Empty response from DeepL API',
              statusCode: res.statusCode,
            });
            return;
          }

          const parsed = JSON.parse(data);
          if (res.statusCode === 200 && parsed.translations && parsed.translations.length > 0) {
            let translatedText = parsed.translations[0].text;
            
            // Restore preserved patterns in the translated text
            translatedText = restorePatterns(translatedText, matches);
            
            resolve({
              success: true,
              translatedText,
            });
          } else {
            console.error(`DeepL API error (${res.statusCode}):`, data);
            reject({
              success: false,
              error: `DeepL API error: ${data}`,
              statusCode: res.statusCode,
            });
          }
        } catch (error) {
          console.error('Failed to parse DeepL response:', data);
          reject({
            success: false,
            error: `Failed to parse response: ${error.message}. Response: ${data.substring(0, 200)}`,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: `Request failed: ${error.message}`,
      });
    });

    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Parse request body
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      // Check if body is empty
      if (!body || body.trim() === '') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Empty request body' }));
        return;
      }

      const { text, source, target, isHTML = false } = JSON.parse(body);

      if (!text || !target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required parameters: text, target' }));
        return;
      }

      const sourceLang = source || 'EN';
      const targetLang = mapToDeepLCode(target);

      // Check if text contains patterns to preserve
      const hasPatterns = /:\w+:/g.test(text);
      if (isHTML) {
        console.log(`Translating HTML document [${sourceLang} → ${targetLang}]`);
      } else if (hasPatterns) {
        console.log(`Translating (with preserved patterns): ${text.substring(0, 100)}... [${sourceLang} → ${targetLang}]`);
      } else {
        console.log(`Translating: ${text.substring(0, 50)}... [${sourceLang} → ${targetLang}]`);
      }

      const result = await translateText(text, sourceLang, targetLang, { isHTML });
      
      if (hasPatterns) {
        console.log('Translation result (patterns preserved):', result);
      } else {
        console.log('Translation result:', result);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Translation error:', error);
      
      // Check if it's a JSON parse error
      if (error instanceof SyntaxError) {
        console.error('Invalid JSON received. Body:', body);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Invalid JSON: ${error.message}`,
        }));
        return;
      }
      
      res.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.error || error.message || 'Translation failed',
      }));
    }
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  });
});

server.listen(PORT, () => {
  console.log(`DeepL Translation Proxy running on http://localhost:${PORT}`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('Ready to accept translation requests');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


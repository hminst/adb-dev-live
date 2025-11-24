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
  let match;
  
  // Find all :word: patterns
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[0]);
  }
  
  // Log preserved patterns for debugging
  if (matches.length > 0) {
    console.log(`  Preserving ${matches.length} pattern(s):`, matches.join(', '));
  }
  
  // Replace each pattern with a unique placeholder
  matches.forEach((match, index) => {
    const placeholder = `___PRESERVE_${index}___`;
    preservedText = preservedText.replace(match, placeholder);
  });
  
  return { preservedText, matches };
}

// Restore preserved patterns after translation
function restorePatterns(text, matches) {
  let restoredText = text;
  
  matches.forEach((match, index) => {
    const placeholder = `___PRESERVE_${index}___`;
    restoredText = restoredText.replace(placeholder, match);
  });
  
  return restoredText;
}

// Prepare HTML for translation by wrapping section-metadata in a special tag
function prepareHTMLForTranslation(html) {
  // Wrap section-metadata elements in <notranslate> tags
  // This uses a more robust approach to handle various HTML formats
  let prepared = html;
  let wrappedCount = 0;
  
  // First, find all opening tags with section-metadata class
  // Match various formats: class="section-metadata", class='section-metadata', class=section-metadata
  const openTagPattern = /<([a-z]+)[^>]*class\s*=\s*["']?[^"'>]*section-metadata[^"'>]*["']?[^>]*>/gi;
  
  const matches = [];
  let match;
  
  // Find all opening tags
  while ((match = openTagPattern.exec(html)) !== null) {
    matches.push({
      index: match.index,
      tagName: match[1].toLowerCase(),
      fullMatch: match[0]
    });
  }
  
  // Process matches in reverse order to maintain indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, tagName, fullMatch } = matches[i];
    
    // Skip if already wrapped
    if (fullMatch.includes('notranslate')) continue;
    
    // Find the matching closing tag by counting nested tags
    let depth = 1;
    let pos = index + fullMatch.length;
    let endIndex = -1;
    
    while (pos < prepared.length && depth > 0) {
      const openPattern = new RegExp(`<${tagName}[^>]*>`, 'gi');
      const closePattern = new RegExp(`</${tagName}>`, 'gi');
      
      openPattern.lastIndex = pos;
      closePattern.lastIndex = pos;
      
      const nextOpen = openPattern.exec(prepared);
      const nextClose = closePattern.exec(prepared);
      
      if (!nextClose) break;
      
      const openPos = nextOpen ? nextOpen.index : Infinity;
      const closePos = nextClose.index;
      
      if (openPos < closePos) {
        depth++;
        pos = openPos + nextOpen[0].length;
      } else {
        depth--;
        if (depth === 0) {
          endIndex = closePos + nextClose[0].length;
          break;
        }
        pos = closePos + nextClose[0].length;
      }
    }
    
    if (endIndex > 0) {
      // Wrap the entire block
      const block = prepared.substring(index, endIndex);
      prepared = prepared.substring(0, index) + 
                `<notranslate>${block}</notranslate>` + 
                prepared.substring(endIndex);
      wrappedCount++;
    }
  }
  
  if (wrappedCount > 0) {
    console.log(`  Wrapped ${wrappedCount} section-metadata block(s) in <notranslate> tags`);
  } else {
    console.log(`  Warning: No section-metadata blocks found to wrap`);
  }
  
  return prepared;
}

// Restore HTML after translation by unwrapping notranslate tags
function restoreHTMLAfterTranslation(html) {
  // Remove notranslate wrapper tags
  let restored = html;
  restored = restored.replace(/<notranslate>/gi, '');
  restored = restored.replace(/<\/notranslate>/gi, '');
  return restored;
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
      // Ignore script, style, and notranslate tags (which wrap section-metadata)
      // DeepL will not translate content inside these tags
      formData.append('ignore_tags', 'script,style,notranslate');
      // Use outline_detection for better HTML handling
      formData.append('outline_detection', '1');
      // Preserve formatting
      formData.append('preserve_formatting', '1');
      
      // Log if we have notranslate tags in the prepared text
      if (preservedText.includes('<notranslate>')) {
        const notranslateCount = (preservedText.match(/<notranslate>/gi) || []).length;
        console.log(`  Sending HTML with ${notranslateCount} notranslate block(s) to DeepL`);
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
            
            // Restore HTML structure if needed
            if (isHTML) {
              translatedText = restoreHTMLAfterTranslation(translatedText);
            }
            
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


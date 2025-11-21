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

function translateText(text, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    const formData = new URLSearchParams();
    formData.append('text', text);
    formData.append('source_lang', sourceLang);
    formData.append('target_lang', targetLang);
    formData.append('auth_key', API_KEY);

    const postData = formData.toString();
    const url = new URL(DEEPL_API_URL);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
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
            resolve({
              success: true,
              translatedText: parsed.translations[0].text,
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

      const { text, source, target } = JSON.parse(body);

      if (!text || !target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required parameters: text, target' }));
        return;
      }

      const sourceLang = source || 'EN';
      const targetLang = mapToDeepLCode(target);

      console.log(`Translating: ${text.substring(0, 50)}... [${sourceLang} → ${targetLang}]`);

      const result = await translateText(text, sourceLang, targetLang);

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


# DeepL Translation Proxy

A local proxy server for DeepL translation API that keeps your API key secure on the server side.

## Features

- **Secure**: API key never exposed to the client
- **Simple**: Pure Node.js, no external dependencies
- **CORS-enabled**: Works with browser-based applications
- **Graceful shutdown**: Handles SIGTERM and SIGINT signals
- **Pattern preservation**: Automatically preserves `:word:` patterns (like `:logo:`, `:toggle:`, `:globe:`) from translation

## Setup

### 1. Get a DeepL API Key

Get a free API key from [DeepL Pro API](https://www.deepl.com/pro-api). The free tier includes 500,000 characters per month.

### 2. Start the Proxy Server

You can provide the API key in three ways:

**Option 1: Command line argument**
```bash
node server.js YOUR_DEEPL_API_KEY
```

**Option 2: Environment variable**
```bash
export DEEPL_API_KEY=YOUR_DEEPL_API_KEY
node server.js
```

**Option 3: NPM script with environment variable**
```bash
DEEPL_API_KEY=YOUR_DEEPL_API_KEY npm start
```

**Development mode with auto-reload (Node 18+)**
```bash
DEEPL_API_KEY=YOUR_DEEPL_API_KEY npm run dev
```

The server will start on `http://localhost:3001`.

## API Usage

### Endpoint

`POST http://localhost:3001/`

### Request Body

```json
{
  "text": "Hello, world!",
  "source": "en",
  "target": "de"
}
```

- `text` (required): The text to translate
- `target` (required): Target language code (e.g., "de", "fr", "es")
- `source` (optional): Source language code, defaults to "en"

### Response

**Success:**
```json
{
  "success": true,
  "translatedText": "Hallo, Welt!"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

### Pattern Preservation

The proxy automatically preserves `:word:` patterns from translation. This is useful for icon placeholders or custom tokens.

**Example:**
```json
// Request
{
  "text": "Click the :logo: to go home or :toggle: to switch themes",
  "source": "en",
  "target": "de"
}

// Response
{
  "success": true,
  "translatedText": "Klicken Sie auf :logo:, um zur Startseite zu gelangen, oder :toggle:, um das Thema zu wechseln"
}
```

Patterns like `:logo:`, `:toggle:`, `:globe:`, `:icon:`, etc., remain unchanged while the surrounding text is translated.

## Supported Languages

- English (en)
- German (de)
- French (fr)
- Spanish (es)
- Italian (it)
- Portuguese (pt)
- Dutch (nl)
- Japanese (ja)
- Chinese (zh)
- Korean (ko)
- Arabic (ar)
- Russian (ru)
- Polish (pl)
- Swedish (sv)
- Danish (da)
- Norwegian (no)
- Finnish (fi)

## Integration

The language rollout tool automatically uses this proxy when it's running. Make sure to start the proxy server before using translation features.

## Security Notes

- The proxy should only be run locally for development
- For production use, deploy behind proper authentication/authorization
- Consider adding rate limiting for production deployments
- Never commit your API key to version control

## Troubleshooting

**Port already in use:**
```bash
# Find and kill the process using port 3001
lsof -ti:3001 | xargs kill
```

**API key not working:**
- Verify your API key is valid at [DeepL account](https://www.deepl.com/account)
- Check if you're using the correct endpoint (free vs. pro)
- Ensure you haven't exceeded your monthly character limit


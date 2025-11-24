# DeepL Translation Proxy

A proxy for DeepL translation API that keeps your API key secure. Available as both a Node.js server (for local development) and a Cloudflare Worker (for production deployment).

## Features

- **Secure**: API key never exposed to the client
- **Dual deployment**: Run locally with Node.js or deploy to Cloudflare Workers
- **CORS-enabled**: Works with browser-based applications
- **Pattern preservation**: Automatically preserves `:word:` patterns (like `:logo:`, `:toggle:`, `:globe:`) from translation
- **Icon preservation**: Preserves icon HTML elements in correct positions during translation
- **HTML structure protection**: Prevents DeepL from modifying HTML structure
- **Environment-based config**: Supports .env file (Node.js) or Cloudflare secrets (Workers)

## Setup

### 1. Get a DeepL API Key

Get a free API key from [DeepL Pro API](https://www.deepl.com/pro-api). The free tier includes 500,000 characters per month.

### 2. Install Dependencies

```bash
npm install
```

## Deployment Options

### Option A: Local Node.js Server (Development)

#### Configure API Key

You can provide the API key in one of these ways (in order of priority):

**Option 1: .env file (Recommended)**
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API key
# DEEPL_API_KEY=your_actual_api_key_here
```

**Option 2: Command line argument**
```bash
node server.js YOUR_DEEPL_API_KEY
```

**Option 3: Environment variable**
```bash
export DEEPL_API_KEY=YOUR_DEEPL_API_KEY
node server.js
```

#### Start the Server

```bash
npm start
```

**Development mode with auto-reload (Node 18+)**
```bash
npm run dev
```

The server will start on `http://localhost:3001`.

### Option B: Cloudflare Worker (Production)

#### Prerequisites

1. Install Wrangler CLI (if not already installed):
```bash
npm install -g wrangler
```

2. Authenticate with Cloudflare:
```bash
wrangler login
```

#### Configure API Key

Set the API key as a Cloudflare Worker secret:

```bash
wrangler secret put DEEPL_API_KEY
# Enter your DeepL API key when prompted
```

For local development, create a `.dev.vars` file:
```bash
# .dev.vars
DEEPL_API_KEY=your_api_key_here
```

#### Deploy

**Deploy to production:**
```bash
npm run worker:deploy
```

**Deploy to staging:**
```bash
npm run worker:deploy:staging
```

**Local development:**
```bash
npm run worker:dev
```

The worker will be available at a URL like: `https://deepl-proxy.your-subdomain.workers.dev`

#### Update Worker URL

After deployment, update the language-rollout tool to use the Cloudflare Worker URL instead of `http://localhost:3001`:

```javascript
// In language-rollout.js, update the proxy URL:
const url = 'https://deepl-proxy.your-subdomain.workers.dev';
```

## API Usage

### Endpoint

**Node.js server:** `POST http://localhost:3001/`  
**Cloudflare Worker:** `POST https://your-worker-url.workers.dev/`

### Request Body

```json
{
  "text": "Hello, world!",
  "source": "en",
  "target": "de",
  "isHTML": false
}
```

- `text` (required): The text to translate
- `target` (required): Target language code (e.g., "de", "fr", "es")
- `source` (optional): Source language code, defaults to "en"
- `isHTML` (optional): Set to `true` for HTML content (preserves structure and icons)

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

- **Node.js server**: Should only be run locally for development
- **Cloudflare Worker**: Suitable for production, but consider adding:
  - Authentication/authorization (API keys, tokens)
  - Rate limiting
  - IP allowlisting if needed
- Never commit your API key to version control
- Use Cloudflare Workers secrets for API keys in production

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


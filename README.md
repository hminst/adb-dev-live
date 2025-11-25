# Author Kit
For projects that want a few more batteries. Built by the team who brought you da.live and adobe.com.

## Getting started

### 1. Github
1. Use this template to make a new repo.
1. Install [AEM Code Sync](https://da.live/bot).

### 2. DA content
1. Browse to https://da.live/start.
2. Follow the steps.

### 3. Local development
1. Clone your new repo to your computer.
1. Install the AEM CLI using your terminal: `sudo npm install -g @adobe/aem-cli`
1. Start the AEM CLI: `aem up`.
1. Open the `{repo}` folder in your favorite code editor and build something.
1. **Recommended:** Install common npm packages like linting and testing: `npm i`.

## Project Structure

```
├── blocks/          # Reusable content blocks
│   ├── accordion/  # Expandable content sections
│   ├── card/       # Card component
│   ├── carousel/   # Image/content carousel
│   ├── columns/    # Multi-column layouts
│   ├── footer/     # Site footer
│   ├── fragment/   # Content fragments
│   ├── header/     # Site header with navigation
│   ├── hero/       # Hero banner sections
│   ├── schedule/   # Scheduled content blocks
│   ├── section-metadata/  # Section configuration
│   ├── table/      # Data tables
│   └── youtube/    # YouTube video embeds
├── tools/          # Developer and author tools
│   ├── deepl-proxy/        # DeepL translation API proxy
│   ├── language-rollout/   # Multi-language page rollout tool
│   ├── scheduler/          # Content scheduling tool
│   ├── shared/             # Shared utilities for tools
│   ├── sidekick/           # Sidekick configuration
│   ├── tag-audit/          # Tag auditing tool
│   ├── tag-gen/            # Tag generation tool
│   ├── tag-view/           # Tag viewing tool
│   └── tree-publish/       # Tree preview & publish tool
├── scripts/        # JavaScript libraries and utilities
│   ├── aem.js      # Core AEM Library (NEVER MODIFY)
│   ├── scripts.js  # Global JavaScript utilities
│   ├── lazy.js    # Lazy loading utilities
│   ├── postlcp.js # Post-LCP functionality
│   └── utils/      # Utility functions
├── styles/         # Global styles and CSS
│   ├── styles.css  # Minimal global styling (LCP)
│   └── fonts/      # Web fonts (Montserrat)
├── test-cases/     # Test case documentation
│   ├── language-rollout.md  # Test cases for language rollout
│   └── tree-publish.md      # Test cases for tree publish
├── workers/        # Cloudflare Workers
│   └── website/    # Website worker implementation
└── templates/      # Page templates
    └── blog/       # Blog template
```

## Features

### Content Blocks

#### Accordion
Expandable content sections with multiple variants:
- **Default**: Multiple items can be open simultaneously
- **Single-Open**: Only one item open at a time
- **Bordered**: Visual style with borders
- **Minimal**: Clean, minimal styling

See `blocks/accordion/AUTHOR-GUIDE.md` for author documentation.

#### Card
Reusable card component for displaying content in card format.

#### Carousel
Image and content carousel with navigation controls.

#### Columns
Flexible multi-column layouts (1-12 columns) with responsive breakpoints.

#### Footer
Site footer with configurable content and links.

#### Fragment
Content fragment loading and management.

#### Header
Site header with:
- Brand logo/link
- Main navigation menu
- Mega menu support
- Action buttons
- Language switcher

#### Hero
Hero banner sections for landing pages.

#### Schedule
Scheduled content blocks that show/hide based on date/time.

#### Section Metadata
Section-level configuration for styling and behavior.

#### Table
Data table component with responsive design.

#### YouTube
YouTube video embeds with responsive sizing.

### Developer Tools

#### Language Rollout (`/tools/language-rollout/`)
Multi-language page rollout tool that enables:
- **Page Tree Copying**: Copy entire directory structures to target languages
- **Machine Translation**: Automatic translation using DeepL API
- **Multi-Language Support**: Rollout to multiple target languages simultaneously
- **Preview & Live Publishing**: Push translated pages to preview or live environments
- **Tree Preview**: Visual preview of pages to be rolled out
- **Selective Rollout**: Choose specific pages or folders to roll out

**Usage**: Access via `https://da.live/app/{org}/{repo}/tools/language-rollout/language-rollout`

#### Tree Publish (`/tools/tree-publish/`)
Tree preview and publish tool for bulk publishing operations:
- **Directory Scanning**: Scan entire directory trees for HTML pages
- **Bulk Publishing**: Publish multiple pages to preview or live simultaneously
- **Tree Visualization**: Hierarchical view of pages with folder structure
- **Selective Publishing**: Choose specific pages or folders to publish
- **Progress Tracking**: Real-time progress display during publishing
- **Results Reporting**: Detailed success/failure reporting

**Usage**: Access via `https://da.live/app/{org}/{repo}/tools/tree-publish/tree-publish`

#### Tag Generation (`/tools/tag-gen/`)
Tool for generating and managing page tags.

#### Tag Audit (`/tools/tag-audit/`)
Tool for auditing and reviewing page tags across the site.

#### Tag View (`/tools/tag-view/`)
Tool for viewing and browsing page tags.

#### Scheduler (`/tools/scheduler/`)
Content scheduling tool for managing scheduled content.

#### DeepL Translation Proxy (`/tools/deepl-proxy/`)
Secure proxy for DeepL translation API:
- **Local Development**: Node.js server on port 3001
- **Production**: Cloudflare Worker deployment
- **Pattern Preservation**: Preserves `:word:` patterns (e.g., `:logo:`, `:toggle:`)
- **Icon Preservation**: Maintains icon positions during translation
- **HTML Structure Protection**: Prevents DeepL from modifying HTML structure

See `tools/deepl-proxy/README.md` for detailed setup and deployment instructions.

### Localization & Globalization
* Language only support - Ex: en, de, hi, ja
* Region only support - Ex: en-us, en-ca, de-de, de-ch
* Hybrid support - Ex: en, en-us, de, de-ch, de-at
* Fragment-based localized 404s
* Localized Header & Footer
* Do not translate support (#_dnt)

### Flexible Section Authoring
* Optional containers to constrain content
* Grids: 1-6
* Color scheme: light, dark
* Gap: xs, s, m, l, xl, xxl
* Spacing: xs, s, m, l, xl, xxl
* Background: token / image / color / gradient

### Base Content
* Universal buttons w/ extensive styles
* Images w/ retina breakpoint
* Color scheme support: light, dark
* Modern favicon support
* New window support
* Deep link support
* Modal support

### Header and Footer Content
* Brand - First link in header
* Main Menu - First list in header
* Actions - Last section of header
* Menu & mega menu support
* Disable header/footer via meta props

### Scheduled Content
* Schedule content using spreadsheets

### Sidekick
* Extensible plumbing for plugins
* Schedule simulator

### Performance
* Extensible LCP detection

### Developer tools
* Environment detection
* Extensible logging (console, coralogix, splunk, etc.)
* Buildless reactive framework support (Lit)
* Hash utils patterns (#_blank, #_dnt, etc)
* Modern CSS scoping & nesting
* AEM Operational Telemetry

### Operations
* Cloudflare Worker reference implementation

## Testing

### Test Cases
Comprehensive test case documentation for automated testing with Playwright MCP:

- **Language Rollout Tests** (`test-cases/language-rollout.md`): 15 test cases covering multi-language rollout, translation, and publishing
- **Tree Publish Tests** (`test-cases/tree-publish.md`): 15 test cases covering bulk publishing, selection mechanisms, and error handling

All test cases include:
- Step-by-step instructions with element selectors
- Expected results and validation criteria
- Timing considerations and test data requirements
- Notes on iframe handling and cross-origin restrictions

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test:file path/to/test.js
```

## Design System Dimensions

### Spacing
XS, S, M, L, XL, XXL

### Emphasis
quiet, default, strong

### Container columns
1 - 12

### Color tokens
100-900

### Color Schemes
light, dark

## Development Workflow

### Local Development
1. Run `npx -y @adobe/aem-cli up --no-open` to start the AEM Proxy server
2. Open `http://localhost:3000` in your browser
3. Make changes to files - they will auto-reload
4. Use browser dev tools to test responsive design

### Linting
- JavaScript: ESLint with Airbnb base configuration
- CSS: Stylelint with standard configuration
- Run `npm run lint` before committing
- Use `npm run lint:fix` to automatically fix issues

### Performance
- Follow AEM Edge Delivery performance best practices: https://www.aem.live/developer/keeping-it-100
- Images uploaded by authors are automatically optimized
- Use lazy loading for non-critical resources (`lazy-styles.css` and `delayed.js`)
- Minimize JavaScript bundle size by avoiding dependencies

### Accessibility
- Ensure proper heading hierarchy
- Include alt text for images
- Test with screen readers
- Follow WCAG 2.1 AA guidelines

## Deployment

### Environments

Edge Delivery Services provides three environments:

- **Local Development**: `http://localhost:3000` - serves code from your local working copy
- **Production Preview**: `https://main--{repo}--{owner}.aem.page/` - preview environment with approved content
- **Production Live**: `https://main--{repo}--{owner}.aem.live/` - live website
- **Feature Preview**: `https://{branch}--{repo}--{owner}.aem.page/` - preview for feature branches

### Publishing Process
1. Push changes to a feature branch
2. AEM Code Sync automatically processes changes making them available on feature preview environment
3. Open a pull request to merge changes to `main`
   - Include a link to `https://{branch}--{repo}--{owner}.aem.page/{path}` in the PR description
   - This link should point to a page that demonstrates your changes
4. Use `gh checks` to verify the status of code synchronization, linting, and performance tests
5. A human reviewer will review the code, inspect the provided URL and merge the PR
6. AEM Code Sync updates the main branch for production

## Documentation

### Block Documentation
- **Accordion**: See `blocks/accordion/AUTHOR-GUIDE.md` for author documentation and `blocks/accordion/README.md` for developer documentation

### Tool Documentation
- **DeepL Proxy**: See `tools/deepl-proxy/README.md` for setup and deployment instructions
- **Language Rollout**: Test cases in `test-cases/language-rollout.md`
- **Tree Publish**: Test cases in `test-cases/tree-publish.md`

### Agent Documentation
See `AGENTS.md` for detailed instructions for AI agents working on this project, including:
- Content-driven development workflow
- Block development guidelines
- Code style and best practices
- Skills framework for development tasks

## Troubleshooting

### Getting Help
- Check [AEM Edge Delivery documentation](https://www.aem.live/docs/)
- Review [Developer Tutorial](https://www.aem.live/developer/tutorial)
- Consult [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
- Consider the rules in [David's Model](https://www.aem.live/docs/davidsmodel)
- Search the web with `site:www.aem.live`
- Search the full text of the documentation with `curl -s https://www.aem.live/docpages-index.json | jq -r '.data[] | select(.content | test("KEYWORD"; "i")) | "\(.path): \(.title)"'`

## Security Considerations

- Never commit sensitive information (API keys, passwords)
- Consider that everything you do is client-side code served on the public web
- Follow Adobe security guidelines
- Regularly update dependencies
- Use the `.hlxignore` file to prevent files from being served

## Contributing

- Follow the existing code style and patterns
- Test changes locally before committing
- Run a PSI check on your branch and fix performance issues before raising a PR
- Ensure all linting passes
- Update documentation for significant changes
- Include preview URLs in PR descriptions (see Publishing Process above)

## License

Apache License 2.0

# Refactoring Opportunities

This document identifies refactoring opportunities across the codebase to improve maintainability, reduce duplication, and enhance code quality.

## 🔴 High Priority

### 1. Extract Duplicate Progress/Results UI Functions
**Location:** `tools/language-rollout/language-rollout.js` and `tools/tree-publish/tree-publish.js`

**Issue:** Identical functions duplicated across files:
- `showProgress()`
- `hideProgress()`
- `updateProgress()`
- `showResults()`
- `hideResults()`

**Solution:** Create shared UI utilities module:
```javascript
// tools/shared/ui-utils.js
export function createProgressManager(selectors) { ... }
export function createResultsManager(selectors) { ... }
```

**Impact:** Reduces ~150 lines of duplicate code, easier to maintain UI consistency.

---

### 2. Extract API Base URLs to Constants
**Location:** Multiple files using hardcoded URLs:
- `tools/language-rollout/language-rollout.js`: `https://admin.da.live`
- `tools/shared/publish-utils.js`: `https://admin.hlx.page`
- `tools/tag-gen/utils.js`: `https://admin.da.live`
- `tools/tag-audit/utils.js`: `https://admin.da.live`

**Issue:** Hardcoded URLs scattered across codebase, difficult to change for different environments.

**Solution:** Create API configuration module:
```javascript
// tools/shared/api-config.js
export const API_BASE_URLS = {
  DA_SOURCE: 'https://admin.da.live',
  HLX_ADMIN: 'https://admin.hlx.page',
  DEEPL_PROXY: 'https://deepl-proxy.h-minst.workers.dev',
};
```

**Impact:** Single source of truth for API endpoints, easier environment switching.

---

### 3. Break Down Large File: `language-rollout.js`
**Location:** `tools/language-rollout/language-rollout.js` (1172 lines)

**Issue:** Single file with too many responsibilities:
- Translation logic
- Tree crawling
- Page copying
- UI management
- Progress tracking
- Results display

**Solution:** Split into modules:
```
tools/language-rollout/
  ├── language-rollout.js (main entry, orchestration)
  ├── modules/
  │   ├── translation.js (translateText, translateHTML)
  │   ├── page-operations.js (copyPage, copyPageTree)
  │   ├── tree-operations.js (previewPageTree, buildTreeStructure)
  │   ├── ui-manager.js (progress, results - use shared)
  │   └── form-handler.js (handleRollout, form validation)
```

**Impact:** Better maintainability, easier testing, clearer separation of concerns.

---

## 🟡 Medium Priority

### 4. Create API Client Abstraction
**Location:** Multiple files with similar fetch patterns

**Issue:** Repeated fetch patterns with similar error handling:
```javascript
const opts = getOpts(token, 'POST');
const resp = await fetch(url, opts);
if (!resp.ok) { /* error handling */ }
```

**Solution:** Create API client class:
```javascript
// tools/shared/api-client.js
export class APIClient {
  constructor(token, baseUrl) { ... }
  async get(path) { ... }
  async post(path, data) { ... }
  async head(path) { ... }
  async put(path, data) { ... }
}
```

**Impact:** Consistent error handling, easier to add retry logic, request/response logging.

---

### 5. Extract Tree Operations to Shared Module
**Location:** `tools/language-rollout/language-rollout.js` and `tools/tree-publish/tree-publish.js`

**Issue:** Similar tree checkbox handling logic:
- `getChildCheckboxes()`
- `getParentCheckbox()`
- `updateParentCheckbox()`
- `handleFolderCheckboxChange()`
- `handleFileCheckboxChange()`

**Solution:** Already partially done in `publish-utils.js`, but checkbox handling could be extracted:
```javascript
// tools/shared/tree-checkbox-manager.js
export class TreeCheckboxManager {
  constructor(container) { ... }
  getChildCheckboxes(nodePath) { ... }
  getParentCheckbox(nodePath) { ... }
  updateParentCheckbox(checkbox) { ... }
}
```

**Impact:** Reusable tree checkbox logic, consistent behavior.

---

### 6. Standardize Error Handling
**Location:** Throughout codebase

**Issue:** Inconsistent error handling patterns:
- Some functions return `{ success: false, error: ... }`
- Some throw errors
- Some return `null` or `false`
- Some log and continue silently

**Solution:** Create error handling utilities:
```javascript
// tools/shared/error-handler.js
export class APIError extends Error { ... }
export function handleAPIError(error, context) { ... }
export function createErrorResponse(message, status) { ... }
```

**Impact:** Consistent error handling, better debugging, user-friendly error messages.

---

### 7. Extract Magic Numbers and Strings
**Location:** Throughout codebase

**Issues Found:**
- Progress state reset values hardcoded
- Status codes: `200`, `400`, `500`
- HTTP methods: `'GET'`, `'POST'`, `'HEAD'`
- Selector strings repeated

**Solution:** Create constants module:
```javascript
// tools/shared/constants.js
export const HTTP_METHODS = { GET: 'GET', POST: 'POST', HEAD: 'HEAD' };
export const HTTP_STATUS = { OK: 200, BAD_REQUEST: 400, SERVER_ERROR: 500 };
export const PROGRESS_STATE_DEFAULT = { total: 0, completed: 0, failed: 0, ... };
```

**Impact:** Easier to maintain, reduces typos, self-documenting code.

---

## 🟢 Low Priority

### 8. Extract Language Configuration
**Location:** `tools/language-rollout/language-rollout.js` and `tools/deepl-proxy/server.js`

**Issue:** Language arrays defined in multiple places:
- `LANGUAGES` array in `language-rollout.js`
- `LANGUAGE_MAP` in `deepl-proxy/server.js` and `worker.js`

**Solution:** Create shared language configuration:
```javascript
// tools/shared/languages.js
export const LANGUAGES = [ ... ];
export const LANGUAGE_MAP = { ... };
export function mapToDeepLCode(langCode) { ... }
```

**Impact:** Single source of truth for language configuration.

---

### 9. Improve Function Naming and Documentation
**Location:** Throughout codebase

**Issues:**
- Some functions have unclear names
- Missing JSDoc comments
- Inconsistent parameter naming

**Solution:** Add JSDoc comments, rename unclear functions:
```javascript
/**
 * Copies a single page from source to target path
 * @param {string} sourcePath - Source page path
 * @param {string} targetPath - Target page path
 * @param {string} token - Authentication token
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
```

**Impact:** Better code documentation, easier onboarding.

---

### 10. Extract Validation Logic
**Location:** `tools/language-rollout/language-rollout.js`

**Issue:** Form validation scattered throughout code

**Solution:** Create validation utilities:
```javascript
// tools/shared/validation.js
export function validateSourcePath(path) { ... }
export function validateLanguageCode(code) { ... }
export function validateForm(formData) { ... }
```

**Impact:** Reusable validation, consistent error messages.

---

### 11. Extract Logging Utility
**Location:** Throughout codebase (228 console.log/error/warn statements)

**Issue:** Direct console usage makes it hard to:
- Control log levels
- Disable logging in production
- Format logs consistently
- Add log metadata

**Solution:** Create logging utility:
```javascript
// tools/shared/logger.js
export const logger = {
  debug: (msg, ...args) => { if (DEBUG) console.log(...) },
  info: (msg, ...args) => console.log(...),
  warn: (msg, ...args) => console.warn(...),
  error: (msg, ...args) => console.error(...),
};
```

**Impact:** Better log management, easier debugging, production-ready logging.

---

### 12. Extract DOM Query Utilities
**Location:** Multiple files (75+ direct DOM queries)

**Issue:** Repeated patterns:
```javascript
document.getElementById('progress-section')
document.querySelector('button[type="submit"]')
```

**Solution:** Create DOM utilities:
```javascript
// tools/shared/dom-utils.js
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);
export const $id = (id) => document.getElementById(id);
```

**Impact:** Shorter, more readable code, consistent DOM access patterns.

---

### 13. Reduce Excessive Console Logging
**Location:** `tools/language-rollout/language-rollout.js` (49 console statements)

**Issue:** Too many debug logs in production code:
- Lines 402-425 have 6+ console.log statements
- Makes it hard to find actual errors
- Performance impact in production

**Solution:** 
- Use logger utility with log levels
- Remove or conditionally enable debug logs
- Keep only essential error/warning logs

**Impact:** Cleaner console output, better performance, easier debugging.

---

## 📊 Summary Statistics

- **Total duplicate code identified:** ~300+ lines
- **Large files (>500 lines):** 2 files
  - `language-rollout.js`: 1,171 lines
  - `tree-publish.js`: 535 lines
- **Hardcoded URLs:** 8+ instances
- **Duplicate functions:** 5+ function sets
- **Console statements:** 228 instances
- **Direct DOM queries:** 75+ instances
- **Missing abstractions:** 8+ opportunities

## 🎯 Recommended Refactoring Order

1. **Phase 1:** Extract API URLs and constants (Quick win, low risk)
2. **Phase 2:** Extract shared UI utilities (High impact, medium risk)
3. **Phase 3:** Break down `language-rollout.js` (High impact, higher risk)
4. **Phase 4:** Create API client abstraction (Medium impact, medium risk)
5. **Phase 5:** Standardize error handling (Medium impact, low risk)
6. **Phase 6:** Extract tree operations (Low impact, low risk)

## ✅ Benefits

- **Maintainability:** Easier to update and fix bugs
- **Testability:** Smaller, focused modules are easier to test
- **Reusability:** Shared utilities reduce duplication
- **Consistency:** Standardized patterns across codebase
- **Documentation:** Better code organization improves understanding


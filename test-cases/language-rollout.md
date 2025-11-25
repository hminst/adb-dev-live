# Language Rollout Tool - Test Cases

**Last Updated:** 2025-11-25

## Overview
Test cases for the language-rollout tool that can be executed using Playwright MCP. Each test case includes step-by-step instructions with element selectors and expected outcomes.

## Test Environment
- Base URL: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
- All interactions occur within an iframe

## Test Case 1: Basic Single Language Rollout (No Translation, No Push)

### Objective
Verify basic rollout functionality for a single language without translation or publishing.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Take snapshot
4. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
5. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
6. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
7. Wait for scan to complete (10 seconds)
8. Take snapshot
9. Verify tree preview is displayed
10. Verify pages are listed with checkboxes
11. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
12. Verify selection count shows correct number
13. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
14. Wait for processing (30 seconds)
15. Take snapshot
16. Verify results section is displayed
17. Verify success message appears
18. Verify statistics show correct counts

### Expected Results
- Tree preview displays all pages from `/fragments`
- All pages are selected after "Select All"
- Rollout completes successfully
- Results show: Total Pages, Copied, Failed counts
- No translation or push operations occur

---

## Test Case 2: Multi-Language Rollout with Translation and Push to Preview

### Objective
Verify multi-language rollout with translation enabled and push to preview.

### Prerequisites
- DeepL proxy server must be running on port 3001

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Take snapshot
4. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
5. Select multiple target languages: `iframe` → `listbox[name="Target Languages"]` → `['de', 'es']` (multi-select)
6. Check "Translate content to target language": `iframe` → `checkbox[name="Translate content to target language"]`
7. Check "Push to preview": `iframe` → `checkbox[name="Push to preview"]`
8. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
9. Wait for scan to complete (10 seconds)
10. Take snapshot
11. Verify tree preview shows existence indicators for both languages (DE and ES badges)
12. Verify warning message about existing pages (if applicable)
13. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
14. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
15. Monitor progress messages (wait 5 seconds initially)
16. Take snapshot
17. Verify progress shows language-specific messages: `[DE] Translating & copying X/Y` or `[ES] Translating & copying X/Y`
18. Wait for completion (60 seconds for translation)
19. Take snapshot
20. Verify results section displays
21. Verify summary shows: "Successfully copied X pages across 2 languages (DE: X/Y, ES: X/Y)"
22. Verify translation status: "All content was translated to target languages"
23. Verify push status: "Pushed X/X to preview"
24. Verify statistics include:
    - Languages: 2 (DE, ES)
    - Total Pages: correct count
    - Copied: correct count
    - Failed: 0
    - Translation: Enabled ✓
    - Pushed to Preview: correct count

### Expected Results
- Both languages are processed sequentially
- Progress messages show current language being processed
- All pages are translated successfully
- All pages are pushed to preview successfully
- Results display comprehensive summary with per-language breakdown

---

## Test Case 3: Multi-Language Rollout with Push to Live

### Objective
Verify multi-language rollout with push to live (publish) functionality.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select multiple target languages: `iframe` → `listbox[name="Target Languages"]` → `['de', 'es']`
5. Check "Push to live (publish)": `iframe` → `checkbox[name="Push to live (publish)"]`
6. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
7. Wait for scan to complete (10 seconds)
8. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
9. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
10. Wait for completion (30 seconds)
11. Take snapshot
12. Verify results show separate counts for:
    - Pushed to Preview (if checked)
    - Pushed to Live: correct count
    - Live Push Failed: 0 (if successful)

### Expected Results
- Pages are published to live environment
- Results show separate statistics for preview and live pushes
- Success message indicates live publishing status

---

## Test Case 4: Partial Page Selection

### Objective
Verify rollout works with only selected pages, not all pages.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
5. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Manually select only first 3 file checkboxes (not using "Select All")
8. Verify selection count shows "3 pages selected"
9. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
10. Wait for completion (15 seconds)
11. Take snapshot
12. Verify results show only 3 pages processed

### Expected Results
- Only selected pages are processed
- Selection count is accurate
- Results reflect only the selected pages

---

## Test Case 5: Folder Selection (Cascading)

### Objective
Verify that selecting a folder checkbox selects all child pages.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
5. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Find a folder checkbox (e.g., `checkbox` with label containing "📁 nav")
8. Click the folder checkbox
9. Verify all child file checkboxes under that folder are selected
10. Verify parent folder checkbox shows checked state
11. Click folder checkbox again to deselect
12. Verify all child checkboxes are deselected

### Expected Results
- Selecting a folder selects all its children
- Deselecting a folder deselects all its children
- Selection count updates correctly

---

## Test Case 6: Deselect All Functionality

### Objective
Verify "Deselect All" button works correctly.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
5. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
8. Verify all checkboxes are selected
9. Click "Deselect All" button: `iframe` → `button[name="☐ Deselect All"]`
10. Verify all checkboxes are deselected
11. Verify selection count shows "0 pages selected"

### Expected Results
- All checkboxes are deselected
- Selection count resets to 0
- Rollout button should be disabled or show error if clicked with no selection

---

## Test Case 7: Refresh Scan Functionality

### Objective
Verify refresh scan button updates the tree preview.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
5. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Take snapshot (note current state)
8. Click "Refresh" button: `iframe` → `button[name="🔄 Refresh"]`
9. Wait for scan to complete again (10 seconds)
10. Take snapshot
11. Verify tree preview is updated
12. Verify selection state is preserved (if applicable)

### Expected Results
- Tree preview is refreshed
- Current selections may be preserved or reset (implementation dependent)

---

## Test Case 8: Error Handling - Missing Source Path

### Objective
Verify error handling when source path is not provided.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
4. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
5. Verify error message or alert appears
6. Check console for error messages

### Expected Results
- Error message displayed
- Scan does not proceed
- User is prompted to enter source path

---

## Test Case 9: Error Handling - No Language Selected

### Objective
Verify error handling when no target language is selected.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
5. Verify error message or alert appears
6. Check console for error messages

### Expected Results
- Error message displayed
- Scan does not proceed
- User is prompted to select at least one language

---

## Test Case 10: Existence Indicators for Multiple Languages

### Objective
Verify that existence indicators show correctly for all selected languages in the tree preview.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select multiple target languages: `iframe` → `listbox[name="Target Languages"]` → `['de', 'es', 'fr']`
5. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Take snapshot
8. Verify each file in tree shows language badges for DE, ES, FR
9. Verify existing pages show warning badges (⚠️)
10. Verify summary shows: "DE: X new, Y existing | ES: X new, Y existing | FR: X new, Y existing"

### Expected Results
- All selected languages are shown in existence indicators
- Warning badges appear for existing pages
- Summary shows breakdown for each language

---

## Test Case 11: Progress Display During Multi-Language Rollout

### Objective
Verify progress display shows correct information during multi-language processing.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select multiple target languages: `iframe` → `listbox[name="Target Languages"]` → `['de', 'es']`
5. Check "Translate content to target language": `iframe` → `checkbox[name="Translate content to target language"]`
6. Check "Push to preview": `iframe` → `checkbox[name="Push to preview"]`
7. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
8. Wait for scan to complete (10 seconds)
9. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
10. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
11. Monitor progress section (check every 5 seconds)
12. Verify progress text shows:
    - Language prefix: `[DE]` or `[ES]`
    - Action: "Translating & copying" or "Copying"
    - Current page: "X/Y"
    - Page path
13. Verify progress bar updates
14. Verify button shows "Processing..." and is disabled
15. Wait for completion
16. Verify progress section is hidden
17. Verify button is re-enabled

### Expected Results
- Progress messages are language-specific
- Progress bar updates smoothly
- Button state changes correctly
- Progress section hides on completion

---

## Test Case 12: Results Display Format

### Objective
Verify results display shows all required information in correct format.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
4. Select multiple target languages: `iframe` → `listbox[name="Target Languages"]` → `['de', 'es']`
5. Check "Translate content to target language": `iframe` → `checkbox[name="Translate content to target language"]`
6. Check "Push to preview": `iframe` → `checkbox[name="Push to preview"]`
7. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
8. Wait for scan to complete (10 seconds)
9. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
10. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
11. Wait for completion (60 seconds)
12. Take snapshot
13. Verify results section contains:
    - Success icon (✅)
    - Title: "Rollout Successful"
    - Summary text with language breakdown
    - Statistics section with:
      - Languages: count and list
      - Total Pages: number
      - Copied: number
      - Failed: number
      - Translation: status
      - Pushed to Preview: number (if enabled)
      - Pushed to Live: number (if enabled)
14. Verify "View Details" expandable section exists (if applicable)
15. Click "View Details" if present
16. Verify detailed list of processed pages

### Expected Results
- Results section is visible and well-formatted
- All statistics are accurate
- Summary includes language-specific breakdown
- Details section shows individual page results

---

## Test Case 13: Console Error Checking

### Objective
Verify no JavaScript errors occur during normal operation.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/language-rollout/language-rollout?ref=local`
2. Wait for page load (3 seconds)
3. Check console messages for errors
4. Fill source path: `iframe` → `textbox[name="Source Path"]` → `/fragments`
5. Select target language: `iframe` → `listbox[name="Target Languages"]` → `de`
6. Click "Scan Directory" button: `iframe` → `button[name="Scan Directory"]`
7. Wait for scan to complete (10 seconds)
8. Check console messages for errors
9. Click "Select All" button: `iframe` → `button[name="☑️ Select All"]`
10. Click "Rollout" button: `iframe` → `button[name="Rollout"]`
11. Wait for completion (30 seconds)
12. Check console messages for errors
13. Verify no ERROR level messages in console

### Expected Results
- No JavaScript errors in console
- Only INFO/LOG level messages (if any)
- All operations complete without errors

---

## Notes for Test Execution

### Playwright MCP Commands Reference
- `browser_navigate`: Navigate to URL
- `browser_wait_for`: Wait for time or text
- `browser_snapshot`: Capture page state
- `browser_type`: Type into textbox
- `browser_select_option`: Select from dropdown
- `browser_click`: Click button/checkbox
- `browser_evaluate`: Execute JavaScript
- `browser_console_messages`: Get console logs

### Element Selectors
All selectors should be prefixed with `iframe` → to target elements within the iframe:
- Textboxes: `iframe` → `textbox[name="Source Path"]`
- Listboxes: `iframe` → `listbox[name="Target Languages"]`
- Checkboxes: `iframe` → `checkbox[name="Translate content to target language"]`
- Buttons: `iframe` → `button[name="Scan Directory"]`

### Timing Considerations
- Page load: 3 seconds
- Directory scan: 10 seconds
- Rollout without translation: 30 seconds
- Rollout with translation: 60+ seconds (depends on number of pages)

### Test Data
- Source path: `/fragments` (contains multiple pages for testing)
- Target languages: `de`, `es`, `fr` (German, Spanish, French)


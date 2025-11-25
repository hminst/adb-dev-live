# Tree Preview & Publish Tool - Test Cases

**Last Updated:** 2025-11-25

## Overview
Test cases for the tree-publish tool that can be executed using Playwright MCP. Each test case includes step-by-step instructions with element selectors and expected outcomes.

## Test Environment
- Base URL: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
- **Note:** The tool runs within a cross-origin iframe (`http://localhost:3000` inside `https://da.live`)
- **Limitation:** Playwright MCP cannot directly access cross-origin iframe content due to browser security restrictions
- **Workaround:** Use Playwright's frame handling or navigate directly to the iframe URL for automated testing

## Test Case 1: Basic Publish to Preview (Single Action)

### Objective
Verify basic publish functionality to preview environment only.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Take snapshot
4. Fill source path: `textbox[name="Source Path"]` → `/fragments`
5. Check "Push to preview": `checkbox[name="Push to preview"]`
6. Click "Scan Directory" button: `button[name="Scan Directory"]`
7. Wait for scan to complete (10 seconds)
8. Take snapshot
9. Verify tree preview is displayed
10. Verify pages are listed with checkboxes
11. Click "Select All" button: `button[name="☑️ Select All"]`
12. Verify selection count shows correct number
13. Click "Publish" button: `button[name="Publish"]`
14. Wait for processing (30 seconds)
15. Take snapshot
16. Verify results section is displayed
17. Verify success message appears
18. Verify statistics show correct counts

### Expected Results
- Tree preview displays all pages from `/fragments`
- All pages are selected after "Select All"
- Publish completes successfully
- Results show: Total Pages, Successful, Failed counts
- Only preview push operations occur
- No live publish operations occur

---

## Test Case 2: Basic Publish to Live (Single Action)

### Objective
Verify basic publish functionality to live environment only.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to live (publish)": `checkbox[name="Push to live (publish)"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Click "Select All" button: `button[name="☑️ Select All"]`
8. Click "Publish" button: `button[name="Publish"]`
9. Wait for processing (30 seconds)
10. Take snapshot
11. Verify results section displays
12. Verify success message appears
13. Verify statistics show:
    - Total Pages: correct count
    - Successful: correct count
    - Failed: 0 (if successful)

### Expected Results
- Pages are published to live environment
- Results show separate statistics for live pushes
- Success message indicates live publishing status
- No preview push operations occur

---

## Test Case 3: Publish to Both Preview and Live

### Objective
Verify publish functionality to both preview and live environments simultaneously.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Check "Push to live (publish)": `checkbox[name="Push to live (publish)"]`
6. Click "Scan Directory" button: `button[name="Scan Directory"]`
7. Wait for scan to complete (10 seconds)
8. Click "Select All" button: `button[name="☑️ Select All"]`
9. Click "Publish" button: `button[name="Publish"]`
10. Wait for processing (30 seconds)
11. Take snapshot
12. Verify results show:
    - Summary mentions both preview and live
    - Statistics show correct counts for both actions
    - Details show success indicators for both preview and live

### Expected Results
- Pages are published to both preview and live
- Results show combined statistics
- Success message indicates both actions completed
- Details show status for both preview and live pushes

---

## Test Case 4: Partial Page Selection

### Objective
Verify publish works with only selected pages, not all pages.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Manually select only first 3 file checkboxes (not using "Select All")
8. Verify selection count shows "3 pages selected"
9. Click "Publish" button: `button[name="Publish"]`
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
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Find a folder checkbox (e.g., `checkbox` with label containing "📁 nav")
8. Click the folder checkbox
9. Verify all child file checkboxes under that folder are selected
10. Verify parent folder checkbox shows checked state
11. Verify selection count updates correctly
12. Click folder checkbox again to deselect
13. Verify all child checkboxes are deselected
14. Verify selection count resets appropriately

### Expected Results
- Selecting a folder selects all its children
- Deselecting a folder deselects all its children
- Selection count updates correctly
- Parent checkbox shows indeterminate state when some children are selected

---

## Test Case 6: Deselect All Functionality

### Objective
Verify "Deselect All" button works correctly.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Click "Select All" button: `button[name="☑️ Select All"]`
8. Verify all checkboxes are selected
9. Click "Deselect All" button: `button[name="☐ Deselect All"]`
10. Verify all checkboxes are deselected
11. Verify selection count shows "0 pages selected"
12. Verify selection summary is hidden

### Expected Results
- All checkboxes are deselected
- Selection count resets to 0
- Selection summary is hidden when count is 0
- Publish button should show error if clicked with no selection

---

## Test Case 7: Refresh Scan Functionality

### Objective
Verify refresh scan button updates the tree preview.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Take snapshot (note current state)
8. Click "Refresh" button: `button[name="🔄 Refresh"]`
9. Wait for scan to complete again (10 seconds)
10. Take snapshot
11. Verify tree preview is updated
12. Verify selection state is reset (all checkboxes unchecked)

### Expected Results
- Tree preview is refreshed
- Selection state is reset after refresh
- Publish button is hidden until new selection is made

---

## Test Case 8: Error Handling - Missing Source Path

### Objective
Verify error handling when source path is not provided.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Check "Push to preview": `checkbox[name="Push to preview"]`
4. Click "Scan Directory" button: `button[name="Scan Directory"]`
5. Verify error message or alert appears
6. Check console for error messages

### Expected Results
- Error message displayed: "Please enter a source path"
- Scan does not proceed
- User is prompted to enter source path

---

## Test Case 9: Error Handling - No Action Selected

### Objective
Verify error handling when no action (preview or live) is selected.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Click "Scan Directory" button: `button[name="Scan Directory"]`
5. Wait for scan to complete (10 seconds)
6. Click "Select All" button: `button[name="☑️ Select All"]`
7. Click "Publish" button: `button[name="Publish"]`
8. Verify error message appears in results section
9. Check console for error messages

### Expected Results
- Error message displayed: "Please select at least one action (Preview or Live)"
- Publish does not proceed
- Results section shows warning/error message
- User is prompted to select an action

---

## Test Case 10: Error Handling - No Pages Selected

### Objective
Verify error handling when no pages are selected for publishing.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Verify no checkboxes are selected (do not click "Select All")
8. Click "Publish" button: `button[name="Publish"]`
9. Verify error message appears in results section
10. Check console for error messages

### Expected Results
- Error message displayed: "No pages selected"
- Publish does not proceed
- Results section shows warning message
- User is prompted to select at least one page

---

## Test Case 11: Empty Directory Handling

### Objective
Verify behavior when scanning a directory with no HTML pages.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/empty-directory` (or a path with no HTML files)
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Take snapshot
8. Verify empty message is displayed: "No HTML pages found in this directory."

### Expected Results
- Empty directory message is displayed
- Tree preview shows empty state
- Publish button remains hidden
- No error occurs

---

## Test Case 12: Progress Display During Publish

### Objective
Verify progress display shows correct information during publishing.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Click "Select All" button: `button[name="☑️ Select All"]`
8. Click "Publish" button: `button[name="Publish"]`
9. Monitor progress section (check every 5 seconds)
10. Verify progress text shows:
    - Current page: "Processing X/Y"
    - File name
11. Verify progress bar updates
12. Verify button shows "Publishing..." and is disabled
13. Wait for completion
14. Verify progress section is hidden
15. Verify button is re-enabled

### Expected Results
- Progress messages show current page being processed
- Progress bar updates smoothly
- Button state changes correctly
- Progress section hides on completion
- Button text returns to "Publish"

---

## Test Case 13: Results Display Format

### Objective
Verify results display shows all required information in correct format.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Click "Select All" button: `button[name="☑️ Select All"]`
8. Click "Publish" button: `button[name="Publish"]`
9. Wait for completion (30 seconds)
10. Take snapshot
11. Verify results section contains:
    - Success icon (✅) or warning icon (⚠️)
    - Title: "Publish Successful" or "Publish Completed with Errors"
    - Summary text with action details
    - Statistics section with:
      - Total Pages: number
      - Successful: number
      - Failed: number
12. Verify details section shows individual page results (if failures occurred)

### Expected Results
- Results section is visible and well-formatted
- All statistics are accurate
- Summary includes action details (preview/live)
- Details section shows individual page results when applicable

---

## Test Case 14: Publish with Failures

### Objective
Verify error handling and reporting when some pages fail to publish.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Fill source path: `textbox[name="Source Path"]` → `/fragments`
4. Check "Push to preview": `checkbox[name="Push to preview"]`
5. Click "Scan Directory" button: `button[name="Scan Directory"]`
6. Wait for scan to complete (10 seconds)
7. Click "Select All" button: `button[name="☑️ Select All"]`
8. Click "Publish" button: `button[name="Publish"]`
9. Wait for completion (30 seconds)
10. Take snapshot
11. If failures occur, verify:
    - Results show warning icon (⚠️)
    - Title: "Publish Completed with Errors"
    - Summary shows successful and failed counts
    - Details section lists failed pages with error information

### Expected Results
- Failures are properly reported
- Results distinguish between successful and failed pages
- Error details are provided for failed pages
- Statistics accurately reflect success/failure counts

---

## Test Case 15: Console Error Checking

### Objective
Verify no JavaScript errors occur during normal operation.

### Steps
1. Navigate to: `https://da.live/app/hminst/adb-dev-live/tools/tree-publish/tree-publish?ref=local`
2. Wait for page load (3 seconds)
3. Check console messages for errors
4. Fill source path: `textbox[name="Source Path"]` → `/fragments`
5. Check "Push to preview": `checkbox[name="Push to preview"]`
6. Click "Scan Directory" button: `button[name="Scan Directory"]`
7. Wait for scan to complete (10 seconds)
8. Check console messages for errors
9. Click "Select All" button: `button[name="☑️ Select All"]`
10. Click "Publish" button: `button[name="Publish"]`
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
All selectors target elements directly (no iframe):
- Textboxes: `textbox[name="Source Path"]`
- Checkboxes: `checkbox[name="Push to preview"]`, `checkbox[name="Push to live (publish)"]`
- Buttons: `button[name="Scan Directory"]`, `button[name="Publish"]`, `button[name="☑️ Select All"]`, `button[name="☐ Deselect All"]`, `button[name="🔄 Refresh"]`

### Timing Considerations
- Page load: 3 seconds
- Directory scan: 10 seconds
- Publish to preview: 30 seconds
- Publish to live: 30 seconds
- Publish to both: 30-60 seconds (depends on number of pages)

### Test Data
- Source path: `/fragments` (contains multiple pages for testing)
- Alternative paths: `/empty-directory` (for empty directory test)

### Key Differences from Language Rollout
- No iframe - all interactions are direct
- No language selection
- No translation functionality
- Simpler workflow: scan → select → publish
- Single source path (no target language paths)


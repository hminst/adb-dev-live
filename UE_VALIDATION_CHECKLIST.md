# Universal Editor Validation Checklist

## Test URL
https://experience.adobe.com/#/@valtechsaemeaptrsd/aem/editor/canvas/main--adb-dev-live--hminst.ue.da.page/de/test

## Component Definitions Status

### ✅ Blocks with Definitions
- [x] Accordion (with accordion-item)
- [x] Card
- [x] Carousel (with carousel-item)
- [x] Columns (with columns-row and columns-cell)
- [x] Fragment
- [x] Hero
- [x] Schedule
- [x] Section Metadata
- [x] Table
- [x] YouTube

### ✅ Default Content
- [x] Text
- [x] Image
- [x] Section

## Validation Steps

### 1. Page Loading
- [ ] Universal Editor loads without errors
- [ ] Page content displays correctly
- [ ] No console errors related to component definitions

### 2. Component Selection
- [ ] Click on a card block - properties panel opens
- [ ] Click on accordion - properties panel opens
- [ ] Click on carousel - properties panel opens
- [ ] Click on hero - properties panel opens
- [ ] Click on other blocks - properties panel opens

### 3. Card Block Editing
- [ ] Image field is editable (reference picker works)
- [ ] Image Alt text field is editable
- [ ] **Richtext content field is editable** (div:nth-child(1)>div:nth-child(2))
- [ ] Changes save correctly
- [ ] Changes reflect in preview

### 4. Accordion Block Editing
- [ ] Can add new accordion items using + button
- [ ] Summary field (div:nth-child(1)) is editable
- [ ] Text field (div:nth-child(2)) is editable
- [ ] Changes save correctly

### 5. Carousel Block Editing
- [ ] Can add new carousel slides using + button
- [ ] Background Image field is editable
- [ ] Text field is editable
- [ ] Changes save correctly

### 6. Hero Block Editing
- [ ] Image field is editable
- [ ] Alt text field is editable
- [ ] Text field (h1) is editable
- [ ] Changes save correctly

### 7. Adding New Blocks
- [ ] Click + button in section
- [ ] Block picker shows all defined blocks
- [ ] Can add new card block
- [ ] Can add new accordion block
- [ ] Can add new carousel block
- [ ] New blocks appear with correct structure

### 8. Content Tree
- [ ] Content tree panel shows all blocks
- [ ] Blocks are properly named (not "(no definition)")
- [ ] Can navigate through content tree
- [ ] Selecting items in tree highlights them on canvas

## Known Issues to Check

### Card Richtext Editing
**Current Model Selector:** `div:nth-child(1)>div:nth-child(2)`

**Card Structure (before decoration):**
```
<div class="card">
  <div>
    <picture>...</picture>  <!-- div:nth-child(1) -->
    <div>richtext content</div>  <!-- div:nth-child(2) -->
  </div>
</div>
```

**If richtext is not editable:**
1. Check browser console for CSS selector errors
2. Inspect the actual DOM structure in Universal Editor
3. Check network tab for `/details` API call - it shows the parsed structure
4. Update CSS selector in `ue/models/blocks/card.json` if needed
5. Run `npm run build:json` and push changes

## Troubleshooting

### Component definitions not loading
- Check if files are accessible: `curl https://main--adb-dev-live--hminst.ue.da.page/component-definition.json`
- Verify JSON syntax is valid
- Check browser console for CORS or 404 errors

### Properties panel empty
- Check if model CSS selectors match actual DOM structure
- Use browser dev tools to inspect `/details` API response
- Verify field `name` attributes use correct CSS selectors

### Changes not saving
- Check browser console for save errors
- Verify network requests complete successfully
- Check if content is published/committed

## Next Steps After Validation

1. Document any issues found
2. Update CSS selectors in `ue/models/blocks/*.json` files as needed
3. Rebuild JSON files: `npm run build:json`
4. Commit and push changes
5. Re-test after deployment syncs

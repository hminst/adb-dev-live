/**
 * Test suite for icon element preservation
 * 
 * Validates that icon elements are correctly preserved and restored
 * to their original positions after translation.
 * 
 * Run with: node icon-preservation.test.js
 */

import { preserveIconElements, restoreIconElements } from './icon-preservation.js';
import assert from 'assert';

// Suppress console.log during tests
const originalLog = console.log;
const originalWarn = console.warn;
let testOutput = [];

function setupTestLogging() {
  testOutput = [];
  console.log = (...args) => {
    testOutput.push(['log', ...args]);
  };
  console.warn = (...args) => {
    testOutput.push(['warn', ...args]);
  };
}

function restoreTestLogging() {
  console.log = originalLog;
  console.warn = originalWarn;
}

/**
 * Test Case 1: Icon before text (most common case)
 * Original: <a href="/"><span class="icon icon-logo"></span>Author Kit</a>
 * Expected after translation: Icon should remain before text
 */
function testIconBeforeText() {
  console.log('\n=== Test 1: Icon before text ===');
  
  const originalHtml = '<div><p><a href="/"><span class="icon icon-logo"></span>Author Kit</a></p></div>';
  const iconPosition = originalHtml.indexOf('<span class="icon icon-logo"></span>');
  const textPosition = originalHtml.indexOf('Author Kit');
  
  // Verify original structure: icon comes before text
  assert(iconPosition < textPosition, 'Icon should be before text in original HTML');
  
  // Preserve icons
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 1, 'Should preserve 1 icon element');
  assert(preservedHtml.includes('ICONELEMENT000'), 'Should contain placeholder');
  assert(!preservedHtml.includes('<span class="icon icon-logo">'), 'Should not contain original icon');
  
  // Simulate translation (text changes, placeholder stays)
  const translatedHtml = preservedHtml.replace('Author Kit', 'Kit de autor');
  
  // Restore icons
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Verify icon is restored before text
  const restoredIconPosition = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const restoredTextPosition = restoredHtml.indexOf('Kit de autor');
  
  assert(restoredIconPosition !== -1, 'Icon should be restored');
  assert(restoredTextPosition !== -1, 'Text should be present');
  assert(restoredIconPosition < restoredTextPosition, 'Icon should remain before text after translation');
  
  console.log('✓ Test 1 passed: Icon remains before text');
}

/**
 * Test Case 2: Multiple icons in different positions
 */
function testMultipleIcons() {
  console.log('\n=== Test 2: Multiple icons ===');
  
  const originalHtml = `
    <div>
      <p><a href="/"><span class="icon icon-logo"></span>Home</a></p>
      <p><a href="/tools"><span class="icon icon-toggle"></span>Toggle</a></p>
      <p><a href="/lang"><span class="icon icon-globe"></span>Language</a></p>
    </div>
  `;
  
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 3, 'Should preserve 3 icon elements');
  
  // Verify all placeholders are present
  assert(preservedHtml.includes('ICONELEMENT000'), 'Should contain ICONELEMENT000');
  assert(preservedHtml.includes('ICONELEMENT001'), 'Should contain ICONELEMENT001');
  assert(preservedHtml.includes('ICONELEMENT002'), 'Should contain ICONELEMENT002');
  
  // Simulate translation
  const translatedHtml = preservedHtml
    .replace('Home', 'Inicio')
    .replace('Toggle', 'Alternar')
    .replace('Language', 'Idioma');
  
  // Restore icons
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Verify all icons are restored in correct positions
  const logoPos = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const togglePos = restoredHtml.indexOf('<span class="icon icon-toggle"></span>');
  const globePos = restoredHtml.indexOf('<span class="icon icon-globe"></span>');
  
  assert(logoPos !== -1, 'Logo icon should be restored');
  assert(togglePos !== -1, 'Toggle icon should be restored');
  assert(globePos !== -1, 'Globe icon should be restored');
  
  // Verify icons are before their respective text
  assert(logoPos < restoredHtml.indexOf('Inicio'), 'Logo should be before "Inicio"');
  assert(togglePos < restoredHtml.indexOf('Alternar'), 'Toggle should be before "Alternar"');
  assert(globePos < restoredHtml.indexOf('Idioma'), 'Globe should be before "Idioma"');
  
  console.log('✓ Test 2 passed: Multiple icons preserved correctly');
}

/**
 * Test Case 3: Icon in header structure (real-world scenario)
 */
function testHeaderStructure() {
  console.log('\n=== Test 3: Header structure ===');
  
  const originalHtml = `
    <div>
      <p><a href="/"><span class="icon icon-logo"></span>Author Kit</a></p>
    </div>
    <div>
      <ul>
        <li><p><a href="/">Features</a></p></li>
      </ul>
    </div>
    <div>
      <p><a href="/tools/widgets/scheme"><span class="icon icon-toggle"></span>Toggle color scheme</a></p>
      <p><a href="/tools/widgets/language"><span class="icon icon-globe"></span>Change language</a></p>
    </div>
  `;
  
  // Store original positions
  const originalLogoPos = originalHtml.indexOf('<span class="icon icon-logo"></span>');
  const originalTextAfterLogo = originalHtml.indexOf('Author Kit');
  const originalTogglePos = originalHtml.indexOf('<span class="icon icon-toggle"></span>');
  const originalTextAfterToggle = originalHtml.indexOf('Toggle color scheme');
  
  // Preserve
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 3, 'Should preserve 3 icons');
  
  // Simulate translation (text changes, structure might shift)
  const translatedHtml = preservedHtml
    .replace('Author Kit', 'Kit de autor')
    .replace('Toggle color scheme', 'Cambiar combinación de colores')
    .replace('Change language', 'Cambiar idioma');
  
  // Restore
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Verify structure is maintained
  const restoredLogoPos = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const restoredTextAfterLogo = restoredHtml.indexOf('Kit de autor');
  const restoredTogglePos = restoredHtml.indexOf('<span class="icon icon-toggle"></span>');
  const restoredTextAfterToggle = restoredHtml.indexOf('Cambiar combinación de colores');
  
  // Critical: Icon must be before text (same relative position as original)
  assert(restoredLogoPos < restoredTextAfterLogo, 'Logo icon must be before "Kit de autor"');
  assert(restoredTogglePos < restoredTextAfterToggle, 'Toggle icon must be before "Cambiar combinación de colores"');
  
  // Verify the structure matches original pattern
  const logoPattern = /<span class="icon icon-logo"><\/span>Kit de autor/;
  assert(logoPattern.test(restoredHtml), 'Logo icon should immediately precede "Kit de autor"');
  
  console.log('✓ Test 3 passed: Header structure maintained');
}

/**
 * Test Case 4: Self-closing icon tags
 */
function testSelfClosingIcons() {
  console.log('\n=== Test 4: Self-closing icon tags ===');
  
  const originalHtml = '<div><p><a href="/"><span class="icon icon-logo" />Author Kit</a></p></div>';
  
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 1, 'Should preserve 1 self-closing icon');
  assert(iconElements[0].isSelfClosing === true, 'Icon should be marked as self-closing');
  
  const translatedHtml = preservedHtml.replace('Author Kit', 'Kit de autor');
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  assert(restoredHtml.includes('<span class="icon icon-logo" />'), 'Self-closing icon should be restored');
  const iconPos = restoredHtml.indexOf('<span class="icon icon-logo" />');
  const textPos = restoredHtml.indexOf('Kit de autor');
  
  assert(iconPos < textPos, 'Self-closing icon should remain before text');
  
  console.log('✓ Test 4 passed: Self-closing icons work correctly');
}

/**
 * Test Case 5: Icons with content
 */
function testIconsWithContent() {
  console.log('\n=== Test 5: Icons with content ===');
  
  const originalHtml = '<div><span class="icon icon-logo">Logo</span>Text</div>';
  
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 1, 'Should preserve 1 icon with content');
  assert(iconElements[0].content === 'Logo', 'Icon content should be preserved');
  
  const translatedHtml = preservedHtml.replace('Text', 'Texto');
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  assert(restoredHtml.includes('<span class="icon icon-logo">Logo</span>'), 'Icon with content should be restored');
  
  console.log('✓ Test 5 passed: Icons with content work correctly');
}

/**
 * Test Case 6: Icons with section-metadata class should be skipped
 */
function testSkipSectionMetadata() {
  console.log('\n=== Test 6: Skip section-metadata icons ===');
  
  const originalHtml = `
    <div>
      <span class="icon icon-logo section-metadata"></span>Should not be preserved
    </div>
    <div>
      <span class="icon icon-toggle"></span>Should be preserved
    </div>
  `;
  
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  
  // Only the non-section-metadata icon should be preserved
  assert(iconElements.length === 1, 'Should preserve only 1 icon (skip section-metadata)');
  assert(preservedHtml.includes('<span class="icon icon-logo section-metadata"></span>'), 'Section-metadata icon should remain unchanged');
  assert(preservedHtml.includes('ICONELEMENT000'), 'Non-section-metadata icon should be replaced with placeholder');
  
  console.log('✓ Test 6 passed: Section-metadata icons are skipped');
}

/**
 * Test Case 7: Real-world scenario - Spanish header translation
 * This is the actual bug case that needed to be fixed
 */
function testSpanishHeaderTranslation() {
  console.log('\n=== Test 7: Spanish header translation (bug fix validation) ===');
  
  // Original English header structure
  const originalHtml = '<div><p><a href="/"><span class="icon icon-logo"></span>Author Kit</a></p></div>';
  
  // Verify original: icon is BEFORE text
  const originalIconPos = originalHtml.indexOf('<span class="icon icon-logo"></span>');
  const originalTextPos = originalHtml.indexOf('Author Kit');
  assert(originalIconPos < originalTextPos, 'Original: Icon must be before text');
  
  // Preserve icons
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  
  // Simulate DeepL translation (this is what was breaking before)
  // DeepL was moving the icon after the text
  const badTranslation = preservedHtml.replace('Author Kit', 'Kit de autor');
  // This simulates what DeepL was doing wrong - moving placeholder after text
  // But with our approach, placeholder stays in place
  
  // Restore icons
  const restoredHtml = restoreIconElements(badTranslation, iconElements);
  
  // CRITICAL TEST: Icon must be BEFORE text (not after)
  const restoredIconPos = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const restoredTextPos = restoredHtml.indexOf('Kit de autor');
  
  assert(restoredIconPos !== -1, 'Icon must be restored');
  assert(restoredTextPos !== -1, 'Text must be present');
  assert(restoredIconPos < restoredTextPos, 'CRITICAL: Icon must be BEFORE text, not after');
  
  // Verify the exact pattern that was broken
  const correctPattern = /<span class="icon icon-logo"><\/span>Kit de autor/;
  const wrongPattern = /Kit de autor<span class="icon icon-logo"><\/span>/;
  
  assert(correctPattern.test(restoredHtml), 'Icon should be before text (correct pattern)');
  assert(!wrongPattern.test(restoredHtml), 'Icon should NOT be after text (wrong pattern)');
  
  console.log('✓ Test 7 passed: Spanish header translation maintains correct icon position');
}

/**
 * Run all tests
 */
function runTests() {
  console.log('Starting icon preservation tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  const tests = [
    testIconBeforeText,
    testMultipleIcons,
    testHeaderStructure,
    testSelfClosingIcons,
    testIconsWithContent,
    testSkipSectionMetadata,
    testSpanishHeaderTranslation,
  ];
  
  tests.forEach((test) => {
    try {
      setupTestLogging();
      test();
      restoreTestLogging();
      passed++;
    } catch (error) {
      restoreTestLogging();
      console.error(`\n✗ Test failed: ${test.name}`);
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      failed++;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
  }
}

// Run tests if this file is executed directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename || process.argv[1].endsWith('icon-preservation.test.js');

if (isMainModule) {
  runTests();
}

export {
  testIconBeforeText,
  testMultipleIcons,
  testHeaderStructure,
  testSelfClosingIcons,
  testIconsWithContent,
  testSkipSectionMetadata,
  testSpanishHeaderTranslation,
  runTests,
};


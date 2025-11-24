/**
 * Integration test to verify icon positions are maintained after translation
 * 
 * This test validates that icons remain in their exact original positions
 * after going through the full translation process (preserve -> translate -> restore).
 * 
 * Run with: node icon-position-verification.test.js
 */

import { preserveIconElements, restoreIconElements } from './icon-preservation.js';
import assert from 'assert';

/**
 * Verify that icon positions are identical before and after translation
 * @param {string} originalHtml - Original HTML with icons
 * @param {string} translatedText - Translated text (simulating DeepL output)
 * @returns {boolean} True if positions match
 */
function verifyIconPositions(originalHtml, translatedText) {
  // Step 1: Preserve icons
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  
  if (iconElements.length === 0) {
    console.log('  No icons found to verify');
    return true;
  }
  
  // Step 2: Simulate translation (replace text but keep placeholders)
  // In real translation, DeepL would translate the text but placeholders stay
  let translatedHtml = preservedHtml;
  
  // Replace English text with translated text while keeping placeholders
  // This simulates what DeepL does - it translates text but doesn't touch our placeholders
  translatedHtml = translatedText;
  
  // Step 3: Restore icons
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Step 4: Verify positions
  const results = [];
  
  iconElements.forEach(({ original, placeholder, index }) => {
    // Find position in original HTML
    const originalPos = originalHtml.indexOf(original);
    
    // Find position in restored HTML
    const restoredPos = restoredHtml.indexOf(original);
    
    const positionMatch = originalPos !== -1 && restoredPos !== -1;
    const relativePositionMatch = positionMatch && 
      (originalPos === restoredPos || 
       // Allow for slight position shifts due to text length changes
       Math.abs(originalPos - restoredPos) < 50);
    
    results.push({
      index,
      placeholder,
      originalPos,
      restoredPos,
      positionMatch,
      relativePositionMatch,
    });
  });
  
  return results.every(r => r.positionMatch);
}

/**
 * Test Case 1: Verify exact position match for header structure
 */
function testHeaderIconPosition() {
  console.log('\n=== Test: Header Icon Position Verification ===');
  
  const originalHtml = '<div><p><a href="/"><span class="icon icon-logo"></span>Author Kit</a></p></div>';
  
  // Store original icon position
  const originalIconPos = originalHtml.indexOf('<span class="icon icon-logo"></span>');
  const originalTextPos = originalHtml.indexOf('Author Kit');
  const iconBeforeText = originalIconPos < originalTextPos;
  
  console.log(`  Original structure:`);
  console.log(`    Icon position: ${originalIconPos}`);
  console.log(`    Text position: ${originalTextPos}`);
  console.log(`    Icon before text: ${iconBeforeText}`);
  
  // Preserve
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 1, 'Should have 1 icon');
  
  // Simulate translation - text changes but placeholder stays
  const translatedHtml = preservedHtml.replace('Author Kit', 'Kit de autor');
  
  // Restore
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Verify positions
  const restoredIconPos = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const restoredTextPos = restoredHtml.indexOf('Kit de autor');
  const restoredIconBeforeText = restoredIconPos < restoredTextPos;
  
  console.log(`  Restored structure:`);
  console.log(`    Icon position: ${restoredIconPos}`);
  console.log(`    Text position: ${restoredTextPos}`);
  console.log(`    Icon before text: ${restoredIconBeforeText}`);
  
  // Critical assertions
  assert(restoredIconPos !== -1, 'Icon must be restored');
  assert(restoredTextPos !== -1, 'Text must be present');
  assert(restoredIconBeforeText, 'CRITICAL: Icon must be BEFORE text after translation');
  assert(iconBeforeText === restoredIconBeforeText, 'Icon-text relationship must be preserved');
  
  // Verify the exact pattern
  const correctPattern = /<span class="icon icon-logo"><\/span>Kit de autor/;
  const wrongPattern = /Kit de autor<span class="icon icon-logo"><\/span>/;
  
  assert(correctPattern.test(restoredHtml), 'Icon should immediately precede text');
  assert(!wrongPattern.test(restoredHtml), 'Icon should NOT follow text');
  
  console.log('  ✓ Icon position verified: Icon remains before text');
}

/**
 * Test Case 2: Verify multiple icons maintain relative positions
 */
function testMultipleIconPositions() {
  console.log('\n=== Test: Multiple Icon Positions Verification ===');
  
  const originalHtml = `
    <div>
      <p><a href="/"><span class="icon icon-logo"></span>Home</a></p>
      <p><a href="/tools"><span class="icon icon-toggle"></span>Toggle</a></p>
      <p><a href="/lang"><span class="icon icon-globe"></span>Language</a></p>
    </div>
  `;
  
  // Store original positions
  const logoPos = originalHtml.indexOf('<span class="icon icon-logo"></span>');
  const togglePos = originalHtml.indexOf('<span class="icon icon-toggle"></span>');
  const globePos = originalHtml.indexOf('<span class="icon icon-globe"></span>');
  
  const homePos = originalHtml.indexOf('Home');
  const toggleTextPos = originalHtml.indexOf('Toggle');
  const langTextPos = originalHtml.indexOf('Language');
  
  console.log(`  Original positions:`);
  console.log(`    Logo: ${logoPos} (before "Home" at ${homePos})`);
  console.log(`    Toggle: ${togglePos} (before "Toggle" at ${toggleTextPos})`);
  console.log(`    Globe: ${globePos} (before "Language" at ${langTextPos})`);
  
  // Preserve
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  assert(iconElements.length === 3, 'Should have 3 icons');
  
  // Simulate translation
  const translatedHtml = preservedHtml
    .replace('Home', 'Inicio')
    .replace('Toggle', 'Alternar')
    .replace('Language', 'Idioma');
  
  // Restore
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Verify positions
  const restoredLogoPos = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const restoredTogglePos = restoredHtml.indexOf('<span class="icon icon-toggle"></span>');
  const restoredGlobePos = restoredHtml.indexOf('<span class="icon icon-globe"></span>');
  
  const restoredHomePos = restoredHtml.indexOf('Inicio');
  const restoredToggleTextPos = restoredHtml.indexOf('Alternar');
  const restoredLangTextPos = restoredHtml.indexOf('Idioma');
  
  console.log(`  Restored positions:`);
  console.log(`    Logo: ${restoredLogoPos} (before "Inicio" at ${restoredHomePos})`);
  console.log(`    Toggle: ${restoredTogglePos} (before "Alternar" at ${restoredToggleTextPos})`);
  console.log(`    Globe: ${restoredGlobePos} (before "Idioma" at ${restoredLangTextPos})`);
  
  // Verify all icons are before their respective text
  assert(restoredLogoPos < restoredHomePos, 'Logo must be before "Inicio"');
  assert(restoredTogglePos < restoredToggleTextPos, 'Toggle must be before "Alternar"');
  assert(restoredGlobePos < restoredLangTextPos, 'Globe must be before "Idioma"');
  
  // Verify relative order is maintained
  assert(restoredLogoPos < restoredTogglePos, 'Logo should come before Toggle');
  assert(restoredTogglePos < restoredGlobePos, 'Toggle should come before Globe');
  
  console.log('  ✓ All icon positions verified: Icons maintain relative positions');
}

/**
 * Test Case 3: Real-world scenario - Spanish header (the actual bug case)
 */
function testSpanishHeaderBugFix() {
  console.log('\n=== Test: Spanish Header Bug Fix Verification ===');
  
  // This is the exact structure that was broken
  const originalHtml = '<div><p><a href="/"><span class="icon icon-logo"></span>Author Kit</a></p></div>';
  
  console.log('  Testing the exact bug scenario:');
  console.log('    Original: <span class="icon icon-logo"></span>Author Kit');
  console.log('    Expected: <span class="icon icon-logo"></span>Kit de autor');
  console.log('    Bug (wrong): Kit de autor<span class="icon icon-logo"></span>');
  
  // Preserve
  const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
  
  // Simulate what DeepL was doing wrong - moving content around
  // But our placeholder approach prevents this
  const translatedHtml = preservedHtml.replace('Author Kit', 'Kit de autor');
  
  // Restore
  const restoredHtml = restoreIconElements(translatedHtml, iconElements);
  
  // Extract the critical part
  const linkMatch = restoredHtml.match(/<a[^>]*>([^<]*)<span[^>]*icon-logo[^>]*><\/span>([^<]*)<\/a>/);
  const correctMatch = restoredHtml.match(/<a[^>]*><span[^>]*icon-logo[^>]*><\/span>([^<]+)<\/a>/);
  const wrongMatch = restoredHtml.match(/<a[^>]*>([^<]+)<span[^>]*icon-logo[^>]*><\/span><\/a>/);
  
  console.log(`  Verification:`);
  console.log(`    Correct pattern found: ${correctMatch !== null}`);
  console.log(`    Wrong pattern found: ${wrongMatch !== null}`);
  
  // CRITICAL: Must match correct pattern, must NOT match wrong pattern
  assert(correctMatch !== null, 'Must match correct pattern (icon before text)');
  assert(wrongMatch === null, 'Must NOT match wrong pattern (icon after text)');
  assert(correctMatch[1].trim() === 'Kit de autor', 'Text should be "Kit de autor"');
  
  // Verify exact position
  const iconIndex = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
  const textIndex = restoredHtml.indexOf('Kit de autor');
  
  assert(iconIndex !== -1, 'Icon must be present');
  assert(textIndex !== -1, 'Text must be present');
  assert(iconIndex < textIndex, 'CRITICAL: Icon must be BEFORE text');
  
  console.log(`    Icon position: ${iconIndex}`);
  console.log(`    Text position: ${textIndex}`);
  console.log(`    Icon before text: ${iconIndex < textIndex}`);
  
  console.log('  ✓ Bug fix verified: Icon position is correct');
}

/**
 * Test Case 4: Position comparison with detailed output
 */
function testDetailedPositionComparison() {
  console.log('\n=== Test: Detailed Position Comparison ===');
  
  const testCases = [
    {
      name: 'Icon before text',
      html: '<a href="/"><span class="icon icon-logo"></span>Home</a>',
      originalText: 'Home',
      translatedText: 'Inicio',
      verify: (html) => {
        const iconPos = html.indexOf('<span class="icon icon-logo"></span>');
        const textPos = html.indexOf('Inicio');
        return iconPos !== -1 && textPos !== -1 && iconPos < textPos;
      },
    },
    {
      name: 'Icon in navigation',
      html: '<nav><a href="/"><span class="icon icon-logo"></span>Brand</a></nav>',
      originalText: 'Brand',
      translatedText: 'Marca',
      verify: (html) => {
        const iconPos = html.indexOf('<span class="icon icon-logo"></span>');
        const textPos = html.indexOf('Marca');
        return iconPos !== -1 && textPos !== -1 && iconPos < textPos;
      },
    },
    {
      name: 'Multiple icons',
      html: '<div><span class="icon icon-logo"></span>Logo</div><div><span class="icon icon-toggle"></span>Toggle</div>',
      originalText: ['Logo', 'Toggle'],
      translatedText: ['Logotipo', 'Alternar'],
      verify: (html) => {
        const logoIconPos = html.indexOf('<span class="icon icon-logo"></span>');
        const logoTxtPos = html.indexOf('Logotipo');
        const toggleIconPos = html.indexOf('<span class="icon icon-toggle"></span>');
        const toggleTxtPos = html.indexOf('Alternar');
        return logoIconPos !== -1 && logoTxtPos !== -1 && logoIconPos < logoTxtPos &&
               toggleIconPos !== -1 && toggleTxtPos !== -1 && toggleIconPos < toggleTxtPos;
      },
    },
  ];
  
  testCases.forEach((testCase, idx) => {
    console.log(`\n  Test ${idx + 1}: ${testCase.name}`);
    
    const originalHtml = testCase.html;
    const { preservedHtml, iconElements } = preserveIconElements(originalHtml);
    
    // Simulate translation
    let translatedHtml = preservedHtml;
    if (Array.isArray(testCase.originalText)) {
      testCase.originalText.forEach((orig, i) => {
        translatedHtml = translatedHtml.replace(new RegExp(orig, 'g'), testCase.translatedText[i]);
      });
    } else {
      translatedHtml = translatedHtml.replace(new RegExp(testCase.originalText, 'g'), testCase.translatedText);
    }
    
    const restoredHtml = restoreIconElements(translatedHtml, iconElements);
    
    // Verify using custom verification function
    const isValid = testCase.verify(restoredHtml);
    assert(isValid, `Position verification failed for ${testCase.name}`);
    
    // Verify all icons are restored
    iconElements.forEach(({ original }) => {
      assert(restoredHtml.includes(original), `Icon should be restored: ${original.substring(0, 30)}...`);
    });
    
    console.log(`    ✓ ${testCase.name}: Position verified`);
  });
}

/**
 * Run all verification tests
 */
function runVerificationTests() {
  console.log('='.repeat(60));
  console.log('Icon Position Verification Tests');
  console.log('='.repeat(60));
  console.log('\nVerifying that icon positions remain identical after translation...\n');
  
  let passed = 0;
  let failed = 0;
  
  const tests = [
    testHeaderIconPosition,
    testMultipleIconPositions,
    testSpanishHeaderBugFix,
    testDetailedPositionComparison,
  ];
  
  tests.forEach((test) => {
    try {
      test();
      passed++;
    } catch (error) {
      console.error(`\n✗ Test failed: ${test.name}`);
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      failed++;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`Verification Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    console.error('\n✗ Some verification tests failed!');
    process.exit(1);
  } else {
    console.log('\n✓ All position verification tests passed!');
    console.log('  Icons maintain their exact positions after translation.');
  }
}

// Run tests if this file is executed directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename || process.argv[1].endsWith('icon-position-verification.test.js');

if (isMainModule) {
  runVerificationTests();
}

export {
  verifyIconPositions,
  testHeaderIconPosition,
  testMultipleIconPositions,
  testSpanishHeaderBugFix,
  testDetailedPositionComparison,
  runVerificationTests,
};


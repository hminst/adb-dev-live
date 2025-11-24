/**
 * Test script to verify HTML translation preserves structure
 */

import { preserveIconElements, restoreIconElements } from './icon-preservation.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read test files
const htmlIn = readFileSync(join(__dirname, 'test-html-translation', 'html-in.html'), 'utf-8');
const htmlExpected = readFileSync(join(__dirname, 'test-html-translation', 'html-expected.html'), 'utf-8');

console.log('Testing icon preservation...\n');

// Test the preservation
const { preservedHtml, iconElements } = preserveIconElements(htmlIn);

console.log('Preserved HTML (first 200 chars):');
console.log(preservedHtml.substring(0, 200));
console.log('\nIcon elements found:', iconElements.length);
iconElements.forEach(({ placeholder, original }) => {
  console.log(`  ${placeholder}: ${original.substring(0, 50)}...`);
});

// Simulate what DeepL might do - translate text but keep placeholders
let translatedHtml = preservedHtml;
translatedHtml = translatedHtml.replace(/Author Kit/g, 'Kit de autor');
translatedHtml = translatedHtml.replace(/Features/g, 'Características');
translatedHtml = translatedHtml.replace(/test/g, 'prueba');
translatedHtml = translatedHtml.replace(/Toggle color scheme/g, 'Cambiar combinación de colores');
translatedHtml = translatedHtml.replace(/Change language/g, 'Cambiar idioma');

console.log('\nTranslated HTML (first 200 chars):');
console.log(translatedHtml.substring(0, 200));

// Restore icons
const restoredHtml = restoreIconElements(translatedHtml, iconElements);

console.log('\nRestored HTML (first 200 chars):');
console.log(restoredHtml.substring(0, 200));

// Check if icon is before text
const iconPos = restoredHtml.indexOf('<span class="icon icon-logo"></span>');
const textPos = restoredHtml.indexOf('Kit de autor');

console.log('\nPosition check:');
console.log(`  Icon position: ${iconPos}`);
console.log(`  Text position: ${textPos}`);
console.log(`  Icon before text: ${iconPos < textPos ? '✓ YES' : '✗ NO'}`);

// Compare with expected
const expectedIconPos = htmlExpected.indexOf('<span class="icon icon-logo"></span>');
const expectedTextPos = htmlExpected.indexOf('Kit de autor');

console.log('\nExpected:');
console.log(`  Icon position: ${expectedIconPos}`);
console.log(`  Text position: ${expectedTextPos}`);
console.log(`  Icon before text: ${expectedIconPos < expectedTextPos ? '✓ YES' : '✗ NO'}`);

if (iconPos < textPos && expectedIconPos < expectedTextPos) {
  console.log('\n✓ Test PASSED: Icon position is correct');
} else {
  console.log('\n✗ Test FAILED: Icon position is incorrect');
  process.exit(1);
}


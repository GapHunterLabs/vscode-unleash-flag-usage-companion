import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findFlagUsages, findNamingViolations, findLikelyTypoGroups } from '../flagInventory';

test('findFlagUsages detects JS-style isEnabled call', () => {
  const usages = findFlagUsages('app.ts', "if (unleash.isEnabled('new-checkout')) { render(); }");
  assert.equal(usages.length, 1);
  assert.equal(usages[0].flagName, 'new-checkout');
  assert.equal(usages[0].line, 1);
});

test('findFlagUsages detects Python-style is_enabled call', () => {
  const usages = findFlagUsages('app.py', 'if unleash_client.is_enabled("new-checkout"):');
  assert.equal(usages.length, 1);
  assert.equal(usages[0].flagName, 'new-checkout');
});

test('findFlagUsages detects Go-style IsEnabled call', () => {
  const usages = findFlagUsages('app.go', 'if unleash.IsEnabled("new-checkout") {');
  assert.equal(usages.length, 1);
});

test('findFlagUsages tracks multiple usages across lines', () => {
  const text = ['isEnabled("a")', 'isEnabled("b")', 'isEnabled("a")'].join('\n');
  const usages = findFlagUsages('app.ts', text);
  assert.equal(usages.length, 3);
  assert.equal(usages[2].line, 3);
});

test('findNamingViolations flags a non-kebab-case flag name', () => {
  const usages = findFlagUsages('app.ts', 'isEnabled("newCheckout")');
  const violations = findNamingViolations(usages);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].flagName, 'newCheckout');
});

test('findNamingViolations does not flag a proper kebab-case name', () => {
  const usages = findFlagUsages('app.ts', 'isEnabled("new-checkout-flow")');
  assert.equal(findNamingViolations(usages).length, 0);
});

test('findNamingViolations reports one violation per distinct name, not per usage', () => {
  const text = ['isEnabled("badName")', 'isEnabled("badName")'].join('\n');
  const usages = findFlagUsages('app.ts', text);
  const violations = findNamingViolations(usages);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].usages.length, 2);
});

test('findLikelyTypoGroups groups differently-spelled variants of the same flag', () => {
  const usages = [
    ...findFlagUsages('a.ts', 'isEnabled("my-flag")'),
    ...findFlagUsages('b.ts', 'isEnabled("myFlag")'),
  ];
  const groups = findLikelyTypoGroups(usages);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].variants.length, 2);
});

test('findLikelyTypoGroups does not group genuinely different flag names', () => {
  const usages = [
    ...findFlagUsages('a.ts', 'isEnabled("checkout-flow")'),
    ...findFlagUsages('b.ts', 'isEnabled("signup-flow")'),
  ];
  assert.equal(findLikelyTypoGroups(usages).length, 0);
});

test('findLikelyTypoGroups does not flag a single consistently-spelled flag', () => {
  const usages = [
    ...findFlagUsages('a.ts', 'isEnabled("my-flag")'),
    ...findFlagUsages('b.ts', 'isEnabled("my-flag")'),
  ];
  assert.equal(findLikelyTypoGroups(usages).length, 0);
});

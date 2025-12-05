# Plan: Update Chrome Extension Testing Skill with Real-World Learnings

## Overview

The `chrome-extension-testing/` skill folder contains templates and documentation for testing Chrome extensions. The main repo (`tests/`) contains real-world tested implementations with many valuable learnings that should be integrated back into the skill.

## Key Learnings to Integrate

### 1. Simple Login Script (HIGH PRIORITY)
**Source**: `tests/simple-login.ts`
**Why**: The Stagehand-based login is complex and unreliable. The simple rebrowser-playwright version is much more reliable and doesn't require AI API keys.

**Add to skill**:
- New `assets/simple-login.ts` template
- Uses pure rebrowser-playwright (no Stagehand dependency)
- Waits for user to press Enter in terminal (simple and reliable)
- Saves session to `.test-profile/` for reuse

### 2. macOS ARM64 Support (MEDIUM PRIORITY)
**Source**: `tests/setup.ts`, `tests/feed-stealth.test.ts`
**Why**: The skill templates only support Intel Mac, missing M1/M2/M3 users.

**Update in skill**:
- `assets/test-template.ts` - Add ARM64 path detection
- `scripts/init-test-env.js` - Add ARM64 path in generated code
- `references/TEST-PATTERNS.md` - Document all platform paths

### 3. Comprehensive Test Reporter (MEDIUM PRIORITY)
**Source**: `tests/reporter.ts`
**Why**: The skill's template has inline reporting. A separate reporter module is cleaner and more reusable.

**Add to skill**:
- New `assets/reporter.ts` template with full reporter class
- Creates timestamped folders, markdown reports, handles screenshots
- Cleaner separation of concerns

### 4. Selector Analysis Function (MEDIUM PRIORITY)
**Source**: `tests/feed-stealth.test.ts` lines 231-301
**Why**: The `analyzeSelectors()` function is extremely useful for debugging injected elements.

**Add to skill**:
- Add pattern to `references/TEST-PATTERNS.md`
- Include in test template as optional debug function

### 5. Enhanced HTML Context Extraction (LOW PRIORITY)
**Source**: `tests/feed-stealth.test.ts` lines 179-228
**Why**: The `saveHtml()` helper with `aroundButtons` option is better than current template.

**Update in skill**:
- Enhance `saveHtmlContext` in `assets/test-template.ts`
- Add configurable parent depth traversal

### 6. Package.json Scripts Organization (MEDIUM PRIORITY)
**Source**: Root `package.json`
**Why**: The skill template has minimal scripts. Real-world usage needs more specialized scripts.

**Update in skill**:
- `assets/package-template.json` - Add more scripts:
  - `test:stealth` - Main stealth test
  - `login` - Simple login helper
  - Optional Stagehand-based tests

### 7. Pre-Navigation Console Listener Pattern (HIGH PRIORITY)
**Source**: `tests/feed-stealth.test.ts` lines 74-93
**Why**: Console listeners must be attached BEFORE navigation to capture all logs.

**Update in skill**:
- `assets/test-template.ts` - Move listener setup before `page.goto()`
- `references/TROUBLESHOOTING.md` - Add this gotcha

### 8. Extension Log Retrieval Best Practices (LOW PRIORITY)
**Source**: `tests/feed-stealth.test.ts` lines 96-118
**Why**: The pattern is already in the skill but could be clearer.

**Update in skill**:
- `references/LOGGER.md` - Clarify timeout handling
- Add note about event names customization

---

## Implementation Tasks

### Task 1: Add Simple Login Script
**Files to create**: `chrome-extension-testing/assets/simple-login.ts`
**Changes**:
- Create new template based on `tests/simple-login.ts`
- Use generic event names (not xpn-specific)
- Include instructions in header comment
- Update `package-template.json` with `login` script

### Task 2: Fix Platform Detection (All Platforms)
**Files to update**:
- `chrome-extension-testing/assets/test-template.ts`
- `chrome-extension-testing/scripts/init-test-env.js`
- `chrome-extension-testing/references/TEST-PATTERNS.md`
**Changes**:
- Add macOS ARM64 (`chrome-mac-arm64`) path detection
- Ensure consistent platform detection across all files

### Task 3: Add Reporter Module
**Files to create**: `chrome-extension-testing/assets/reporter.ts`
**Changes**:
- Create standalone reporter class
- Support markdown reports, screenshots, notes, errors
- Include timestamped folder creation

### Task 4: Add Selector Analysis Pattern
**Files to update**: `chrome-extension-testing/references/TEST-PATTERNS.md`
**Changes**:
- Add "Selector Analysis" section with `analyzeSelectors()` code
- Explain when and how to use it

### Task 5: Update Package Template
**Files to update**: `chrome-extension-testing/assets/package-template.json`
**Changes**:
- Add `login` script
- Add description field
- Consider adding `sharp` as dev dependency

### Task 6: Update Test Template with Best Practices
**Files to update**: `chrome-extension-testing/assets/test-template.ts`
**Changes**:
- Move console listener setup BEFORE navigation
- Add selector analysis helper function
- Improve HTML context extraction
- Add comments about listener timing

### Task 7: Update Troubleshooting Guide
**Files to update**: `chrome-extension-testing/references/TROUBLESHOOTING.md`
**Changes**:
- Add "Console logs not captured" section (listener timing)
- Add "Login session not persisting" section (profile path tips)

### Task 8: Update SKILL.md Quick Reference
**Files to update**: `chrome-extension-testing/SKILL.md`
**Changes**:
- Add `login` command to Quick Reference table
- Mention reporter module
- Update setup workflow

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `assets/simple-login.ts` | CREATE | Simple login helper template |
| `assets/reporter.ts` | CREATE | Standalone test reporter module |
| `assets/test-template.ts` | UPDATE | Platform detection, listener timing, helpers |
| `assets/package-template.json` | UPDATE | Add login script, sharp dependency |
| `scripts/init-test-env.js` | UPDATE | ARM64 support in generated code |
| `references/TEST-PATTERNS.md` | UPDATE | Add selector analysis, ARM64 paths |
| `references/TROUBLESHOOTING.md` | UPDATE | Add listener timing, profile issues |
| `SKILL.md` | UPDATE | Quick reference, workflow updates |

---

## Risk Considerations

1. **Backwards Compatibility**: Changes should be additive. Existing templates should still work.
2. **Complexity**: Adding too many patterns may overwhelm users. Keep core template simple, put advanced patterns in references.
3. **Dependencies**: The simple login script doesn't need Stagehand - keeping skill usable without AI API keys.

---

## Implementation Order

1. Task 2 (Platform Detection) - Bug fix, quick win
2. Task 1 (Simple Login Script) - High value addition
3. Task 5 (Package Template) - Required for login script
4. Task 6 (Test Template Best Practices) - High impact
5. Task 7 (Troubleshooting) - Documentation
6. Task 3 (Reporter Module) - Nice to have
7. Task 4 (Selector Analysis Pattern) - Documentation
8. Task 8 (SKILL.md Updates) - Final polish

# Chrome Extension Testing Framework

A comprehensive testing and debugging framework for Chrome extensions, featuring stealth automation, cross-script logging, and detailed visual reporting. Built to solve the hard problems of extension testing on sites with bot detection.

## The Problem

Testing Chrome extensions is notoriously difficult for several reasons:

### 1. Isolated Worlds
Content scripts run in an "isolated world" - they share the DOM with the page but have separate JavaScript execution contexts. This means:
- Playwright's `page.evaluate()` runs in the main world, not the content script's world
- `page.on('console')` only captures main world logs, missing all content script output
- You can't directly call functions or access variables in your content script

### 2. Bot Detection
Modern websites like X.com (Twitter) detect automation tools through:
- CDP (Chrome DevTools Protocol) detection
- `navigator.webdriver` flag
- Automation-controlled browser fingerprints
- Headless browser detection

Standard Playwright/Puppeteer will get blocked with "Something went wrong" errors.

### 3. Multi-Script Architecture
Chrome extensions have multiple script contexts that all need debugging:
- **Content scripts** - Injected into web pages
- **Background service worker** - Persistent extension logic
- **Popup scripts** - Extension popup UI

Each runs in isolation with no unified logging.

### 4. Visual Verification
Extensions modify the DOM and inject UI elements. You need to:
- Verify elements are injected correctly
- Check styling matches the host site
- Ensure no layout breaks or visual regressions
- Debug subtle pixel-level issues

---

## The Solution

This framework provides a complete testing and debugging toolkit:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Runner (TypeScript)                      │
│                  rebrowser-playwright (stealth)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Content    │  │  Background  │  │    Popup     │          │
│  │   Script     │  │   Worker     │  │   Script     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────────┬┴─────────────────┘                   │
│                          ▼                                      │
│              ┌─────────────────────┐                            │
│              │   Shared Logger     │                            │
│              │  (chrome.storage)   │                            │
│              └──────────┬──────────┘                            │
│                         │                                       │
│                         ▼                                       │
│              ┌─────────────────────┐                            │
│              │   Event-Based API   │◄───── Test Runner          │
│              │ (window.dispatch)   │                            │
│              └─────────────────────┘                            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      Test Reports                                │
│  📸 Screenshots  📄 HTML Capture  📋 Logs  📊 DOM Analysis      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Stealth Browser Automation

Uses `rebrowser-playwright` instead of standard Playwright to bypass CDP detection:

```typescript
import { chromium } from "rebrowser-playwright";

const context = await chromium.launchPersistentContext(profilePath, {
  headless: false,
  executablePath: chromePath,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--disable-blink-features=AutomationControlled",
  ],
});
```

**Why rebrowser-playwright?**
- Patches CDP to avoid detection
- Removes automation flags
- Passes bot detection on X.com, LinkedIn, etc.
- Drop-in replacement for Playwright

### 2. Cross-Script Logging System

A unified logger (`shared/logger.js`) that captures logs from ALL extension scripts:

```javascript
// In any extension script (content, background, popup):
xpnLog('content', 'log', 'Button injected for', username);
xpnLog('background', 'error', 'API call failed', error);
xpnLog('popup', 'info', 'Notes loaded:', count);
```

**How it works:**
1. Logs to console immediately (for manual debugging)
2. Queues logs with timestamps and source tags
3. Batches writes to `chrome.storage.local` (100ms debounce)
4. Exposes event-based API for test retrieval

**Log format in storage:**
```javascript
{
  t: 1701720000000,    // timestamp
  s: 'content',        // source: content|background|popup
  l: 'log',            // level: log|error|warn|info
  m: 'Injected 5 buttons'  // message
}
```

### 3. Event-Based Log Retrieval

Since content scripts run in an isolated world, we use custom events to bridge the gap:

```typescript
// In test runner:
const getExtensionLogs = async () => {
  const logs = await page.evaluate(async () => {
    return new Promise((resolve) => {
      window.addEventListener('__xpn_logs_response__', (e) => {
        resolve(e.detail);
      }, { once: true });

      window.dispatchEvent(new Event('__xpn_get_logs__'));
      setTimeout(() => resolve('[]'), 2000);
    });
  });
  return JSON.parse(logs);
};
```

The content script listens for `__xpn_get_logs__` and responds with `__xpn_logs_response__`:

```javascript
// In logger.js (content script context):
window.addEventListener('__xpn_get_logs__', async () => {
  const logs = await xpnGetLogs();
  window.dispatchEvent(new CustomEvent('__xpn_logs_response__', {
    detail: JSON.stringify(logs)
  }));
});
```

### 4. Comprehensive Test Reports

Each test run generates a timestamped report directory:

```
test-reports/
└── 2025-12-04T22-34-01_feed-stealth/
    ├── 01_home-feed.png
    ├── 02_note-buttons-found.png
    ├── 03_scroll-1.png
    ├── ...
    ├── full-page.html
    ├── button-contexts.html
    └── console-logs.md
```

**Report contents:**
- **Screenshots** - Numbered PNG files for each test step
- **Full HTML** - Complete page source for debugging
- **Context HTML** - Extracted DOM around injected elements
- **Console logs** - Formatted markdown with all extension logs

### 5. Screenshot Zoom Tool

For pixel-perfect verification, a zoom utility to inspect details:

```bash
node scripts/zoom-screenshot.js <input.png> <x> <y> <width> <height> <output.png>

# Example: Zoom into a modal at position (370,250) with size 530x400
node scripts/zoom-screenshot.js screenshot.png 370 250 530 400 zoomed.png
```

Outputs a 2x scaled crop for detailed inspection.

---

## Setup

### Prerequisites

- Node.js 18+
- Chrome for Testing (auto-installed)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd chrome-extension-tester

# Install dependencies
npm install

# Install Chrome for Testing
npm run install-chrome
```

### Configuration

Create a `.env` file:

```env
# Optional: Custom Chrome path
CHROME_FOR_TESTING_PATH=./chrome/win64-143.0.7499.40/chrome-win64/chrome.exe
```

---

## Integrating the Logger

### Step 1: Add logger to manifest.json

```json
{
  "content_scripts": [
    {
      "matches": ["*://*.example.com/*"],
      "js": ["shared/logger.js", "content/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### Step 2: Import in background service worker

```javascript
// background/background.js
importScripts('shared/logger.js');

chrome.runtime.onInstalled.addListener(() => {
  xpnLog('background', 'log', 'Extension installed');
});
```

### Step 3: Include in popup HTML

```html
<!-- popup/popup.html -->
<script src="../shared/logger.js"></script>
<script src="popup.js"></script>
```

### Step 4: Use throughout your extension

```javascript
// Content script
xpnLog('content', 'log', 'Initialized');
xpnLog('content', 'error', 'Failed to inject', element);

// Background
xpnLog('background', 'warn', 'Rate limited, retrying...');

// Popup
xpnLog('popup', 'info', 'Loaded', count, 'notes');
```

---

## Writing Tests

### Basic Test Structure

```typescript
import { chromium } from "rebrowser-playwright";
import path from "path";
import fs from "fs";

async function main() {
  // Setup
  const extensionPath = path.resolve(__dirname, "..");
  const profilePath = path.resolve(__dirname, "../.test-profile");
  const reportDir = createReportDir();

  // Launch with extension
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: findChrome(),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = context.pages()[0];

  try {
    // Navigate
    await page.goto("https://example.com");
    await takeScreenshot(page, reportDir, "initial");

    // Test your extension
    const buttonCount = await page.evaluate(() => {
      return document.querySelectorAll(".my-extension-button").length;
    });
    console.log(`Found ${buttonCount} buttons`);

    // Get extension logs
    const logs = await getExtensionLogs(page);
    saveLogs(reportDir, logs);

  } finally {
    await context.close();
  }
}
```

### Helper Functions

```typescript
// Human-like delays to avoid detection
const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

// Screenshot with step numbering
let stepNum = 0;
const takeScreenshot = async (page, dir, name) => {
  stepNum++;
  const filename = `${String(stepNum).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: path.join(dir, filename) });
  console.log(`📸 ${filename}`);
};

// Save HTML context around elements
const saveHtmlContext = async (page, dir, selector) => {
  const html = await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    return Array.from(elements).slice(0, 10).map(el => {
      let parent = el;
      for (let i = 0; i < 5 && parent.parentElement; i++) {
        parent = parent.parentElement;
      }
      return parent.outerHTML;
    }).join('\n\n<hr>\n\n');
  }, selector);

  fs.writeFileSync(path.join(dir, 'context.html'), html);
};

// DOM analysis
const analyzeDOM = async (page, selector) => {
  return page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    return Array.from(elements).map(el => ({
      tag: el.tagName,
      classes: el.className,
      rect: el.getBoundingClientRect(),
      computedStyle: {
        display: getComputedStyle(el).display,
        position: getComputedStyle(el).position,
      }
    }));
  }, selector);
};
```

---

## Running Tests

```bash
# Run the main stealth test
npm run test:feed-stealth

# Other test commands (customize in package.json)
npm run test:popup
npm run test:content
```

### Persistent Profile

Tests use a persistent Chrome profile (`.test-profile/`) which:
- Preserves login sessions between runs
- Stores extension data
- Maintains cookies and localStorage

**To reset the profile:**
```bash
rm -rf .test-profile
```

---

## Analyzing Reports

### Screenshot Review

Screenshots are numbered in execution order:
```
01_home-feed.png      - Initial page load
02_buttons-found.png  - After extension injects elements
03_scroll-1.png       - After scrolling
04_modal-open.png     - UI interaction
...
```

### Log Analysis

`console-logs.md` provides formatted logs:

```markdown
## Extension Logs (from chrome.storage)
[2025-12-04T22:34:03.516Z] [content:LOG] X Profile Notes initialized
[2025-12-04T22:34:04.777Z] [content:LOG] Injected 3 note buttons
[2025-12-04T22:34:20.778Z] [content:LOG] Opening modal for @username
[2025-12-04T22:34:22.527Z] [content:LOG] Note saved for @username (score: 4)

## Extension State (from DOM)
- Buttons injected: 12
- Wrappers created: 12
- Modal exists: true
```

### HTML Debugging

- `full-page.html` - Complete page for inspecting DOM structure
- `button-contexts.html` - Extracted fragments around injected elements

### Zoom for Details

```bash
# Zoom into specific coordinates
node scripts/zoom-screenshot.js \
  test-reports/2025-12-04T22-34-01_feed-stealth/04_modal-open.png \
  370 250 530 400 \
  test-reports/2025-12-04T22-34-01_feed-stealth/04_modal-zoomed.png
```

---

## Best Practices

### 1. Use Human-Like Delays

```typescript
// Avoid detection with randomized delays
await humanDelay(2000, 3000);  // 2-3 seconds
```

### 2. Batch Log Writes

The logger automatically batches writes to avoid performance issues:
- 100ms debounce
- Max 1000 log entries
- Automatic trimming of old logs

### 3. Tag Logs by Source

Always specify the source for easy filtering:
```javascript
xpnLog('content', 'log', ...);   // Content script
xpnLog('background', 'log', ...); // Service worker
xpnLog('popup', 'log', ...);      // Popup
```

### 4. Capture State Before Actions

```typescript
// Before
await takeScreenshot("before-click");
const beforeCount = await getButtonCount();

// Action
await page.click('.my-button');

// After
await takeScreenshot("after-click");
const afterCount = await getButtonCount();
console.log(`Buttons: ${beforeCount} -> ${afterCount}`);
```

### 5. Save HTML for Debugging

When tests fail, HTML captures help identify selector issues:
```typescript
await saveHtml("debug-state");
await saveHtmlContext(".my-selector");
```

---

## Troubleshooting

### "Something went wrong" on X.com

Ensure you're using `rebrowser-playwright`:
```typescript
import { chromium } from "rebrowser-playwright";  // NOT 'playwright'
```

### No extension logs captured

1. Check logger is included in manifest.json
2. Verify logger.js loads before other scripts
3. Check chrome.storage permissions
4. Ensure event listeners are registered

### Logs show 0 entries

The content script runs in an isolated world. Use the event-based API:
```typescript
// Dispatch event to request logs
window.dispatchEvent(new Event('__xpn_get_logs__'));

// Listen for response
window.addEventListener('__xpn_logs_response__', handler);
```

### Screenshots are blank

Check viewport settings:
```typescript
viewport: { width: 1280, height: 900 }
```

And screenshot clip area:
```typescript
await page.screenshot({
  path: filepath,
  clip: { x: 0, y: 0, width: 1280, height: 900 }
});
```

---

## File Structure

```
chrome-extension-tester/
├── shared/
│   └── logger.js           # Cross-script logging utility
├── content/
│   ├── content.js          # Content script
│   └── content.css         # Injected styles
├── background/
│   └── background.js       # Service worker
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── tests/
│   ├── feed-stealth.test.ts  # Main test file
│   └── *.test.ts             # Other tests
├── scripts/
│   └── zoom-screenshot.js    # Screenshot zoom utility
├── test-reports/             # Generated reports
│   └── {timestamp}_{test}/
│       ├── *.png             # Screenshots
│       ├── *.html            # HTML captures
│       └── console-logs.md   # Formatted logs
├── chrome/                   # Chrome for Testing
├── .test-profile/            # Persistent browser profile
├── manifest.json
└── package.json
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `rebrowser-playwright` | Stealth browser automation |
| `typescript` | Type-safe test code |
| `ts-node` | Run TypeScript directly |
| `sharp` | Image processing for zoom |
| `dotenv` | Environment configuration |

---

## License

GPL-3.0

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

---

## Acknowledgments

- [rebrowser-playwright](https://github.com/nicememe/rebrowser-playwright) - Stealth Playwright fork
- [Playwright](https://playwright.dev/) - Browser automation framework
- [Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing/) - Stable Chrome builds

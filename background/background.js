/**
 * X Profile Notes - Background Service Worker
 * Handles extension lifecycle and badge updates
 */

// Import shared logger
importScripts('shared/logger.js');

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install - initialize storage
    const existing = await chrome.storage.local.get(['notes']);
    if (!existing.notes) {
      await chrome.storage.local.set({ notes: {} });
    }
    xpnLog('background', 'log', 'X Profile Notes installed');
  } else if (details.reason === 'update') {
    xpnLog('background', 'log', 'X Profile Notes updated to version', chrome.runtime.getManifest().version);
  }

  // Update badge
  updateBadge();
});

// Update badge with note count
async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || {};
    const count = Object.keys(notes).length;

    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#1d9bf0' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    xpnLog('background', 'error', 'Error updating badge:', error);
  }
}

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.notes) {
    updateBadge();
  }
});

// Initial badge update
updateBadge();

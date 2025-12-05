/**
 * X Profile Notes - Content Script
 * Injects note buttons next to X.com profile usernames
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__xProfileNotesInjected) return;
  window.__xProfileNotesInjected = true;

  // Configuration
  const CONFIG = {
    debounceMs: 100,
    buttonClass: 'xpn-note-btn',
    modalClass: 'xpn-modal',
    indicatorClass: 'xpn-has-note',
    processedAttr: 'data-xpn-processed'
  };

  // Storage for notes (cached from chrome.storage)
  let notesCache = {};

  // ============================================================
  // Storage Functions
  // ============================================================

  // Helper to normalize username
  function normalizeUsername(username) {
    return username.toLowerCase().replace('@', '');
  }

  // Migrate old single-score format to new multi-score format
  function migrateNoteFormat(noteData) {
    if (noteData.score !== undefined && !noteData.scores) {
      noteData.scores = noteData.score !== null
        ? [{ value: noteData.score, timestamp: noteData.updatedAt || Date.now() }]
        : [];
      delete noteData.score;
    }
    // Ensure scores array exists
    if (!noteData.scores) {
      noteData.scores = [];
    }
    return noteData;
  }

  async function loadNotes() {
    try {
      const result = await chrome.storage.local.get(['notes']);
      notesCache = result.notes || {};

      // Migrate any old format notes
      let needsSave = false;
      for (const username in notesCache) {
        if (notesCache[username].score !== undefined && !notesCache[username].scores) {
          notesCache[username] = migrateNoteFormat(notesCache[username]);
          needsSave = true;
        }
      }

      // Save migrated data
      if (needsSave) {
        await chrome.storage.local.set({ notes: notesCache });
        xpnLog('content', 'log', 'Migrated notes to multi-score format');
      }

      return notesCache;
    } catch (error) {
      xpnLog('content', 'error', 'Error loading notes:', error);
      return {};
    }
  }

  async function saveNote(username, noteText, score = null) {
    const nUsername = normalizeUsername(username);
    const now = Date.now();

    // Ensure entry exists with migrated format
    if (!notesCache[nUsername]) {
      notesCache[nUsername] = {
        note: '',
        scores: [],
        createdAt: now,
        updatedAt: now
      };
    } else {
      // Migrate if needed
      notesCache[nUsername] = migrateNoteFormat(notesCache[nUsername]);
    }

    // Update note text
    notesCache[nUsername].note = noteText ? noteText.trim() : '';

    // Add new score to array if provided
    if (score !== null && score >= 1 && score <= 5) {
      notesCache[nUsername].scores.push({ value: score, timestamp: now });

      // Keep only last 5 scores
      if (notesCache[nUsername].scores.length > 5) {
        notesCache[nUsername].scores = notesCache[nUsername].scores.slice(-5);
      }
    }

    notesCache[nUsername].updatedAt = now;

    // Check if we have any content to keep
    const hasContent = notesCache[nUsername].note !== '' || notesCache[nUsername].scores.length > 0;

    if (!hasContent) {
      // Delete note if empty text and no scores
      delete notesCache[nUsername];
    }

    try {
      await chrome.storage.local.set({ notes: notesCache });
      updateAllIndicators();
      const avgScore = getAverageScore(username);
      xpnLog('content', 'log', `Note saved for @${nUsername}`, score ? `(added score: ${score}, avg: ${avgScore})` : '');
      return true;
    } catch (error) {
      xpnLog('content', 'error', 'Error saving note:', error);
      return false;
    }
  }

  // Delete a specific score from history
  async function deleteScoreAtIndex(username, index) {
    const nUsername = normalizeUsername(username);
    const noteData = notesCache[nUsername];
    if (!noteData?.scores?.[index]) return false;

    noteData.scores.splice(index, 1);
    noteData.updatedAt = Date.now();

    // Check if we have any content to keep
    const hasContent = noteData.note !== '' || noteData.scores.length > 0;

    if (!hasContent) {
      delete notesCache[nUsername];
    }

    try {
      await chrome.storage.local.set({ notes: notesCache });
      updateAllIndicators();
      xpnLog('content', 'log', `Deleted score at index ${index} for @${nUsername}`);
      return true;
    } catch (error) {
      xpnLog('content', 'error', 'Error deleting score:', error);
      return false;
    }
  }

  // Calculate average score for a user
  function getAverageScore(username) {
    const nUsername = normalizeUsername(username);
    const noteData = notesCache[nUsername];
    if (!noteData?.scores?.length) return null;

    const sum = noteData.scores.reduce((acc, s) => acc + s.value, 0);
    return Math.round((sum / noteData.scores.length) * 10) / 10; // One decimal
  }

  // Get all scores for a user (for history display)
  function getScores(username) {
    const nUsername = normalizeUsername(username);
    const noteData = notesCache[nUsername];
    return noteData?.scores || [];
  }

  async function deleteNote(username) {
    const normalizedUsername = username.toLowerCase().replace('@', '');
    delete notesCache[normalizedUsername];

    try {
      await chrome.storage.local.set({ notes: notesCache });
      updateAllIndicators();
      return true;
    } catch (error) {
      xpnLog('content', 'error', 'Error deleting note:', error);
      return false;
    }
  }

  function getNote(username) {
    const nUsername = normalizeUsername(username);
    const noteData = notesCache[nUsername];
    if (!noteData) return null;
    // Ensure migrated format
    return migrateNoteFormat(noteData);
  }

  function hasNote(username) {
    const nUsername = normalizeUsername(username);
    const data = notesCache[nUsername];
    // Has note if there's text content OR any scores
    return !!(data && (data.note || (data.scores && data.scores.length > 0)));
  }

  function getScore(username) {
    // Returns average score for compatibility
    return getAverageScore(username);
  }

  // ============================================================
  // Theme Detection
  // ============================================================

  function detectTheme() {
    const html = document.documentElement;
    const bg = getComputedStyle(html).backgroundColor;

    // Parse RGB values
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const brightness = (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / 3;
      return brightness < 128 ? 'dark' : 'light';
    }

    // Fallback: check for common X.com theme classes
    if (document.body.style.backgroundColor === 'rgb(0, 0, 0)' ||
        html.classList.contains('dark')) {
      return 'dark';
    }

    return 'light';
  }

  // ============================================================
  // Username Detection
  // ============================================================

  function findUsernameElements() {
    const elements = [];

    // Strategy 1: Links to profiles with @ in text (most reliable)
    // Only matches actual <a> tags linking to profiles
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      if (link.hasAttribute(CONFIG.processedAttr)) return;

      // Skip if inside our own modal or wrapper
      if (link.closest(`.${CONFIG.modalClass}`)) return;
      if (link.closest('.xpn-username-wrapper')) return;

      const href = link.getAttribute('href');
      // Match profile links: /username (but not /username/status, /settings, etc.)
      if (href && /^\/[a-zA-Z0-9_]{1,15}$/.test(href)) {
        const text = link.textContent.trim();
        // Check if it looks like a username (@handle or just the handle matching href)
        if (text.startsWith('@') || text.toLowerCase() === href.slice(1).toLowerCase()) {
          // Only inject in tweet headers, not in tweet body text
          const tweetText = link.closest('[data-testid="tweetText"]');
          if (tweetText) return; // Skip @mentions in tweet body

          elements.push({
            element: link,
            username: href.slice(1)
          });
        }
      }
    });

    // Note: We removed Strategy 2 (span matching) because X.com has deeply nested
    // spans and textContent includes all descendants, causing duplicate matches.
    // Profile links (Strategy 1) are the reliable selectors.

    return elements;
  }

  // ============================================================
  // Button Creation
  // ============================================================

  function createNoteButton(username) {
    const button = document.createElement('button');
    button.className = CONFIG.buttonClass;
    button.setAttribute('data-username', username);
    button.setAttribute('title', `Add note for @${username}`);
    button.setAttribute('aria-label', `Add note for @${username}`);

    // Check if user has scores (get average)
    const avgScore = getAverageScore(username);
    const scoreCount = getScores(username).length;

    if (avgScore !== null) {
      // Format: show decimal only if not a whole number
      const displayScore = avgScore % 1 === 0 ? avgScore.toString() : avgScore.toFixed(1);
      button.innerHTML = `<span class="xpn-score-display">${displayScore}</span>`;
      button.classList.add('xpn-has-score');
      // Map average to nearest color tier (1-5)
      const colorTier = Math.max(1, Math.min(5, Math.round(avgScore)));
      button.classList.add(`xpn-score-${colorTier}`);
      button.setAttribute('title', `Avg: ${displayScore}/5 (${scoreCount} score${scoreCount > 1 ? 's' : ''}) - Click to edit`);
    } else {
      // SVG icon (notebook/note icon)
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"/>
        </svg>
      `;
    }

    // Update indicator if note exists (text content)
    if (hasNote(username)) {
      button.classList.add(CONFIG.indicatorClass);
      if (avgScore === null) {
        button.setAttribute('title', `View/edit note for @${username}`);
      }
    }

    // Click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openNoteModal(username);
    });

    return button;
  }

  function injectButton(element, username) {
    // Mark as processed
    element.setAttribute(CONFIG.processedAttr, 'true');

    // Create and inject button
    const button = createNoteButton(username);

    // Wrap the username element and button in a container to prevent wrapping
    const wrapper = document.createElement('span');
    wrapper.className = 'xpn-username-wrapper';
    wrapper.style.cssText = 'display: inline-flex; align-items: center; white-space: nowrap;';

    // Insert wrapper before element, then move element into wrapper
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
    wrapper.appendChild(button);
  }

  // ============================================================
  // Modal UI
  // ============================================================

  function createModal() {
    const modal = document.createElement('div');
    modal.className = CONFIG.modalClass;
    modal.innerHTML = `
      <div class="xpn-modal-backdrop"></div>
      <div class="xpn-modal-content">
        <div class="xpn-modal-header">
          <h3 class="xpn-modal-title">Note for <span class="xpn-modal-username"></span></h3>
          <button class="xpn-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="xpn-modal-body">
          <textarea class="xpn-modal-textarea" placeholder="Write your note here..."></textarea>
          <div class="xpn-score-section">
            <label class="xpn-score-label">Add Rating:</label>
            <div class="xpn-score-buttons">
              <button type="button" class="xpn-score-btn" data-score="1">1</button>
              <button type="button" class="xpn-score-btn" data-score="2">2</button>
              <button type="button" class="xpn-score-btn" data-score="3">3</button>
              <button type="button" class="xpn-score-btn" data-score="4">4</button>
              <button type="button" class="xpn-score-btn" data-score="5">5</button>
            </div>
            <span class="xpn-score-hint">(saves immediately)</span>
          </div>
          <div class="xpn-score-history">
            <div class="xpn-score-history-header">
              <span>Score History <span class="xpn-score-count"></span></span>
              <span class="xpn-score-avg"></span>
            </div>
            <div class="xpn-score-history-list"></div>
          </div>
          <div class="xpn-modal-meta"></div>
        </div>
        <div class="xpn-modal-footer">
          <button class="xpn-modal-delete">Delete All</button>
          <div class="xpn-modal-actions">
            <button class="xpn-modal-cancel">Cancel</button>
            <button class="xpn-modal-save">Save Note</button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const backdrop = modal.querySelector('.xpn-modal-backdrop');
    const closeBtn = modal.querySelector('.xpn-modal-close');
    const cancelBtn = modal.querySelector('.xpn-modal-cancel');
    const saveBtn = modal.querySelector('.xpn-modal-save');
    const deleteBtn = modal.querySelector('.xpn-modal-delete');
    const textarea = modal.querySelector('.xpn-modal-textarea');
    const scoreButtons = modal.querySelectorAll('.xpn-score-btn');

    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Score button handlers - immediately add score
    scoreButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = modal.getAttribute('data-username');
        const score = parseInt(btn.getAttribute('data-score'), 10);
        const noteText = textarea.value;

        xpnLog('content', 'log', `Adding score ${score} for @${username}`);

        // Save note text and add score
        await saveNote(username, noteText, score);

        // Update the score history display
        updateScoreHistoryDisplay(modal, username);
      });
    });

    // Save note text only (no new score)
    saveBtn.addEventListener('click', async () => {
      const username = modal.getAttribute('data-username');
      const noteText = textarea.value;
      await saveNote(username, noteText, null);
      closeModal();
    });

    deleteBtn.addEventListener('click', async () => {
      const username = modal.getAttribute('data-username');
      if (confirm(`Delete all data for @${username}?`)) {
        await deleteNote(username);
        closeModal();
      }
    });

    // Keyboard shortcuts for textarea
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'Enter' && e.shiftKey) {
        // Shift+Enter to save and close
        e.preventDefault();
        saveBtn.click();
      }
    });

    // Global keyboard shortcuts for modal
    document.addEventListener('keydown', async (e) => {
      // Only handle when modal is open
      if (!modal.classList.contains('xpn-modal-open')) return;

      // Escape to close (works from anywhere)
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      // Tab to focus textarea (when not already in textarea)
      if (e.key === 'Tab' && document.activeElement !== textarea) {
        e.preventDefault();
        textarea.focus();
        return;
      }

      // Shift+Enter to save and close (when in textarea, handled above)
      if (e.key === 'Enter' && e.shiftKey && document.activeElement === textarea) {
        return; // Let the textarea handler deal with it
      }

      // Number keys 1-5 for quick scoring (only when not in textarea)
      if (document.activeElement !== textarea) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          e.stopPropagation();

          const username = modal.getAttribute('data-username');
          const noteText = textarea.value;

          xpnLog('content', 'log', `Quick score ${num} for @${username}`);

          // Save with the score and close modal
          await saveNote(username, noteText, num);
          closeModal();
        }
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function getModal() {
    let modal = document.querySelector(`.${CONFIG.modalClass}`);
    if (!modal) {
      modal = createModal();
    }
    return modal;
  }

  // Helper to format date for score history
  function formatScoreDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  // Update the score history display in the modal
  function updateScoreHistoryDisplay(modal, username) {
    const scores = getScores(username);
    const avgScore = getAverageScore(username);

    const historySection = modal.querySelector('.xpn-score-history');
    const historyList = modal.querySelector('.xpn-score-history-list');
    const countSpan = modal.querySelector('.xpn-score-count');
    const avgSpan = modal.querySelector('.xpn-score-avg');

    // Show/hide history section
    if (scores.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';
    countSpan.textContent = `(${scores.length}/5)`;

    const displayAvg = avgScore % 1 === 0 ? avgScore.toString() : avgScore.toFixed(1);
    avgSpan.textContent = `Avg: ${displayAvg}`;

    // Build score entries (most recent first)
    const reversedScores = [...scores].reverse();
    historyList.innerHTML = reversedScores.map((score, idx) => {
      const realIndex = scores.length - 1 - idx; // Index in original array
      const colorClass = `xpn-score-${score.value}`;
      return `
        <div class="xpn-score-entry" data-index="${realIndex}">
          <span class="xpn-score-value ${colorClass}">${score.value}</span>
          <span class="xpn-score-date">${formatScoreDate(score.timestamp)}</span>
          <button class="xpn-score-delete" title="Delete this score">&times;</button>
        </div>
      `;
    }).join('');

    // Add delete handlers
    historyList.querySelectorAll('.xpn-score-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const entry = btn.closest('.xpn-score-entry');
        const index = parseInt(entry.getAttribute('data-index'), 10);
        await deleteScoreAtIndex(username, index);
        updateScoreHistoryDisplay(modal, username);
      });
    });

    // Update meta and delete button visibility
    const note = getNote(username);
    const meta = modal.querySelector('.xpn-modal-meta');
    const deleteBtn = modal.querySelector('.xpn-modal-delete');

    if (note && (note.note || (note.scores && note.scores.length > 0))) {
      const date = new Date(note.updatedAt).toLocaleString();
      meta.textContent = `Last updated: ${date}`;
      deleteBtn.style.display = 'block';
    } else {
      meta.textContent = '';
      deleteBtn.style.display = 'none';
    }
  }

  function openNoteModal(username) {
    xpnLog('content', 'log', `Opening modal for @${username}`);
    const modal = getModal();
    const note = getNote(username);

    modal.setAttribute('data-username', username);
    modal.querySelector('.xpn-modal-username').textContent = `@${username}`;

    const textarea = modal.querySelector('.xpn-modal-textarea');
    textarea.value = note?.note || '';

    // Update score history display
    updateScoreHistoryDisplay(modal, username);

    const meta = modal.querySelector('.xpn-modal-meta');
    if (note && (note.note || (note.scores && note.scores.length > 0))) {
      const date = new Date(note.updatedAt).toLocaleString();
      meta.textContent = `Last updated: ${date}`;
      modal.querySelector('.xpn-modal-delete').style.display = 'block';
    } else {
      meta.textContent = '';
      modal.querySelector('.xpn-modal-delete').style.display = 'none';
    }

    modal.classList.add('xpn-modal-open');
    document.body.style.overflow = 'hidden';

    // Don't auto-focus textarea - let user press Tab to focus, or number keys for quick score
  }

  function closeModal() {
    const modal = document.querySelector(`.${CONFIG.modalClass}`);
    if (modal) {
      modal.classList.remove('xpn-modal-open');
      document.body.style.overflow = '';
    }
  }

  // ============================================================
  // Indicator Updates
  // ============================================================

  function updateAllIndicators() {
    document.querySelectorAll(`.${CONFIG.buttonClass}`).forEach(button => {
      const username = button.getAttribute('data-username');
      const avgScore = getAverageScore(username);
      const scoreCount = getScores(username).length;
      const hasNoteData = hasNote(username);

      // Remove all score classes first
      button.classList.remove('xpn-has-score', 'xpn-score-1', 'xpn-score-2', 'xpn-score-3', 'xpn-score-4', 'xpn-score-5');

      if (avgScore !== null) {
        // Format: show decimal only if not a whole number
        const displayScore = avgScore % 1 === 0 ? avgScore.toString() : avgScore.toFixed(1);
        button.innerHTML = `<span class="xpn-score-display">${displayScore}</span>`;
        button.classList.add('xpn-has-score');
        // Map average to nearest color tier (1-5)
        const colorTier = Math.max(1, Math.min(5, Math.round(avgScore)));
        button.classList.add(`xpn-score-${colorTier}`);
        button.setAttribute('title', `Avg: ${displayScore}/5 (${scoreCount} score${scoreCount > 1 ? 's' : ''}) - Click to edit`);
      } else {
        // Show SVG icon
        button.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"/>
          </svg>
        `;
        if (hasNoteData) {
          button.classList.add(CONFIG.indicatorClass);
          button.setAttribute('title', `View/edit note for @${username}`);
        } else {
          button.classList.remove(CONFIG.indicatorClass);
          button.setAttribute('title', `Add note for @${username}`);
        }
      }
    });
  }

  // ============================================================
  // DOM Observer
  // ============================================================

  let processTimeout = null;

  function processPage() {
    const usernameElements = findUsernameElements();
    let injectedCount = 0;

    usernameElements.forEach(({ element, username }) => {
      // Skip if already processed
      if (element.hasAttribute(CONFIG.processedAttr)) return;

      // Skip common non-profile pages
      const skipUsernames = ['home', 'explore', 'notifications', 'messages', 'settings', 'search', 'compose', 'i', 'intent'];
      if (skipUsernames.includes(username.toLowerCase())) return;

      injectButton(element, username);
      injectedCount++;
    });

    if (injectedCount > 0) {
      xpnLog('content', 'log', `Injected ${injectedCount} note buttons`);
    }
  }

  function debouncedProcess() {
    if (processTimeout) {
      clearTimeout(processTimeout);
    }
    processTimeout = setTimeout(processPage, CONFIG.debounceMs);
  }

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        debouncedProcess();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // ============================================================
  // Initialization
  // ============================================================

  async function init() {
    xpnLog('content', 'log', 'X Profile Notes initialized');

    // Load cached notes
    await loadNotes();

    // Listen for storage changes (from popup or other tabs)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.notes) {
        notesCache = changes.notes.newValue || {};
        updateAllIndicators();
      }
    });

    // Initial processing
    processPage();

    // Set up mutation observer for dynamic content
    setupObserver();

    // Also process on navigation (X.com uses client-side routing)
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        debouncedProcess();
      }
    }).observe(document.body, { childList: true, subtree: true });

    // Global keyboard shortcut: Alt+N to open note for first profile
    document.addEventListener('keydown', (e) => {
      // Check for Alt+N (not Ctrl+N which opens new Chrome tab)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
        // Don't trigger if user is typing in an input field
        const activeTag = document.activeElement?.tagName.toLowerCase();
        const isEditable = document.activeElement?.isContentEditable;
        if (activeTag === 'textarea' || activeTag === 'input' || isEditable) {
          return; // Let the browser handle it
        }

        // Don't trigger if modal is already open
        const modal = document.querySelector(`.${CONFIG.modalClass}`);
        if (modal?.classList.contains('xpn-modal-open')) {
          return;
        }

        // Find the first username on the page
        // Check already-processed elements first (buttons already injected)
        const existingButtons = document.querySelectorAll(`.${CONFIG.buttonClass}`);

        let firstUsername = null;

        if (existingButtons.length > 0) {
          // Get username from first button
          firstUsername = existingButtons[0].getAttribute('data-username');
        } else {
          // Fall back to unprocessed elements
          const usernameElements = findUsernameElements();
          if (usernameElements.length > 0) {
            firstUsername = usernameElements[0].username;
          }
        }

        if (firstUsername) {
          e.preventDefault();
          xpnLog('content', 'log', `Keyboard shortcut Alt+N: opening modal for @${firstUsername}`);
          openNoteModal(firstUsername);
        }
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

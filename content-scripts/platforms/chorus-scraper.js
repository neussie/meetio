/**
 * Chorus.ai Meeting Scraper
 * Bulk export by clicking each meeting and extracting from side panel
 * Pattern: Same as Zoom - click meeting → side panel opens → extract → repeat
 */

(function() {
  'use strict';

  const { log, sleep, slugify, downloadFile } = window.HarnessExporterUtils;

  log('Chorus scraper loaded');

  /**
   * Detect which Chorus page we're on
   */
  function detectChorusPage() {
    const url = window.location.href;

    // Home page or calendar view with meeting list
    if (url.includes('/my-profile') || url.includes('/home') ||
        (url.includes('chorus.ai') && !url.includes('/meeting/'))) {
      return 'list';
    }

    return 'unknown';
  }

  /**
   * Get all meeting cards/rows from the home page
   * ONLY meetings with recordings (has "Meeting Recap" or "Meeting Brief" badge)
   */
  function getAllMeetingCards() {
    log('Searching for meeting cards with recordings...');

    // Find calendar rows that contain meeting info
    const rows = Array.from(document.querySelectorAll('.calendar-row, [class*="calendar-row"]'));

    // Filter to only rows that have meeting content AND recordings
    const meetingRows = rows.filter(row => {
      const text = row.textContent;

      // Must have substantial content and look like a meeting
      if (text.length < 30) return false;
      if (!text.match(/AM|PM/) && !text.match(/\d{1,2}:\d{2}/)) return false;
      if (text.includes('Sunday') || text.includes('Monday')) return false;

      // CRITICAL: Must have "Meeting Recap" or "Meeting Brief" badge (indicates recording exists)
      if (!text.includes('Meeting Recap') && !text.includes('Meeting Brief')) {
        return false;
      }

      // Skip grayed-out meetings (no recording indicator)
      const grayedOut = row.querySelector('.color-lighter-grey');
      if (grayedOut && text.includes('—')) {
        return false;
      }

      return true;
    });

    log(`✓ Found ${meetingRows.length} meetings WITH recordings`);

    if (meetingRows.length > 0) {
      log('First 5 meetings:');
      meetingRows.slice(0, 5).forEach((row, i) => {
        const text = row.textContent.trim().substring(0, 80);
        log(`  [${i}] ${text}...`);
      });
    }

    return meetingRows;
  }

  /**
   * Wait for the side panel to appear
   * We look for the Transcript tab to appear (indicates panel loaded)
   */
  async function waitForSidePanel() {
    log('Waiting for side panel...');

    let attempts = 0;
    const maxAttempts = 20; // 10 seconds

    while (attempts < maxAttempts) {
      // Check if Transcript tab appeared (indicates panel is loaded)
      const allTabs = document.querySelectorAll('[role="tab"]');
      let transcriptTabFound = false;

      for (const tab of allTabs) {
        if (tab.textContent.trim().toLowerCase() === 'transcript') {
          transcriptTabFound = true;
          log('✓ Side panel loaded (Transcript tab found)');

          // Find the panel container - walk up from tab
          let panel = tab.closest('[class*="preview"]') ||
                      tab.closest('[class*="panel"]') ||
                      tab.closest('[class*="drawer"]') ||
                      tab.closest('aside') ||
                      document; // Fallback to whole document

          if (panel !== document) {
            log(`✓ Found panel container: ${panel.className}`);
          } else {
            log('Using whole document as panel');
          }

          return panel;
        }
      }

      await sleep(500);
      attempts++;
    }

    log('⚠️  Side panel did not load (no Transcript tab found)');
    return null;
  }

  /**
   * UNUSED: Find the "Copy transcript" button in the side panel
   * Button contains: <i class="fa-copy fa-regular">
   * (Kept for reference - we now scrape DOM directly)
   */
  /*
  function findCopyTranscriptButton(panel) {
    if (!panel) {
      // Search entire document if no panel specified
      panel = document;
    }

    log('Looking for Copy Transcript button...');

    // Method 1: Look for FontAwesome copy icon
    const copyIcon = panel.querySelector('i.fa-copy, i[class*="fa-copy"]');
    if (copyIcon) {
      // Find the parent button
      let button = copyIcon.closest('button');
      if (!button) {
        button = copyIcon.closest('[role="button"]');
      }
      if (!button) {
        button = copyIcon.closest('a');
      }

      if (button) {
        log('✓ Found Copy button via fa-copy icon');
        return button;
      }
    }

    // Method 2: Look for button with "Copy" text
    const buttons = panel.querySelectorAll('button, [role="button"]');
    for (const button of buttons) {
      const text = button.textContent.toLowerCase();
      if (text.includes('copy transcript') ||
          (text.includes('copy') && button.querySelector('i.fa-copy'))) {
        log('✓ Found Copy Transcript button via text');
        return button;
      }
    }

    log('✗ Could not find Copy Transcript button');
    return null;
  }
  */

  /**
   * Extract meeting metadata from Overview tab
   * Must be called BEFORE clicking Transcript tab!
   */
  function extractMetadataFromOverviewTab() {
    log('Extracting metadata from Overview tab...');

    // The Overview tab shows:
    // - Meeting title (h1/h2 at top)
    // - "Meeting Date: Jun 22, 2026"
    // - "Participants: Name +13"
    // - "Account: Company Name"

    let title = 'Unknown Meeting';
    let meetingDate = new Date().toISOString().split('T')[0];
    let attendees = '';
    let account = '';

    // Find title - look for the exact element with class "title"
    // Chorus format: <a class="title overflow-ellipsis-2-lines" ...>Meeting Title</a>

    const titleElement = document.querySelector('a.title.overflow-ellipsis-2-lines') ||
                         document.querySelector('a.title') ||
                         document.querySelector('[class*="title"][class*="overflow"]');

    if (titleElement) {
      title = titleElement.textContent.trim();
      log(`✓ Title (from .title element): ${title}`);
    } else {
      log('⚠️  Could not find title element, searching headings...');

      // Fallback: Look in headings within side panel
      const panel = document.querySelector('[class*="preview"]') ||
                    document.querySelector('[class*="panel"]') ||
                    document.querySelector('[class*="drawer"]') ||
                    document.querySelector('aside');

      const titleSelectors = ['h1', 'h2'];
      const searchArea = panel || document;

      for (const sel of titleSelectors) {
        const els = searchArea.querySelectorAll(sel);
        for (const el of els) {
          const text = el.textContent.trim();
          // Must have reasonable length and not be navigation text
          if (text.length > 5 && text.length < 200 &&
              !text.match(/^(Chorus|Home|Overview|Comments|Transcript)$/)) {
            title = text;
            log(`✓ Title (from ${sel}): ${title}`);
            break;
          }
        }
        if (title !== 'Unknown Meeting') break;
      }
    }

    // Find "Meeting Date: Jun 22, 2026"
    const bodyText = document.body.innerText;
    const dateMatch = bodyText.match(/Meeting Date:\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4})/);
    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed)) {
        meetingDate = parsed.toISOString().split('T')[0];
        log(`✓ Date: ${meetingDate} (from "${dateMatch[1]}")`);
      }
    }

    // Find "Participants: Steven Lilford +13"
    const participantsMatch = bodyText.match(/Participants?:\s*([^\n]+)/);
    if (participantsMatch) {
      attendees = participantsMatch[1].trim();
      // Clean up the "+13" part if present
      attendees = attendees.replace(/\s*\+\d+$/, ' and others');
      log(`✓ Participants: ${attendees}`);
    }

    // Find "Account: Infosys Ltd"
    const accountMatch = bodyText.match(/Account:\s*([^\n]+)/);
    if (accountMatch) {
      account = accountMatch[1].trim();
      log(`✓ Account: ${account}`);
    }

    return {
      title,
      meetingDate,
      attendees,
      account
    };
  }

  /**
   * UNUSED: Click "Copy transcript" button and get transcript from clipboard
   * (Kept for reference - we now scrape DOM directly)
   */
  /*
  async function getTranscriptFromClipboard(copyButton) {
    log('Clicking Copy Transcript button...');

    // Click the button
    copyButton.click();

    // Wait for clipboard to be populated
    await sleep(500);

    try {
      // Read from clipboard
      const text = await navigator.clipboard.readText();
      log(`✓ Got transcript from clipboard: ${text.length} characters`);

      // Parse the transcript text
      // Chorus format is typically: "Speaker Name\nTimestamp\nText\n\n"
      const lines = text.split('\n').filter(line => line.trim().length > 0);

      const transcriptLines = [];
      let currentSpeaker = '';
      let currentTime = '';
      let currentText = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if this is a timestamp (MM:SS or HH:MM:SS)
        if (line.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
          currentTime = line;
        }
        // Check if this is a speaker name (capitalized words)
        else if (line.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/)) {
          // Save previous entry if exists
          if (currentSpeaker && currentText) {
            transcriptLines.push(`**${currentSpeaker}** ${currentTime ? `(${currentTime})` : ''}: ${currentText}`);
          }

          currentSpeaker = line;
          currentText = '';
          currentTime = '';
        }
        // This is transcript text
        else {
          if (currentText) {
            currentText += ' ' + line;
          } else {
            currentText = line;
          }
        }
      }

      // Add last entry
      if (currentSpeaker && currentText) {
        transcriptLines.push(`**${currentSpeaker}** ${currentTime ? `(${currentTime})` : ''}: ${currentText}`);
      }

      log(`✓ Parsed ${transcriptLines.length} transcript entries`);

      return transcriptLines;
    } catch (error) {
      log(`✗ Failed to read clipboard: ${error.message}`);
      return [];
    }
  }
  */

  /**
   * Scrape transcript directly from the DOM
   * Chorus format: Speaker name, timestamp, then text
   */
  function scrapeTranscriptFromDOM() {
    log('Scraping transcript from DOM...');

    // The transcript is rendered as a series of elements
    // Each entry typically has: speaker name, timestamp, and text

    // Look for transcript entries - try multiple patterns
    const containers = [
      document.querySelector('[class*="transcript-container"]'),
      document.querySelector('[class*="Transcript"]'),
      document.querySelector('[id*="transcript"]'),
      // Fallback: look for the active tab panel
      document.querySelector('[role="tabpanel"][aria-hidden="false"]')
    ].filter(Boolean);

    if (containers.length === 0) {
      log('✗ No transcript container found');
      return [];
    }

    const container = containers[0];
    log(`✓ Using container: ${container.className || container.id || container.tagName}`);

    const transcriptLines = [];

    // Try to find structured transcript entries
    // Each entry might be in a div or list item
    const entries = container.querySelectorAll('div, p, li');

    let currentSpeaker = '';
    let currentTime = '';
    let currentText = '';

    Array.from(entries).forEach(entry => {
      const text = entry.textContent.trim();

      if (text.length < 2) return;

      // Check if this is a timestamp (e.g., "0:04")
      if (text.match(/^\d{1,2}:\d{2}$/)) {
        currentTime = text;
      }
      // Check if this is a speaker name (capitalized words, 2-4 words max)
      else if (text.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/) && text.length < 50) {
        // Save previous entry if complete
        if (currentSpeaker && currentText) {
          transcriptLines.push(`**${currentSpeaker}** ${currentTime ? `(${currentTime})` : ''}: ${currentText}`);
        }

        currentSpeaker = text;
        currentText = '';
        currentTime = '';
      }
      // This is transcript text
      else if (!text.match(/^(Overview|Comments|Transcript|Meeting Details|Action Items)$/i)) {
        if (currentText) {
          currentText += ' ' + text;
        } else {
          currentText = text;
        }
      }
    });

    // Add last entry
    if (currentSpeaker && currentText) {
      transcriptLines.push(`**${currentSpeaker}** ${currentTime ? `(${currentTime})` : ''}: ${currentText}`);
    }

    // If structured parsing didn't work, try simpler line-by-line
    if (transcriptLines.length < 3) {
      log('Structured parsing failed, trying line-by-line...');
      const lines = container.innerText.split('\n').filter(l => l.trim().length > 5);

      currentSpeaker = '';
      currentTime = '';
      currentText = '';

      lines.forEach(line => {
        const trimmed = line.trim();

        if (trimmed.match(/^\d{1,2}:\d{2}$/)) {
          currentTime = trimmed;
        } else if (trimmed.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/) && trimmed.length < 50) {
          if (currentSpeaker && currentText) {
            transcriptLines.push(`**${currentSpeaker}** ${currentTime ? `(${currentTime})` : ''}: ${currentText}`);
          }
          currentSpeaker = trimmed;
          currentText = '';
        } else if (!trimmed.match(/^(Overview|Comments|Transcript)$/i)) {
          currentText = currentText ? currentText + ' ' + trimmed : trimmed;
        }
      });

      if (currentSpeaker && currentText) {
        transcriptLines.push(`**${currentSpeaker}** ${currentTime ? `(${currentTime})` : ''}: ${currentText}`);
      }
    }

    log(`✓ Scraped ${transcriptLines.length} transcript entries`);

    if (transcriptLines.length > 0) {
      log('First 3 entries:');
      transcriptLines.slice(0, 3).forEach((line, i) => {
        log(`  [${i}] ${line.substring(0, 80)}...`);
      });
    }

    return transcriptLines;
  }

  /**
   * Extract transcript from side panel
   * Flow: Extract metadata from Overview → Click Transcript tab → Scrape transcript
   */
  async function extractTranscriptFromPanel(panel) {
    log('Extracting data from side panel...');

    // STEP 1: Extract metadata from Overview tab (BEFORE switching tabs!)
    log('Step 1: Extracting metadata from Overview tab...');
    const metadata = extractMetadataFromOverviewTab();

    // STEP 2: Find and click the "Transcript" tab
    log('Step 2: Looking for Transcript tab...');
    const allTabs = document.querySelectorAll('[role="tab"]');
    let transcriptTab = null;

    for (const tab of allTabs) {
      const tabText = tab.textContent.trim().toLowerCase();
      if (tabText === 'transcript') {
        // Check if it's NOT already active
        const isActive = tab.classList.contains('mdc-tab--active') ||
                        tab.classList.contains('mat-mdc-tab-active') ||
                        tab.getAttribute('aria-selected') === 'true';

        if (!isActive) {
          transcriptTab = tab;
          log(`  Found Transcript tab (inactive): ${tab.className}`);
        } else {
          log('  Transcript tab already active');
        }
        break;
      }
    }

    if (transcriptTab) {
      log('  Clicking Transcript tab...');
      transcriptTab.click();
      await sleep(2000); // Wait for tab content to load
    } else {
      log('  ⚠️  Transcript tab not found or already active');
      await sleep(500);
    }

    // STEP 3: Scrape transcript directly from DOM
    log('Step 3: Scraping transcript from DOM...');
    const transcriptLines = scrapeTranscriptFromDOM();

    if (transcriptLines.length === 0) {
      log('✗ No transcript entries found');
      return null;
    }

    return {
      ...metadata,
      transcriptLines
    };
  }

  /**
   * Close the side panel
   */
  async function closeSidePanel() {
    log('Attempting to close side panel...');

    // Method 1: Look for close button with various selectors
    const closeSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="Close"]',
      '[class*="close-button"]',
      '[class*="closeButton"]',
      'button[class*="close"]',
      '[role="button"][class*="close"]',
      'button > svg[class*="close"]',
      'button:has(svg[class*="close"])'
    ];

    for (const selector of closeSelectors) {
      try {
        const closeButton = document.querySelector(selector);
        if (closeButton && closeButton.offsetParent !== null) { // Check if visible
          log(`  Found close button: ${selector}`);
          closeButton.click();
          await sleep(1000);
          log('  ✓ Panel closed');
          return;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Method 2: Press Escape key
    log('  Trying Escape key...');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await sleep(1000);
    log('  ✓ Pressed Escape');
  }

  /**
   * Generate markdown from transcript data
   */
  function generateMarkdown(data) {
    if (!data) return '';

    let md = `## ✧ Metadata\n`;
    md += `- **Meeting Title:** ${data.title}\n`;
    md += `- **Date:** ${data.meetingDate}\n`;
    if (data.attendees) {
      md += `- **Attendees:** ${data.attendees}\n`;
    }
    if (data.account) {
      md += `- **Account:** ${data.account}\n`;
    }
    md += `- **Recording / Source:** Chorus.ai\n`;
    md += `- **Language:** English\n\n`;

    md += `## ✧ Transcript\n\n`;

    if (data.transcriptLines && data.transcriptLines.length > 0) {
      data.transcriptLines.forEach(line => {
        md += `${line}\n`;
      });
    }

    return md;
  }

  /**
   * Export all meetings (bulk)
   * Pattern: Click each meeting → side panel opens → extract → close → repeat
   */
  async function exportAllMeetings() {
    log('\n=== EXPORT ALL MEETINGS (BULK) ===\n');

    const meetingCards = getAllMeetingCards();

    if (meetingCards.length === 0) {
      alert('No meetings found on this page.\n\nMake sure you are on the Chorus home page.');
      return;
    }

    // Confirm with user
    if (meetingCards.length > 5) {
      if (!confirm(`Export ${meetingCards.length} meetings? This will download ${meetingCards.length} markdown files.`)) {
        log('Export cancelled by user');
        return;
      }
    }

    log(`Starting export of ${meetingCards.length} meetings...\n`);

    const results = [];

    for (let i = 0; i < meetingCards.length; i++) {
      const card = meetingCards[i];
      const cardText = card.textContent.trim().substring(0, 60);

      log(`\n[${i + 1}/${meetingCards.length}] ${cardText}...`);

      try {
        // Scroll into view
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);

        // Click the meeting row to open side panel
        log('  Clicking meeting row...');

        // Simple click on the row (not the link)
        // Chorus handles row clicks to show sidebar
        card.click();

        // Wait for side panel to appear
        await sleep(2000);
        const panel = await waitForSidePanel();

        if (!panel) {
          log('  ✗ Side panel did not appear');
          results.push({ success: false, title: cardText });
          continue;
        }

        // Extract transcript from side panel
        const data = await extractTranscriptFromPanel(panel);

        if (data && data.transcriptLines?.length > 0) {
          // Generate markdown
          const markdown = generateMarkdown(data);

          // Create filename - use a fallback if title extraction failed
          let safeTitle = data.title;
          if (safeTitle === 'Unknown Meeting' || safeTitle.includes('June') || safeTitle.includes('July')) {
            // Fallback: extract clean title from meeting card text
            // Card format: "Time\nTitle\nno show Harness <> Topic\nMeeting Recap\nParticipant +N"
            let fallbackTitle = cardText;

            // Remove time stamps (12:00 PM, 4:00 PM, etc)
            fallbackTitle = fallbackTitle.replace(/\d{1,2}:\d{2}\s*(AM|PM)/gi, '');

            // Remove "Meeting Recap" / "Meeting Brief"
            fallbackTitle = fallbackTitle.replace(/Meeting\s+(Recap|Brief)/gi, '');

            // Remove participant info (Name +N)
            fallbackTitle = fallbackTitle.replace(/[A-Z][a-z]+\s+[A-Z][a-z]+\s+\+\d+/g, '');

            // Remove "no show" text
            fallbackTitle = fallbackTitle.replace(/no\s+show/gi, '');

            // Clean up whitespace and get first meaningful line
            const lines = fallbackTitle.split('\n').map(l => l.trim()).filter(l => l.length > 5);
            safeTitle = lines[0] || `Meeting-${i + 1}`;

            log(`  ⚠️  Using fallback title: ${safeTitle}`);
          }

          const filename = `${data.meetingDate}_${slugify(safeTitle)}.md`;

          // Download
          downloadFile(filename, markdown);

          log(`  ✓ Downloaded: ${filename}`);
          results.push({ success: true, title: safeTitle });
        } else {
          log(`  ✗ No transcript found`);
          if (data) {
            log(`  Debug: title="${data.title}", transcriptLines=${data.transcriptLines?.length || 0}`);
          }
          results.push({ success: false, title: cardText, reason: 'No transcript' });
        }

        // Close the side panel before moving to next
        await closeSidePanel();

        // Wait before next meeting
        if (i < meetingCards.length - 1) {
          await sleep(1500);
        }

      } catch (error) {
        log(`  ✗ Error: ${error.message}`);
        results.push({ success: false, title: cardText, error: error.message });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    log(`\n=== EXPORT COMPLETE ===`);
    log(`✓ Successful: ${successful}`);
    log(`✗ Failed: ${failed}`);
    log(`Total: ${results.length}`);

    alert(`Export complete!\n✓ ${successful} meetings exported\n✗ ${failed} failed`);

    return results;
  }

  /**
   * Add export button
   */
  function addExportButton() {
    const button = document.createElement('button');
    button.id = 'meetio-chorus-export-btn';
    button.textContent = '📚 Export All Meetings';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      padding: 14px 24px;
      background: #00B8E6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 184, 230, 0.3);
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#0099CC';
      button.style.transform = 'translateY(-2px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#00B8E6';
      button.style.transform = 'translateY(0)';
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '⏳ Exporting...';

      try {
        await exportAllMeetings();
      } catch (error) {
        log('Error:', error);
        alert('Export failed. Check console for details.');
      }

      button.disabled = false;
      button.textContent = '📚 Export All Meetings';
    });

    document.body.appendChild(button);
    log('✓ Export button added');
  }

  /**
   * Initialize
   */
  async function init() {
    log('Initializing Chorus scraper...');

    // Wait for page to load
    await sleep(2000);

    const pageType = detectChorusPage();
    log(`Detected page type: ${pageType}`);

    if (pageType === 'list') {
      const meetings = getAllMeetingCards();
      log(`✓ Found ${meetings.length} meetings available for export`);

      // Add export button
      addExportButton();

      log('✓ Ready!');
    } else {
      log('⚠️  Not on Chorus home page - navigate to home to export');
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

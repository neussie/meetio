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
   * Get all meeting links/cards from the home page
   * Based on console output: a[href*="/meeting/"]
   */
  function getAllMeetingLinks() {
    log('Searching for meeting links...');

    const links = Array.from(document.querySelectorAll('a[href*="/meeting/"]'));

    log(`✓ Found ${links.length} meeting links`);

    if (links.length > 0) {
      log('First 5 meetings:');
      links.slice(0, 5).forEach((link, i) => {
        log(`  [${i}] ${link.textContent.trim().substring(0, 60)}...`);
      });
    }

    return links;
  }

  /**
   * Wait for the side panel to appear and load
   */
  async function waitForSidePanel() {
    log('Waiting for side panel...');

    // The side panel appears on the right side when you click a meeting
    // Look for the panel by common identifiers
    const selectors = [
      '[class*="meeting-preview"]',
      '[class*="MeetingPreview"]',
      '[class*="side-panel"]',
      '[class*="SidePanel"]',
      'aside',
      '[role="complementary"]'
    ];

    let panel = null;
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds

    while (!panel && attempts < maxAttempts) {
      for (const selector of selectors) {
        panel = document.querySelector(selector);
        if (panel && panel.offsetParent !== null) { // Check if visible
          log(`✓ Found side panel: ${selector}`);
          return panel;
        }
      }
      await sleep(500);
      attempts++;
    }

    // Fallback: look for any element that appeared recently on the right side
    log('⚠️  Could not find side panel with known selectors');
    return null;
  }

  /**
   * Find the "Copy transcript" button in the side panel
   */
  function findCopyTranscriptButton(panel) {
    if (!panel) return null;

    log('Looking for Copy Transcript button...');

    // Look for button with "Copy transcript" text
    const buttons = panel.querySelectorAll('button, [role="button"], a');

    for (const button of buttons) {
      const text = button.textContent.toLowerCase();
      if (text.includes('copy transcript') || text.includes('copy') && text.includes('transcript')) {
        log('✓ Found Copy Transcript button');
        return button;
      }
    }

    log('✗ Could not find Copy Transcript button');
    return null;
  }

  /**
   * Extract meeting metadata from side panel
   */
  function extractMetadataFromPanel(panel) {
    if (!panel) {
      return {
        title: 'Unknown Meeting',
        meetingDate: new Date().toISOString().split('T')[0],
        attendees: ''
      };
    }

    log('Extracting metadata from panel...');

    // Find title - usually an h1, h2, or link at the top
    let title = 'Unknown Meeting';
    const titleEl = panel.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]');
    if (titleEl) {
      title = titleEl.textContent.trim();
      log(`✓ Title: ${title}`);
    }

    // Find date - look for "Meeting Date:" label or similar
    let meetingDate = new Date().toISOString().split('T')[0];
    const dateText = panel.textContent;
    const dateMatch = dateText.match(/Meeting Date:\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/);
    if (dateMatch) {
      const parsed = new Date(dateMatch[0].replace('Meeting Date:', '').trim());
      if (!isNaN(parsed)) {
        meetingDate = parsed.toISOString().split('T')[0];
        log(`✓ Date: ${meetingDate}`);
      }
    }

    // Find participants/attendees
    const participantEls = panel.querySelectorAll('[class*="participant"], [class*="Participant"], [title]');
    const attendees = [];

    participantEls.forEach(el => {
      const name = el.getAttribute('title') || el.textContent.trim();
      if (name && name.length > 2 && name.length < 50 &&
          !attendees.includes(name) && !name.match(/^[A-Z]{2}$/)) {
        attendees.push(name);
      }
    });

    log(`✓ Found ${attendees.length} attendees`);

    return {
      title,
      meetingDate,
      attendees: attendees.slice(0, 10).join(', ')
    };
  }

  /**
   * Click "Copy transcript" button and get transcript from clipboard
   */
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

  /**
   * Extract transcript from side panel
   */
  async function extractTranscriptFromPanel(panel) {
    log('Extracting transcript from side panel...');

    // First, try to find and click the "Transcript" tab if needed
    const transcriptTab = Array.from(panel.querySelectorAll('[role="tab"], button, a')).find(el =>
      el.textContent.trim().toLowerCase() === 'transcript'
    );

    if (transcriptTab) {
      log('Clicking Transcript tab...');
      transcriptTab.click();
      await sleep(1000);
    }

    // Get metadata
    const metadata = extractMetadataFromPanel(panel);

    // Find and use the "Copy transcript" button
    const copyButton = findCopyTranscriptButton(panel);

    if (copyButton) {
      const transcriptLines = await getTranscriptFromClipboard(copyButton);

      if (transcriptLines.length > 0) {
        log('First 3 entries:');
        transcriptLines.slice(0, 3).forEach((line, i) => {
          log(`  [${i}] ${line.substring(0, 80)}...`);
        });

        return {
          ...metadata,
          transcriptLines
        };
      }
    }

    // Fallback: scrape transcript text directly from panel
    log('⚠️  Falling back to direct scraping...');

    const transcriptContainer = panel.querySelector('[class*="transcript"]') || panel;
    const transcriptText = transcriptContainer.textContent;

    // Parse transcript entries (simple fallback)
    const transcriptLines = [];
    const lines = transcriptText.split('\n').filter(line => line.trim().length > 10);

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length > 5 && !trimmed.match(/^(Transcript|Overview|Comments)$/i)) {
        // Try to identify speaker
        const speakerMatch = trimmed.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
        if (speakerMatch) {
          const speaker = speakerMatch[1];
          const content = trimmed.substring(speaker.length).trim();
          if (content.length > 0) {
            transcriptLines.push(`**${speaker}**: ${content}`);
          }
        } else {
          transcriptLines.push(trimmed);
        }
      }
    });

    log(`✓ Scraped ${transcriptLines.length} lines`);

    return {
      ...metadata,
      transcriptLines
    };
  }

  /**
   * Close the side panel
   */
  async function closeSidePanel() {
    // Look for close button (X icon)
    const closeButton = document.querySelector('[class*="close"], [aria-label*="close" i], [aria-label*="Close" i]');

    if (closeButton) {
      log('Closing side panel...');
      closeButton.click();
      await sleep(500);
    } else {
      // Click outside the panel to close it
      log('Clicking outside panel to close...');
      const overlay = document.querySelector('[class*="overlay"]') || document.body;
      overlay.click();
      await sleep(500);
    }
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

    const meetingLinks = getAllMeetingLinks();

    if (meetingLinks.length === 0) {
      alert('No meetings found on this page.\n\nMake sure you are on the Chorus home page.');
      return;
    }

    // Confirm with user
    if (meetingLinks.length > 5) {
      if (!confirm(`Export ${meetingLinks.length} meetings? This will download ${meetingLinks.length} markdown files.`)) {
        log('Export cancelled by user');
        return;
      }
    }

    log(`Starting export of ${meetingLinks.length} meetings...\n`);

    const results = [];

    for (let i = 0; i < meetingLinks.length; i++) {
      const link = meetingLinks[i];
      const linkText = link.textContent.trim().substring(0, 60);

      log(`\n[${i + 1}/${meetingLinks.length}] ${linkText}...`);

      try {
        // Scroll into view
        link.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);

        // Click the meeting link to open side panel
        log('  Clicking meeting...');
        link.click();

        // Wait for side panel to appear
        await sleep(2000);
        const panel = await waitForSidePanel();

        if (!panel) {
          log('  ✗ Side panel did not appear');
          results.push({ success: false, title: linkText });
          continue;
        }

        // Extract transcript from side panel
        const data = await extractTranscriptFromPanel(panel);

        if (data && data.transcriptLines?.length > 0) {
          // Generate markdown
          const markdown = generateMarkdown(data);

          // Create filename
          const filename = `${data.meetingDate}_${slugify(data.title)}.md`;

          // Download
          downloadFile(filename, markdown);

          log(`  ✓ Downloaded: ${filename}`);
          results.push({ success: true, title: data.title });
        } else {
          log(`  ✗ No transcript found`);
          results.push({ success: false, title: linkText });
        }

        // Close the side panel before moving to next
        await closeSidePanel();

        // Wait before next meeting
        if (i < meetingLinks.length - 1) {
          await sleep(1500);
        }

      } catch (error) {
        log(`  ✗ Error: ${error.message}`);
        results.push({ success: false, title: linkText, error: error.message });
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
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#4f46e5';
      button.style.transform = 'translateY(-2px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#6366f1';
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
      const meetings = getAllMeetingLinks();
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

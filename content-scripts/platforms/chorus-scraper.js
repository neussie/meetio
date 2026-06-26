/**
 * Chorus.ai Meeting Scraper
 * Supports bulk export from Home page and single export from meeting pages
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
    if (url.includes('/my-profile') || url.includes('/home') || url.includes('chorus.ai/') && !url.includes('/meeting/')) {
      return 'list';
    }
    // Individual meeting detail page
    else if (url.includes('/meeting/') || url.includes('/call/')) {
      return 'detail';
    }

    return 'unknown';
  }

  /**
   * Get all meeting links from the home/list page
   */
  function getAllMeetingLinks() {
    log('Searching for meeting links...');

    // Based on console output: a[href*="/meeting/"]
    const links = Array.from(document.querySelectorAll('a[href*="/meeting/"]'));

    log(`✓ Found ${links.length} meeting links`);

    // Extract data from each link
    const meetings = links.map((link, i) => {
      const href = link.href;
      const meetingId = href.split('/meeting/')[1];
      const text = link.textContent.trim();

      // Try to parse title and date from link text
      // Format: "Title Company XX mins left  Date"
      let title = text;
      let date = '';

      // Extract date (pattern: Jun 22, 2026)
      const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/);
      if (dateMatch) {
        date = dateMatch[0];
        // Remove date from title
        title = text.substring(0, text.indexOf(dateMatch[0])).trim();
      }

      // Clean up title (remove "XX mins left" pattern)
      title = title.replace(/\d+\s+mins?\s+left/gi, '').trim();

      return {
        href,
        meetingId,
        title,
        date,
        rawText: text
      };
    });

    if (meetings.length > 0) {
      log('First 3 meetings:');
      meetings.slice(0, 3).forEach((m, i) => {
        log(`  [${i}] ${m.title} - ${m.date}`);
      });
    }

    return meetings;
  }

  /**
   * Extract meeting metadata from detail page
   */
  function extractMeetingMetadata() {
    log('Extracting meeting metadata...');

    // Try to find meeting title in header
    const titleSelectors = [
      'h1',
      'h2',
      '[class*="meeting-title"]',
      '[class*="MeetingTitle"]',
      '[class*="heading"]'
    ];

    let title = 'Unknown Meeting';
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 5 && el.textContent.trim().length < 200) {
        title = el.textContent.trim();
        log(`✓ Found title: ${title}`);
        break;
      }
    }

    // Try to find date from "Meeting Details" section
    let meetingDate = new Date().toISOString().split('T')[0];

    // Look for text like "Meeting Date: Jun 24, 2026"
    const dateText = document.body.textContent;
    const dateMatch = dateText.match(/Meeting Date:\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/);
    if (dateMatch) {
      const parsed = new Date(dateMatch[0].replace('Meeting Date:', '').trim());
      if (!isNaN(parsed)) {
        meetingDate = parsed.toISOString().split('T')[0];
        log(`✓ Found date: ${meetingDate}`);
      }
    }

    // Try to find participants
    const participantElements = document.querySelectorAll('[class*="participant"], [class*="Participant"], [class*="avatar"]');
    const attendees = [];

    participantElements.forEach(el => {
      const name = el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent.trim();
      if (name && name.length > 2 && name.length < 50 && !attendees.includes(name) && !name.match(/^[A-Z]{2}$/)) {
        attendees.push(name);
      }
    });

    log(`✓ Found ${attendees.length} attendees`);

    return {
      title,
      meetingDate,
      attendees: attendees.slice(0, 10).join(', ') // Limit to 10
    };
  }

  /**
   * Extract transcript from the "Transcript" tab on detail page
   */
  async function extractTranscript() {
    log('Extracting transcript...');

    // First, check if we need to click the "Transcript" tab
    const transcriptTab = Array.from(document.querySelectorAll('[role="tab"], button, a')).find(el =>
      el.textContent.trim().toLowerCase() === 'transcript'
    );

    if (transcriptTab && !transcriptTab.classList.contains('active')) {
      log('Clicking Transcript tab...');
      transcriptTab.click();
      await sleep(2000); // Wait for content to load
    }

    const metadata = extractMeetingMetadata();

    // Look for transcript container
    // The transcript is usually in a scrollable container
    const transcriptContainer = document.querySelector('[class*="transcript"]') ||
                                 document.querySelector('[class*="Transcript"]') ||
                                 document.querySelector('main');

    if (!transcriptContainer) {
      log('✗ Could not find transcript container');
      return null;
    }

    log('✓ Found transcript container');

    // Chorus transcript format: timestamp + speaker + text
    // Look for individual transcript lines/entries
    const transcriptLines = [];

    // Try to find individual entries (speaker blocks)
    // Based on typical Chorus structure, each entry might be in its own div
    const entries = transcriptContainer.querySelectorAll('[class*="transcript-entry"], [class*="TranscriptEntry"], p, [class*="message"]');

    if (entries.length < 5) {
      log('Few structured entries found, parsing raw text...');

      // Fallback: Parse text content directly
      const text = transcriptContainer.textContent;

      // Split by timestamps (HH:MM or MM:SS pattern)
      const lines = text.split(/\n\d{1,2}:\d{2}\n/).filter(line => line.trim().length > 10);

      lines.forEach((line, i) => {
        const cleaned = line.trim();
        if (cleaned.length > 5) {
          // Try to extract speaker name (usually first words, capitalized)
          const speakerMatch = cleaned.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
          if (speakerMatch) {
            const speaker = speakerMatch[1];
            const content = cleaned.substring(speaker.length).trim();
            if (content.length > 0) {
              transcriptLines.push(`**${speaker}**: ${content}`);
            }
          } else {
            transcriptLines.push(cleaned);
          }
        }
      });
    } else {
      log(`✓ Found ${entries.length} transcript entries`);

      // Parse structured entries
      entries.forEach(entry => {
        const text = entry.textContent.trim();
        if (text.length < 5) return;

        // Try to find timestamp within entry
        const timeMatch = text.match(/(\d{1,2}:\d{2})/);
        const time = timeMatch ? timeMatch[1] : '';

        // Try to find speaker name
        let speaker = 'Unknown';
        let content = text;

        // Look for bold/strong elements (often used for speaker names)
        const strongEl = entry.querySelector('strong, b, [class*="speaker"], [class*="Speaker"]');
        if (strongEl) {
          speaker = strongEl.textContent.trim();
          content = text.replace(speaker, '').replace(time, '').trim();
        } else {
          // Try to extract speaker from beginning
          const speakerMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
          if (speakerMatch) {
            speaker = speakerMatch[1];
            content = text.substring(speaker.length).replace(time, '').trim();
          }
        }

        if (content.length > 0 && !content.match(/^(Transcript|Overview|Comments|Action Items)$/i)) {
          transcriptLines.push(`**${speaker}** ${time ? `(${time})` : ''}: ${content}`);
        }
      });
    }

    log(`✓ Extracted ${transcriptLines.length} transcript lines`);

    if (transcriptLines.length > 0) {
      log('First 3 entries:');
      transcriptLines.slice(0, 3).forEach((line, i) => {
        log(`  [${i}] ${line.substring(0, 80)}...`);
      });
    }

    return {
      ...metadata,
      transcriptLines
    };
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
   * Export single meeting (from detail page)
   */
  async function exportCurrentMeeting() {
    log('\n=== EXPORT CURRENT MEETING ===\n');

    const data = await extractTranscript();

    if (!data || !data.transcriptLines || data.transcriptLines.length === 0) {
      alert('Could not extract transcript. Make sure:\n1. The Transcript tab is visible\n2. The meeting has a transcript');
      return;
    }

    const markdown = generateMarkdown(data);
    const filename = `${data.meetingDate}_${slugify(data.title)}.md`;

    downloadFile(filename, markdown);
    log(`✓ Downloaded: ${filename}`);

    return { success: true, filename };
  }

  /**
   * Navigate to a meeting page and export it
   */
  async function navigateAndExport(meetingUrl, meetingInfo) {
    // Open in new tab
    const newWindow = window.open(meetingUrl, '_blank');

    if (!newWindow) {
      log(`✗ Could not open ${meetingUrl} - popup blocked?`);
      return { success: false, reason: 'Popup blocked', title: meetingInfo.title };
    }

    log(`✓ Opened ${meetingInfo.title} in new tab`);

    // Note: We can't directly control the new tab from here due to browser security
    // The user will need to click the export button in each tab
    // OR we need to use a different approach (background script)

    return { success: true, title: meetingInfo.title };
  }

  /**
   * Export all meetings - opens tabs for user to export
   */
  async function exportAllMeetings() {
    log('\n=== EXPORT ALL MEETINGS (BULK) ===\n');

    const meetings = getAllMeetingLinks();

    if (meetings.length === 0) {
      alert('No meetings found on this page.\n\nMake sure you are on the Chorus home page with visible meetings.');
      return;
    }

    // Confirm with user
    const confirmMsg = `Found ${meetings.length} meetings.\n\n` +
                       `Chorus doesn't allow full bulk export due to browser security.\n\n` +
                       `Would you like to:\n` +
                       `1. Open each meeting in a new tab\n` +
                       `2. Then click the export button in each tab\n\n` +
                       `This will open ${meetings.length} tabs.`;

    if (!confirm(confirmMsg)) {
      log('Bulk export cancelled by user');
      return;
    }

    log(`Opening ${meetings.length} meeting tabs...`);

    // Open meetings with delay to avoid overwhelming the browser
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      log(`[${i + 1}/${meetings.length}] Opening: ${meeting.title}`);

      window.open(meeting.href, '_blank');

      // Wait before opening next tab
      if (i < meetings.length - 1) {
        await sleep(500); // 500ms delay between opens
      }
    }

    alert(`✓ Opened ${meetings.length} meeting tabs!\n\n` +
          `Now:\n` +
          `1. Go to each tab\n` +
          `2. Wait for the page to load\n` +
          `3. Click the "📚 Export to Markdown" button\n` +
          `4. Your transcripts will download!`);

    log('✓ All tabs opened');
  }

  /**
   * Add export button(s) based on page type
   */
  function addExportButton() {
    const pageType = detectChorusPage();

    if (pageType === 'list') {
      // Add "Export All" button on list/home page
      addBulkExportButton();
    } else if (pageType === 'detail') {
      // Add single export button on detail page
      addSingleExportButton();
    } else {
      log('⚠️  Unknown page type, no button added');
    }
  }

  /**
   * Add bulk export button (for home/list page)
   */
  function addBulkExportButton() {
    const button = document.createElement('button');
    button.id = 'meetio-chorus-bulk-btn';
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
      button.textContent = '⏳ Opening tabs...';

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
    log('✓ Bulk export button added');
  }

  /**
   * Add single export button (for detail page)
   */
  function addSingleExportButton() {
    const button = document.createElement('button');
    button.id = 'meetio-chorus-export-btn';
    button.textContent = '📚 Export to Markdown';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      padding: 14px 24px;
      background: #2D8CFF;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(45, 140, 255, 0.3);
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#1E7BE5';
      button.style.transform = 'translateY(-2px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#2D8CFF';
      button.style.transform = 'translateY(0)';
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '⏳ Exporting...';

      try {
        const result = await exportCurrentMeeting();
        if (result && result.success) {
          alert(`✓ Meeting exported!\n\n${result.filename}`);
        }
      } catch (error) {
        log('Error:', error);
        alert('Export failed. Check console for details.');
      }

      button.disabled = false;
      button.textContent = '📚 Export to Markdown';
    });

    document.body.appendChild(button);
    log('✓ Single export button added');
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
      addBulkExportButton();
    } else if (pageType === 'detail') {
      log('✓ On meeting detail page');
      addSingleExportButton();
    } else {
      log('⚠️  Not on a supported Chorus page');
    }

    log('✓ Ready!');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

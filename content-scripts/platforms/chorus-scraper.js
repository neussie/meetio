/**
 * Chorus.ai Meeting Scraper
 * Extracts meeting transcripts from chorus.ai
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

    if (url.includes('/meetings') || url.includes('/calls')) {
      return 'list'; // Meeting list view
    } else if (url.includes('/meeting/') || url.includes('/call/')) {
      return 'detail'; // Individual meeting view
    }

    return 'unknown';
  }

  /**
   * Get all meeting cards from the list view
   */
  function getAllMeetingCards() {
    // Chorus typically uses cards or list items for meetings
    // We'll try multiple selectors

    const selectors = [
      '[data-testid*="meeting"]',
      '[data-testid*="call"]',
      '.meeting-card',
      '.call-card',
      '[class*="MeetingCard"]',
      '[class*="CallCard"]',
      'article',
      '[role="article"]'
    ];

    let cards = [];

    for (const selector of selectors) {
      cards = Array.from(document.querySelectorAll(selector));
      if (cards.length > 0) {
        log(`✓ Found ${cards.length} meetings using selector: ${selector}`);
        break;
      }
    }

    if (cards.length === 0) {
      log('✗ Could not find meeting cards. Trying fallback...');
      // Fallback: Look for clickable elements with date-like text
      const allLinks = document.querySelectorAll('a, div[role="button"], button');
      cards = Array.from(allLinks).filter(el => {
        const text = el.textContent;
        // Must contain date patterns and meeting-like content
        return (text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || text.match(/20\d{2}/)) &&
               text.length > 30 &&
               text.length < 500;
      });
      log(`Fallback found ${cards.length} potential meetings`);
    }

    return cards;
  }

  /**
   * Extract meeting metadata from detail page
   */
  function extractMeetingMetadata() {
    log('Extracting meeting metadata...');

    // Try to find meeting title
    const titleSelectors = [
      'h1',
      '[data-testid*="title"]',
      '[class*="Title"]',
      '[class*="heading"]',
      'header h2',
      'header h3'
    ];

    let title = 'Unknown Meeting';
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 0) {
        title = el.textContent.trim();
        log(`✓ Found title: ${title}`);
        break;
      }
    }

    // Try to find date
    const dateSelectors = [
      '[data-testid*="date"]',
      '[class*="Date"]',
      'time',
      '[datetime]'
    ];

    let meetingDate = new Date().toISOString().split('T')[0];
    for (const selector of dateSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const dateText = el.textContent || el.getAttribute('datetime');
        if (dateText) {
          const parsed = new Date(dateText);
          if (!isNaN(parsed)) {
            meetingDate = parsed.toISOString().split('T')[0];
            log(`✓ Found date: ${meetingDate}`);
            break;
          }
        }
      }
    }

    // Try to find attendees
    const attendeeSelectors = [
      '[data-testid*="attendee"]',
      '[data-testid*="participant"]',
      '[class*="Attendee"]',
      '[class*="Participant"]',
      '[class*="avatar"]'
    ];

    const attendees = [];
    attendeeSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const name = el.textContent.trim() || el.getAttribute('title') || el.getAttribute('aria-label');
        if (name && name.length > 2 && name.length < 50 && !attendees.includes(name)) {
          attendees.push(name);
        }
      });
    });

    log(`✓ Found ${attendees.length} attendees: ${attendees.join(', ')}`);

    return {
      title,
      meetingDate,
      attendees: attendees.join(', ')
    };
  }

  /**
   * Extract transcript from detail page
   */
  async function extractTranscript() {
    log('Extracting transcript...');

    const metadata = extractMeetingMetadata();

    // Look for transcript container
    const transcriptSelectors = [
      '[data-testid*="transcript"]',
      '[class*="Transcript"]',
      '[class*="transcript"]',
      '[role="article"]',
      'main',
      '[class*="Content"]'
    ];

    let transcriptContainer = null;
    for (const selector of transcriptSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.length > 100) {
        transcriptContainer = el;
        log(`✓ Found transcript container: ${selector}`);
        break;
      }
    }

    if (!transcriptContainer) {
      log('✗ Could not find transcript container');
      return null;
    }

    // Extract speaker entries
    // Chorus typically formats as: [Speaker Name] [Time] Text
    const transcriptLines = [];

    // Try to find individual transcript entries
    const entrySelectors = [
      '[data-testid*="transcript-entry"]',
      '[data-testid*="message"]',
      '[class*="TranscriptEntry"]',
      '[class*="Message"]',
      'p'
    ];

    let entries = [];
    for (const selector of entrySelectors) {
      entries = Array.from(transcriptContainer.querySelectorAll(selector));
      if (entries.length > 5) {
        log(`✓ Found ${entries.length} transcript entries using: ${selector}`);
        break;
      }
    }

    if (entries.length === 0) {
      log('No structured entries found, parsing raw text...');
      // Fallback: Parse raw text
      const text = transcriptContainer.textContent;

      // Try to match patterns like:
      // "Speaker Name 12:34:56 Text here"
      // "Speaker Name: Text here"
      const lines = text.split('\n').filter(line => line.trim().length > 0);

      lines.forEach(line => {
        // Match speaker patterns
        const speakerMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[:\s]+(.+)$/);
        if (speakerMatch) {
          const speaker = speakerMatch[1];
          const content = speakerMatch[2];
          transcriptLines.push(`**${speaker}**: ${content}`);
        }
      });
    } else {
      // Parse structured entries
      entries.forEach(entry => {
        const text = entry.textContent.trim();
        if (text.length < 5) return;

        // Try to extract speaker and content
        const speakerEl = entry.querySelector('[class*="speaker"], [class*="Speaker"], [class*="name"], [class*="Name"]');
        const timeEl = entry.querySelector('[class*="time"], [class*="Time"], time');

        const speaker = speakerEl ? speakerEl.textContent.trim() : 'Unknown';
        const time = timeEl ? timeEl.textContent.trim() : '';
        const content = text.replace(speaker, '').replace(time, '').trim();

        if (content.length > 0) {
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
      alert('Could not extract transcript from this page. Make sure the transcript is visible.');
      return;
    }

    const markdown = generateMarkdown(data);
    const filename = `${data.meetingDate}_${slugify(data.title)}.md`;

    downloadFile(filename, markdown);
    log(`✓ Downloaded: ${filename}`);

    alert(`Meeting exported successfully!\n${filename}`);
  }

  /**
   * Diagnostic mode - inspect page structure
   */
  function runDiagnostics() {
    log('\n=== CHORUS.AI DIAGNOSTIC MODE ===\n');

    const pageType = detectChorusPage();
    log(`Page type: ${pageType}`);
    log(`URL: ${window.location.href}`);

    if (pageType === 'list') {
      const cards = getAllMeetingCards();
      log(`\nFound ${cards.length} meeting cards`);
      cards.slice(0, 5).forEach((card, i) => {
        log(`  [${i}] ${card.textContent.substring(0, 100).trim()}...`);
      });
    } else if (pageType === 'detail') {
      const metadata = extractMeetingMetadata();
      log(`\nMetadata:`);
      log(`  Title: ${metadata.title}`);
      log(`  Date: ${metadata.meetingDate}`);
      log(`  Attendees: ${metadata.attendees}`);
    }

    log('\n=== END DIAGNOSTIC ===\n');
  }

  /**
   * Add export button
   */
  function addExportButton() {
    const pageType = detectChorusPage();

    if (pageType !== 'detail') {
      log('⚠️  Export button only available on meeting detail pages');
      return;
    }

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
        await exportCurrentMeeting();
      } catch (error) {
        log('Error:', error);
        alert('Export failed. Check console for details.');
      }

      button.disabled = false;
      button.textContent = '📚 Export to Markdown';
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

    // Run diagnostics in console
    runDiagnostics();

    // Add export button on detail pages
    if (pageType === 'detail') {
      addExportButton();
      log('✓ Ready to export!');
    } else {
      log('⚠️  Navigate to a meeting detail page to export');
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

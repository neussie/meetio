/**
 * Zoom Notes Scraper - FINAL VERSION
 * Works with sidebar layout
 */

(function() {
  'use strict';

  const { log, sleep, slugify, downloadFile } = window.HarnessExporterUtils;

  log('Zoom scraper loaded');

  /**
   * Find the sidebar with the notes list
   */
  function findSidebar() {
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      log('✓ Found sidebar');
      return sidebar;
    }
    log('✗ Could not find sidebar');
    return null;
  }

  /**
   * Get all note buttons from the sidebar
   */
  function getAllNoteButtons() {
    // Notes are <div role="button"> with class "sc-cxbFWh hanMZs"
    // They're NOT actual <button> elements!

    // Method 1: Direct class selector
    let noteButtons = Array.from(document.querySelectorAll('div.sc-cxbFWh.hanMZs'));

    if (noteButtons.length === 0) {
      log('Method 1 failed, trying method 2...');
      // Method 2: Any div with role="button" that has meeting-like text
      const allDivButtons = document.querySelectorAll('div[role="button"]');
      noteButtons = Array.from(allDivButtons).filter(div => {
        const text = div.textContent;
        // Must contain a year (2026) and be a reasonable length
        return text.match(/20\d{2}/) &&
               text.length > 30 &&
               text.length < 300 &&
               !text.includes('Close sidebar') &&
               !text.includes('Share');
      });
    }

    log(`Found ${noteButtons.length} note buttons`);

    // Log first 5 for debugging
    noteButtons.slice(0, 5).forEach((btn, i) => {
      log(`  [${i}] ${btn.textContent.substring(0, 60)}...`);
    });

    return noteButtons;
  }

  /**
   * Extract transcript from the currently displayed note (right panel)
   */
  async function extractCurrentTranscript() {
    log('Extracting transcript from right panel...');

    // Wait for content to load
    await sleep(2000);

    // Get the title - try multiple selectors
    let titleElement = document.querySelector('[class*="title"]');
    if (!titleElement || titleElement.textContent.includes('Share')) {
      titleElement = document.querySelector('[contenteditable]');
    }

    const fullTitle = titleElement ? titleElement.textContent.trim() : 'Unknown Meeting';
    log(`Full title: ${fullTitle}`);

    // Parse title to extract meeting name and date
    let meetingName = fullTitle;
    let meetingDate = new Date().toISOString().split('T')[0];

    // Look for date pattern: YYYY-MM-DD or similar
    const dateMatch = fullTitle.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      meetingDate = dateMatch[1];
      // Get everything before the date as the meeting name
      meetingName = fullTitle.substring(0, fullTitle.indexOf(dateMatch[0])).trim();
    }

    // Remove common emojis and extra whitespace
    meetingName = meetingName.replace(/[☕🥐📅🎯✨🔥💡📝🎉]/g, '').trim();

    // Remove time info like "10:31(GMT+1:00)" that might be trailing
    meetingName = meetingName.replace(/\d{1,2}:\d{2}\(GMT[^)]+\)/g, '').trim();

    log(`Meeting: ${meetingName}`);
    log(`Date: ${meetingDate}`);

    // Extract attendees from title (names separated by / or ,)
    const attendees = meetingName.split(/[\/,]/).map(n => n.trim()).filter(n => n.length > 0 && n.length < 30);

    // Get transcript from main container
    const mainContainer = document.querySelector('.docs-main-container');
    if (!mainContainer) {
      log('✗ Could not find main container');
      return null;
    }

    let containerText = mainContainer.textContent;
    log(`Main container has ${containerText.length} chars`);

    // Remove the header junk from the start
    const transcriptStart = containerText.indexOf('Transcript');
    if (transcriptStart !== -1) {
      containerText = containerText.substring(transcriptStart + 10); // Skip "Transcript"
      log('Trimmed header junk');
    }

    // Zoom format: "Name11:31:23Text here.NextName11:32:00More text."
    // The name runs directly into the timestamp with NO space
    const transcriptLines = [];

    // Match pattern: Name (letters/spaces) directly followed by HH:MM:SS
    // Use lookbehind to ensure we capture the speaker name correctly
    const regex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(\d{1,2}:\d{2}:\d{2})/g;

    const matches = [];
    let match;
    while ((match = regex.exec(containerText)) !== null) {
      const speaker = match[1].trim();
      const time = match[2];

      // Skip if this looks like UI text
      if (speaker.includes('Workflow') ||
          speaker.includes('Share') ||
          speaker.includes('Open') ||
          speaker.includes('Close')) {
        continue;
      }

      matches.push({
        speaker,
        time,
        index: match.index + match[0].length
      });
    }

    log(`Found ${matches.length} speaker timestamps`);

    // Extract text between each speaker entry
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];

      // Get text from after this timestamp to before next speaker (or end)
      const startIndex = current.index;
      const endIndex = next ? next.index - next.speaker.length - next.time.length : containerText.length;
      const text = containerText.substring(startIndex, endIndex).trim();

      // Clean up the text - remove speaker name and timestamp if they appear again
      let cleanText = text
        .replace(current.speaker + current.time, '')
        .trim();

      // Skip if text is too short or speaker name is suspicious
      if (current.speaker.length < 3 ||
          current.speaker.length > 50 ||
          cleanText.length < 2) {
        continue;
      }

      transcriptLines.push(`**${current.speaker}** (${current.time}): ${cleanText}`);
    }

    log(`Extracted ${transcriptLines.length} transcript lines`);

    if (transcriptLines.length > 0) {
      log('First 3 entries:');
      transcriptLines.slice(0, 3).forEach((line, i) => {
        log(`  [${i}] ${line.substring(0, 80)}...`);
      });
    }

    return {
      fullTitle,
      meetingName,
      meetingDate,
      attendees: attendees.join(', '),
      transcriptLines
    };
  }

  /**
   * Generate markdown from transcript data (matching working format)
   */
  function generateMarkdown(data) {
    if (!data) return '';

    let md = `## ✧ Metadata\n`;
    md += `- **Meeting Title:** ${data.meetingName}\n`;
    md += `- **Date:** ${data.meetingDate}\n`;
    if (data.attendees) {
      md += `- **Attendees:** ${data.attendees}\n`;
    }
    md += `- **Recording / Source:** Zoom My Notes\n`;
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
   * Export all visible notes
   */
  async function exportAllNotes() {
    log('\n=== EXPORT ALL NOTES ===\n');

    const sidebar = findSidebar();
    if (!sidebar) {
      alert('Could not find notes sidebar. Please make sure you are on hub.zoom.us/notes');
      return;
    }

    const noteButtons = getAllNoteButtons();
    if (noteButtons.length === 0) {
      alert('No notes found in sidebar');
      return;
    }

    // Confirm if more than 5 notes
    if (noteButtons.length > 5) {
      if (!confirm(`Export ${noteButtons.length} notes? This will download ${noteButtons.length} markdown files.`)) {
        log('Export cancelled by user');
        return;
      }
    }

    log(`Starting export of ${noteButtons.length} notes...\n`);

    const results = [];

    for (let i = 0; i < noteButtons.length; i++) {
      const button = noteButtons[i];
      const noteTitle = button.textContent.trim().substring(0, 60);

      log(`\n[${i + 1}/${noteButtons.length}] ${noteTitle}...`);

      try {
        // Click the note with proper mouse events
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);

        // Trigger real mouse events that Zoom's SPA will listen to
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        button.dispatchEvent(clickEvent);
        log('  Clicked note');

        // Wait for content to load
        await sleep(3000);

        // Extract transcript
        const data = await extractCurrentTranscript();

        if (data && data.transcriptLines?.length > 0) {
          // Generate markdown
          const markdown = generateMarkdown(data);

          // Create descriptive filename: date_meeting-name.md
          const filename = `${data.meetingDate}_${slugify(data.meetingName)}.md`;

          // Download
          downloadFile(filename, markdown);

          log(`  ✓ Downloaded: ${filename}`);
          results.push({ success: true, title: data.meetingName });
        } else {
          log(`  ✗ No content found`);
          results.push({ success: false, title: noteTitle });
        }

      } catch (error) {
        log(`  ✗ Error: ${error.message}`);
        results.push({ success: false, title: noteTitle, error: error.message });
      }

      // Wait before next note
      if (i < noteButtons.length - 1) {
        await sleep(1500);
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    log(`\n=== EXPORT COMPLETE ===`);
    log(`✓ Successful: ${successful}`);
    log(`✗ Failed: ${failed}`);
    log(`Total: ${results.length}`);

    alert(`Export complete!\n✓ ${successful} notes exported\n✗ ${failed} failed`);

    return results;
  }

  /**
   * Add export button
   */
  function addExportButton() {
    const button = document.createElement('button');
    button.id = 'harness-export-btn';
    button.textContent = '📚 Export All Notes';
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
        await exportAllNotes();
      } catch (error) {
        log('Error:', error);
        alert('Export failed. Check console for details.');
      }

      button.disabled = false;
      button.textContent = '📚 Export All Notes';
    });

    document.body.appendChild(button);
    log('✓ Export button added');
  }

  /**
   * Initialize
   */
  async function init() {
    log('Initializing...');

    // Wait for page to load
    await sleep(2000);

    // Check if we're on the right page
    const sidebar = findSidebar();
    if (!sidebar) {
      log('⚠️  Not on notes page or sidebar not found');
      return;
    }

    const notes = getAllNoteButtons();
    log(`Ready to export ${notes.length} notes`);

    // Add button
    addExportButton();

    log('✓ Ready!');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

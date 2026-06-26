/**
 * Notion API Integration
 * Handles all Notion API calls for the extension
 */

const NotionAPI = {

  /**
   * Get settings from storage
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['notionApiKey', 'notionDatabaseId'], (result) => {
        resolve({
          apiKey: result.notionApiKey || null,
          databaseId: result.notionDatabaseId || null
        });
      });
    });
  },

  /**
   * Check if Notion is configured
   */
  async isConfigured() {
    const settings = await this.getSettings();
    return !!(settings.apiKey && settings.databaseId);
  },

  /**
   * Test Notion connection and get database schema
   */
  async testConnection(apiKey, databaseId) {
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const database = await response.json();

      return {
        success: true,
        database: {
          title: database.title?.[0]?.plain_text || 'Untitled',
          properties: Object.keys(database.properties),
          schema: database.properties
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Check if a transcript already exists in Notion
   * @param {string} title - Meeting title
   * @param {string} date - Meeting date (YYYY-MM-DD)
   */
  async checkExists(title, date) {
    const settings = await this.getSettings();
    if (!settings.apiKey || !settings.databaseId) {
      throw new Error('Notion not configured');
    }

    try {
      // Query database for matching title and date
      const response = await fetch(`https://api.notion.com/v1/databases/${settings.databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            and: [
              {
                property: 'Title',
                title: {
                  contains: title
                }
              },
              {
                property: 'Date',
                date: {
                  equals: date
                }
              }
            ]
          },
          page_size: 1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.results.length > 0;
    } catch (error) {
      console.error('Error checking if transcript exists:', error);
      // If we can't check, assume it doesn't exist to avoid missing uploads
      return false;
    }
  },

  /**
   * Create a new page in Notion with transcript
   * @param {object} transcript - Transcript data
   */
  async createPage(transcript) {
    const settings = await this.getSettings();
    if (!settings.apiKey || !settings.databaseId) {
      throw new Error('Notion not configured');
    }

    try {
      // Build the transcript content as blocks
      const contentBlocks = this.buildContentBlocks(transcript);

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent: {
            database_id: settings.databaseId
          },
          properties: {
            // Title property (required by most databases)
            'Title': {
              title: [{
                text: {
                  content: transcript.fullTitle || transcript.meetingName
                }
              }]
            },
            // Date property (if exists)
            'Date': {
              date: {
                start: transcript.meetingDate
              }
            }
          },
          children: contentBlocks
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const page = await response.json();
      return {
        success: true,
        pageId: page.id,
        url: page.url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Build Notion blocks from transcript
   */
  buildContentBlocks(transcript) {
    const blocks = [];

    // Add heading
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{
          type: 'text',
          text: { content: 'Transcript' }
        }]
      }
    });

    // Add transcript lines
    if (transcript.transcriptLines && transcript.transcriptLines.length > 0) {
      // Group consecutive lines to avoid block limits
      let currentParagraph = '';

      transcript.transcriptLines.forEach((line, index) => {
        currentParagraph += line + '\n\n';

        // Create a block every 5 lines or at the end
        if ((index + 1) % 5 === 0 || index === transcript.transcriptLines.length - 1) {
          if (currentParagraph.trim()) {
            blocks.push({
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{
                  type: 'text',
                  text: { content: currentParagraph.trim().substring(0, 2000) } // Notion limit
                }]
              }
            });
          }
          currentParagraph = '';
        }
      });
    }

    // Notion has a limit of 100 blocks per request
    return blocks.slice(0, 100);
  }
};

// Make available to background script
if (typeof module !== 'undefined') {
  module.exports = NotionAPI;
}

# Meetio 🎯

**Your AI-powered meeting memory. Export Zoom and Chorus.ai transcripts and supercharge Claude with perfect customer context.**

Stop copy-pasting meeting notes into Claude. Stop losing track of customer conversations across Zoom, Chorus, and scattered notes. Meetio exports transcripts from **Zoom Notes** and **Chorus.ai** in bulk, ready to feed into Claude via Notion for AI-powered customer intelligence.

## 🎯 Why Meetio?

**The Problem:**
- 😫 Tired of copy-pasting call transcripts into Claude?
- 🤯 Keeping up with tens of customers, stakeholders, and meetings is overwhelming
- 🔍 Navigating Zoom and Chorus to find recordings wastes precious time
- 🧠 Claude's memory can't keep up with all your customer context

**The Solution:**
Meetio + Notion + Claude = Your AI memory system that never forgets a customer detail.

1. **Meetio Extension**: Download all Zoom transcripts in bulk (one click!)
2. **Notion Template**: Upload transcripts to a dedicated workspace that maps customers → stakeholders → meetings → tasks
3. **Claude Integration**: Connect Claude to your Notion, and it has perfect context for every customer interaction

Now you can ask Claude to:
- ✍️ Write POV documents with full customer context
- 🎬 Create demo scripts tailored to stakeholder conversations
- 🔄 Build reverse demo guides based on actual customer needs
- 📊 Generate account summaries from meeting history

## ✨ Features

- **Multi-Platform Support**: Export from **Zoom Notes** and **Chorus.ai**
- **Bulk Export**: Download all your Zoom meeting notes in one click
- **Beautiful Formatting**: Clean markdown with metadata, speaker labels, and timestamps
- **Smart Parsing**: Automatically extracts meeting names, dates, and attendees
- **Zero Configuration**: Install and click—no setup required
- **Privacy First**: All processing happens locally in your browser
- **Notion-Ready**: Output format designed to integrate seamlessly with Notion databases

## 🚀 Quick Start (Complete Setup)

### Step 1: Install Meetio Browser Extension

1. Clone this repository:
   ```bash
   git clone https://github.com/neussie/meetio.git
   cd meetio
   ```

2. Load the extension in Chrome/Edge:
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the **entire `meetio` folder** (the root, not a subfolder)

3. Navigate to [hub.zoom.us/notes](https://hub.zoom.us/notes)

4. Click the **"📚 Export All Notes"** button that appears in the bottom right

### Step 2: Set Up Notion Template

1. **Get the Notion template**: [Harness Meeting Intelligence Template](https://github.com/pvnarp/harness-agentic-skills)
   - Duplicate the template to your Notion workspace
   - The template includes databases for:
     - 📊 **Customers**: Track all your accounts
     - 👥 **Stakeholders**: Map decision-makers and champions
     - 📝 **Meeting Notes**: Store all transcripts with auto-linking
     - ✅ **Tasks**: Action items extracted from meetings

2. **Upload your transcripts**:
   - Drag and drop the markdown files exported by Meetio
   - Notion will automatically parse metadata and create relationships

### Step 3: Connect Claude to Your Notion

1. **Enable Notion integration** in Claude:
   - Go to Claude settings
   - Connect your Notion workspace
   - Grant access to your Meeting Intelligence database

2. **Start using your AI memory**:
   ```
   "Claude, based on my meetings with Acme Corp, draft a POV for their migration project"
   
   "Claude, summarize all conversations with John from TechCo and create a demo script"
   
   "Claude, what are the main pain points discussed across my financial services customers?"
   ```

Claude now has perfect context from every customer conversation! 🎉

## 📖 Daily Usage

### Export from Zoom Notes

1. Go to your Zoom notes: [hub.zoom.us/notes](https://hub.zoom.us/notes)
2. Wait for the sidebar with your notes list to load
3. Click the **"📚 Export All Notes"** button in the bottom right corner
4. Confirm the export (if you have more than 5 notes)
5. Your markdown files download automatically!

### Export from Chorus.ai

1. Go to a meeting detail page on [chorus.ai](https://chorus.ai)
2. Make sure the transcript is visible on the page
3. Click the **"📚 Export to Markdown"** button in the bottom right corner
4. Your markdown file downloads automatically!

**Note**: Chorus scraper works on individual meeting pages. For bulk export, navigate to each meeting you want to export.

### Upload to Notion

1. Open your **Meeting Intelligence** workspace in Notion
2. Navigate to the **"Meeting Notes"** database
3. Drag and drop all exported `.md` files
4. Notion automatically:
   - Parses metadata (date, attendees, title)
   - Links to customers and stakeholders
   - Extracts action items

### Ask Claude Anything

With Claude connected to your Notion:

```
💬 "Claude, create a POV for Acme Corp's CI/CD modernization based on our last 3 calls"

💬 "Claude, what commitments did we make to TechCo in our June meetings?"

💬 "Claude, draft a reverse demo guide for FinanceCorp focusing on security topics they mentioned"

💬 "Claude, summarize key objections from all healthcare customers this quarter"
```

### Example Export Format

Each exported file is Notion-ready with structured metadata:

```markdown
## ✧ Metadata
- **Meeting Title:** Acme Corp - POV Kickoff
- **Date:** 2026-06-24
- **Attendees:** Sarah Chen, Michael Torres, Neus Escruela
- **Recording / Source:** Zoom My Notes
- **Language:** English

## ✧ Transcript

**Sarah Chen** (11:31:23): We're currently using Jenkins and it's becoming a maintenance nightmare.
**Michael Torres** (11:31:45): The security team is also concerned about our artifact scanning process.
**Neus Escruela** (11:32:10): Let me show you how Harness can address both of those pain points...
```

## 🛠️ Development

### Project Structure

```
meetio/
├── manifest.json                    # Extension configuration
├── content-scripts/
│   ├── platforms/                   # Platform-specific scrapers
│   │   ├── zoom-scraper.js          # Zoom Notes scraper
│   │   └── chorus-scraper.js        # Chorus.ai scraper (coming soon)
│   ├── utils.js                     # Shared utilities (logging, file download)
│   └── injected-ui.css              # UI styles
├── background/
│   ├── service-worker.js            # Background tasks
│   └── notion-api.js                # Notion integration (future)
├── popup/
│   ├── popup.html                   # Extension popup UI
│   └── popup.js                     # Popup logic
├── options/
│   ├── options.html                 # Settings page
│   └── options.js                   # Settings logic
├── icons/                           # Extension icons
├── samples/                         # Example exports (not in repo)
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

### Adding New Platforms

Meetio currently supports:
- ✅ **Zoom Notes** (hub.zoom.us/notes) - Bulk export
- ✅ **Chorus.ai** - Individual meeting export

To add support for other platforms (Gong, Salesloft, etc.):

1. Create `content-scripts/platforms/{platform}-scraper.js`
2. Add new `content_scripts` entry in `manifest.json`:
   ```json
   {
     "matches": ["*://platform.com/*"],
     "js": ["content-scripts/utils.js", "content-scripts/platforms/platform-scraper.js"]
   }
   ```
3. Follow the pattern from `zoom-scraper.js` or `chorus-scraper.js`
4. Use the `window.HarnessExporterUtils` helpers (log, sleep, slugify, downloadFile)

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test thoroughly on [hub.zoom.us/notes](https://hub.zoom.us/notes)

4. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add support for different date formats"
   ```

5. Push and create a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 🐛 Troubleshooting

**Extension button doesn't appear**
- Make sure you're on `hub.zoom.us/notes`
- Refresh the page
- Check the browser console for errors (F12)

**No transcripts exported**
- Verify your notes are visible in the sidebar
- Check that notes contain actual transcript content
- Open the browser console to see detailed logs

**Transcript formatting issues**
- Report an issue with the problematic note title/date format
- Include browser console logs

## 📝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on real Zoom notes
5. Submit a PR with a clear description

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 👤 Author

**Neus Samir Escruela**
- Email: neus.escruela@harness.io
- GitHub: [@neussie](https://github.com/neussie)

## 🔗 Related Projects

- **[Harness Meeting Intelligence Template](https://github.com/pvnarp/harness-agentic-skills)**: The Notion template that powers your AI memory system
- **[Harness Skills](https://github.com/harness/harness-skills)**: Additional Claude skills for sales engineers and customer success teams

## 💡 Pro Tips

- **Export weekly**: Make it a Friday ritual to export and upload the week's meetings
- **Tag strategically**: Use Notion tags for customer stages (POV, POC, Production) to help Claude understand context
- **Link stakeholders**: Connect meeting attendees to stakeholder profiles for relationship mapping
- **Ask specific questions**: The more context Claude has, the better. Reference customer names, dates, or topics for precise answers

## 🙏 Acknowledgments

Built with ☕ by the Harness.io SE team for anyone managing complex customer relationships at scale.

Special thanks to the team behind the Notion template integration that makes this workflow possible.

---

**Note**: This extension is not affiliated with or endorsed by Zoom Video Communications, Inc. or Notion Labs, Inc.

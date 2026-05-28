export interface HelpShortcut {
  keys: string;
  description: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  shortcuts?: HelpShortcut[];
  relatedArticles?: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
  icon: string;
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    "id": "getting-started",
    "name": "Getting Started",
    "icon": "🚀",
    "articles": [
      {
        "id": "welcome",
        "title": "Welcome to WORBI",
        "description": "Introduction to WORBI — your AI-powered world-building workspace",
        "content": "WORBI (WorldBuilder UI) is a professional world-building workspace for writers, GMs, and creators — running 100% locally on your machine. No cloud. No trackers. Your data, your rules.\n\n**What you can do with WORBI:**\n- **Write stories** — Full WYSIWYG rich text editor with two-column layout\n- **Design quests** — AI-assisted quest outlines and document templates\n- **Build worlds** — Organize lore, characters, locations, and timelines\n- **Generate images** — Local AI image generation via Z-Image-Turbo\n- **Explore connections** — Visual relationship graphs between your documents\n\n**Getting Started:**\n1. Set up your LLM provider in Settings → LLM (local or cloud)\n2. Create your first document using the File menu or Ctrl+Shift+N for templates\n3. Use the AI sidebar (Sparkles icon) for writing assistance\n4. Organize with tags, timelines, and the relationship graph",
        "shortcuts": [
          {
            "keys": "Ctrl+Shift+N",
            "description": "New from Template"
          },
          {
            "keys": "Ctrl+S",
            "description": "Save file"
          }
        ],
        "relatedArticles": [
          "first-document",
          "workspace-layout"
        ]
      },
      {
        "id": "installation",
        "title": "Installation & Setup",
        "description": "Install WORBI and configure your development environment",
        "content": "**Prerequisites:**\n- **Node.js** ≥ 18\n- **npm** ≥ 9\n- **GPU (optional)** — NVIDIA with ≥ 8 GB VRAM for local image generation\n- **LLM backend** — Any OpenAI-compatible server (LM Studio, Ollama, vLLM) or cloud provider\n\n**Install & Run:**\n\n```bash\ngit clone git@github.com:rauty79/worbi.git\ncd worbi\nnpm install\nnpm run dev\n```\n\n**Services:**\n| Service | URL |\n|---------|-----|\n| API Server | http://localhost:8082 |\n| Web Client | http://localhost:5173 |\n\n**Optional: Z-Image Server**\nFor local image generation, run [Nymphs2D2](../Z-Image/) on localhost:8090 and configure in Settings → Images.\n\n**LLM Configuration:**\nConfigure your LLM provider in Settings → LLM. WORBI supports:\n- **Local:** LM Studio, Ollama, llama.cpp, TextGen WebUI, LocalAI, Jan, vLLM\n- **Cloud:** OpenAI, Groq, Together AI, OpenRouter, Mistral, xAI\n\n> ⚠ Non-OpenAI providers (Anthropic, Google) may require a custom adapter for chat.",
        "relatedArticles": [
          "welcome",
          "llm-setup"
        ]
      },
      {
        "id": "first-document",
        "title": "Creating Your First Document",
        "description": "Create documents from scratch or use pre-built templates",
        "content": "WORBI offers several ways to create documents:\n\n**Blank Document:**\n- Click File → New Blank File in the header\n- Or click \"New File\" on the Welcome screen\n\n**From Template (Recommended):**\nWORBI includes 7 pre-built templates:\n- **Character Sheet** — Name, appearance, personality, backstory\n- **Location** — Geography, climate, points of interest\n- **Quest Outline** — Objectives, NPCs, rewards, timeline\n- **Timeline Entry** — Date, era, events, participants\n- **Item/Artifact** — Description, powers, history\n- **Faction** — Members, goals, territories\n- **Creature** — Stats, abilities, habitat\n\nAccess templates via:\n- File → New from Template...\n- Welcome screen → \"New from Template\" button\n- Keyboard: Ctrl+Shift+N\n\n**Working with Templates:**\n1. Select a template from the modal\n2. Enter a file name\n3. The document opens in the editor with pre-filled structure\n4. Fill in the fields and start writing!",
        "shortcuts": [
          {
            "keys": "Ctrl+Shift+N",
            "description": "New from Template"
          }
        ],
        "relatedArticles": [
          "welcome",
          "editor-basics"
        ]
      },
      {
        "id": "workspace-layout",
        "title": "Workspace Layout",
        "description": "Understanding the WORBI interface — Activity Bar, Editor, Panels, and more",
        "content": "WORBI uses a VS Code–style layout with four main areas:\n\n**1. Activity Bar (Left Edge)**\nA thin icon bar for switching between views:\n- 📁 **Explorer** — File tree browser\n- 🔍 **Search** — Full-text workspace search\n- ⭐ **Starred Files** — Your favorite/quick-access files\n- 🏷️ **Tags** — Tag management and file filtering\n- 🕐 **Timeline** — Chronological event browser\n- 📖 **Outline** — Document headings and bookmarks\n- 📊 **Graph** — Relationship graph visualization\n- 🖼️ **Images** — Image generator panel\n\n**2. Header (Top)**\n- WORBI logo and tagline\n- File menu (New File, Templates, Import DOCX)\n- AI sidebar toggle\n- Current user display\n- Logout button\n\n**3. Main Editor Area (Center)**\n- Tab bar for open documents\n- Rich text editor with formatting toolbar\n- Optional Information Panel (right side, draggable)\n\n**4. AI Sidebar (Right)**\n- Chat panel for AI assistance\n- Toggle with Sparkles icon in Activity Bar or Header\n- Greyed out when AI server is offline\n\n**5. Status Bar (Bottom)**\n- Shows LLM connection status\n- Save status and other indicators\n\n**Resizable Panels:**\n- Drag the divider between panels to resize\n- Left sidebar width is adjustable\n- Right Information Panel width is adjustable",
        "relatedArticles": [
          "welcome",
          "file-explorer"
        ]
      }
    ]
  },
  {
    "id": "editor",
    "name": "Editor",
    "icon": "✏️",
    "articles": [
      {
        "id": "editor-basics",
        "title": "Rich Text Formatting",
        "description": "Formatting tools available in the WORBI editor",
        "content": "The WORBI editor is powered by TipTap (ProseMirror) and provides full WYSIWYG editing:\n\n**Text Formatting:**\n- **Bold** — Ctrl+B\n- **Italic** — Ctrl+I\n- **Underline** — Ctrl+U\n- **Headings** — H1 through H6\n- **Lists** — Ordered and unordered\n- **Tables** — Insert and edit tables\n- **Code Blocks** — Fenced code with monospace font\n- **Inline Code** — Backtick-wrapped code\n- **Text Alignment** — Left, center, right\n- **Text Colors** — Custom color support\n\n**Multi-File Editing:**\n- Open multiple documents in tabs\n- Dirty-state indicators (●) show unsaved changes\n- Tab close button with save prompt for unsaved changes\n- Unsaved changes browser warning (prevents accidental data loss)\n\n**Image Support:**\n- Drag-to-resize images with hover handles\n- Images persist via blob bridge system\n- Click images for full-size preview",
        "shortcuts": [
          {
            "keys": "Ctrl+B",
            "description": "Bold"
          },
          {
            "keys": "Ctrl+I",
            "description": "Italic"
          },
          {
            "keys": "Ctrl+U",
            "description": "Underline"
          },
          {
            "keys": "Ctrl+S",
            "description": "Save file"
          }
        ],
        "relatedArticles": [
          "two-column",
          "images-media",
          "spellcheck"
        ]
      },
      {
        "id": "two-column",
        "title": "Two-Column Editor Layout",
        "description": "Use the main + margin column layout for annotations and notes",
        "content": "WORBI features a unique two-column editor layout:\n\n**Main Column (~66%):**\n- Your primary writing area\n- Full rich text editing\n- Content flows naturally\n\n**Margin Column (~34%):**\n- Side notes, annotations, and marginalia\n- Separate TipTap instance (independent editing)\n- Perfect for GM notes, commentary, or design remarks\n\n**Resizing:**\n- Hover over the divider between columns\n- Drag left/right to adjust proportions\n- Content delimiter shows the split point\n\n**Use Cases:**\n- Write story text in the main column with GM notes in the margin\n- Draft content with editorial comments\n- Separate canonical lore from author notes\n- Character dialogue with stage directions in margin",
        "relatedArticles": [
          "editor-basics",
          "bookmarks"
        ]
      },
      {
        "id": "images-media",
        "title": "Images & Media",
        "description": "Insert, manage, and resize images in your documents",
        "content": "**Inserting Images:**\n- Use the image button in the editor toolbar\n- Select from workspace assets or upload new images\n- Images are saved in the assets/images/ folder\n\n**Resizing Images:**\n- Hover over an image to reveal resize handles\n- Drag handles to resize proportionally\n- Dimensions persist across save/reload cycles\n\n**Image Preview:**\n- Click an image for full-size preview\n- Navigate between images in the same document\n\n**Asset Management:**\n- Generated images land in assets/images/ automatically\n- Image Explorer in the sidebar shows all workspace images\n- Hero images can be set per document in the Information Panel\n\n**Supported Formats:**\nJPG, JPEG, PNG, GIF, BMP, WebP, SVG, ICO",
        "relatedArticles": [
          "editor-basics",
          "image-generation"
        ]
      },
      {
        "id": "spellcheck",
        "title": "Spellcheck",
        "description": "Real-time typo detection and correction",
        "content": "WORBI includes a built-in spellcheck system:\n\n**How It Works:**\n- Real-time typo detection as you type\n- Misspelled words shown with red underlines\n- Hover over underlined words for suggestion tooltips\n- Batch processing for performance on long documents\n\n**Using Spellcheck:**\n- Spellcheck runs automatically — no toggle needed\n- Right-click a highlighted word for suggestions\n- Select a replacement to apply the fix\n- Suggestions appear in a contextual menu\n\n**Performance:**\n- Words are processed in batches to maintain editor responsiveness\n- Custom names and made-up words can be ignored",
        "relatedArticles": [
          "editor-basics"
        ]
      },
      {
        "id": "find-replace",
        "title": "Find & Replace",
        "description": "Search and replace text within the current document",
        "content": "**Opening Find & Replace:**\n- Press Ctrl+F for Find\n- Press Ctrl+H for Find & Replace\n- Or use the editor toolbar buttons\n\n**Features:**\n- Highlight all matches in the current document\n- Navigate between matches with Previous/Next buttons\n- Case-sensitive toggle\n- Replace one at a time or replace all\n\n**Usage:**\n1. Enter your search term\n2. Toggle case sensitivity if needed\n3. Navigate matches or replace as needed\n4. Match count shows current position (e.g., \"3 of 12\")",
        "shortcuts": [
          {
            "keys": "Ctrl+F",
            "description": "Find"
          },
          {
            "keys": "Ctrl+H",
            "description": "Find & Replace"
          }
        ],
        "relatedArticles": [
          "editor-basics",
          "workspace-search"
        ]
      },
      {
        "id": "wikilinks",
        "title": "WikiLinks ([[links]])",
        "description": "Create clickable cross-document links using Obsidian-style syntax",
        "content": "WikiLinks allow you to create connections between documents using Obsidian-style `[[bracket]]` syntax.\n\n**Creating Links:**\n- Type `[[` in the editor to trigger autocomplete\n- Select a document from the dropdown (keyboard navigable with arrows + Enter)\n- Link format: `[[Document Name]]`\n- Custom display: `[[Document Name|Custom Text]]`\n\n**Link States:**\n- 🔵 **Blue link** — Document exists, click to open\n- 🟠 **Amber link** — Document doesn't exist yet, click to create\n- Links include a 📒 emoji prefix for visual identification\n\n**Link Resolution:**\n- Case-insensitive matching against workspace .html files\n- Clicking an existing link opens it in a new tab\n- Clicking a missing link prompts document creation\n\n**Hover Popover:**\n- Hover over a link (300ms delay) to see:\n  - Document name and path\n  - Content preview\n  - \"Open Document\" button\n- Popover auto-closes after 1500ms of inactivity\n- Move mouse over popover to keep it open\n\n**Backlinks:**\n- The Information Panel shows which documents link to the current one\n- Includes context snippets showing the link in context\n\n**Edge Cases:**\n- Links in code blocks are not parsed\n- Circular links are handled gracefully\n- Self-links render as non-clickable",
        "shortcuts": [
          {
            "keys": "[[",
            "description": "Trigger WikiLink autocomplete"
          }
        ],
        "relatedArticles": [
          "relationship-graph",
          "backlinks"
        ]
      },
      {
        "id": "file-restore",
        "title": "File Restore",
        "description": "Revert to the version of a document when it was last opened",
        "content": "WORBI provides a one-click restore feature to recover from accidental edits:\n\n**How It Works:**\n- When you open a file, WORBI snapshots its content\n- The snapshot persists even after saving\n- If you accidentally make wrong changes (and save them), you can restore\n\n**Using Restore:**\n- Click the ⟲ (Restore) icon in the editor toolbar\n- A confirmation dialog appears to prevent accidental data loss\n- Click Confirm to restore to the last opened version\n\n**Restore Awareness:**\n- The restore button stays enabled after saving if content differs from the original snapshot\n- Not just a \"dirty\" check — works even after saving wrong changes\n\n**Limitations:**\n- Restores to the version when the file was *opened* (not the last saved version)\n- Reopening the file creates a new snapshot",
        "relatedArticles": [
          "editor-basics"
        ]
      },
      {
        "id": "emoji-picker",
        "title": "Emoji Picker",
        "description": "Insert emojis at the cursor position using the built-in picker",
        "content": "**Accessing the Picker:**\n- Click the smile icon (😊) in the editor toolbar\n- The emoji picker opens at the cursor position\n\n**Categories (800+ emojis):**\n- Smileys, People, Animals, Food, Activities, Travel, Objects, Symbols, Flags\n\n**Features:**\n- Search within the active category\n- Horizontal scrollable category tabs with emoji icons\n- Click an emoji to insert it at the cursor position\n- Dark theme consistent with WORBI's design",
        "relatedArticles": [
          "editor-basics"
        ]
      }
    ]
  },
  {
    "id": "ai-features",
    "name": "AI Features",
    "icon": "🤖",
    "articles": [
      {
        "id": "ai-chat",
        "title": "AI Chat Panel",
        "description": "Use the AI sidebar for writing assistance, worldbuilding help, and more",
        "content": "The AI Chat Panel provides conversational AI assistance for your world-building work.\n\n**Opening the Chat:**\n- Click the Sparkles icon in the Activity Bar\n- Or click the \"AI\" button in the Header\n- State is persisted — it stays open/closed between sessions\n\n**What You Can Ask:**\n- Writing assistance and creative prompts\n- Worldbuilding and lore questions\n- Quest design and character development\n- Historical research and fact-checking (with web search)\n\n**Context Awareness:**\n- Your current document content is shared as context\n- The AI knows what you're working on\n- Ask questions about your specific document\n\n**Tools Toggle:**\n- Click the ⚡ button in the chat header to enable AI tools\n- When ON (amber glow): AI can search the web and access workspace files\n- When OFF: Standard chat mode\n\n**Offline Detection:**\n- If the LLM server is offline, AI features are greyed out\n- A red banner appears in the chat panel\n- Features automatically re-enable when the server comes back online",
        "shortcuts": [],
        "relatedArticles": [
          "ghost-text",
          "ai-tools"
        ]
      },
      {
        "id": "ghost-text",
        "title": "Ghost Text (Inline Completions)",
        "description": "AI-powered inline text completions as you type",
        "content": "Ghost Text provides inline AI continuation suggestions rendered as dimmed text at your cursor position.\n\n**Triggering Ghost Text:**\n- Press Ctrl+Space at any point in your document\n- Or click the ✨ Sparkles button in the toolbar\n- AI generates a continuation based on your current context\n\n**Accepting/Dismissing:**\n- Press Tab to accept the suggestion (commits the text)\n- Press Esc to dismiss the suggestion\n\n**Auto-Complete Mode:**\n- Toggle the \"AI\" button in the toolbar for continuous suggestions\n- Provides automatic suggestions while typing\n- Uses a 1.5-second idle debounce to avoid interrupting your flow\n- Toggle off when you want to write without AI suggestions\n\n**Tips:**\n- Ghost text works best when you've written a clear preceding sentence\n- The AI uses your current document as context\n- Works with any LLM configured in Settings",
        "shortcuts": [
          {
            "keys": "Ctrl+Space",
            "description": "Trigger AI ghost text"
          },
          {
            "keys": "Tab",
            "description": "Accept AI suggestion"
          },
          {
            "keys": "Esc",
            "description": "Dismiss AI suggestion"
          }
        ],
        "relatedArticles": [
          "ai-chat",
          "name-generator"
        ]
      },
      {
        "id": "name-generator",
        "title": "AI Name Generator",
        "description": "Generate culture-specific names for characters, places, and factions",
        "content": "The Name Generator creates culture-specific names for your world-building projects.\n\n**Supported Cultures:**\n- Elvish, Dwarvish, Nordic, and more\n- Configure the culture type when generating\n\n**What You Can Generate:**\n- Character names\n- Place names (cities, regions, landmarks)\n- Item names (artifacts, weapons, treasures)\n- Faction names (guilds, kingdoms, organizations)\n\n**How to Use:**\n1. Open the Name Generator from the editor toolbar\n2. Select the name type and culture\n3. Click Generate\n4. Click any result to insert it at your cursor position",
        "relatedArticles": [
          "ghost-text",
          "document-generator"
        ]
      },
      {
        "id": "document-generator",
        "title": "AI Document Generator",
        "description": "Scaffold structured documents from an AI prompt",
        "content": "The Document Generator creates structured documents from a text prompt.\n\n**Document Types:**\n- Character sheets\n- Location descriptions\n- Quest outlines\n- Timeline entries\n- Freeform documents\n\n**How to Use:**\n1. Click \"Generate with AI\" from the Welcome screen or toolbar\n2. Enter a descriptive prompt (e.g., \"A grizzled dwarven blacksmith who secretly forges enchanted weapons\")\n3. Select the document type\n4. AI generates a structured document\n5. Review and edit the result in the editor\n\n**Tips:**\n- Be specific in your prompts for better results\n- The AI uses your LLM provider (configured in Settings → LLM)\n- Generated documents are created in the current folder",
        "relatedArticles": [
          "name-generator",
          "document-templates"
        ]
      },
      {
        "id": "ai-tools",
        "title": "AI Tools Engine",
        "description": "AI-powered tools for web search, file operations, and workspace actions",
        "content": "The AI Tools Engine allows the AI assistant to take actions beyond text generation.\n\n**Available Tools:**\n\n| Tool | Description | Permission |\n|------|-------------|------------|\n| 🔍 Web Search | Internet research & lore lookups | Web Search toggle |\n| 📄 Read File | Read workspace file contents | File Access: read+ |\n| 📁 List Files | List directory contents | File Access: read+ |\n| 📝 Create File | Create new documents | File Access: readwrite+ |\n| ✏️ Edit File | Modify existing documents | File Access: readwrite+ |\n| 🗑️ Delete File | Delete workspace files | File Access: full |\n| 🔄 Rename File | Rename files/folders | File Access: full |\n| 🔎 Search Files | Search text across files | File Access: read+ |\n\n**Enabling Tools:**\n- Click the ⚡ button in the chat header\n- Configure permissions in Settings → Tools tab\n\n**Permission Levels:**\n- **none** — No file access\n- **read** — Can read and list files\n- **readwrite** — Can read, create, and edit\n- **full** — Full access including delete and rename\n\n**Tool Status:**\n- Tool activities shown as colored cards in chat\n- Real-time status: ✅ Done or ❌ Error\n- Loading text changes to \"⚡ Thinking & acting...\"\n\n**Security:**\n- All file operations restricted to workspace directory\n- Delete requires explicit permission (off by default)\n- File reads truncated to 10,000 characters",
        "relatedArticles": [
          "ai-chat",
          "tool-permissions"
        ]
      },
      {
        "id": "image-generation",
        "title": "AI Image Generation",
        "description": "Generate images locally using Z-Image-Turbo",
        "content": "WORBI integrates with Z-Image-Turbo (Nymphs2D2) for local AI image generation.\n\n**Requirements:**\n- NVIDIA GPU with ≥ 8 GB VRAM\n- Z-Image server running on localhost:8090\n- Configure server URL in Settings → Images\n\n**Features:**\n- **Text-to-Image** — Prompt → image in seconds\n- **Image-to-Image** — Variations from an existing image\n- **Full Controls** — Steps, guidance scale, seed, negative prompt, strength\n- **Real-Time Progress** — Live progress bar during generation\n- **Auto Save** — Generated images saved to assets/images/\n\n**VRAM Protection:**\n- Server-side GPU check prevents OOM crashes\n- Configurable minimum free VRAM threshold (default 8 GB)\n- Warning dialog if VRAM is below threshold\n- \"Generate Anyway\" option for override\n\n**Accessing the Generator:**\n- Click the Image icon in the Activity Bar\n- Or click the ✨ button in the Image Explorer header\n- Configure in Settings → Images tab",
        "relatedArticles": [
          "images-media",
          "image-to-text"
        ]
      },
      {
        "id": "image-to-text",
        "title": "Image to Text (Transcription)",
        "description": "Convert handwritten or printed documents to text using AI vision",
        "content": "The Image to Text feature transcribes images of documents using your LLM's vision capabilities.\n\n**How to Use:**\n1. Open the Image Generator Panel\n2. Switch to \"Image to Text\" mode\n3. Upload an image or select from workspace\n4. Add custom instructions (optional)\n5. Click Transcribe\n\n**Output Options:**\n- **Copy to Clipboard** — Copy the transcribed text\n- **Insert into Prompt** — Use the text in the generator\n- **Open in Editor** — Creates a new timestamped document (e.g., `Transcribed_20260502_042700`) in the current folder\n\n**Supported Models:**\n- Works with any vision-capable LLM (LLaVA, GPT-4o, Claude Vision)\n- Configure your model in Settings → LLM",
        "relatedArticles": [
          "image-generation",
          "ai-chat"
        ]
      },
      {
        "id": "llm-setup",
        "title": "LLM Configuration",
        "description": "Set up and configure your LLM provider for AI features",
        "content": "WORBI supports any OpenAI-compatible API for AI features.\n\n**Configuring Your LLM:**\n1. Open Settings → LLM tab\n2. Select a provider preset or choose \"Custom\"\n3. Enter your API base URL and API key (if required)\n4. Click \"Test Connection\" to verify\n5. Select a model from the dropdown\n6. Save settings\n\n**Provider Presets (16 available):**\n\n**Local:**\n- LM Studio (localhost:1234)\n- Ollama (localhost:11434)\n- llama.cpp (localhost:8080)\n- TextGen WebUI (localhost:5000)\n- LocalAI (localhost:8080)\n- Jan (localhost:1337)\n- vLLM (localhost:8000)\n\n**Cloud:**\n- OpenAI, Groq, Together AI, OpenRouter, Mistral, xAI\n- Anthropic ⚠, Google AI Studio ⚠\n\n**Connection Status:**\n- 🟢 Connected — Server responding with loaded models\n- 🟡 Reachable but no models — Server up, no models loaded\n- 🔴 Failed — Connection unsuccessful\n- Gray — Not tested yet\n\n> ⚠ Anthropic and Google use non-OpenAI APIs and may require a custom adapter.",
        "relatedArticles": [
          "ai-chat",
          "installation"
        ]
      }
    ]
  },
  {
    "id": "organization",
    "name": "Organization",
    "icon": "📁",
    "articles": [
      {
        "id": "file-explorer",
        "title": "File Explorer",
        "description": "Navigate, create, and manage your workspace files and folders",
        "content": "The File Explorer provides a tree view of your workspace.\n\n**Default Folders:**\nWORBI creates these folders automatically:\n- **MainStory** — Your primary narrative documents\n- **Quests** — Quest outlines and adventure content\n- **Characters** — Character sheets and profiles\n- **World** — Locations, lore, and world-building\n\n**File Operations:**\n- **Create** — New files and folders\n- **Rename** — Rename files and folders\n- **Delete** — Remove files and folders (with confirmation)\n- **Copy** — Duplicate files within the workspace\n- **Move** — Move files between folders\n- **Download** — Download files as HTML\n\n**Undo/Redo:**\nFile operations support undo/redo:\n- Create, delete, rename, copy, move operations can be undone\n- Uses a file system undo/redo stack\n\n**System Files:**\n- `.wbu_meta.json` support files are hidden by default\n- Only user-created files are shown\n\n**New Files:**\n- Auto-appends `.html` extension for new files\n- Files are created in the currently selected folder",
        "shortcuts": [],
        "relatedArticles": [
          "workspace-layout",
          "starred-files"
        ]
      },
      {
        "id": "tags",
        "title": "Tags & Tag Relationships",
        "description": "Organize documents with color-coded tags and discover connections",
        "content": "**Creating Tags:**\n- Open the Tags view in the Activity Bar\n- Click \"Add Tag\" to create a new tag\n- Choose a color for the tag from the color picker\n- Tags are color-coded for visual organization\n\n**Applying Tags:**\n- Open a document's Information Panel\n- In the TAGS section, click to add tags\n- Multiple tags can be applied to any document\n- Tags display with their defined color in the panel\n\n**Filtering by Tags:**\n- Use the tag filter in the Tags sidebar\n- Click a tag to filter the file explorer\n- Only files with the selected tag are shown\n\n**Tag Relationships:**\n- **Implicit** — Files sharing the same tag are connected\n- **Explicit** — Define explicit connections between tags\n- Relationships shown in the Relationship Graph view\n\n**Tag Colors:**\nEach tag has a defined color used consistently across:\n- Tag badges in the Information Panel\n- Timeline event dots\n- Graph node labels\n- File explorer indicators",
        "shortcuts": [],
        "relatedArticles": [
          "relationship-graph",
          "timeline"
        ]
      },
      {
        "id": "starred-files",
        "title": "Starred Files (Favorites)",
        "description": "Mark files as favorites for quick access",
        "content": "**Starring Files:**\n- Click the star icon next to a file in the Explorer\n- Starred files appear in the Starred Files view\n- Also shown on the Welcome screen\n\n**Accessing Starred Files:**\n- Click the Star icon in the Activity Bar\n- Browse the Favorites section on the Welcome screen\n- Click a file to open it immediately\n\n**Managing Stars:**\n- Hover over a starred file to reveal the remove button\n- Click X to remove from favorites\n- Stars are persisted in localStorage",
        "shortcuts": [],
        "relatedArticles": [
          "file-explorer",
          "welcome-screen"
        ]
      },
      {
        "id": "timeline",
        "title": "Timeline View",
        "description": "Browse events chronologically, organized by era",
        "content": "The Timeline View provides a chronological browser for your world's events.\n\n**How It Works:**\n- Documents with Date/Period + Era fields are automatically detected\n- Scans the entire workspace (any folder)\n- Events are grouped by era and sorted chronologically\n\n**Setting Timeline Metadata:**\n- Open a document's Information Panel\n- In the Timeline section:\n  - **Era** — Select or type an era name\n  - **Date/Period** — Enter a date number\n- Selecting an era auto-fills the next sequential date\n\n**Timeline Features:**\n- **Era Headers** — Click to expand/collapse era groups\n- **Tag-Colored Dots** — Event dots use the document's tag colors\n- **NoTag Label** — Events without tags show \"NoTag\"\n- **Collapsible Eras** — Organize by clicking era headers\n\n**Settings:**\n- Click the gear icon in the Timeline header\n- **Era Order** — Define custom era ordering\n- **Date Format** — Configure how dates display\n\n**Filters:**\n- **Era Filter** — Select specific eras to show\n- **Tag Filter** — Filter by tag categories\n- Untagged events always appear even with tag filters active",
        "shortcuts": [],
        "relatedArticles": [
          "tags",
          "information-panel"
        ]
      },
      {
        "id": "bookmarks",
        "title": "Outline & Bookmarks",
        "description": "Quick-navigate document headings and create permanent bookmarks",
        "content": "The Outline panel (Book icon in Activity Bar) shows all headings in the active document.\n\n**Headings:**\n- Automatically detects H1, H2, and H3 headings\n- Updates in real-time as you edit\n- Click any heading to scroll to it with smooth animation\n- Brief purple highlight on navigation target\n\n**Manual Bookmarks:**\n- Press Ctrl+Shift+M to pin current cursor position\n- Auto-generated label based on context\n- Bookmarks are permanent (survive page reloads)\n\n**Bookmark Management:**\n- Per-file persistence stored in localStorage\n- Hover to reveal remove button\n- Delete unwanted bookmarks with one click\n\n**Empty States:**\n- Helpful guidance when no document is open\n- Hints when no headings are found in the current document",
        "shortcuts": [
          {
            "keys": "Ctrl+Shift+M",
            "description": "Create bookmark at cursor"
          }
        ],
        "relatedArticles": [
          "two-column",
          "editor-basics"
        ]
      },
      {
        "id": "relationship-graph",
        "title": "Relationship Graph",
        "description": "Visualize document connections as an interactive force-directed graph",
        "content": "The Relationship Graph visualizes connections between your documents using Cytoscape.js.\n\n**Opening the Graph:**\n- Click the GitGraph icon in the Activity Bar\n- Or click \"Open Graph\" link in the DocumentEditor header\n\n**Graph Types (5 views):**\n- **Full Graph** — All document connections\n- **Character Network** — Character-to-character connections\n- **Location Map** — Location-based connections\n- **Thematic Links** — Theme-based connections\n- **Tag-Based Only** — Connections from shared tags (no AI needed)\n\n**Relationship Types (5 categories):**\n- Character Connection (amber)\n- Location (green)\n- Thematic (purple)\n- Narrative (blue)\n- Tag-Based (gray dashed)\n\n**Node Interaction:**\n- Click a node to open its document\n- Drag nodes to rearrange\n- Hover for tooltips with tags and metadata\n- Timeline metadata shown in tooltips when available\n\n**Filtering:**\n- Filter by tags in the sidebar\n- Filter by relationship types\n- Filter by era (select specific eras to include)\n\n**Controls:**\n- Resizable, draggable modal\n- Maximize, zoom, pan, and re-layout buttons\n- Smart caching to localStorage for fast reload\n\n**AI Requirements:**\n- LLM-powered for most graph types\n- Greyed out when AI is offline\n- Tag-Based Only works without AI",
        "shortcuts": [],
        "relatedArticles": [
          "tags",
          "wikilinks",
          "timeline"
        ]
      },
      {
        "id": "workspace-search",
        "title": "Workspace Search",
        "description": "Full-text search across all workspace documents",
        "content": "**Opening Search:**\n- Click the magnifying glass icon in the Activity Bar\n\n**Search Features:**\n- Full-text search across all workspace text files\n- Debounced input for responsive searching\n- Results shown with file path and matching line\n- Click a result to open the file at the match location\n\n**Search Scope:**\n- Searches all text files in your workspace\n- Includes document content, not just file names\n- Results update in real-time as you type",
        "shortcuts": [],
        "relatedArticles": [
          "find-replace",
          "file-explorer"
        ]
      },
      {
        "id": "story-bible",
        "title": "Story Bible Compiler",
        "description": "Compile your workspace into a single reference document",
        "content": "The Story Bible Compiler creates a single HTML document from your workspace.\n\n**How to Use:**\n1. Open the compiler from the toolbar or menu\n2. Select files to include:\n   - Individual files\n   - Entire folders\n   - Entire workspace\n3. Configure compilation options\n4. Click Compile\n\n**Compilation Options:**\n- **Table of Contents** — With anchor links for navigation\n- **Section Dividers** — Visual separators between documents\n- **File Path Subtitles** — Show source paths in the output\n- **Margin Note Exclusion** — Exclude margin column content\n- **Ordering** — By folder, alphabetical, or last modified\n\n**Use Cases:**\n- Create print-ready world bibles\n- Compile character compendiums\n- Generate quest reference guides\n- Export for sharing with collaborators",
        "shortcuts": [],
        "relatedArticles": [
          "export-import"
        ]
      }
    ]
  },
  {
    "id": "settings",
    "name": "Settings",
    "icon": "⚙️",
    "articles": [
      {
        "id": "settings-overview",
        "title": "Settings Overview",
        "description": "Configure WORBI behavior, appearance, and integrations",
        "content": "WORBI Settings are organized into 5 tabs:\n\n**LLM Tab:**\n- Provider selection (16 presets + custom)\n- API base URL and API key\n- Model selection\n- Connection testing\n\n**Tools Tab:**\n- Web search toggle\n- File access level (none/read/readwrite/full)\n- Granular permissions (create, edit, delete, rename)\n- Max search results slider\n\n**Images Tab:**\n- Z-Image server status\n- Start/stop server controls\n- Model info\n- Minimum free VRAM threshold\n\n**Editor Tab:**\n- Max open tabs setting\n- Editor behavior preferences\n\n**Appearance Tab:**\n- Theme presets (6 available)\n- Light/dark mode toggle\n- Full color customization (13 colors)\n- Live preview\n- Reset to default\n\nSettings are saved per-user and persisted across sessions.",
        "shortcuts": [],
        "relatedArticles": [
          "llm-setup",
          "tool-permissions",
          "appearance"
        ]
      },
      {
        "id": "tool-permissions",
        "title": "AI Tool Permissions",
        "description": "Control what actions the AI can perform on your workspace",
        "content": "**Access Settings → Tools tab to manage permissions.**\n\n**Web Search:**\n- Toggle on/off to allow AI internet research\n- Max search results configurable (1-20)\n\n**File Access Levels:**\n\n| Level | Read | Create | Edit | Delete | Rename |\n|-------|------|--------|------|--------|--------|\n| none | ❌ | ❌ | ❌ | ❌ | ❌ |\n| read | ✅ | ❌ | ❌ | ❌ | ❌ |\n| readwrite | ✅ | ✅* | ✅* | ❌ | ❌ |\n| full | ✅ | ✅* | ✅* | ✅* | ✅* |\n\n*Requires corresponding granular toggle enabled.\n\n**Granular Permissions:**\n- Allow file creation\n- Allow file modification (readwrite+)\n- Allow file deletion (full only, off by default)\n- Allow file/folder renaming (full only)\n\n**Quick Toggle:**\n- ⚡ button in chat header enables/disables all tools\n- Status cards show tool activity in real-time",
        "shortcuts": [],
        "relatedArticles": [
          "ai-tools",
          "settings-overview"
        ]
      },
      {
        "id": "appearance",
        "title": "Appearance & Themes",
        "description": "Customize WORBI look with presets and full color control",
        "content": "**Access Settings → Appearance tab to customize your theme.**\n\n**Theme Presets (6 available):**\n- **Purple Mist** (default) — Subtle purple accents\n- **Nord** — Cool blue-grey tones\n- **Gruvbox** — Warm retro colors\n- **Dracula** — Dark with vibrant accents\n- **Ocean** — Deep blue tones\n- **Rose** — Pink/red accents\n\n**Light/Dark Mode:**\n- Smooth animated toggle\n- 3 presets include dedicated light variants (Purple Mist, Nord, Ocean)\n\n**Full Color Customization:**\n13 individually customizable colors:\n- Background, Text, Panels, Panel Text\n- Borders, Input BG, Muted BG, Muted Text\n- Primary, Primary Text, Danger, Success, Warning\n\n**Live Preview:**\n- Real-time preview panel\n- Shows buttons, status dots, and input fields\n- Updates as you adjust colors\n\n**Persistence:**\n- Theme settings saved to localStorage\n- Restored automatically on app startup\n- One-click reset to restore Purple Mist default\n\n**Technical:**\n- All colors applied as CSS custom properties\n- Variables: --bg, --fg, --primary, etc.\n- Consistent theming across all components",
        "shortcuts": [],
        "relatedArticles": [
          "settings-overview"
        ]
      }
    ]
  },
  {
    "id": "shortcuts",
    "name": "Keyboard Shortcuts",
    "icon": "⌨️",
    "articles": [
      {
        "id": "all-shortcuts",
        "title": "All Keyboard Shortcuts",
        "description": "Complete reference of all keyboard shortcuts in WORBI",
        "content": "**App Shortcuts:**\n\n| Shortcut | Action |\n|----------|--------|\n| Ctrl+S / Cmd+S | Save file |\n| Ctrl+Shift+N | New from Template |\n| Ctrl+Shift+M | Create bookmark at cursor |\n| F1 | Open Help (coming soon) |\n| Esc | Close modals / dismiss suggestions |\n\n**Editor Shortcuts:**\n\n| Shortcut | Action |\n|----------|--------|\n| Ctrl+B | Bold |\n| Ctrl+I | Italic |\n| Ctrl+U | Underline |\n| Ctrl+F | Find |\n| Ctrl+H | Find & Replace |\n\n**AI Shortcuts:**\n\n| Shortcut | Action |\n|----------|--------|\n| Ctrl+Space | Trigger AI ghost text |\n| Tab | Accept AI suggestion |\n| Esc | Dismiss AI suggestion |\n\n**Customizing Shortcuts:**\n- Open Settings → Keyboard tab\n- 7 programmable shortcuts available\n- Click any shortcut to record a new key combination\n- Conflict detection warns about duplicate bindings\n- Reset individual or all shortcuts to defaults\n- Custom bindings saved to localStorage\n\n**Rebindable Shortcuts:**\n- Save\n- New from Template\n- Find\n- Find & Replace\n- AI Complete\n- Accept AI Suggestion\n- Decline AI Suggestion\n\n**Platform Display:**\n- Ctrl shown as ⌘ on macOS\n- Win shown on Windows for Meta key",
        "shortcuts": [
          {
            "keys": "Ctrl+S",
            "description": "Save file"
          },
          {
            "keys": "Ctrl+B",
            "description": "Bold"
          },
          {
            "keys": "Ctrl+I",
            "description": "Italic"
          },
          {
            "keys": "Ctrl+Space",
            "description": "AI ghost text"
          },
          {
            "keys": "Tab",
            "description": "Accept AI suggestion"
          },
          {
            "keys": "Esc",
            "description": "Dismiss AI suggestion"
          },
          {
            "keys": "Ctrl+F",
            "description": "Find"
          },
          {
            "keys": "Ctrl+H",
            "description": "Find & Replace"
          },
          {
            "keys": "Ctrl+Shift+N",
            "description": "New from Template"
          },
          {
            "keys": "Ctrl+Shift+M",
            "description": "Create bookmark"
          }
        ],
        "relatedArticles": [
          "settings-overview"
        ]
      }
    ]
  },
  {
    "id": "import-export",
    "name": "Import & Export",
    "icon": "💾",
    "articles": [
      {
        "id": "export-import",
        "title": "Import & Export",
        "description": "Import DOCX files and export to PDF or DOCX",
        "content": "**Import:**\n\n**DOCX Import:**\n- Click File → Import DOCX\n- Or drag a .docx file into WORBI\n- Uses mammoth.js for conversion\n- Content imported as HTML into the editor\n\n**Export:**\n\n**PDF Export:**\n- Renders editor content as print-ready PDF\n- Uses html2pdf.js for generation\n- Ideal for world bibles and reference documents\n\n**DOCX Export:**\n- Export editor content as .docx file\n- Edit offline in Microsoft Word\n- Preserves formatting and structure\n\n**Story Bible Export:**\n- Compile multiple files into a single document\n- Includes table of contents and section dividers\n- See \"Story Bible Compiler\" for details",
        "shortcuts": [],
        "relatedArticles": [
          "story-bible"
        ]
      }
    ]
  }
];

const ALL_ARTICLES = HELP_CATEGORIES.flatMap((category) => category.articles);

export function getArticleById(id: string): HelpArticle | undefined {
  return ALL_ARTICLES.find((article) => article.id === id);
}

export function getCategoryForArticle(articleId: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((category) =>
    category.articles.some((article) => article.id === articleId),
  );
}

export function searchArticles(query: string): HelpArticle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return ALL_ARTICLES.filter((article) =>
    [article.title, article.description, article.content].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}

export function formatShortcut(keys: string): string {
  return keys
    .split('+')
    .map((key) => key.trim())
    .map((key) => (key.length === 1 ? key.toUpperCase() : key))
    .join(' + ');
}

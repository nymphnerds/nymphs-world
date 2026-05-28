# WORBI — Data Flow Patterns

## State Management Pattern

```
App.tsx (hook orchestration)
  ├── useAuth()        → authState, login, logout
  ├── useFiles()       → files, tabs, currentFile, save, create, delete
  ├── useLLM()         → chatHistory, settings, tools, sendMessage
  ├── useRecents()     → recentFiles, starredFiles
  ├── useSearch()      → searchResults, debouncedSearch
  ├── useTags()        → tags, assignTag, removeTag
  ├── useBookmarks()   → bookmarks, addBookmark
  ├── useLocations()   → locations, setFileLocations
  ├── useReminders()   → reminders, createReminder, checkReminders
  ├── useImageGeneration() → image gen state
  ├── useSessionPersistence() → session save/restore
  └── useTheme()       → applyThemeColours
```

**No external state management library** (no Redux, no Zustand). All state lives in React hooks called from `App.tsx` and passed down as props.

## File Save Flow

```
User edits TipTap editor
  → onContentChange callback
  → marks tab as dirty (unsaved indicator)
  → user clicks Save or Ctrl+S
  → useFiles.saveFile(fileId, content)
  → PUT /api/files/:fileId { content }
  → on success: clear dirty flag, update local file cache, push to undo stack
```

## AI Chat Flow

```
User types message → clicks Send
  → useLLM.sendMessage(text)
  → POST /api/llm/chat { messages[], model, provider, settings }
  → Server: llmService.sendChatMessage()
    → calls LLM API (OpenAI-compatible endpoint)
    → if response includes tool calls:
      → toolService.executeTool(toolName, arguments)
      → feeds tool result back to LLM
      → repeats until no more tool calls (max 10 iterations)
    → returns final response
  → Client: appends assistant message to chat history
```

## Relationship Graph Flow

```
User clicks Generate Graph on a file
  → App.tsx → handleGenerate(seedPath)
  → POST /api/llm/graph/from-seed { seedPath, relationshipTypes, useAI }
  → Server: graph.js
    → reads file metadata (tags, era, location)
    → scans workspace for related files
    → if AI: sends context to LLM for semantic edge analysis
    → if no-AI: creates edges from shared metadata only
  → Returns nodes[] + edges[]
  → Client: renders in GraphModal using Cytoscape.js
```

## Reminder Flow

```
Client polls POST /api/reminders/check every 30s
  → Server: reminderService.checkAndFireReminders()
  → Returns fired[] reminders
  → Client: shows toast notifications for fired reminders
  → User can convert fired reminder → new follow-up via POST /:id/convert
```

## Game File Export Flow

```
User clicks "Game Export" in Header
  → Opens GameExportModal
  → templateDetector.ts auto-detects template type from folder path
  → User confirms template type + target file name
  → gameGeneratorPrompts.ts loads appropriate LLM prompt
  → POST /api/llm/chat with system prompt + document content
  → LLM converts document to game engine format
  → User reviews generated text
  → File saved to docs/GameReady/ as .txt
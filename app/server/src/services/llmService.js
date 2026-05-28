import axios from 'axios';
import config from '../config.js';
import { executeTool, getToolDefinitions } from './toolService.js';

// Default tool permissions (used when not provided)
const defaultPermissions = {
  webSearch: true,
  allowRead: true,
  allowWrite: true,
  allowDelete: false,
  allowRename: false,
  allowSearch: false,
  maxSearchResults: 5,
  // Feature permissions (default: false — opt-in only)
  allowGraph: false,
  allowTags: false,
  allowLocations: false,
  allowFiles: true,
  allowImageGen: false,
  allowReminders: false,
};

const MAX_TOOL_TURNS = 10;

/**
 * Build headers for LLM API requests
 */
function buildHeaders(apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Normalize base URL — ensure it ends without trailing slash
 */
function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

/**
 * Fetch available models from LLM server
 * @param {Object} settings - User settings with baseUrl, apiKey, serverType
 */
async function fetchModels(settings) {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  if (!baseUrl) {
    throw new Error('No base URL configured. Please set your LLM provider URL in Settings.');
  }

  const isOllama = settings.serverType === 'ollama';
  const headers = buildHeaders(settings.apiKey);

  try {
    let response;
    if (isOllama) {
      // Ollama native API: /api/tags
      response = await axios.get(`${baseUrl}/api/tags`, { headers });
      const models = (response.data.models || []).map((m) => m.name).filter(Boolean);
      return models;
    } else {
      // OpenAI-compatible: /models
      response = await axios.get(`${baseUrl}/models`, { headers });
      const models = (response.data.data || []).map((m) => m.id).filter(Boolean);
      return models;
    }
  } catch (error) {
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
}

/**
 * Test LLM connection by listing models
 * @param {Object} settings - User settings
 */
async function testConnection(settings) {
  try {
    const models = await fetchModels(settings);
    return { success: true, message: 'Connection successful', models };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error.message}` };
  }
}

/**
 * Get a human-friendly label for tool activity
 */
function getToolActivityLabel(toolName, args) {
  switch (toolName) {
    case 'web_search':
      return `🔍 Searching the web for "${args?.query || '...'}"...`;
    case 'read':
      return `📄 Reading ${args?.file_path || '...'}...`;
    case 'list':
      return `📁 Listing ${args?.dir_path || 'workspace root'}...`;
    case 'write':
      return `📝 Writing ${args?.file_path || '...'}...`;
    case 'edit':
      return `✏️ Editing ${args?.file_path || '...'}...`;
    case 'mkdir':
      return `📁 Creating folder ${args?.folder_path || '...'}...`;
    case 'delete':
      return `🗑️ Deleting ${args?.file_path || '...'}...`;
    case 'rename':
      return `🔄 Renaming ${args?.file_path || '...'}...`;
    case 'copy':
      return `📋 Copying ${args?.file_path || '...'}...`;
    case 'move':
      return `📦 Moving ${args?.file_path || '...'}...`;
    case 'search':
      return `🔍 Searching for "${args?.query || '...'}"...`;
    default:
      return `⚙️ Running ${toolName}...`;
  }
}

/**
 * Send chat message to LLM with optional tool calling support
 * @param {Array} messages - Chat history messages
 * @param {string} documentContent - Current document content for context
 * @param {string} [systemPrompt] - Optional user-defined system prompt
 * @param {Object} [permissions] - Tool permissions from user settings
 * @param {Object} settings - User LLM settings (baseUrl, apiKey, modelName, etc.)
 */
async function sendChatMessage(messages, documentContent, systemPrompt, permissions, settings, username) {
  const defaultPrompt = 'You are a helpful AI assistant for a game worldbuilder tool. The user is working on a document with the following content. Use this context to assist with writing, worldbuilding, lore, character development, and quest design.';
  const prompt = systemPrompt && systemPrompt.trim() ? systemPrompt.trim() : defaultPrompt;

  // Build tool instructions appended to system prompt when tools are available
  const perms = permissions || defaultPermissions;
  const tools = getToolDefinitions(perms);
  const providerId = (settings?.providerId || '').toLowerCase();
  // Providers known to NOT support OpenAI-style function calling.
  // NOTE: llama.cpp variants DO support function calling via llama.cpp server (tested).
  // Only textgen-webui is confirmed to not support tools.
  const noToolProviders = ['textgen-webui', 'textgen_webui'];
  const providerSupportsTools = !noToolProviders.includes(providerId);
  const toolsEnabled = tools.length > 0 && providerSupportsTools;

  let toolInstructions = '';
  if (toolsEnabled) {
    toolInstructions = `

---
You have access to tools that let you read, create, and modify files in the user's workspace.
Use the available tools to accomplish the user's requests directly.

Available file operations:
- write: Create new files. Always use this when asked to create a new document.
- read: Read existing files to understand their content before editing.
- list: Browse directories to find files and understand the folder structure.
- edit: Modify existing files (full content overwrite). Read the file first before editing.
- search: Search across all files by name and content.
- mkdir: Create new folders.

## WORKSPACE FILE FORMAT RULES (STRICT)

1. ALL document files must use the .html extension. Never create .txt, .md, or extensionless files for documents.
2. Files contain raw HTML content (not full HTML documents — just the body content).
3. The editor splits content at <!-- MARGIN_SPLIT --> — everything before is main content (left), everything after appears in the Information Panel (right sidebar: Notes, Images, etc).

## FOLDER STRUCTURE (STRICT)

You may ONLY place files in these template-defined folders OR folders that already exist:

 Template Type → Folder:
 - character → NPCs/
 - creature → NPCs/
 - location → Locations/
 - quest → Quests/
 - timeline → MainStory/
 - item → Items/
 - faction → Factions/
 - blank → user-specified existing folder

NEVER create files outside these folders unless the user explicitly references a folder that already exists in the workspace root. NEVER create new folders unless the user explicitly asks.

## SEMANTIC INTENT MAPPING

The user will not use the exact template names. Infer the correct template from their language:

 "NPC" / "character" / "person" / "personality" / "hero" / "villain" → character template → NPCs/
 "monster" / "beast" / "creature" / "animal" / "dragon" / "goblin" → creature template → NPCs/
 "place" / "location" / "city" / "town" / "dungeon" / "forest" / "realm" / "country" → location template → Locations/
 "quest" / "mission" / "task" / "adventure" / "objective" → quest template → Quests/
 "event" / "story" / "timeline" / "history" / "chapter" / "arc" → timeline template → MainStory/
 "item" / "weapon" / "artifact" / "treasure" / "object" / "potion" → item template → Items/
 "faction" / "group" / "organization" / "guild" / "clan" / "kingdom" / "party" → faction template → Factions/
 anything else → blank template → ask user which folder, or use an existing folder

## TEMPLATE HTML STRUCTURES

Use these EXACT HTML structures when creating files. Fill in the fields with creative content based on the user's request.

### Character Template (NPCs/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Character -->
<h2>Character</h2>
<p><strong>Name:</strong> [name]</p>
<p><strong>Role:</strong> [role]</p>
<p><strong>Personality:</strong> [traits]</p>
<p><strong>Location:</strong> [location]</p>
<p><strong>Status:</strong> Active</p>
<h3>Backstory</h3>
<p>[backstory]</p>
<h3>Abilities</h3>
<p>[abilities]</p>
<h3>Relationships</h3>
<p>NPC: - [related NPC name]</p>
<h3>Quotes</h3>
<p>[quote]</p>
<h3>Inventory</h3>
<p>[items]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

### Creature Template (NPCs/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Creature -->
<h2>Creature</h2>
<p><strong>Name:</strong> [name]</p>
<p><strong>Type:</strong> [type]</p>
<p><strong>Hostility:</strong> [hostile/neutral/passive]</p>
<p><strong>Habitat:</strong> [habitat]</p>
<p><strong>Status:</strong> Wild</p>
<h3>Description</h3>
<p>[description]</p>
<h3>Behavior</h3>
<p>[behavior]</p>
<h3>Abilities</h3>
<p>[abilities]</p>
<h3>Combat Tactics</h3>
<p>[tactics]</p>
<h3>Lore</h3>
<p>[lore]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

### Location Template (Locations/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Location -->
<h2>Location</h2>
<p><strong>Name:</strong> [name]</p>
<p><strong>Type:</strong> [type]</p>
<p><strong>Region:</strong> [region]</p>
<p><strong>Connected To:</strong> [linked locations]</p>
<h3>Description</h3>
<p>[description]</p>
<h3>Points of Interest</h3>
<ol><li>[point 1]</li><li>[point 2]</li></ol>
<h3>Inhabitants</h3>
<p>NPC: - [inhabitant name]</p>
<h3>Hazards</h3>
<p>[hazards]</p>
<h3>History</h3>
<p>[history]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

### Quest Template (Quests/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Quest -->
<h2>Quest</h2>
<p><strong>Quest ID:</strong> [id]</p>
<p><strong>Type:</strong> Main/Side/Arc</p>
<p><strong>Status:</strong> Available</p>
<p><strong>Related NPCs:</strong> [NPC names]</p>
<p><strong>Location:</strong> [location]</p>
<h3>Objectives</h3>
<ol><li>[objective 1]</li><li>[objective 2]</li><li>[objective 3]</li></ol>
<h3>Rewards</h3>
<p>[rewards]</p>
<h3>Prerequisites</h3>
<p>[prereqs]</p>
<h3>Story Beats</h3>
<h4>Act 1: Hook</h4>
<p>[hook]</p>
<h4>Act 2: Development</h4>
<p>[development]</p>
<h4>Act 3: Resolution</h4>
<p>[resolution]</p>
<h3>Complications</h3>
<p>[complications]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

### Timeline Template (MainStory/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Timeline -->
<h2>Timeline</h2>
<p><strong>Title:</strong> [title]</p>
<p><strong>Era:</strong> [era]</p>
<p><strong>Connected Quests:</strong> [quest names]</p>
<h3>Setting</h3>
<p>[setting]</p>
<h3>Key Characters</h3>
<p>NPC: - [character name]</p>
<h3>Act 1</h3>
<p>[act 1]</p>
<h3>Act 2</h3>
<p>[act 2]</p>
<h3>Act 3</h3>
<p>[act 3]</p>
<h3>Consequences</h3>
<p>[consequences]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

### Item Template (Items/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Item -->
<h2>Item</h2>
<p><strong>Name:</strong> [name]</p>
<p><strong>Type:</strong> [type]</p>
<p><strong>Rarity:</strong> Common/Uncommon/Rare/Epic/Legendary</p>
<p><strong>Usable:</strong> Yes/No</p>
<h3>Description</h3>
<p>[description]</p>
<h3>Effects</h3>
<p>[effects]</p>
<h3>Lore</h3>
<p>[lore]</p>
<h3>Quest Uses</h3>
<p>[quest connections]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

### Faction Template (Factions/)
\`--\`html
\`\`\`html
<!-- Build: Yes -->
<!-- Template: Faction -->
<h2>Faction</h2>
<p><strong>Name:</strong> [name]</p>
<p><strong>Alignment:</strong> [alignment]</p>
<p><strong>Leader:</strong> [leader]</p>
<p><strong>Relationship:</strong> Neutral/Hostile/Friendly</p>
<h3>Goals</h3>
<p>[goals]</p>
<h3>Members</h3>
<p>NPC: - [member name]</p>
<h3>Relationships</h3>
<p>FACTION: - [related faction]</p>
<h3>Territory</h3>
<p>[territory]</p>
<h3>Notes</h3>
<p></p>
\`\`\`
--\`

## CREATION PROCESS

When the user asks you to create something:

1. INFER the template type from the user's request using the Semantic Intent Mapping above
2. LIST the target folder to check existing files and avoid duplicates
3. Choose a unique filename (e.g., "Jack.html" not "jack - NPC.html")
4. WRITE the file using the correct HTML template structure filled with creative content
5. Place it in the correct folder from the table above

## FILE NAMING CONVENTIONS

- Use simple, clean names: "Jack.html", "DarkForest.html", "FindTheCrown.html"
- Do NOT append template suffixes (no "- NPC", "- Location", "- Quest")
- Capitalize words: "TheDragon.html" not "the dragon.html"
- Replace spaces with CamelCase or single word
- Use .html extension always`;
  }

  const fullSystemPrompt = `${prompt}${toolInstructions}

---
Current Document Content:
${documentContent || '(Empty document)'}
---`;

  const apiMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...messages,
  ];

  // Extract settings with fallbacks
  const baseUrl = normalizeBaseUrl(settings?.baseUrl || config.llm.baseUrl);
  const apiKey = settings?.apiKey || config.llm.apiKey || '';
  const modelName = settings?.modelName || config.llm.modelName;
  const maxTokens = settings?.maxTokens ?? config.llm.maxTokens;
  const temperature = settings?.temperature ?? config.llm.temperature;
  const topP = settings?.topP ?? config.llm.topP;
  const topK = settings?.topK ?? config.llm.topK;
  const frequencyPenalty = settings?.frequencyPenalty ?? config.llm.frequencyPenalty;
  const presencePenalty = settings?.presencePenalty ?? config.llm.presencePenalty;
  const seed = settings?.seed ?? config.llm.seed;

  if (!baseUrl) {
    throw new Error('No LLM base URL configured. Please configure your LLM provider in Settings.');
  }

  // Track tool activity for the response
  const toolActivity = [];

  // Build request body with inference parameters
  const buildRequestBody = (msgs, includeTools = false) => {
    const body = {
      model: modelName,
      messages: msgs,
      max_tokens: maxTokens,
      temperature: temperature,
    };

    if (topP !== undefined && topP !== 1.0) body.top_p = topP;
    if (topK !== undefined && topK !== 50) body.top_k = topK;
    if (frequencyPenalty !== undefined && frequencyPenalty !== 0.0) body.frequency_penalty = frequencyPenalty;
    if (presencePenalty !== undefined && presencePenalty !== 0.0) body.presence_penalty = presencePenalty;
    if (seed !== undefined && seed !== 0) body.seed = seed;

    if (includeTools && toolsEnabled) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    return body;
  };

  const headers = buildHeaders(apiKey);

  // DEBUG: Log tool configuration before request loop
  console.log('[llmService] TOOL CONFIG DEBUG:', JSON.stringify({
    providerId,
    toolsLength: tools.length,
    providerSupportsTools,
    toolsEnabled,
    noToolProviders,
    firstToolName: tools?.[0]?.function?.name
  }));

  try {
    let currentMessages = [...apiMessages];
    let turnCount = 0;
    let toolsSupported = true;

    while (turnCount < MAX_TOOL_TURNS) {
      const requestBody = buildRequestBody(currentMessages, toolsSupported);

      // DEBUG: Log request details before sending to LLM
      console.log('[llmService] REQUEST DEBUG:', JSON.stringify({
        model: modelName,
        turn: turnCount,
        messageCount: requestBody.messages.length,
        hasTools: !!requestBody.tools,
        toolCount: requestBody.tools?.length || 0,
        toolChoice: requestBody.tool_choice,
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        firstToolName: requestBody.tools?.[0]?.function?.name,
        systemPreview: requestBody.messages[0]?.content?.substring(0, 400)
      }));

      try {
        const response = await axios.post(
          `${baseUrl}/chat/completions`,
          requestBody,
          { headers }
        );

        // DEBUG: Log raw LLM response
        const choice = response.data.choices?.[0];
        const msg = choice?.message;
        console.log('[llmService] RESPONSE DEBUG:', JSON.stringify({
          turn: turnCount,
          hasChoices: !!response.data.choices,
          hasMessage: !!msg,
          role: msg?.role,
          hasContent: !!msg?.content,
          contentLength: msg?.content?.length || 0,
          contentPreview: msg?.content?.substring(0, 300),
          hasToolCalls: !!(msg?.tool_calls),
          toolCallCount: msg?.tool_calls?.length || 0,
          firstToolCallName: msg?.tool_calls?.[0]?.function?.name,
          finishReason: choice?.finish_reason,
        }));

        if (!choice) {
          throw new Error('No response from LLM');
        }

        const message = choice.message;

        // Check if the LLM wants to call tools
        if (message.tool_calls && message.tool_calls.length > 0) {
          turnCount++;
          currentMessages.push(message);

          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function?.name;
            let toolArgs = {};

            try {
              toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
            } catch {
              toolArgs = {};
            }

            // Apply maxSearchResults limit from permissions
            if (toolName === 'web_search' && perms.maxSearchResults) {
              if (!toolArgs.max_results || toolArgs.max_results > perms.maxSearchResults) {
                toolArgs.max_results = perms.maxSearchResults;
              }
            }

            const activityLabel = getToolActivityLabel(toolName, toolArgs);
            toolActivity.push({
              tool: toolName,
              status: 'running',
              label: activityLabel,
              args: toolArgs,
            });

            let toolResult;
            try {
              toolResult = await executeTool(toolName, toolArgs, username);
              toolActivity[toolActivity.length - 1].status = 'complete';
              toolActivity[toolActivity.length - 1].result = toolResult;
            } catch (error) {
              toolResult = `Error: ${error.message}`;
              toolActivity[toolActivity.length - 1].status = 'error';
              toolActivity[toolActivity.length - 1].error = error.message;
            }

            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }

          // Continue the loop to send the tool results back to the LLM
          continue;
        }

        // No tool calls - return the final text response
        return {
          role: 'assistant',
          content: message.content || '',
          toolActivity: toolActivity.length > 0 ? toolActivity : undefined,
        };
      } catch (requestError) {
        // If first request with tools fails with 5xx, retry without tools
        // (llama.cpp and some local servers don't support function calling)
        if (toolsSupported && toolsEnabled && turnCount === 0) {
          console.warn(`[llmService] Request with tools failed, retrying without tools (server may not support function calling)`);
          toolsSupported = false;
          continue;
        }
        throw requestError;
      }
    }

    // Max turns reached
    return {
      role: 'assistant',
      content: 'I reached the maximum number of tool calls. Please try a more specific request.',
      toolActivity: toolActivity.length > 0 ? toolActivity : undefined,
    };

  } catch (error) {
    console.error('[llmService] sendChatMessage FAILED:', error.message, JSON.stringify(error.response?.data || ''));
    throw new Error(`LLM request failed: ${error.message}`);
  }
}

/**
 * Send a completion request (creative writing continuation)
 * Used for the inline AI writing assistant (ghost text at cursor)
 * @param {string} context - The text context to continue from
 * @param {string} [documentTitle] - Optional document title for context
 * @param {number} [maxTokens=200] - Max tokens to generate
 * @param {Object} settings - User LLM settings
 */
async function sendCompletion(context, documentTitle, maxTokens, settings) {
  const completionSystemPrompt = `You are a creative writing assistant embedded in WORBI, a world-building document editor.
Complete the user's text in their voice and style. Continue naturally from the cutoff point.
Match the tone, vocabulary, and pacing of the surrounding text.
Do NOT add dialogue markers, chapter headings, or structural elements unless the context clearly calls for them.
Output ONLY the continuation text — no explanations, no meta-commentary.`;

  const fullSystemPrompt = documentTitle
    ? `${completionSystemPrompt}\n\nThe document is titled: ${documentTitle}`
    : completionSystemPrompt;

  // Send as a single chat message — the LLM returns the continuation
  const response = await sendChatMessage(
    [{ role: 'user', content: context }],
    '',
    fullSystemPrompt,
    { webSearch: false, allowRead: false, allowWrite: false, allowDelete: false, allowRename: false, allowSearch: false, maxSearchResults: 0, allowFiles: false },
    { ...settings, maxTokens: maxTokens || 200 }
  );

  return {
    completion: response.content || '',
    model: settings?.modelName || config.llm.modelName,
  };
}

/**
 * Document type templates for AI document generation
 */
const DOCUMENT_TEMPLATES = {
  character: `You are generating a character sheet for a world-building project.
Output structured HTML with these sections:
<h2>Character Name</h2>
<p><strong>Role:</strong> ...</p>
<p><strong>Race/Species:</strong> ...</p>
<p><strong>Age:</strong> ...</p>
<h3>Physical Description</h3>
<p>...</p>
<h3>Personality</h3>
<p>...</p>
<h3>Background</h3>
<p>...</p>
<h3>Abilities & Skills</h3>
<p>...</p>
<h3>Motivations & Goals</h3>
<p>...</p>
<h3>Relationships</h3>
<p>...</p>
<h3>Notes</h3>
<p>...</p>

Fill in all sections with creative, detailed content based on the user's prompt.
Use the margin column (<!-- MARGIN_SPLIT -->) for supplementary notes.`,

  location: `You are generating a location description for a world-building project.
Output structured HTML with these sections:
<h2>Location Name</h2>
<p><strong>Type:</strong> (city, dungeon, forest, mountain, etc.)</p>
<p><strong>Region:</strong> ...</p>
<p><strong>Climate:</strong> ...</p>
<h3>Geography & Layout</h3>
<p>...</p>
<h3>Population & Culture</h3>
<p>...</p>
<h3>Points of Interest</h3>
<p>...</p>
<h3>History</h3>
<p>...</p>
<h3>Adventure Hooks</h3>
<p>...</p>

Fill in all sections with creative, detailed content based on the user's prompt.`,

  quest: `You are generating a quest outline for a world-building project.
Output structured HTML with these sections:
<h2>Quest Name</h2>
<p><strong>Recommended Level:</strong> ...</p>
<p><strong>Quest Giver:</strong> ...</p>
<p><strong>Location:</strong> ...</p>
<h3>Hook</h3>
<p>How the party discovers the quest...</p>
<h3>Objectives</h3>
<ol><li>...</li><li>...</li></ol>
<h3>Key NPCs</h3>
<p>...</p>
<h3>Encounters</h3>
<p>...</p>
<h3>Rewards</h3>
<p>...</p>
<h3>Possible Complications</h3>
<p>...</p>

Fill in all sections with creative, detailed content based on the user's prompt.`,

  timeline: `You are generating a timeline entry for a world-building project.
Output structured HTML with these sections:
<h2>Event Name</h2>
<p><strong>Date/Period:</strong> ...</p>
<p><strong>Category:</strong> (historical, personal, mythological, etc.)</p>
<h3>Description</h3>
<p>What happened...</p>
<h3>Key Figures</h3>
<p>...</p>
<h3>Consequences</h3>
<p>How this event shaped the world...</p>
<h3>Related Events</h3>
<p>...</p>

Fill in all sections with creative, detailed content based on the user's prompt.`,

  freeform: `You are generating content for a world-building document.
Write creative, detailed prose based on the user's prompt.
Use HTML formatting with appropriate headings, paragraphs, and lists.`,
};

/**
 * Generate a document from a prompt using AI
 * @param {string} prompt - User's description of what to generate
 * @param {string} docType - Document type: 'character', 'location', 'quest', 'timeline', 'freeform'
 * @param {string} [documentContext] - Optional context from current document
 * @param {Object} settings - User LLM settings
 */
async function generateDocument(prompt, docType, documentContext, settings) {
  const template = DOCUMENT_TEMPLATES[docType] || DOCUMENT_TEMPLATES.freeform;

  const userMessage = documentContext
    ? `Here is some context from my world:\n\n${documentContext}\n\nPlease generate a document based on this prompt:\n\n${prompt}`
    : `Please generate a document based on this prompt:\n\n${prompt}`;

  const response = await sendChatMessage(
    [{ role: 'user', content: userMessage }],
    '',
    template,
    { webSearch: false, allowRead: false, allowWrite: false, allowDelete: false, allowRename: false, allowSearch: false, maxSearchResults: 0, allowFiles: false },
    settings
  );

  return {
    html: response.content || '',
    model: settings?.modelName || config.llm.modelName,
  };
}

/**
 * Transcribe an image to text using a vision-capable LLM model
 * Sends the image as a base64 data URI with a transcription prompt
 * @param {string} imageBase64 - Base64-encoded image data URI (e.g. "data:image/png;base64,...")
 * @param {string} [customPrompt] - Optional custom prompt for the transcription
 * @param {Object} settings - User LLM settings
 */
async function transcribeImage(imageBase64, customPrompt, settings) {
  const defaultPrompt = 'Transcribe all the text visible in this image. Preserve the original formatting, paragraph structure, line breaks, and any handwritten style. If the text is handwritten, do your best to accurately transcribe it. Output only the transcribed text with no additional commentary.';
  const prompt = customPrompt && customPrompt.trim() ? customPrompt.trim() : defaultPrompt;

  // Extract settings with fallbacks
  const baseUrl = normalizeBaseUrl(settings?.baseUrl || config.llm.baseUrl);
  const apiKey = settings?.apiKey || config.llm.apiKey || '';
  const modelName = settings?.modelName || config.llm.modelName;
  const maxTokens = settings?.maxTokens ?? config.llm.maxTokens;
  const temperature = settings?.temperature ?? config.llm.temperature;

  if (!baseUrl) {
    throw new Error('No LLM base URL configured. Please configure your LLM provider in Settings.');
  }

  if (!imageBase64) {
    throw new Error('No image provided for transcription.');
  }

  // Build vision message with image
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageBase64 } },
      ],
    },
  ];

  const body = {
    model: modelName,
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature,
  };

  const headers = buildHeaders(apiKey);

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      body,
      { headers, maxBodyLength: Infinity, maxContentLength: Infinity }
    );

    const choice = response.data.choices?.[0];
    if (!choice) {
      throw new Error('No response from LLM');
    }

    const content = choice.message?.content || '';

    // Check for error about vision not being supported
    if (content.toLowerCase().includes('does not support') || content.toLowerCase().includes('vision')) {
      // Some models return an error message instead of throwing
      // But typically the API itself throws, so this is a fallback
    }

    return {
      text: content,
      model: modelName,
    };
  } catch (error) {
    // Provide helpful error for vision-unsupported models
    if (error.response?.data?.error?.message?.toLowerCase().includes('vision') ||
        error.response?.data?.error?.message?.toLowerCase().includes('image') ||
        error.response?.data?.error?.message?.toLowerCase().includes('multimodal')) {
      throw new Error(`Your current model "${modelName}" does not support image/vision input. Please switch to a vision-capable model (e.g., LLaVA, GPT-4o, Claude Vision) in Settings.`);
    }
    throw new Error(`Image transcription failed: ${error.message}`);
  }
}

export {
  fetchModels,
  testConnection,
  sendChatMessage,
  sendCompletion,
  generateDocument,
  transcribeImage,
};

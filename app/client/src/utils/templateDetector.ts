/**
 * Template Detector — Maps WORBI document folder paths to game file template types.
 *
 * The template type is determined by the top-level folder the document resides in.
 * This system is extensible: adding a new template type requires only adding an
 * entry to TEMPLATE_CONFIG.
 */

export interface TemplateTypeConfig {
  /** Unique identifier for this template type */
  id: string;
  /** Human-readable label */
  label: string;
  /** The folder name(s) in the workspace that trigger this template type */
  folderMatch: string[];
  /** Output file extension (always .txt for game engine compatibility) */
  fileExtension: string;
  /** Output subfolder under GameReady/ */
  outputSubfolder: string;
  /** Whether this is an aggregator (scans all docs) vs a single-doc generator */
  isAggregator: boolean;
  /** Prompt template key — matches a file in templates/game-generator/ */
  promptKey: string;
}

export const TEMPLATE_CONFIG: Record<string, TemplateTypeConfig> = {
  npc: {
    id: 'npc',
    label: 'NPC Character',
    folderMatch: ['NPCs'],
    fileExtension: '.txt',
    outputSubfolder: 'NPCs',
    isAggregator: false,
    promptKey: 'npc',
  },
  playerCharacter: {
    id: 'playerCharacter',
    label: 'Player Character',
    folderMatch: ['PlayerCharacters', 'PlayerCharacter'],
    fileExtension: '.txt',
    outputSubfolder: 'PlayerCharacter',
    isAggregator: false,
    promptKey: 'playerCharacter',
  },
  quest: {
    id: 'quest',
    label: 'Quest Arc',
    folderMatch: ['Quests'],
    fileExtension: '.txt',
    outputSubfolder: 'Quests',
    isAggregator: false,
    promptKey: 'quest',
  },
  mainStory: {
    id: 'mainStory',
    label: 'Main Story',
    folderMatch: ['MainStory'],
    fileExtension: '.txt',
    outputSubfolder: 'MainStory',
    isAggregator: false,
    promptKey: 'mainStory',
  },
  location: {
    id: 'location',
    label: 'Location',
    folderMatch: ['Locations'],
    fileExtension: '.txt',
    outputSubfolder: 'Locations',
    isAggregator: false,
    promptKey: 'location',
  },
  item: {
    id: 'item',
    label: 'Item',
    folderMatch: ['Items'],
    fileExtension: '.txt',
    outputSubfolder: 'Items',
    isAggregator: false,
    promptKey: 'item',
  },
  faction: {
    id: 'faction',
    label: 'Faction',
    folderMatch: ['Factions'],
    fileExtension: '.txt',
    outputSubfolder: 'Factions',
    isAggregator: false,
    promptKey: 'faction',
  },
  noticeBoard: {
    id: 'noticeBoard',
    label: 'NoticeBoard Agent',
    folderMatch: ['NoticeBoard', '_NoticeBoard'],
    fileExtension: '.txt',
    outputSubfolder: 'NPCs',
    isAggregator: true,
    promptKey: 'noticeBoard',
  },
};

/** All template type IDs */
export const TEMPLATE_TYPE_IDS = Object.keys(TEMPLATE_CONFIG);

/** All non-aggregator template types (regular generators) */
export const GENERATOR_TYPES = TEMPLATE_TYPE_IDS.filter(id => !TEMPLATE_CONFIG[id].isAggregator);

/** The aggregator type ID (NoticeBoard) */
export const AGGREGATOR_TYPE = 'noticeBoard';

/**
 * The folder path prefix where game-ready output files are stored.
 */
export const GAMEREADY_FOLDER = 'GameReady';

/**
 * Detect the template type based on the document's folder path.
 * Returns null if the document is not in a recognized template folder.
 *
 * @param folderPath - The folder path of the document (e.g., "NPCs", "QuestArcs")
 * @returns The template type config, or null if not recognized
 */
export function detectTemplateType(folderPath: string): TemplateTypeConfig | null {
  if (!folderPath) return null;

  // Extract the top-level folder from the path
  const topFolder = folderPath.replace(/\\/g, '/').split('/')[0];

  for (const config of Object.values(TEMPLATE_CONFIG)) {
    if (config.folderMatch.includes(topFolder)) {
      return config;
    }
  }

  return null;
}

/**
 * Get all template type configurations.
 */
export function getAllTemplateTypes(): TemplateTypeConfig[] {
  return Object.values(TEMPLATE_CONFIG);
}

/**
 * Get a template type configuration by its ID.
 */
export function getTemplateTypeById(id: string): TemplateTypeConfig | undefined {
  return TEMPLATE_CONFIG[id];
}

/**
 * Build the output path for a generated game file.
 *
 * @param templateType - The template type config
 * @param fileName - The base file name (without extension)
 * @returns The full output path under GameReady/
 */
export function buildGameReadyPath(templateType: TemplateTypeConfig, fileName: string): string {
  return `${GAMEREADY_FOLDER}/${templateType.outputSubfolder}/${fileName}${templateType.fileExtension}`;
}

/**
 * Check if a folder path is inside the GameReady directory.
 */
export function isGameReadyFolder(folderPath: string): boolean {
  if (!folderPath) return false;
  const topFolder = folderPath.split('/')[0];
  return topFolder === GAMEREADY_FOLDER;
}

/**
 * Check if a file path is a game-ready file.
 */
export function isGameReadyFile(filePath: string): boolean {
  if (!filePath) return false;
  return filePath.startsWith(GAMEREADY_FOLDER + '/') || filePath.startsWith(GAMEREADY_FOLDER + '\\');
}

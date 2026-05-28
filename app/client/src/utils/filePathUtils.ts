/**
 * File Path Utilities
 *
 * Shared path manipulation helpers used across the app for
 * folder navigation, file naming, and path extraction.
 */

/**
 * Extract the parent folder path from a file path.
 * Returns empty string for files at the workspace root.
 *
 * @param filePath - A relative file path (e.g., "NPCs/JimmyDog.html")
 * @returns The parent folder path or empty string for root files
 *
 * @example
 * getFolderFromPath("NPCs/JimmyDog.html") // "NPCs"
 * getFolderFromPath("Quests/Acts/Act1.html") // "Quests/Acts"
 * getFolderFromPath("rootFile.html") // ""
 * getFolderFromPath("") // ""
 */
export function getFolderFromPath(filePath: string): string {
  if (!filePath) return '';
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return filePath.substring(0, lastSlash);
}

/**
 * Extract the filename from a file path.
 *
 * @param filePath - A relative file path
 * @returns The filename including extension
 *
 * @example
 * getFileName("NPCs/JimmyDog.html") // "JimmyDog.html"
 * getFileName("rootFile.html") // "rootFile.html"
 */
export function getFileName(filePath: string): string {
  if (!filePath) return '';
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return filePath;
  return filePath.substring(lastSlash + 1);
}

/**
 * Strip the .html extension from a filename (case-insensitive).
 *
 * @param fileName - A filename with or without .html extension
 * @returns The filename without the .html extension
 *
 * @example
 * stripHtmlExtension("JimmyDog.html") // "JimmyDog"
 * stripHtmlExtension("JimmyDog.HTML") // "JimmyDog"
 * stripHtmlExtension("notes.txt") // "notes.txt"
 */
export function stripHtmlExtension(fileName: string): string {
  return fileName.replace(/\.html$/i, '');
}

/**
 * Get a clean display name from a file path (folder stripped, .html removed).
 *
 * @param filePath - A relative file path
 * @returns The clean display name
 *
 * @example
 * getDisplayName("NPCs/JimmyDog.html") // "JimmyDog"
 * getDisplayName("Quests/Acts/Act1.html") // "Act1"
 */
export function getDisplayName(filePath: string): string {
  const name = getFileName(filePath);
  return stripHtmlExtension(name);
}
import { useCallback } from 'react';
import { signImageBatch, isProxyImageUrl, getOriginalPathFromProxy, isWorkspaceProxyUrl, signImageFromWorkspace } from '../../services/api';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico']);

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Extract image src values from HTML content.
 * Only considers server-side image URLs (/api/files/images/...).
 */
export function extractImagePaths(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  const paths: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith('/api/files/images/')) {
      const relativePath = src.replace('/api/files/images/', '');
      const decoded = relativePath.split('/').map(seg => decodeURIComponent(seg)).filter(Boolean).join('/');
      paths.push(decoded);
    }
  }
  return paths;
}

/**
 * Extract workspace-relative image paths from HTML (e.g., "folder/image.png").
 */
export function extractWorkspaceImagePaths(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  const paths: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith('/') || src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:')) continue;
    const filename = src.split('/').pop() || '';
    if (isImageFile(filename)) {
      paths.push(src);
    }
  }
  return paths;
}

export function useImageConversion() {
  /** Convert server image URLs to signed proxy URLs for display in the editor */
  const convertServerUrlsToProxyUrls = useCallback(async (html: string): Promise<string> => {
    let result = html;

    // Step 1: Sign asset image URLs in batch
    const assetPaths = extractImagePaths(result);
    if (assetPaths.length > 0) {
      try {
        const signedMap = await signImageBatch(assetPaths);
        for (const [originalPath, proxyUrl] of signedMap) {
          const encodedSegments = originalPath.split('/').map(seg => encodeURIComponent(seg)).filter(Boolean);
          const serverUrl = '/api/files/images/' + encodedSegments.join('/');
          const escaped = serverUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          result = result.replace(new RegExp(escaped, 'g'), proxyUrl);
        }
      } catch (err) {
        console.error('[images] Failed to sign asset image URLs:', err);
      }
    }

    // Step 2: Sign workspace-relative image paths
    const wsPaths = extractWorkspaceImagePaths(result);
    if (wsPaths.length > 0) {
      for (const wsPath of wsPaths) {
        try {
          const proxyUrl = await signImageFromWorkspace(wsPath);
          const escaped = wsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          result = result.replace(new RegExp(escaped, 'g'), proxyUrl);
        } catch (err) {
          console.warn('[images] Failed to sign workspace image:', wsPath, err);
        }
      }
    }

    return result;
  }, []);

  /** Convert proxy URLs back to canonical server URLs before saving */
  const convertProxyUrlsToServerUrls = useCallback((html: string): string => {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    let result = html;
    let match;
    const replacements: [string, string][] = [];

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (isProxyImageUrl(src)) {
        const originalPath = getOriginalPathFromProxy(src);
        if (originalPath) {
          let serverUrl: string;
          if (isWorkspaceProxyUrl(src)) {
            serverUrl = originalPath;
          } else {
            const encodedSegments = originalPath.split('/').map(seg => encodeURIComponent(seg)).filter(Boolean);
            serverUrl = '/api/files/images/' + encodedSegments.join('/');
          }
          const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          replacements.push([escaped, serverUrl]);
        }
      }
    }

    for (const [escaped, serverUrl] of replacements) {
      result = result.replace(new RegExp(escaped, 'g'), serverUrl);
    }
    return result;
  }, []);

  return {
    convertServerUrlsToProxyUrls,
    convertProxyUrlsToServerUrls,
  };
}
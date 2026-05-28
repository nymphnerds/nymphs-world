import { useState, useEffect, useCallback } from 'react';
import { getTags, createTag, updateTag, deleteTag, getFileTags, addTagsToFile, removeTagFromFile, setFileTags as setFileTagsApi, getFilesByTag, getFileRelationships, Tag, FileItem, RelationshipResult } from '../services/api';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTags();
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const create = async (name: string, color?: string, description?: string) => {
    try {
      const newTag = await createTag(name, color, description);
      setTags(prev => [...prev, newTag]);
      return newTag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
      throw err;
    }
  };

  const update = async (id: string, updates: { name?: string; color?: string; description?: string }) => {
    try {
      const updated = await updateTag(id, updates);
      setTags(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
      throw err;
    }
  };

  const getByColor = (tagName: string) => {
    return tags.find(t => t.name === tagName)?.color || '#a78bfa';
  };

  return {
    tags,
    loading,
    error,
    refresh: fetchTags,
    createTag: create,
    updateTag: update,
    deleteTag: remove,
    getByColor,
  };
}

// Hook for managing tags on a specific file
export function useFileTags(filePath: string | null) {
  const [fileTags, setFileTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tags } = useTags();

  const fetchFileTags = useCallback(async () => {
    if (!filePath) {
      setFileTags([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getFileTags(filePath);
      setFileTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch file tags');
      setFileTags([]);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    fetchFileTags();
  }, [fetchFileTags]);

  const addTags = async (tagNames: string[]) => {
    if (!filePath) return;
    try {
      setError(null);
      await addTagsToFile(filePath, tagNames);
      await fetchFileTags();
      window.dispatchEvent(new CustomEvent('wbu-tags-changed', { detail: { filePath } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tags');
      throw err;
    }
  };

  const removeTag = async (tagName: string) => {
    if (!filePath) return;
    try {
      setError(null);
      await removeTagFromFile(filePath, tagName);
      await fetchFileTags();
      window.dispatchEvent(new CustomEvent('wbu-tags-changed', { detail: { filePath } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
      throw err;
    }
  };

  const replaceTags = async (tagNames: string[]) => {
    if (!filePath) return;
    try {
      setError(null);
      await setFileTagsApi(filePath, tagNames);
      await fetchFileTags();
      window.dispatchEvent(new CustomEvent('wbu-tags-changed', { detail: { filePath } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set tags');
      throw err;
    }
  };

  const getTagColor = (tagName: string) => {
    return tags.find(t => t.name === tagName)?.color || '#a78bfa';
  };

  const availableTags = tags.filter(t => !fileTags.includes(t.name));

    return {
    fileTags,
    availableTags,
    loading,
    error,
    refresh: fetchFileTags,
    addTags,
    removeTag,
    replaceTags,
    getTagColor,
  };
}

// Hook for getting files by tag and relationships
export function useTagQueries() {
  const [filesByTag, setFilesByTag] = useState<FileItem[]>([]);
  const [relationships, setRelationships] = useState<RelationshipResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFilesByTag = async (tagName: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFilesByTag(tagName);
      setFilesByTag(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files by tag');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchRelationships = async (filePath: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFileRelationships(filePath);
      setRelationships(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch relationships');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    filesByTag,
    relationships,
    loading,
    error,
    fetchFilesByTag,
    fetchRelationships,
  };
}
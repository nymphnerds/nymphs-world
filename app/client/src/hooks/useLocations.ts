import { useState, useEffect, useCallback } from 'react';
import {
  getLocations, createLocation, updateLocation, deleteLocation,
  getFileLocations, addLocationsToFile, removeLocationFromFile,
  setFileLocations as setFileLocationsApi, getFilesByLocation,
  Location, FileItem
} from '../services/api';

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLocations();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Listen for location changes from other components
  useEffect(() => {
    const handler = () => {
      fetchLocations();
    };
    window.addEventListener('wbu-locations-changed', handler);
    return () => window.removeEventListener('wbu-locations-changed', handler);
  }, [fetchLocations]);

  const notifyChange = () => {
    window.dispatchEvent(new CustomEvent('wbu-locations-changed'));
  };

  const create = async (name: string, color?: string, description?: string) => {
    try {
      const newLocation = await createLocation(name, color, description);
      setLocations(prev => [...prev, newLocation]);
      notifyChange();
      return newLocation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create location');
      throw err;
    }
  };

  const update = async (id: string, updates: { name?: string; color?: string; description?: string }) => {
    try {
      const updated = await updateLocation(id, updates);
      setLocations(prev => prev.map(l => l.id === id ? updated : l));
      notifyChange();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update location');
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));
      notifyChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location');
      throw err;
    }
  };

  const getByColor = (locationName: string) => {
    return locations.find(l => l.name === locationName)?.color || '#10b981';
  };

  return {
    locations,
    loading,
    error,
    refresh: fetchLocations,
    createLocation: create,
    updateLocation: update,
    deleteLocation: remove,
    getByColor,
  };
}

// Hook for managing locations on a specific file
export function useFileLocations(filePath: string | null) {
  const [fileLocations, setFileLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locations } = useLocations();

  const fetchFileLocations = useCallback(async () => {
    if (!filePath) {
      setFileLocations([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getFileLocations(filePath);
      setFileLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch file locations');
      setFileLocations([]);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    fetchFileLocations();
  }, [fetchFileLocations]);

  // Listen for file-location changes from other components
  useEffect(() => {
    if (!filePath) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.filePath === filePath) {
        fetchFileLocations();
      }
    };
    window.addEventListener('wbu-file-locations-changed', handler);
    return () => window.removeEventListener('wbu-file-locations-changed', handler);
  }, [filePath, fetchFileLocations]);

  const notifyFileChange = () => {
    if (!filePath) return;
    window.dispatchEvent(new CustomEvent('wbu-file-locations-changed', { detail: { filePath } }));
  };

  const addLocations = async (locationNames: string[]) => {
    if (!filePath) return;
    try {
      setError(null);
      await addLocationsToFile(filePath, locationNames);
      await fetchFileLocations();
      notifyFileChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add locations');
      throw err;
    }
  };

  const removeLocation = async (locationName: string) => {
    if (!filePath) return;
    try {
      setError(null);
      await removeLocationFromFile(filePath, locationName);
      await fetchFileLocations();
      notifyFileChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove location');
      throw err;
    }
  };

  const replaceLocations = async (locationNames: string[]) => {
    if (!filePath) return;
    try {
      setError(null);
      await setFileLocationsApi(filePath, locationNames);
      await fetchFileLocations();
      notifyFileChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set locations');
      throw err;
    }
  };

  const getLocationColor = (locationName: string) => {
    return locations.find(l => l.name === locationName)?.color || '#10b981';
  };

  const availableLocations = locations.filter(l => !fileLocations.includes(l.name));

  return {
    fileLocations,
    availableLocations,
    loading,
    error,
    refresh: fetchFileLocations,
    addLocations,
    removeLocation,
    replaceLocations,
    getLocationColor,
  };
}

// Hook for getting files by location
export function useLocationQueries() {
  const [filesByLocation, setFilesByLocation] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFilesByLocation = async (locationName: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFilesByLocation(locationName);
      setFilesByLocation(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files by location');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    filesByLocation,
    loading,
    error,
    fetchFilesByLocation,
  };
}
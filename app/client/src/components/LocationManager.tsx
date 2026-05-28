import React, { useState, useEffect } from 'react';
import { useLocations, useFileLocations, useLocationQueries } from '../hooks/useLocations';

interface LocationManagerProps {
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  defaultShowAddLocation?: boolean;
}

const LocationManager: React.FC<LocationManagerProps> = ({ activeFilePath, onFileSelect, defaultShowAddLocation }) => {
  const { locations, loading: locationsLoading, createLocation: createLocationAction, updateLocation: updateLocationAction, deleteLocation: deleteLocationAction, getByColor } = useLocations();
  const { fileLocations, availableLocations, addLocations, removeLocation, getLocationColor } = useFileLocations(activeFilePath);
  const { filesByLocation, fetchFilesByLocation, loading: queryLoading } = useLocationQueries();

  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationColor, setNewLocationColor] = useState('#10b981');
  const [showAddLocation, setShowAddLocation] = useState(!!defaultShowAddLocation);

  useEffect(() => {
    if (defaultShowAddLocation) {
      setShowAddLocation(true);
    }
  }, [defaultShowAddLocation]);

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleFilterLocation = async (locationName: string) => {
    if (selectedLocationFilter === locationName) {
      setSelectedLocationFilter(null);
      return;
    }
    setSelectedLocationFilter(locationName);
    await fetchFilesByLocation(locationName);
  };

  const handleAddLocationToFile = async (locationName: string) => {
    if (activeFilePath) {
      await addLocations([locationName]);
    }
  };

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return;
    try {
      await createLocationAction(newLocationName.trim(), newLocationColor, '');
      setNewLocationName('');
      setNewLocationColor('#10b981');
      setShowAddLocation(false);
    } catch (err) {
      // error handled in hook
    }
  };

  const handleStartEdit = (location: { id: string; name: string; color: string }) => {
    setEditingLocationId(location.id);
    setEditName(location.name);
    setEditColor(location.color);
  };

  const handleSaveEdit = async () => {
    if (!editingLocationId || !editName.trim()) return;
    try {
      await updateLocationAction(editingLocationId, { name: editName.trim(), color: editColor });
      setEditingLocationId(null);
    } catch (err) {
      // error handled in hook
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (confirm('Delete this location? It will be removed from all files.')) {
      await deleteLocationAction(id);
    }
  };

  return (
    <div className="tag-manager">
      <div className="tag-manager-header">
        <h3>Locations</h3>
        <button
          className="tag-add-btn"
          onClick={() => setShowAddLocation(!showAddLocation)}
          title="Add Location"
        >
          +
        </button>
      </div>

      {/* Create new location form */}
      {showAddLocation && (
        <div className="tag-create-form">
          <input
            type="text"
            placeholder="Location name"
            value={newLocationName}
            onChange={e => setNewLocationName(e.target.value)}
            className="tag-input"
            onKeyDown={e => e.key === 'Enter' && handleCreateLocation()}
          />
          <input
            type="color"
            value={newLocationColor}
            onChange={e => setNewLocationColor(e.target.value)}
            className="tag-color-picker"
            title="Location color"
          />
          <button onClick={handleCreateLocation} className="tag-create-confirm" disabled={!newLocationName.trim()}>
            Add
          </button>
        </div>
      )}

      {/* Active file locations */}
      {activeFilePath && (
        <div className="tag-section">
          <h4>Active Document</h4>
          <div className="tag-list">
            {fileLocations.map(locationName => (
              <span
                key={locationName}
                className="tag-badge tag-badge-active"
                style={{ backgroundColor: getLocationColor(locationName) + '33', borderColor: getLocationColor(locationName), color: getLocationColor(locationName) }}
                title={`Click to remove "${locationName}"`}
                onClick={() => removeLocation(locationName)}
              >
                {locationName}
                <span className="tag-remove">&times;</span>
              </span>
            ))}
          </div>
          {availableLocations.length > 0 && (
            <>
              <h4 style={{ marginTop: '8px' }}>Add Location</h4>
              <div className="tag-list tag-list-scroll">
                {availableLocations.map(location => (
                  <span
                    key={location.name}
                    className="tag-badge tag-badge-add"
                    style={{ backgroundColor: location.color + '22', borderColor: location.color }}
                    title={`Click to add "${location.name}"`}
                    onClick={() => handleAddLocationToFile(location.name)}
                  >
                    <span className="tag-dot" style={{ backgroundColor: location.color }}></span>
                    {location.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* All locations with file counts */}
      <div className="tag-section">
        <h4>All Locations</h4>
        {locationsLoading ? (
          <div className="tag-loading">Loading...</div>
        ) : (
          <div className="tag-list tag-list-scroll">
            {locations.map(location => (
              <div key={location.id} className="tag-row">
                {editingLocationId === location.id ? (
                  <div className="tag-edit-form">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="tag-edit-input"
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      className="tag-color-picker"
                    />
                    <button onClick={handleSaveEdit} className="tag-edit-save">✓</button>
                    <button onClick={() => setEditingLocationId(null)} className="tag-edit-cancel">✗</button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`tag-filter-btn ${selectedLocationFilter === location.name ? 'active' : ''}`}
                      style={{ color: location.color }}
                      onClick={() => handleFilterLocation(location.name)}
                      title={`Show files at "${location.name}"`}
                    >
                      <span className="tag-dot" style={{ backgroundColor: location.color }}></span>
                      {location.name}
                    </button>
                    <div className="tag-actions">
                      <button onClick={() => handleStartEdit(location)} title="Edit" className="tag-action-btn">✎</button>
                      <button onClick={() => handleDeleteLocation(location.id)} title="Delete" className="tag-action-btn tag-action-delete">🗑</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Files filtered by location */}
      {selectedLocationFilter && (
        <div className="tag-section">
          <h4>
            Files: {selectedLocationFilter} ({filesByLocation.length})
            <button className="tag-clear-filter" onClick={() => setSelectedLocationFilter(null)}>✕</button>
          </h4>
          {queryLoading ? (
            <div className="tag-loading">Loading...</div>
          ) : (
            <div className="tag-file-list">
              {filesByLocation.map(file => (
                <button
                  key={file.path}
                  className="tag-file-item"
                  onClick={() => onFileSelect(file.path)}
                  title={file.path}
                >
                  {file.name}
                </button>
              ))}
              {filesByLocation.length === 0 && (
                <div className="tag-empty">No files at this location</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationManager;
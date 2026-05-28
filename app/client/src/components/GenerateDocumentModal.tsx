import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { generateDocument, DocumentType, createFile } from '../services/api';

interface GenerateDocumentModalProps {
  onClose: () => void;
  onFileCreated: (path: string) => void;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string; icon: string; folder: string }[] = [
  { value: 'character', label: 'Character Sheet', icon: '👤', folder: 'PlayerCharacters' },
  { value: 'location', label: 'Location Description', icon: '🗺️', folder: 'Locations' },
  { value: 'quest', label: 'Quest Outline', icon: '⚔️', folder: 'Quests' },
  { value: 'timeline', label: 'Timeline Entry', icon: '📅', folder: 'Timeline' },
  { value: 'freeform', label: 'Freeform', icon: '📝', folder: 'Documents' },
];

export function GenerateDocumentModal({ onClose, onFileCreated }: GenerateDocumentModalProps) {
  const [selectedType, setSelectedType] = useState<DocumentType>('character');
  const [prompt, setPrompt] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt describing what to generate.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const typeInfo = DOCUMENT_TYPES.find((t) => t.value === selectedType);
      const name = fileName.trim() || prompt.trim().slice(0, 40);
      const safeName = name.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
      const folder = typeInfo?.folder || 'Documents';
      const fullPath = `${folder}/${safeName}.html`;

      const result = await generateDocument(prompt, selectedType);

      await createFile(fullPath, result.html);
      onFileCreated(fullPath);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Sparkles size={20} /> Generate Document with AI</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="generate-doc-form">
          <div className="form-group">
            <label>Document Type:</label>
            <div className="doc-type-grid">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={`doc-type-btn ${selectedType === type.value ? 'active' : ''}`}
                  onClick={() => setSelectedType(type.value)}
                >
                  <span className="doc-type-icon">{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>
              Prompt:
              <span className="label-hint"> Describe what you want to generate</span>
            </label>
            <textarea
              className="prompt-textarea"
              placeholder="An ancient dragon who secretly rules a merchant guild in human form..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
            />
          </div>

          <div className="form-group">
            <label>
              File Name:
              <span className="label-hint"> Optional, auto-generated from prompt if left blank</span>
            </label>
            <input
              type="text"
              className="file-name-input"
              placeholder="Auto-generated from prompt"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              className="btn-primary btn-generate"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
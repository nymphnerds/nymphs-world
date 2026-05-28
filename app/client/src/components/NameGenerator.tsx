import { useState, useCallback } from 'react';
import { sendChat, ChatMessage } from '../services/api';
import { Sparkles, X, Loader2, Copy } from 'lucide-react';

const CULTURES = [
  'Elvish',
  'Dwarvish',
  'Nordic / Viking',
  'Roman / Latin',
  'Japanese',
  'Arabic / Middle Eastern',
  'Draconic',
  'Fey / Whimsical',
  'Dark / Gothic',
];

type NameType = 'character' | 'place' | 'item' | 'faction';
type NameGender = 'any' | 'male' | 'female' | 'neutral';

interface NameGeneratorProps {
  onClose: () => void;
  onInsertAtCursor: (name: string) => void;
}

export function NameGenerator({ onClose, onInsertAtCursor }: NameGeneratorProps) {
  const [culture, setCulture] = useState(CULTURES[0]);
  const [customCulture, setCustomCulture] = useState('');
  const [isCustomCulture, setIsCustomCulture] = useState(false);
  const [nameType, setNameType] = useState<NameType>('character');
  const [gender, setGender] = useState<NameGender>('any');
  const [count, setCount] = useState(5);
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    const activeCulture = isCustomCulture ? customCulture : culture;
    if (!activeCulture) {
      setError('Please enter a culture');
      return;
    }

    setLoading(true);
    setError('');
    setNames([]);

    try {
      const systemPrompt = `You are a name generator for a world-building tool. Generate ${count} unique ${activeCulture} ${nameType} names (${gender}).
Each name should include a first name and optionally a surname or epithet.
Output as a JSON array of strings. No explanations, no commentary.
Example: ["Aelindriel Moonshadow", "Thalanil Starweaver"]`;

      const response = await sendChat(
        `Generate ${count} ${activeCulture} ${nameType} names${gender !== 'any' ? ` (${gender})` : ''}.`,
        [] as ChatMessage[],
        '',
        systemPrompt,
        { webSearch: false, allowRead: false, allowWrite: false, allowDelete: false, allowRename: false, allowSearch: false, allowFiles: false, allowGraph: false, allowTags: false, allowLocations: false, allowImageGen: false, allowReminders: false, maxSearchResults: 0 }
      );

      // Parse the response content as JSON
      let content = response.content || '';

      // Extract JSON array from response if wrapped in markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      }

      // Try to find a JSON array in the content
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        content = arrayMatch[0];
      }

      const parsed = JSON.parse(content) as string[];

      if (Array.isArray(parsed) && parsed.length > 0) {
        setNames(parsed);
      } else {
        setError('Invalid response format. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate names');
    } finally {
      setLoading(false);
    }
  }, [culture, customCulture, isCustomCulture, nameType, gender, count]);

  const handleCopy = useCallback((name: string, index: number) => {
    navigator.clipboard.writeText(name);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  }, []);

  const handleInsert = useCallback(() => {
    if (selectedName) {
      onInsertAtCursor(selectedName);
      onClose();
    }
  }, [selectedName, onInsertAtCursor, onClose]);

  const nameTypeOptions: { value: NameType; label: string }[] = [
    { value: 'character', label: 'Character' },
    { value: 'place', label: 'Place' },
    { value: 'item', label: 'Item' },
    { value: 'faction', label: 'Faction' },
  ];

  const genderOptions: { value: NameGender; label: string }[] = [
    { value: 'any', label: 'Any' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'neutral', label: 'Neutral' },
  ];

  return (
    <div className="name-generator">
      {/* Header */}
      <div className="name-generator-header">
        <h3>Name Generator</h3>
        <button className="name-generator-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Settings */}
      <div className="name-generator-body">
        {/* Culture */}
        <div className="name-generator-field">
          <label>Culture</label>
          {!isCustomCulture ? (
            <select
              value={isCustomCulture ? '__custom__' : culture}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomCulture(true);
                } else {
                  setIsCustomCulture(false);
                  setCulture(e.target.value);
                }
              }}
              className="name-generator-select"
            >
              {CULTURES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
          ) : (
            <input
              type="text"
              value={customCulture}
              onChange={(e) => setCustomCulture(e.target.value)}
              placeholder="Enter a culture style..."
              className="name-generator-input"
            />
          )}
        </div>

        {/* Type */}
        <div className="name-generator-field">
          <label>Type</label>
          <div className="name-generator-radio-group">
            {nameTypeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`name-generator-radio ${nameType === opt.value ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="nameType"
                  value={opt.value}
                  checked={nameType === opt.value}
                  onChange={() => setNameType(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Gender */}
        <div className="name-generator-field">
          <label>Gender</label>
          <div className="name-generator-radio-group">
            {genderOptions.map((opt) => (
              <label
                key={opt.value}
                className={`name-generator-radio ${gender === opt.value ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={opt.value}
                  checked={gender === opt.value}
                  onChange={() => setGender(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="name-generator-field">
          <label>Count: {count}</label>
          <input
            type="range"
            min="1"
            max="20"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="name-generator-range"
          />
        </div>

        {/* Generate Button */}
        <button
          className="name-generator-generate-btn"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate
            </>
          )}
        </button>

        {/* Error */}
        {error && <div className="name-generator-error">{error}</div>}

        {/* Generated Names */}
        {names.length > 0 && (
          <div className="name-generator-results">
            <div className="name-generator-results-header">
              <span>Generated Names</span>
            </div>
            <div className="name-generator-list">
              {names.map((name, idx) => (
                <div
                  key={idx}
                  className={`name-generator-name ${selectedName === name ? 'selected' : ''}`}
                  onClick={() => setSelectedName(name)}
                >
                  <span className="name-generator-name-text">{name}</span>
                  <button
                    className="name-generator-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(name, idx);
                    }}
                    title="Copy to clipboard"
                  >
                    <Copy size={12} />
                    {copiedIndex === idx && <span className="name-generator-copied">Copied!</span>}
                  </button>
                </div>
              ))}
            </div>

            {/* Insert Button */}
            {selectedName && (
              <button
                className="name-generator-insert-btn"
                onClick={handleInsert}
              >
                Insert at Cursor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
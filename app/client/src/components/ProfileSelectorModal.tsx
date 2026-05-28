import React, { useState } from 'react';
import { X, Gamepad2, Briefcase } from 'lucide-react';
import { getProfile, setProfile } from '../services/api';

interface ProfileSelectorModalProps {
  onClose: () => void;
  onSelect: (profile: string) => void;
}

const profileIcons: Record<string, React.ReactNode> = {
  game: <Gamepad2 size={48} className="text-[#a78bfa]" />,
  work: <Briefcase size={48} className="text-[#60a5fa]" />,
};

const profileDescriptions: Record<string, string> = {
  game: 'Story writing and world-building with folders for PlayerCharacters, NPCs, Quests, Locations, and Items',
  work: 'Business management with folders for Customers, Jobs, Bookings, and Quotes',
};

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({ onClose, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (profileKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await setProfile(profileKey);
      localStorage.setItem('wbu_profile', profileKey);
      onSelect(profileKey);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-[#2a2a3a] p-8 max-w-lg w-full mx-4"
        style={{ backgroundColor: '#1a1a2e' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#e0e0e0' }}>
            Choose Your Workspace
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#2a2a3a] transition-colors"
            style={{ color: '#888' }}
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-6" style={{ color: '#888' }}>
          Select how you want to use WORBI. You can switch or merge profiles later in Settings.
        </p>

        <div className="space-y-4">
          {/* Game Profile */}
          <button
            onClick={() => handleSelect('game')}
            disabled={loading}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-[#2a2a3a] hover:border-[#a78bfa] transition-all group text-left"
            style={{ backgroundColor: '#12121e' }}
          >
            <div className="flex-shrink-0">{profileIcons.game}</div>
            <div>
              <h3 className="text-lg font-semibold group-hover:text-[#a78bfa] transition-colors" style={{ color: '#e0e0e0' }}>
                Game
              </h3>
              <p className="text-sm mt-1" style={{ color: '#888' }}>
                {profileDescriptions.game}
              </p>
            </div>
          </button>

          {/* Work Profile */}
          <button
            onClick={() => handleSelect('work')}
            disabled={loading}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-[#2a2a3a] hover:border-[#60a5fa] transition-all group text-left"
            style={{ backgroundColor: '#12121e' }}
          >
            <div className="flex-shrink-0">{profileIcons.work}</div>
            <div>
              <h3 className="text-lg font-semibold group-hover:text-[#60a5fa] transition-colors" style={{ color: '#e0e0e0' }}>
                Work
              </h3>
              <p className="text-sm mt-1" style={{ color: '#888' }}>
                {profileDescriptions.work}
              </p>
            </div>
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm" style={{ color: '#f87171' }}>
            {error}
          </p>
        )}

        <p className="mt-6 text-xs text-center" style={{ color: '#555' }}>
          Choosing a profile creates the default folders. Switching later merges folders without deleting anything.
        </p>
      </div>
    </div>
  );
};

export default ProfileSelectorModal;

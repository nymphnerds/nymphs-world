import React from 'react';
import { Sparkles, Clock, Image as ImageIcon, BookOpen, GitGraph, MapPin, Bell, Tags, ListTree, MessageSquare } from 'lucide-react';

type ActivityType = 'explorer' | 'search' | 'starred' | 'tags' | 'locations' | 'timeline' | 'dialogue' | 'graph' | 'images' | 'outline' | 'reminders';
type HideableIcon = ActivityType | 'ai';

interface ActivityBarProps {
  activeActivity: ActivityType;
  onSwitch: (activity: ActivityType) => void;
  onSettings?: () => void;
  onToggleAI?: () => void;
  showAISidebar?: boolean;
  aiOffline?: boolean;
  leftPanelHidden?: boolean;
  onTogglePanel?: () => void;
  hiddenIcons?: Set<HideableIcon>;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeActivity, onSwitch, onSettings, onToggleAI, showAISidebar = true, aiOffline, hiddenIcons }) => {
  return (
    <div className="activity-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', height: '100%', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          className={`activity-icon ${activeActivity === 'explorer' ? 'active' : ''}`}
          onClick={() => onSwitch('explorer')}
          title="Explorer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button
          className={`activity-icon ${activeActivity === 'search' ? 'active' : ''}`}
          onClick={() => onSwitch('search')}
          title="Search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
        </button>
        <button
          className={`activity-icon ${activeActivity === 'starred' ? 'active' : ''}`}
          onClick={() => onSwitch('starred')}
          title="Starred Files"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        {!hiddenIcons?.has('tags') && (
          <button
            className={`activity-icon ${activeActivity === 'tags' ? 'active' : ''}`}
            onClick={() => onSwitch('tags')}
            title="Tags"
          >
            <Tags size={20} />
          </button>
        )}
        {!hiddenIcons?.has('locations') && (
          <button
            className={`activity-icon ${activeActivity === 'locations' ? 'active' : ''}`}
            onClick={() => onSwitch('locations')}
            title="Locations"
          >
            <MapPin size={20} />
          </button>
        )}
        {!hiddenIcons?.has('timeline') && (
          <button
            className={`activity-icon ${activeActivity === 'timeline' ? 'active' : ''}`}
            onClick={() => onSwitch('timeline')}
            title="Timeline"
          >
            <Clock size={20} />
          </button>
        )}
        {!hiddenIcons?.has('dialogue') && (
          <button
            className={`activity-icon ${activeActivity === 'dialogue' ? 'active' : ''}`}
            onClick={() => onSwitch('dialogue')}
            title="Dialogue"
          >
            <MessageSquare size={20} />
          </button>
        )}
        {!hiddenIcons?.has('outline') && (
          <button
            className={`activity-icon ${activeActivity === 'outline' ? 'active' : ''}`}
            onClick={() => onSwitch('outline')}
            title="Outline"
          >
            <ListTree size={20} />
          </button>
        )}
        {!hiddenIcons?.has('graph') && (
          <button
            className={`activity-icon ${activeActivity === 'graph' ? 'active' : ''} ${aiOffline ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={aiOffline ? undefined : () => onSwitch('graph')}
            title={aiOffline ? "AI server is offline" : "Relationship Graph"}
          >
            <GitGraph size={20} />
          </button>
        )}
        {!hiddenIcons?.has('images') && (
          <button
            className={`activity-icon ${activeActivity === 'images' ? 'active' : ''} ${aiOffline ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={aiOffline ? undefined : () => onSwitch('images')}
            title={aiOffline ? "AI server is offline" : "Image Generator"}
          >
            <ImageIcon size={20} />
          </button>
        )}
        {!hiddenIcons?.has('reminders') && (
          <button
            className={`activity-icon ${activeActivity === 'reminders' ? 'active' : ''}`}
            onClick={() => onSwitch('reminders')}
            title="Reminders"
          >
            <Bell size={20} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {onToggleAI && !hiddenIcons?.has('ai') && (
          <button
            className={`activity-icon ${showAISidebar ? 'active' : ''} ${aiOffline ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={aiOffline ? undefined : onToggleAI}
            title={aiOffline ? "AI server is offline" : showAISidebar ? "Hide AI Sidebar" : "Show AI Sidebar"}
          >
            <Sparkles size={20} />
          </button>
        )}

        {onSettings && (
          <button
            className="activity-icon"
            onClick={onSettings}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ActivityBar;
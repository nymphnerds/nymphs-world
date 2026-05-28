import { useState, useCallback, useEffect } from 'react';

type ActivityType = 'explorer' | 'search' | 'starred' | 'tags' | 'timeline' | 'dialogue' | 'locations' | 'graph' | 'images' | 'outline' | 'reminders';

export function useActivityRouter(
  toggleLeftPanel: () => void,
  setLeftPanelHidden: (hidden: boolean | ((prev: boolean) => boolean)) => void,
) {
  const [activeActivity, setActiveActivity] = useState<ActivityType>('explorer');
  const [tagsShowAddTag, setTagsShowAddTag] = useState(false);

  const handleActivitySwitch = useCallback((activity: ActivityType) => {
    if (activity === activeActivity) {
      toggleLeftPanel();
    } else {
      setActiveActivity(activity);
      setLeftPanelHidden(false);
      localStorage.removeItem('wbu-left-panel-hidden');
    }
  }, [activeActivity, toggleLeftPanel, setLeftPanelHidden]);

  const handleOpenTagSidebar = useCallback(() => {
    setActiveActivity('tags');
    setTagsShowAddTag(true);
  }, []);

  // Reset tagsShowAddTag when switching away from tags activity
  useEffect(() => {
    if (activeActivity !== 'tags') {
      setTagsShowAddTag(false);
    }
  }, [activeActivity]);

  return {
    activeActivity,
    setActiveActivity,
    tagsShowAddTag,
    handleActivitySwitch,
    handleOpenTagSidebar,
  };
}

export type { ActivityType };
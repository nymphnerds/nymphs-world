import { useTags, useFileTags } from '../hooks/useTags';
import { Plus } from 'lucide-react';

interface TagInsertControlProps {
  editor: any;
  infoEditor: any;
  currentPath: string | null;
  onOpenTagSidebar?: () => void;
}

export function TagInsertControl({ editor, infoEditor, currentPath, onOpenTagSidebar }: TagInsertControlProps) {
  const { tags, loading } = useTags();
  const { addTags } = useFileTags(currentPath);

  const handleSelectTag = async (tagName: string) => {
    if (!tagName || !currentPath) return;

    // Directly add the tag to the file via the API
    await addTags([tagName]);

    // Notify other components (InformationPanel) to refresh their tag lists
    window.dispatchEvent(new CustomEvent('wbu-tags-changed', { detail: { filePath: currentPath } }));
  };

  if (loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5">
      <div className="w-px h-4 bg-border mx-0.5" />
      <select
        defaultValue=""
        onChange={(e) => handleSelectTag(e.target.value)}
        className="h-5 px-1 text-[10px] rounded bg-background border border-border text-muted-foreground outline-none cursor-pointer"
        title="Select a tag to apply to document"
      >
        <option value="" disabled>Tag...</option>
        {tags.map(tag => (
          <option key={tag.id} value={tag.name}>
            {tag.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => onOpenTagSidebar?.()}
        className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
        title="Create new tag"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
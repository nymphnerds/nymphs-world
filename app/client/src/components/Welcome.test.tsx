import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Welcome } from './Welcome';

// ---- Mock lucide-react ----
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const names = ['FileText', 'Star', 'Plus', 'Clock', 'X', 'Sparkles', 'LayoutTemplate', 'HelpCircle'];
  for (const n of names) {
    icons[n] = vi.fn((props: any) => <svg data-testid={n} {...props} />);
  }
  return icons;
});

describe('Welcome', () => {
  const minimalProps = {
    recentFiles: [
      { path: 'Lore/test.html', name: 'test', lastOpened: Date.now() - 3600000 },
    ],
    starredFiles: [
      { path: 'PlayerCharacters/hero.html', name: 'hero' },
    ],
    onFileClick: vi.fn(),
    onRemoveRecent: vi.fn(),
    onToggleStar: vi.fn(),
    onNewFile: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<Welcome {...minimalProps} />);
    expect(screen.getByText('WORBI')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<Welcome {...minimalProps} />);
    expect(screen.getByText(/WorldBuilder UI/i)).toBeInTheDocument();
  });

  it('renders New File button', () => {
    render(<Welcome {...minimalProps} />);
    expect(screen.getByText('New File')).toBeInTheDocument();
  });

  it('renders recent files section', () => {
    render(<Welcome {...minimalProps} />);
    expect(screen.getByText(/Recent Files/i)).toBeInTheDocument();
  });

  it('renders starred files section', () => {
    render(<Welcome {...minimalProps} />);
    expect(screen.getByText(/Favorites/i)).toBeInTheDocument();
  });

  it('renders empty state when no files', () => {
    render(<Welcome {...minimalProps} recentFiles={[]} starredFiles={[]} />);
    expect(screen.getByText(/No recent files/i)).toBeInTheDocument();
  });

  it('renders New from Template button when onCreateFromTemplate provided', () => {
    render(<Welcome {...minimalProps} onCreateFromTemplate={vi.fn()} />);
    expect(screen.getByText('New from Template')).toBeInTheDocument();
  });
});
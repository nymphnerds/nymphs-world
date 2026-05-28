import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabBar } from './TabBar';

// ---- Mock lucide-react ----
vi.mock('lucide-react', () => {
  const MockIcon: React.FC = (props: any) => <svg data-testid="mock-icon" {...props} />;
  const mockFn = vi.fn(() => MockIcon);
  return {
    X: mockFn,
  };
});

// Mock scrollIntoView which doesn't exist in jsdom
HTMLElement.prototype.scrollIntoView = vi.fn();

describe('TabBar', () => {
  const minimalProps = {
    tabs: {},
    activeTabId: null,
    onSwitch: vi.fn(),
    onClose: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseAll: vi.fn(),
  };

  it('returns null when no tabs', () => {
    const { container } = render(<TabBar {...minimalProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders tab when provided', () => {
    const tabs = {
      'file1.html': {
        id: 'file1.html',
        path: 'Lore/file1.html',
        name: 'file1',
        lastModified: Date.now(),
        content: '',
        originalContent: '',
        dirty: false,
      },
    };
    render(<TabBar {...minimalProps} tabs={tabs} activeTabId='file1.html' />);
    expect(screen.getByText('file1')).toBeInTheDocument();
  });

  it('renders close button on tab', () => {
    const tabs = {
      'file1.html': {
        id: 'file1.html',
        path: 'Lore/file1.html',
        name: 'file1',
        lastModified: Date.now(),
        content: '',
        originalContent: '',
        dirty: false,
      },
    };
    render(<TabBar {...minimalProps} tabs={tabs} activeTabId='file1.html' />);
    expect(screen.getByTitle('Close tab')).toBeInTheDocument();
  });
});
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityBar from './ActivityBar';

// ---- Mock lucide-react ----
vi.mock('lucide-react', () => {
  const MockIcon: React.FC = (props: any) => <svg data-testid="mock-icon" {...props} />;
  const mockFn = vi.fn(() => MockIcon);
  return {
    Sparkles: mockFn,
    Clock: mockFn,
    Image: mockFn,
    BookOpen: mockFn,
    GitGraph: mockFn,
    MapPin: mockFn,
    Bell: mockFn,
    Tags: mockFn,
    ListTree: mockFn,
  };
});

describe('ActivityBar', () => {
  const minimalProps = {
    activeActivity: 'explorer' as const,
    onSwitch: vi.fn(),
    onSettings: vi.fn(),
    onToggleAI: vi.fn(),
    showAISidebar: false,
  };

  it('renders without crashing', () => {
    render(<ActivityBar {...minimalProps} />);
    expect(screen.getByTitle('Explorer')).toBeInTheDocument();
  });

  it('renders Search button', () => {
    render(<ActivityBar {...minimalProps} />);
    expect(screen.getByTitle('Search')).toBeInTheDocument();
  });

  it('renders Starred Files button', () => {
    render(<ActivityBar {...minimalProps} />);
    expect(screen.getByTitle('Starred Files')).toBeInTheDocument();
  });

  it('renders Tags button', () => {
    render(<ActivityBar {...minimalProps} />);
    expect(screen.getByTitle('Tags')).toBeInTheDocument();
  });

  it('renders Settings button when onSettings provided', () => {
    render(<ActivityBar {...minimalProps} onSettings={vi.fn()} />);
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('calls onSwitch when Explorer button clicked', () => {
    const onSwitch = vi.fn();
    render(<ActivityBar {...minimalProps} onSwitch={onSwitch} />);
    screen.getByTitle('Explorer').click();
    expect(onSwitch).toHaveBeenCalledWith('explorer');
  });
});
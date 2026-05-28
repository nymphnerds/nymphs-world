import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatPanel } from './ChatPanel';

// ---- Mock dependencies ----
vi.mock('lucide-react', () => {
  const MockIcon: React.FC = (props: any) => <svg data-testid="mock-icon" {...props} />;
  const mockFn = vi.fn(() => MockIcon);
  return {
    Send: mockFn,
    Trash2: mockFn,
    Loader2: mockFn,
    Bot: mockFn,
    User: mockFn,
    Zap: mockFn,
    Sparkles: mockFn,
    WifiOff: mockFn,
    Scissors: mockFn,
    X: mockFn,
  };
});

vi.mock('./NameGenerator', () => ({
  NameGenerator: vi.fn(() => <div data-testid="name-generator">NameGenerator Mock</div>),
}));

describe('ChatPanel', () => {
  const minimalProps = {
    history: [],
    loading: false,
    onSend: vi.fn().mockResolvedValue(null),
    onClear: vi.fn(),
    documentContent: '',
    width: 300,
    toolsEnabled: false,
    onToggleTools: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<ChatPanel {...minimalProps} />);
    expect(screen.getByText('AI Chat')).toBeInTheDocument();
  });

  it('renders the Chat tab button', () => {
    render(<ChatPanel {...minimalProps} />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('renders the Names tab button', () => {
    render(<ChatPanel {...minimalProps} />);
    expect(screen.getByText('Names')).toBeInTheDocument();
  });

  it('shows empty state message when no history', () => {
    render(<ChatPanel {...minimalProps} />);
    expect(screen.getByText(/AI Assistant/i)).toBeInTheDocument();
  });

  it('renders textarea input', () => {
    render(<ChatPanel {...minimalProps} />);
    expect(screen.getByPlaceholderText(/Ask AI/i)).toBeInTheDocument();
  });

  it('renders clear chat button', () => {
    render(<ChatPanel {...minimalProps} />);
    expect(screen.getByTitle('Clear chat')).toBeInTheDocument();
  });
});
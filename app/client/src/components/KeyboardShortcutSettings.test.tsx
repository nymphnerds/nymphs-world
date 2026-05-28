import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcutSettings } from './KeyboardShortcutSettings';

// ---- Mock dependencies ----
vi.mock('lucide-react', () => {
  const MockIcon: React.FC = (props: any) => <svg data-testid="mock-icon" {...props} />;
  const mockFn = vi.fn(() => MockIcon);
  return {
    Keyboard: mockFn,
    RotateCcw: mockFn,
    AlertTriangle: mockFn,
    Check: mockFn,
  };
});

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn().mockReturnValue({
    bindings: [],
    setBinding: vi.fn(),
    resetAll: vi.fn(),
    definitions: [],
    conflicts: [],
    formatCombo: vi.fn().mockReturnValue('Ctrl+S'),
  }),
}));

describe('KeyboardShortcutSettings', () => {
  it('renders without crashing', () => {
    render(<KeyboardShortcutSettings />);
    expect(screen.getByText(/Keyboard Shortcuts/i)).toBeInTheDocument();
  });
});
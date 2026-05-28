import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

// ---- Mock lucide-react ----
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const names = ['FilePlus', 'LogOut', 'User', 'FileInput', 'Sparkles', 'ChevronDown', 'HelpCircle', 'Gamepad2'];
  for (const n of names) {
    icons[n] = vi.fn((props: any) => <svg data-testid={n} {...props} />);
  }
  return icons;
});

describe('Header', () => {
  const minimalProps = {
    onNewFile: vi.fn(),
    onCreateFromTemplate: vi.fn(),
    onImportDOCX: vi.fn(),
    onLogout: vi.fn(),
    username: 'testuser',
    showAISidebar: false,
    onToggleAISidebar: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<Header {...minimalProps} />);
    expect(screen.getByText('WORBI')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<Header {...minimalProps} />);
    expect(screen.getByText(/WorldBuilder UI/i)).toBeInTheDocument();
  });

  it('renders username', () => {
    render(<Header {...minimalProps} username='testuser' />);
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('renders File menu button', () => {
    render(<Header {...minimalProps} />);
    expect(screen.getByText('File')).toBeInTheDocument();
  });

  it('renders Help button', () => {
    render(<Header {...minimalProps} />);
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders AI toggle button', () => {
    render(<Header {...minimalProps} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders Logout button', () => {
    render(<Header {...minimalProps} />);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('renders Game Export button when onGenerateGameFile provided', () => {
    render(<Header {...minimalProps} onGenerateGameFile={vi.fn()} />);
    expect(screen.getByText('Game Export')).toBeInTheDocument();
  });
});
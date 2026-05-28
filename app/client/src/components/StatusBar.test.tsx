import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  const minimalProps = {
    currentPath: 'Lore/test.html',
    wordCount: 42,
    llmConnected: true,
    error: null,
  };

  it('renders without crashing', () => {
    render(<StatusBar {...minimalProps} />);
    expect(screen.getByText(/42 words/i)).toBeInTheDocument();
  });

  it('renders LLM Connected status when connected', () => {
    render(<StatusBar {...minimalProps} llmConnected={true} />);
    expect(screen.getByText('LLM Connected')).toBeInTheDocument();
  });

  it('renders LLM Offline status when offline', () => {
    render(<StatusBar {...minimalProps} llmConnected={false} aiOffline={true} />);
    expect(screen.getByText('LLM Offline')).toBeInTheDocument();
  });

  it('renders Checking LLM when status is unknown', () => {
    render(<StatusBar {...minimalProps} llmConnected={null} />);
    expect(screen.getByText('Checking LLM...')).toBeInTheDocument();
  });

  it('renders current path when provided', () => {
    render(<StatusBar {...minimalProps} currentPath="Lore/test.html" />);
    expect(screen.getByText('Lore/test.html')).toBeInTheDocument();
  });

  it('renders error message when provided', () => {
    render(<StatusBar {...minimalProps} error="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders without current path when null', () => {
    render(<StatusBar {...minimalProps} currentPath={null} />);
    expect(screen.getByText(/42 words/i)).toBeInTheDocument();
  });
});
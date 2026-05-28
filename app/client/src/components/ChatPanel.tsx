import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2, Bot, User, Zap, Sparkles, WifiOff, Scissors, X } from 'lucide-react';
import type { ChatMessage, ToolActivity } from '../services/api';
import { NameGenerator } from './NameGenerator';

interface ChatPanelProps {
  history: ChatMessage[];
  loading: boolean;
  onSend: (message: string, documentContent: string) => Promise<ChatMessage | null>;
  onClear: () => void;
  documentContent: string;
  width: number;
  toolsEnabled: boolean;
  onToggleTools: () => void;
  aiOffline?: boolean;
  messagesTrimmed?: boolean;
  onDismissTrimNotification?: () => void;
}

export function ChatPanel({
  history,
  loading,
  onSend,
  onClear,
  documentContent,
  width,
  toolsEnabled,
  onToggleTools,
  aiOffline,
  messagesTrimmed,
  onDismissTrimNotification,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'names'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    await onSend(input.trim(), documentContent);
    setInput('');
  }, [input, loading, onSend, documentContent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const renderMessage = useCallback((msg: ChatMessage, i: number) => {
    const isToolMessage = msg.role === 'assistant' && (
      msg.content.startsWith('[🔍') ||
      msg.content.startsWith('[📄') ||
      msg.content.startsWith('[📁') ||
      msg.content.startsWith('[📝') ||
      msg.content.startsWith('[✏️') ||
      msg.content.startsWith('[🗑️') ||
      msg.content.startsWith('[🔄') ||
      msg.content.startsWith('[⚙️')
    );

    if (isToolMessage) {
      const statusMatch = msg.content.match(/\[(.+?)\]\s+(.*)/);
      if (statusMatch) {
        const isError = statusMatch[2].startsWith('❌');
        return (
          <div key={i} className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
              <Bot size={12} className="text-primary" />
            </div>
            <div className={`rounded-lg px-3 py-1.5 text-xs font-mono border ${
              isError
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
            }`}>
              {msg.content}
            </div>
          </div>
        );
      }
    }

    return (
      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {msg.role === 'assistant' && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
            <Bot size={12} className="text-primary" />
          </div>
        )}
        <div
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            msg.role === 'user'
              ? 'bg-primary/20 text-primary'
              : 'bg-secondary text-foreground'
          }`}
        >
          {msg.content}
        </div>
        {msg.role === 'user' && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center mt-0.5">
            <User size={12} className="text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div
      className="flex flex-col border-l border-border overflow-hidden"
      style={{ width, backgroundColor: 'rgb(var(--right-sidebar))' }}
    >
      {/* Tab Bar */}
      <div className="flex border-b border-border">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'chat'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('chat')}
        >
          <Bot size={12} />
          Chat
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'names'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('names')}
        >
          <Sparkles size={12} />
          Names
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-300 border-b border-border">
            <span className="flex items-center gap-1.5">
              <Bot size={14} className="text-gray-300" />
              AI Chat
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTools}
                className={`p-0.5 rounded hover:bg-accent transition-colors ${
                  toolsEnabled
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={toolsEnabled ? 'Tools enabled: AI can search web and access files' : 'Tools disabled: AI chat only'}
              >
                <Zap size={14} className={toolsEnabled ? 'fill-amber-400/20' : ''} />
              </button>
              <button
                onClick={onClear}
                className="p-0.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-3">
            {/* Trim Notification */}
            {messagesTrimmed && (
              <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-300 flex items-center gap-2">
                <Scissors size={14} className="flex-shrink-0" />
                <span className="flex-1">Oldest messages trimmed to stay within context window limit.</span>
                {onDismissTrimNotification && (
                  <button onClick={onDismissTrimNotification} className="p-0.5 hover:bg-yellow-500/20 rounded">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
            {/* AI Offline Banner */}
            {aiOffline && (
              <div className="mx-3 mt-3 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 flex items-center gap-2">
                <WifiOff size={14} className="flex-shrink-0" />
                <span>AI server is offline. Start your LLM server to enable AI features.</span>
              </div>
            )}
            {history.length === 0 ? (
              <div className="px-4 text-center text-xs text-muted-foreground mt-8">
                <Bot size={32} className="mx-auto mb-3 opacity-30" />
                <p className="mb-1">AI Assistant</p>
                <p className="text-[11px]">Ask for help with writing, worldbuilding, lore, or quest design.</p>
                <p className="text-[11px] mt-2 opacity-60">Your current document content is shared as context.</p>
                {toolsEnabled && (
                  <div className="mt-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                    ⚡ Tools Active: AI can search the web and access workspace files
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 space-y-3">
                {history.map((msg, i) => renderMessage(msg, i))}
                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <Bot size={12} className="text-primary" />
                    </div>
                    <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {toolsEnabled ? '⚡ Thinking & acting...' : 'Thinking...'}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-2">
            <div className="flex gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={aiOffline ? "AI server offline..." : toolsEnabled ? "Ask AI (tools active ⚡)..." : "Ask AI..."}
                rows={2}
                disabled={aiOffline}
                className="flex-1 resize-none rounded-md bg-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || aiOffline}
                className="self-end p-2 rounded-md bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 transition-colors"
                title={aiOffline ? "AI server is offline" : undefined}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Name Generator Tab */
        <NameGenerator onClose={() => setActiveTab('chat')} onInsertAtCursor={() => {}} />
      )}
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Bot,
  User,
} from 'lucide-react';
import { fixai, platform } from '../api/client';
import type { Workspace, Conversation, Message, ToolCall } from '../api/types';

/* ── Chat Page ───────────────────────────────────────────────────── */

export default function Chat() {
  const { workspaceId, conversationId } = useParams<{
    workspaceId: string;
    conversationId?: string;
  }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [activeTools, setActiveTools] = useState<{ name: string; args?: Record<string, unknown> }[]>([]);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load workspace + conversations ──────────────────────────── */

  useEffect(() => {
    if (!workspaceId) return;
    platform.getWorkspace(workspaceId).then(setWorkspace);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspace?.service_ids.fixai_org_id) return;
    fixai.listConversations(workspace.service_ids.fixai_org_id).then(setConversations);
  }, [workspace]);

  useEffect(() => {
    if (activeConvId) {
      fixai.getConversation(activeConvId).then((detail) => {
        setMessages(detail.messages || []);
      });
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  /* ── Create conversation ───────────────────────────────────────── */

  async function handleNewConversation() {
    if (!workspace?.service_ids.fixai_org_id) return;
    try {
      const conv = await fixai.createConversation(workspace.service_ids.fixai_org_id);
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      navigate(`/workspace/${workspaceId}/chat/${conv.id}`, { replace: true });
    } catch (e: any) {
      alert(e.message);
    }
  }

  /* ── Send message with SSE streaming ───────────────────────────── */

  async function handleSend() {
    if (!input.trim() || !activeConvId || streaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamContent('');
    setActiveTools([]);

    try {
      const response = await fixai.sendMessage(activeConvId, userMsg.content);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              if (event.type === 'token' && event.content) {
                fullContent += event.content;
                setStreamContent(fullContent);
              } else if (event.type === 'tool_start') {
                setActiveTools((prev) => [...prev, { name: event.tool || event.name || 'unknown', args: event.args }]);
              } else if (event.type === 'tool_end') {
                setActiveTools((prev) => prev.slice(0, -1));
              } else if (event.type === 'done') {
                // Final message
                const assistantMsg: Message = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: event.content || fullContent,
                  tool_calls: event.tool_calls,
                  created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamContent('');
              }
            } catch {
              // Not JSON, might be a plain text token
              if (data && data !== '[DONE]') {
                fullContent += data;
                setStreamContent(fullContent);
              }
            }
          }
        }
      }

      // If stream ended without a "done" event, add what we have
      if (fullContent && !messages.find((m) => m.content === fullContent)) {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') return prev;
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
            },
          ];
        });
        setStreamContent('');
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${e.message}`,
          created_at: new Date().toISOString(),
        },
      ]);
      setStreamContent('');
    } finally {
      setStreaming(false);
      setActiveTools([]);
    }
  }

  /* ── Delete conversation ───────────────────────────────────────── */

  async function handleDeleteConv(e: React.MouseEvent, convId: string) {
    e.stopPropagation();
    try {
      await fixai.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
        navigate(`/workspace/${workspaceId}/chat`, { replace: true });
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  /* ── Keyboard shortcuts ────────────────────────────────────────── */

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /* ── Render ────────────────────────────────────────────────────── */

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--cc-text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <div
        className="w-64 border-r flex flex-col shrink-0"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer border"
            style={{ background: 'var(--cc-accent-glow)', borderColor: 'var(--cc-accent)', color: 'var(--cc-accent)' }}
          >
            <Plus size={16} /> New Session
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  navigate(`/workspace/${workspaceId}/chat/${conv.id}`, { replace: true });
                }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm mb-1 group"
                style={{
                  background: activeConvId === conv.id ? 'var(--cc-surface-2)' : 'transparent',
                  color: 'var(--cc-text-secondary)',
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={14} style={{ color: 'var(--cc-text-muted)' }} />
                  <span className="truncate">{conv.title || 'Untitled'}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteConv(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 cursor-pointer border-0 bg-transparent"
                  style={{ color: 'var(--cc-text-muted)' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="flex items-center gap-1.5 text-xs cursor-pointer border-0 bg-transparent"
            style={{ color: 'var(--cc-text-muted)' }}
          >
            <ArrowLeft size={12} /> Back to Dashboard
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--cc-bg)' }}>
        {!activeConvId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center">
            <Bot size={48} style={{ color: 'var(--cc-text-muted)' }} className="mb-4" />
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--cc-text)' }}>
              Start debugging
            </h2>
            <p className="text-sm mb-6 text-center max-w-md" style={{ color: 'var(--cc-text-muted)' }}>
              Create a new session to start an AI-powered investigation into your production services.
              The agent can search code, query metrics, and analyze logs.
            </p>
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-0"
              style={{ background: 'var(--cc-accent)', color: '#fff' }}
            >
              <Plus size={16} /> New Debug Session
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {messages.length === 0 && !streamContent && (
                <div className="text-center py-20" style={{ color: 'var(--cc-text-muted)' }}>
                  <p className="text-sm">Send a message to start debugging.</p>
                  <p className="text-xs mt-2">
                    Try: "Why is the checkout API returning 500 errors?"
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Streaming content */}
              {streamContent && (
                <div className="flex gap-3 mb-4">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                    style={{ background: 'var(--cc-accent-glow)', color: 'var(--cc-accent)' }}
                  >
                    <Bot size={14} />
                  </div>
                  <div
                    className="flex-1 text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--cc-text)' }}
                  >
                    {streamContent}
                    <span className="inline-block w-2 h-4 ml-0.5 animate-pulse" style={{ background: 'var(--cc-accent)' }} />
                  </div>
                </div>
              )}

              {/* Active tool calls */}
              {activeTools.length > 0 && (
                <div className="flex gap-3 mb-4">
                  <div className="w-7 shrink-0" />
                  <div className="space-y-1">
                    {activeTools.map((tool, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                        style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-secondary)' }}
                      >
                        <Loader2 size={12} className="animate-spin" style={{ color: 'var(--cc-accent)' }} />
                        <Wrench size={12} />
                        <span className="font-mono">{tool.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEnd} />
            </div>

            {/* Input */}
            <div className="border-t px-6 py-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div
                className="flex items-end gap-2 border rounded-xl px-4 py-3"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the production issue you want to investigate..."
                  className="flex-1 bg-transparent border-0 outline-none resize-none text-sm leading-relaxed"
                  style={{ color: 'var(--cc-text)', minHeight: '24px', maxHeight: '120px' }}
                  rows={1}
                  disabled={streaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="p-2 rounded-lg cursor-pointer border-0 transition-colors disabled:opacity-30"
                  style={{ background: 'var(--cc-accent)', color: '#fff' }}
                >
                  {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--cc-text-muted)' }}>
                The agent can search code, query dashboards, and analyze logs to help debug issues.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── ChatMessage Component ───────────────────────────────────────── */

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className="flex gap-3 mb-5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
        style={{
          background: isUser ? 'var(--cc-surface-3)' : 'var(--cc-accent-glow)',
          color: isUser ? 'var(--cc-text-secondary)' : 'var(--cc-accent)',
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        {/* Tool calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.tool_calls.map((tc, i) => (
              <ToolCallDisplay key={i} toolCall={tc} />
            ))}
          </div>
        )}
        {/* Message content */}
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: isUser ? 'var(--cc-text)' : 'var(--cc-text)' }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

/* ── ToolCallDisplay ─────────────────────────────────────────────── */

function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border text-xs"
      style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 cursor-pointer border-0 bg-transparent"
        style={{ color: 'var(--cc-text-secondary)' }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={12} style={{ color: 'var(--cc-accent)' }} />
        <span className="font-mono font-medium">{toolCall.name}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          {toolCall.args && (
            <pre
              className="mt-2 p-2 rounded text-xs overflow-auto font-mono"
              style={{ background: 'var(--cc-surface-2)', color: 'var(--cc-text-muted)' }}
            >
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          )}
          {toolCall.result && (
            <pre
              className="mt-2 p-2 rounded text-xs overflow-auto font-mono max-h-40"
              style={{ background: 'var(--cc-surface-2)', color: 'var(--cc-text-muted)' }}
            >
              {toolCall.result.length > 2000
                ? toolCall.result.slice(0, 2000) + '\n... (truncated)'
                : toolCall.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

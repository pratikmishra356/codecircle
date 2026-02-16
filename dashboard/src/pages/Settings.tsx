import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Key,
  Globe,
  Cpu,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { platform } from '../api/client';
import type { AIConfig } from '../api/types';

export default function Settings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [provider, setProvider] = useState<'claude' | 'bedrock'>('bedrock');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showKey, setShowKey] = useState(false);

  // Original config for display
  const [config, setConfig] = useState<AIConfig | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const cfg = await platform.getAIConfig();
      setConfig(cfg);
      setProvider(cfg.provider as 'claude' | 'bedrock');
      setBaseUrl(cfg.base_url || '');
      setModelId(cfg.model_id || '');
      setMaxTokens(cfg.max_tokens);
      // Don't populate api_key — it's never returned in full
      setApiKey('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const update: Record<string, any> = {
        provider,
        base_url: baseUrl || null,
        model_id: modelId || null,
        max_tokens: maxTokens,
      };
      // Only send api_key if user entered a new value
      if (apiKey.trim()) {
        update.api_key = apiKey.trim();
      }
      const cfg = await platform.saveAIConfig(update);
      setConfig(cfg);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--cc-text-muted)' }}>
        <Loader2 size={20} className="animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 pb-20">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm mb-6 cursor-pointer border-0 bg-transparent font-medium hover:opacity-80"
        style={{ color: 'var(--cc-text-muted)' }}
      >
        <ArrowLeft size={14} /> Workspaces
      </button>

      <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--cc-text)' }}>
        Global AI (default)
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--cc-text-secondary)' }}>
        Default for new workspaces. Override per workspace on its page.
      </p>

      <div className="cc-card flex items-start gap-3 px-5 py-4 mb-8">
        <Info size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--cc-accent)' }} />
        <div className="text-sm leading-relaxed" style={{ color: 'var(--cc-text-secondary)' }}>
          Saving here pushes to all workspaces that haven’t set their own config. Use <strong>AI settings for this workspace</strong> on a workspace page for per-team keys.
        </div>
      </div>

      <div className="cc-card overflow-hidden">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <label className="cc-label flex items-center gap-2"><Cpu size={14} /> Provider</label>
          <div className="flex gap-3 mt-2">
            {(['bedrock', 'claude'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer border transition-all"
                style={{
                  background: provider === p ? 'var(--cc-accent)' : 'var(--cc-surface-2)',
                  borderColor: provider === p ? 'var(--cc-accent)' : 'var(--cc-border)',
                  color: provider === p ? '#fff' : 'var(--cc-text-secondary)',
                }}
              >
                {p === 'bedrock' ? 'AWS Bedrock Proxy' : 'Direct Claude API'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <label className="flex items-center gap-2 text-sm font-medium mb-1" style={{ color: 'var(--cc-text)' }}>
            <Key size={16} /> API Key / Token
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--cc-text-muted)' }}>
            {config?.api_key_set
              ? `Current key configured (${config.api_key_preview}). Leave blank to keep existing.`
              : 'No API key configured. Enter one below.'}
          </p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.api_key_set ? 'Enter new key to replace existing' : 'Enter API key or Bedrock token'}
              className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm border outline-none font-mono"
              style={{
                background: 'var(--cc-surface-2)',
                borderColor: 'var(--cc-border)',
                color: 'var(--cc-text)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer border-0 bg-transparent"
              style={{ color: 'var(--cc-text-muted)' }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {config?.api_key_set && (
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle2 size={12} style={{ color: 'var(--cc-success)' }} />
              <span className="text-xs" style={{ color: 'var(--cc-success)' }}>Key is configured</span>
            </div>
          )}
        </div>

        {/* Base URL (Bedrock) */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <label className="flex items-center gap-2 text-sm font-medium mb-1" style={{ color: 'var(--cc-text)' }}>
            <Globe size={16} /> {provider === 'bedrock' ? 'Bedrock Proxy URL' : 'API Base URL'}
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--cc-text-muted)' }}>
            {provider === 'bedrock'
              ? 'The Bedrock / LLM proxy URL endpoint'
              : 'Leave blank for default Anthropic API endpoint'}
          </p>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === 'bedrock' ? 'https://llm-proxy.example.com' : 'https://api.anthropic.com'}
            className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none font-mono"
            style={{
              background: 'var(--cc-surface-2)',
              borderColor: 'var(--cc-border)',
              color: 'var(--cc-text)',
            }}
          />
        </div>

        {/* Model ID */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <label className="flex items-center gap-2 text-sm font-medium mb-1" style={{ color: 'var(--cc-text)' }}>
            <Bot size={16} /> Model ID
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--cc-text-muted)' }}>
            The AI model identifier to use for debugging and code analysis
          </p>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="anthropic.claude-sonnet-4-20250514-v1:0"
            className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none font-mono"
            style={{
              background: 'var(--cc-surface-2)',
              borderColor: 'var(--cc-border)',
              color: 'var(--cc-text)',
            }}
          />
        </div>

        {/* Max Tokens */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <label className="flex items-center gap-2 text-sm font-medium mb-1" style={{ color: 'var(--cc-text)' }}>
            Max Tokens
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--cc-text-muted)' }}>
            Maximum number of tokens for AI responses
          </p>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Math.max(1, parseInt(e.target.value) || 4096))}
            className="w-32 px-3 py-2.5 rounded-lg text-sm border outline-none"
            style={{
              background: 'var(--cc-surface-2)',
              borderColor: 'var(--cc-border)',
              color: 'var(--cc-text)',
            }}
          />
        </div>

        {/* Services that use this config */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--cc-text)' }}>
            Services Using This Config
          </label>
          <div className="flex gap-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface-2)' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--cc-text-secondary)' }}>
                FixAI
              </span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface-2)' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--cc-text-secondary)' }}>
                Code Parser
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 flex items-center gap-3 flex-wrap" style={{ background: 'var(--cc-surface-2)' }}>
          <button onClick={handleSave} disabled={saving} className="cc-btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save</>}
          </button>

          {saved && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--cc-success)' }}>
              <CheckCircle2 size={16} /> Saved successfully
            </span>
          )}

          {error && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--cc-error)' }}>
              <AlertCircle size={16} /> {error}
            </span>
          )}

          {config?.updated_at && (
            <span className="ml-auto text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              Last updated: {new Date(config.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

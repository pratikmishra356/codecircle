import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BarChart3,
  ScrollText,
  Code2,
  Rocket,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { platform } from '../api/client';
import type { Workspace, AIConfig, MetricsConfig, LogsConfig, CodeConfig } from '../api/types';

/* ── Step definitions ────────────────────────────────────────────── */

const STEPS = [
  { key: 'ai', label: 'AI Provider', icon: Bot, required: true },
  { key: 'metrics', label: 'Metrics', icon: BarChart3, required: false },
  { key: 'logs', label: 'Logs', icon: ScrollText, required: false },
  { key: 'code', label: 'Code', icon: Code2, required: false },
  { key: 'review', label: 'Launch', icon: Rocket, required: true },
] as const;

/* ── Component ───────────────────────────────────────────────────── */

export default function SetupWizard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [aiForm, setAiForm] = useState<AIConfig>({ llm_provider: 'anthropic', llm_api_key: '', llm_model_id: '' });
  const [metricsProvider, setMetricsProvider] = useState<'datadog' | 'prometheus' | 'grafana'>('datadog');
  const [metricsForm, setMetricsForm] = useState<MetricsConfig>({ provider: 'datadog' });
  const [logsForm, setLogsForm] = useState<LogsConfig>({ provider: 'splunk_cloud', host_url: '' });
  const [codeForm, setCodeForm] = useState<CodeConfig>({ repo_path: '' });
  const [skipMetrics, setSkipMetrics] = useState(false);
  const [skipLogs, setSkipLogs] = useState(false);
  const [skipCode, setSkipCode] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      platform.getWorkspace(workspaceId).then((ws) => {
        setWorkspace(ws);
        // Restore saved state
        if (ws.llm_provider) {
          setAiForm({
            llm_provider: ws.llm_provider as 'anthropic' | 'bedrock',
            llm_api_key: '',
            llm_model_id: ws.llm_model_id || '',
          });
        }
      });
    }
  }, [workspaceId]);

  /* ── Save step data ────────────────────────────────────────────── */

  async function saveStep() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      const key = STEPS[step].key;
      if (key === 'ai') {
        await platform.saveAI(workspaceId, aiForm);
      } else if (key === 'metrics' && !skipMetrics) {
        await platform.saveMetrics(workspaceId, { ...metricsForm, provider: metricsProvider });
      } else if (key === 'logs' && !skipLogs) {
        await platform.saveLogs(workspaceId, logsForm);
      } else if (key === 'code' && !skipCode) {
        await platform.saveCode(workspaceId, codeForm);
      }
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleProvision() {
    if (!workspaceId) return;
    setProvisioning(true);
    setError(null);
    try {
      const ws = await platform.provision(workspaceId);
      if (ws.status === 'error') {
        setError('Provisioning completed with errors. You can still use the workspace.');
      }
      navigate(`/workspace/${workspaceId}`);
    } catch (e: any) {
      setError(e.message);
      setProvisioning(false);
    }
  }

  /* ── Render helpers ────────────────────────────────────────────── */

  const inputStyle: React.CSSProperties = {
    background: 'var(--cc-surface-2)',
    borderColor: 'var(--cc-border)',
    color: 'var(--cc-text)',
  };

  const labelStyle: React.CSSProperties = { color: 'var(--cc-text-secondary)' };

  function Input({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    mono = false,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    mono?: boolean;
  }) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
          {label}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 focus:ring-indigo-500 ${mono ? 'font-mono' : ''}`}
          style={inputStyle}
        />
      </div>
    );
  }

  function Toggle({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) {
    return (
      <label className="flex items-start gap-3 cursor-pointer mb-4">
        <div
          className="w-10 h-5 rounded-full p-0.5 transition-colors mt-0.5 shrink-0 cursor-pointer"
          style={{ background: checked ? 'var(--cc-accent)' : 'var(--cc-surface-3)' }}
          onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        >
          <div
            className="w-4 h-4 rounded-full transition-transform bg-white"
            style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>{label}</div>
          {description && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{description}</div>
          )}
        </div>
      </label>
    );
  }

  function ProviderCard({
    name,
    active,
    onClick,
    icon,
  }: {
    name: string;
    active: boolean;
    onClick: () => void;
    icon: string;
  }) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer transition-all"
        style={{
          background: active ? 'var(--cc-accent-glow)' : 'var(--cc-surface-2)',
          borderColor: active ? 'var(--cc-accent)' : 'var(--cc-border)',
          color: active ? 'var(--cc-accent)' : 'var(--cc-text-secondary)',
        }}
      >
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium">{name}</span>
      </button>
    );
  }

  /* ── Step content ──────────────────────────────────────────────── */

  function renderStep() {
    const key = STEPS[step].key;

    if (key === 'ai') {
      return (
        <div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>
            Configure AI Provider
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
            CodeCircle uses Claude to power the debugging agent. Choose how to connect.
          </p>

          <div className="flex gap-3 mb-6">
            <ProviderCard
              name="Anthropic API"
              icon="🔑"
              active={aiForm.llm_provider === 'anthropic'}
              onClick={() => setAiForm({ ...aiForm, llm_provider: 'anthropic' })}
            />
            <ProviderCard
              name="AWS Bedrock"
              icon="☁️"
              active={aiForm.llm_provider === 'bedrock'}
              onClick={() => setAiForm({ ...aiForm, llm_provider: 'bedrock' })}
            />
          </div>

          {aiForm.llm_provider === 'anthropic' ? (
            <Input
              label="Anthropic API Key"
              value={aiForm.llm_api_key || ''}
              onChange={(v) => setAiForm({ ...aiForm, llm_api_key: v })}
              placeholder="sk-ant-..."
              type="password"
              mono
            />
          ) : (
            <>
              <Input
                label="Bedrock Proxy URL"
                value={aiForm.llm_bedrock_url || ''}
                onChange={(v) => setAiForm({ ...aiForm, llm_bedrock_url: v })}
                placeholder="https://your-bedrock-proxy.example.com"
              />
              <Input
                label="API Key (if required)"
                value={aiForm.llm_api_key || ''}
                onChange={(v) => setAiForm({ ...aiForm, llm_api_key: v })}
                placeholder="Optional API key"
                type="password"
                mono
              />
            </>
          )}

          <Input
            label="Model ID (optional)"
            value={aiForm.llm_model_id || ''}
            onChange={(v) => setAiForm({ ...aiForm, llm_model_id: v })}
            placeholder="anthropic.claude-sonnet-4-20250514-v1:0"
            mono
          />
        </div>
      );
    }

    if (key === 'metrics') {
      return (
        <div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>
            Connect Metrics Provider
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
            Connect Datadog, Prometheus, or Grafana to explore dashboards and metrics.
          </p>

          <Toggle
            label="Skip metrics setup"
            description="You can configure this later"
            checked={skipMetrics}
            onChange={setSkipMetrics}
          />

          {!skipMetrics && (
            <>
              <div className="flex gap-3 mb-6">
                <ProviderCard
                  name="Datadog"
                  icon="🐕"
                  active={metricsProvider === 'datadog'}
                  onClick={() => { setMetricsProvider('datadog'); setMetricsForm({ provider: 'datadog' }); }}
                />
                <ProviderCard
                  name="Prometheus"
                  icon="🔥"
                  active={metricsProvider === 'prometheus'}
                  onClick={() => { setMetricsProvider('prometheus'); setMetricsForm({ provider: 'prometheus' }); }}
                />
                <ProviderCard
                  name="Grafana"
                  icon="📊"
                  active={metricsProvider === 'grafana'}
                  onClick={() => { setMetricsProvider('grafana'); setMetricsForm({ provider: 'grafana' }); }}
                />
              </div>

              {metricsProvider === 'datadog' && (
                <>
                  <Input
                    label="API Key"
                    value={metricsForm.api_key || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, api_key: v })}
                    placeholder="Your Datadog API key"
                    type="password"
                    mono
                  />
                  <Input
                    label="Application Key"
                    value={metricsForm.app_key || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, app_key: v })}
                    placeholder="Your Datadog Application key"
                    type="password"
                    mono
                  />
                  <Input
                    label="Site (optional)"
                    value={metricsForm.site || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, site: v })}
                    placeholder="datadoghq.com"
                  />
                </>
              )}

              {metricsProvider === 'prometheus' && (
                <>
                  <Input
                    label="Prometheus URL"
                    value={metricsForm.endpoint_url || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, endpoint_url: v })}
                    placeholder="http://prometheus:9090"
                  />
                  <Input
                    label="Username (optional)"
                    value={metricsForm.username || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, username: v })}
                    placeholder="Basic auth username"
                  />
                  <Input
                    label="Password (optional)"
                    value={metricsForm.password || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, password: v })}
                    placeholder="Basic auth password"
                    type="password"
                  />
                </>
              )}

              {metricsProvider === 'grafana' && (
                <>
                  <Input
                    label="Grafana URL"
                    value={metricsForm.endpoint_url || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, endpoint_url: v })}
                    placeholder="http://grafana:3000"
                  />
                  <Input
                    label="API Key / Service Account Token"
                    value={metricsForm.bearer_token || ''}
                    onChange={(v) => setMetricsForm({ ...metricsForm, bearer_token: v })}
                    placeholder="glsa_..."
                    type="password"
                    mono
                  />
                </>
              )}
            </>
          )}
        </div>
      );
    }

    if (key === 'logs') {
      return (
        <div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>
            Connect Logs Provider
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
            Connect Splunk Cloud to search production logs.
          </p>

          <Toggle
            label="Skip logs setup"
            description="You can configure this later"
            checked={skipLogs}
            onChange={setSkipLogs}
          />

          {!skipLogs && (
            <>
              <Input
                label="Splunk Cloud Host URL"
                value={logsForm.host_url}
                onChange={(v) => setLogsForm({ ...logsForm, host_url: v })}
                placeholder="https://your-org.splunkcloud.com"
              />
              <Input
                label="Session Cookie"
                value={logsForm.cookie || ''}
                onChange={(v) => setLogsForm({ ...logsForm, cookie: v })}
                placeholder="splunkd_8000=..."
                type="password"
                mono
              />
              <Input
                label="CSRF Token"
                value={logsForm.csrf_token || ''}
                onChange={(v) => setLogsForm({ ...logsForm, csrf_token: v })}
                placeholder="Paste from browser dev tools"
                type="password"
                mono
              />
              <p className="text-xs mt-2" style={{ color: 'var(--cc-text-muted)' }}>
                Tip: Open Splunk Cloud in your browser, open Dev Tools &gt; Network, find any API
                request, and copy the <code>Cookie</code> and <code>X-Splunk-Form-Key</code> headers.
              </p>
            </>
          )}
        </div>
      );
    }

    if (key === 'code') {
      return (
        <div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>
            Connect Code Repository
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
            Point to a local code repository for the AI to analyze call graphs and entry points.
          </p>

          <Toggle
            label="Skip code setup"
            description="You can configure this later"
            checked={skipCode}
            onChange={setSkipCode}
          />

          {!skipCode && (
            <>
              <Input
                label="Repository Path"
                value={codeForm.repo_path}
                onChange={(v) => setCodeForm({ ...codeForm, repo_path: v })}
                placeholder="/path/to/your/codebase"
                mono
              />
              <Input
                label="Repository Name (optional)"
                value={codeForm.repo_name || ''}
                onChange={(v) => setCodeForm({ ...codeForm, repo_name: v })}
                placeholder="my-service"
              />
            </>
          )}
        </div>
      );
    }

    // Review step
    return (
      <div>
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>
          Review & Launch
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
          Everything looks good. Click Launch to provision all services and start debugging.
        </p>

        <div className="space-y-3">
          <ReviewItem
            icon="🤖"
            label="AI Provider"
            value={aiForm.llm_provider === 'anthropic' ? 'Anthropic API' : 'AWS Bedrock'}
            configured={!!aiForm.llm_api_key || !!aiForm.llm_bedrock_url}
          />
          <ReviewItem
            icon="📈"
            label="Metrics"
            value={skipMetrics ? 'Skipped' : metricsProvider.charAt(0).toUpperCase() + metricsProvider.slice(1)}
            configured={!skipMetrics}
          />
          <ReviewItem
            icon="📋"
            label="Logs"
            value={skipLogs ? 'Skipped' : 'Splunk Cloud'}
            configured={!skipLogs}
          />
          <ReviewItem
            icon="💻"
            label="Code"
            value={skipCode ? 'Skipped' : codeForm.repo_name || codeForm.repo_path || 'Not set'}
            configured={!skipCode && !!codeForm.repo_path}
          />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--cc-text-muted)' }}>
        Loading workspace...
      </div>
    );
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Header */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm mb-6 cursor-pointer border-0 bg-transparent"
        style={{ color: 'var(--cc-text-muted)' }}
      >
        <ArrowLeft size={14} /> Back to workspaces
      </button>

      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--cc-text)' }}>
        Set up {workspace.name}
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--cc-text-muted)' }}>
        Configure your providers step by step. You can skip optional steps and configure them later.
      </p>

      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <button
              key={s.key}
              onClick={() => i <= step && setStep(i)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors"
              style={{
                background: active ? 'var(--cc-accent-glow)' : done ? 'var(--cc-surface-2)' : 'transparent',
                borderColor: active ? 'var(--cc-accent)' : done ? 'var(--cc-border)' : 'var(--cc-border)',
                color: active ? 'var(--cc-accent)' : done ? 'var(--cc-success)' : 'var(--cc-text-muted)',
              }}
            >
              {done ? <Check size={12} /> : <Icon size={12} />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div
        className="rounded-lg border p-6 mb-6"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        {renderStep()}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--cc-error)' }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm cursor-pointer border disabled:opacity-30"
          style={{ background: 'transparent', borderColor: 'var(--cc-border)', color: 'var(--cc-text-secondary)' }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {isLastStep ? (
          <button
            onClick={handleProvision}
            disabled={provisioning}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-0"
            style={{ background: 'var(--cc-accent)', color: '#fff' }}
          >
            {provisioning ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Provisioning...
              </>
            ) : (
              <>
                <Rocket size={16} /> Launch Workspace
              </>
            )}
          </button>
        ) : (
          <button
            onClick={saveStep}
            disabled={saving}
            className="flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer border-0"
            style={{ background: 'var(--cc-accent)', color: '#fff' }}
          >
            {saving ? 'Saving...' : 'Next'} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── ReviewItem ──────────────────────────────────────────────────── */

function ReviewItem({
  icon,
  label,
  value,
  configured,
}: {
  icon: string;
  label: string;
  value: string;
  configured: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg border"
      style={{ background: 'var(--cc-surface-2)', borderColor: 'var(--cc-border)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>
            {label}
          </div>
          <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            {value}
          </div>
        </div>
      </div>
      {configured ? (
        <Check size={18} style={{ color: 'var(--cc-success)' }} />
      ) : (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--cc-surface-3)', color: 'var(--cc-text-muted)' }}>
          Skipped
        </span>
      )}
    </div>
  );
}

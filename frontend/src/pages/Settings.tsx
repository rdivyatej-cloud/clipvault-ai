import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Sparkles, 
  Save, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive,
  Check,
  Server
} from 'lucide-react';
import { api } from '../services/api';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    whisper_model: 'base',
    ollama_url: 'http://localhost:11434',
    ollama_model: 'qwen2.5:3b',
    default_clip_min_duration: '25',
    default_clip_max_duration: '55',
    target_aspect_ratio: '9:16',
    subtitle_style: 'red_highlight',
    audio_normalization: 'true',
    auto_generate_clips_count: '3',
    framing_mode: 'blur_pillarbox',
  });

  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [testingDiagnostics, setTestingDiagnostics] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
    runDiagnostics();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const runDiagnostics = async () => {
    setTestingDiagnostics(true);
    try {
      const data = await api.getDiagnostics();
      setDiagnostics(data);
    } catch (err) {
      console.error('Failed to run diagnostics', err);
    } finally {
      setTestingDiagnostics(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await api.updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-vault-surface rounded-2xl border border-vault-border">
        <div>
          <h2 className="text-xl font-extrabold text-vault-silverLight tracking-tight flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-vault-red" />
            <span>Studio Engine Settings</span>
          </h2>
          <p className="text-xs text-vault-muted mt-1">
            Configure local AI models, FFmpeg 9:16 framing, and CPU performance thresholds.
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={testingDiagnostics}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-vault-surfaceHover text-vault-silver hover:text-white border border-vault-border transition-all"
        >
          <RotateCw className={`w-3.5 h-3.5 ${testingDiagnostics ? 'animate-spin' : ''}`} />
          <span>Run System Diagnostics</span>
        </button>
      </div>

      {/* Diagnostics Status Card */}
      {diagnostics && (
        <div className="p-5 rounded-2xl bg-vault-surface border border-vault-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-vault-silverLight">
                Local Hardware & AI Health Check
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              OPERATIONAL
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-vault-bg/60 p-3 rounded-xl border border-vault-border">
              <span className="text-vault-muted text-[10px] block">FASTAPI AI ENGINE:</span>
              <span className="text-vault-silverLight font-bold">
                {diagnostics.ai_engine?.status === 'online' ? '● Online (Port 8000)' : '○ Standby'}
              </span>
            </div>

            <div className="bg-vault-bg/60 p-3 rounded-xl border border-vault-border">
              <span className="text-vault-muted text-[10px] block">OLLAMA SERVICE:</span>
              <span className="text-emerald-400 font-bold">
                {diagnostics.ai_engine?.ollama_connected ? '● Connected' : '○ Standby'}
              </span>
            </div>

            <div className="bg-vault-bg/60 p-3 rounded-xl border border-vault-border">
              <span className="text-vault-muted text-[10px] block">ACTIVE LLM MODEL:</span>
              <span className="text-vault-silverLight font-bold truncate block">
                {diagnostics.ai_engine?.available_llm_models?.[0] || 'qwen2.5:3b'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: AI Model Configuration */}
        <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
          <div className="flex items-center space-x-2 border-b border-vault-border pb-3">
            <Sparkles className="w-4 h-4 text-vault-red" />
            <h3 className="text-sm font-bold text-vault-silverLight uppercase tracking-wider">
              Local AI Engine Configuration
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                faster-whisper Model Size
              </label>
              <select
                value={settings.whisper_model}
                onChange={(e) => setSettings({ ...settings, whisper_model: e.target.value })}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="base">base (Recommended for CPU i5-11320H)</option>
                <option value="small">small (Higher accuracy, slightly slower)</option>
                <option value="tiny">tiny (Ultra fast)</option>
              </select>
              <p className="text-[10px] text-vault-muted mt-1">
                Transcribes speech on CPU with INT8 quantization.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Ollama LLM Model
              </label>
              <input
                type="text"
                value={settings.ollama_model}
                onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-mono"
              />
              <p className="text-[10px] text-vault-muted mt-1">
                Default: <span className="font-mono text-vault-silver">qwen2.5:3b</span> (Verified local)
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Ollama Endpoint URL
              </label>
              <input
                type="text"
                value={settings.ollama_url}
                onChange={(e) => setSettings({ ...settings, ollama_url: e.target.value })}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Auto-Generate Top Clips Count
              </label>
              <select
                value={settings.auto_generate_clips_count}
                onChange={(e) => setSettings({ ...settings, auto_generate_clips_count: e.target.value })}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="1">Top 1 clip automatically</option>
                <option value="2">Top 2 clips automatically</option>
                <option value="3">Top 3 clips automatically (Recommended)</option>
                <option value="5">Top 5 clips automatically</option>
                <option value="0">Do not auto-render (Manual selection)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Video Editing & Subtitle Typography */}
        <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
          <div className="flex items-center space-x-2 border-b border-vault-border pb-3">
            <Cpu className="w-4 h-4 text-vault-silver" />
            <h3 className="text-sm font-bold text-vault-silverLight uppercase tracking-wider">
              Video Editing & Subtitle Styling
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Vertical 9:16 Framing Mode
              </label>
              <select
                value={settings.framing_mode}
                onChange={(e) => setSettings({ ...settings, framing_mode: e.target.value })}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="blur_pillarbox">
                  High-End Blur Pillarbox (Preserves facecam & gameplay)
                </option>
                <option value="center_crop">
                  Direct Center Crop (Fills entire screen)
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Audio Normalization (EBU R128)
              </label>
              <select
                value={settings.audio_normalization}
                onChange={(e) => setSettings({ ...settings, audio_normalization: e.target.value })}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="true">Enabled (Levels shouting and quiet speech)</option>
                <option value="false">Disabled (Raw audio)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
                <Check className="w-4 h-4" />
                <span>Settings saved to local SQLite database!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-vault-red to-vault-redHover text-white shadow-glow-red hover:brightness-110 active:scale-95 transition-all flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};


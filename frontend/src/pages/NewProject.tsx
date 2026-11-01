import React, { useState, useRef } from 'react';
import { 
  Upload, 
  HardDrive, 
  Link as LinkIcon, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Folder, 
  Sliders, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

interface NewProjectProps {
  setActiveTab: (tab: string) => void;
  setSelectedProject: (id: string) => void;
}

export const NewProject: React.FC<NewProjectProps> = ({ setActiveTab, setSelectedProject }) => {
  const [importMode, setImportMode] = useState<'upload' | 'local' | 'url'>('upload');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Local path state
  const [localPath, setLocalPath] = useState('');
  
  // Stream URL state
  const [streamUrl, setStreamUrl] = useState('');
  const [urlNotice, setUrlNotice] = useState<string | null>(null);

  // Configuration
  const [minDuration, setMinDuration] = useState('25');
  const [maxDuration, setMaxDuration] = useState('55');
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState('red_highlight');

  // Submitting state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUrlCheck = async () => {
    if (!streamUrl.trim()) return;
    try {
      const res = await api.validateUrl(streamUrl, projectName);
      if (res.success && res.message) {
        setUrlNotice(res.message);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'URL validation failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (importMode === 'upload') {
        if (!selectedFile) {
          throw new Error('Please select a video file to import.');
        }

        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('name', projectName || selectedFile.name);
        formData.append('auto_analyze', String(autoAnalyze));

        const res = await api.uploadProject(formData);
        if (res.success && res.project) {
          setSelectedProject(res.project.id);
          setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
        } else {
          throw new Error(res.error || 'Failed to upload project');
        }
      } else if (importMode === 'local') {
        if (!localPath.trim()) {
          throw new Error('Please provide an existing local file path.');
        }

        const res = await api.importLocalProject(localPath, projectName, autoAnalyze);
        if (res.success && res.project) {
          setSelectedProject(res.project.id);
          setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
        } else {
          throw new Error(res.error || 'Failed to import local file');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during project import');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-vault-silverLight tracking-tight">
          Import Video Stream
        </h2>
        <p className="text-sm text-vault-muted mt-1">
          Import your authorized streamer VOD or gaming recording. Runs completely on your Intel Iris Xe / CPU laptop.
        </p>
      </div>

      {/* Import Mode Tabs */}
      <div className="flex border-b border-vault-border space-x-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setImportMode('upload')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-all ${
            importMode === 'upload'
              ? 'border-vault-red text-vault-red'
              : 'border-transparent text-vault-muted hover:text-vault-silver'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload File (Drag & Drop)</span>
        </button>

        <button
          type="button"
          onClick={() => setImportMode('local')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-all ${
            importMode === 'local'
              ? 'border-vault-red text-vault-red'
              : 'border-transparent text-vault-muted hover:text-vault-silver'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Local Path Import</span>
        </button>

        <button
          type="button"
          onClick={() => setImportMode('url')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-all ${
            importMode === 'url'
              ? 'border-vault-red text-vault-red'
              : 'border-transparent text-vault-muted hover:text-vault-silver'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Stream / YouTube URL</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mode 1: File Upload */}
        {importMode === 'upload' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? 'border-vault-red bg-vault-red/10'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-vault-border hover:border-vault-red/50 bg-vault-surface'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mkv,.mov,.webm,.avi"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-vault-silverLight">{selectedFile.name}</h4>
                <p className="text-xs text-vault-muted font-mono">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Click or drag to replace
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-vault-surfaceHover border border-vault-border flex items-center justify-center mx-auto text-vault-red shadow-glow-red">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-vault-silverLight">
                    Drag and drop your video file here
                  </h4>
                  <p className="text-xs text-vault-muted mt-1">
                    Supports MP4, MKV, MOV, WEBM (Up to 4GB)
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-vault-surfaceHover text-vault-silver border border-vault-border hover:border-vault-borderLight"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Local Path Import */}
        {importMode === 'local' && (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Full Local File Path
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="e.g. C:\Users\Dell\Videos\stream_vod_01.mp4"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  className="flex-1 bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-mono"
                />
              </div>
              <p className="text-[11px] text-vault-muted mt-1.5">
                Fastest option for large multi-gigabyte files. Avoids copying or re-uploading file.
              </p>
            </div>
          </div>
        )}

        {/* Mode 3: Stream / YouTube URL */}
        {importMode === 'url' && (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Stream / YouTube URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="flex-1 bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleUrlCheck}
                  className="px-4 py-2.5 bg-vault-surfaceHover text-vault-silverLight hover:text-white rounded-xl text-xs font-semibold border border-vault-border transition-colors"
                >
                  Verify URL
                </button>
              </div>
            </div>

            {urlNotice && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start space-x-3 text-xs text-blue-300">
                <ShieldCheck className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-white">Platform & Copyright Compliance Notice</div>
                  <p className="leading-relaxed">{urlNotice}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Project Name */}
        <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
              Project Name
            </label>
            <input
              type="text"
              placeholder="e.g. Kai Cenat 24h Stream Best Moments"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-medium"
            />
          </div>

          {/* AI Settings Section */}
          <div className="pt-4 border-t border-vault-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-2">
                Clip Target Duration ({minDuration}s - {maxDuration}s)
              </label>
              <div className="flex items-center space-x-3 text-xs">
                <input
                  type="range"
                  min="15"
                  max="45"
                  value={minDuration}
                  onChange={(e) => setMinDuration(e.target.value)}
                  className="flex-1 accent-vault-red cursor-pointer"
                />
                <span className="font-mono text-vault-silver font-semibold w-8">{minDuration}s</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-2">
                Subtitle Typography Style
              </label>
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="red_highlight">Crimson Red Highlight (TikTok / Reels Style)</option>
                <option value="classic_white">Classic Studio White</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="autoAnalyze"
              checked={autoAnalyze}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
              className="rounded accent-vault-red cursor-pointer"
            />
            <label htmlFor="autoAnalyze" className="text-xs text-vault-silver cursor-pointer select-none">
              Automatically start AI moment detection and generate top 3 clips immediately
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || (importMode === 'upload' && !selectedFile) || (importMode === 'local' && !localPath.trim())}
          className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-vault-red to-vault-redHover text-white shadow-glow-red hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <Sparkles className="w-5 h-5 animate-spin" />
              <span>Importing & Initializing Studio...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Create Project & Run Local AI</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

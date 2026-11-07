import React, { useState, useRef } from 'react';
import { 
  Upload, 
  HardDrive, 
  Globe, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck,
  Youtube,
  Clock,
  ExternalLink,
  Download,
  RefreshCw,
  FileVideo,
  Layers,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { YouTubeMetadata } from '../types';

interface NewProjectProps {
  setActiveTab: (tab: string) => void;
  setSelectedProject: (id: string) => void;
}

export const NewProject: React.FC<NewProjectProps> = ({ setActiveTab, setSelectedProject }) => {
  const [sourceMode, setSourceMode] = useState<'youtube' | 'direct_url' | 'local_video'>('youtube');
  
  // Project settings
  const [projectName, setProjectName] = useState('');
  const [minDuration, setMinDuration] = useState('25');
  const [maxDuration, setMaxDuration] = useState('55');
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState('red_highlight');
  const [autoClipsCount, setAutoClipsCount] = useState('3');

  // YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isVerifyingYt, setIsVerifyingYt] = useState(false);
  const [verifiedYtData, setVerifiedYtData] = useState<{
    videoId: string;
    metadata: YouTubeMetadata;
    existingProject: any | null;
    instructions: { summary: string; export_methods: string[] };
  } | null>(null);
  const [ytLocalMode, setYtLocalMode] = useState<'upload' | 'path'>('upload');
  const [ytSelectedFile, setYtSelectedFile] = useState<File | null>(null);
  const [ytLocalPath, setYtLocalPath] = useState('');
  const [isYtDragging, setIsYtDragging] = useState(false);
  const [forceOverwriteYt, setForceOverwriteYt] = useState(false);

  // Direct Media URL state
  const [directUrl, setDirectUrl] = useState('');
  const [isVerifyingDirect, setIsVerifyingDirect] = useState(false);
  const [verifiedDirectData, setVerifiedDirectData] = useState<{
    url: string;
    suggestedFilename?: string;
    contentLength?: number;
    contentType?: string;
    resolvedIp?: string;
    existingProject?: any;
  } | null>(null);
  const [forceOverwriteDirect, setForceOverwriteDirect] = useState(false);

  // Local Video state
  const [localInputMode, setLocalInputMode] = useState<'upload' | 'path'>('upload');
  const [localSelectedFile, setLocalSelectedFile] = useState<File | null>(null);
  const [localFilePath, setLocalFilePath] = useState('');
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ytFileInputRef = useRef<HTMLInputElement>(null);

  // 1. Verify YouTube URL
  const handleVerifyYouTubeUrl = async () => {
    if (!youtubeUrl.trim()) {
      setErrorMsg('Please enter a YouTube video or livestream URL.');
      return;
    }
    setErrorMsg(null);
    setSuccessNotice(null);
    setIsVerifyingYt(true);
    setVerifiedYtData(null);

    try {
      const res = await api.verifyYouTubeUrl(youtubeUrl.trim());
      if (res.success && res.metadata && res.video_id) {
        setVerifiedYtData({
          videoId: res.video_id,
          metadata: res.metadata,
          existingProject: res.existing_project || null,
          instructions: res.instructions || {
            summary: 'Please provide your authorized local video file for local AI clipping.',
            export_methods: [
              'Download via YouTube Studio > Content > Options > Download',
              'Export via Google Takeout (takeout.google.com)',
              'Original OBS / Twitch VOD recording file',
            ],
          },
        });

        if (!projectName || projectName.trim() === '') {
          setProjectName(res.metadata.title);
        }

        if (res.existing_project) {
          setErrorMsg(`Notice: A project for this video already exists ("${res.existing_project.name}"). You can associate a new file or view the existing project.`);
        }
      } else {
        throw new Error(res.error || 'Failed to verify YouTube video');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'YouTube verification failed. Please check the URL.');
    } finally {
      setIsVerifyingYt(false);
    }
  };

  // 2. Verify Direct Media URL
  const handleVerifyDirectUrl = async () => {
    if (!directUrl.trim()) {
      setErrorMsg('Please enter a direct video URL (e.g. https://domain.com/video.mp4).');
      return;
    }
    setErrorMsg(null);
    setSuccessNotice(null);
    setIsVerifyingDirect(true);
    setVerifiedDirectData(null);

    try {
      const res = await api.verifySource(directUrl.trim());
      if (res.success && res.sourceType === 'direct_media') {
        setVerifiedDirectData({
          url: res.normalizedInput,
          suggestedFilename: res.metadata?.suggested_filename,
          contentLength: res.metadata?.content_length,
          contentType: res.metadata?.content_type,
          resolvedIp: res.metadata?.resolved_ip,
          existingProject: res.existingProject,
        });

        if (!projectName || projectName.trim() === '') {
          const fn = res.metadata?.suggested_filename || 'Direct Stream Clip';
          setProjectName(fn.replace(/\.[^/.]+$/, ''));
        }

        if (res.existingProject) {
          setErrorMsg(`Notice: A project already exists for this URL ("${res.existingProject.name}"). Enable force re-ingest or open the existing project.`);
        }
      } else {
        throw new Error(res.error || 'Direct media validation failed. Please ensure the URL points to a valid video stream.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Direct media URL validation failed.');
    } finally {
      setIsVerifyingDirect(false);
    }
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);
    setIsLoading(true);

    try {
      if (sourceMode === 'youtube') {
        if (!verifiedYtData) {
          throw new Error('Please verify your YouTube URL first before proceeding.');
        }

        if (ytLocalMode === 'upload') {
          if (!ytSelectedFile) {
            throw new Error('Please select your authorized local video file (exported from YouTube Studio or OBS recording).');
          }

          setLoadingStep('Associating and uploading authorized video...');
          const formData = new FormData();
          formData.append('video', ytSelectedFile);
          formData.append('youtube_id', verifiedYtData.videoId);
          formData.append('youtube_url', verifiedYtData.metadata.url);
          formData.append('title', projectName || verifiedYtData.metadata.title);
          formData.append('metadata', JSON.stringify(verifiedYtData.metadata));
          formData.append('auto_analyze', String(autoAnalyze));
          formData.append('force', String(forceOverwriteYt));

          const res = await api.associateYouTubeFile(formData);
          if (res.success && res.project) {
            setSelectedProject(res.project.id);
            setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
          } else if (res.duplicate) {
            throw new Error(`A project for this YouTube video already exists ("${res.project?.name}"). Enable "Force Re-associate" or open the existing project.`);
          } else {
            throw new Error(res.error || 'Failed to associate local video with YouTube project');
          }
        } else {
          if (!ytLocalPath.trim()) {
            throw new Error('Please specify the path to your authorized local video file.');
          }

          setLoadingStep('Linking authorized local video path...');
          const res = await api.associateYouTubeLocalPath({
            youtube_id: verifiedYtData.videoId,
            file_path: ytLocalPath.trim(),
            youtube_url: verifiedYtData.metadata.url,
            title: projectName || verifiedYtData.metadata.title,
            metadata: verifiedYtData.metadata,
            auto_analyze: autoAnalyze,
            force: forceOverwriteYt,
          });

          if (res.success && res.project) {
            setSelectedProject(res.project.id);
            setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
          } else if (res.duplicate) {
            throw new Error(`A project for this YouTube video already exists ("${res.project?.name}"). Enable "Force Re-associate" or open the existing project.`);
          } else {
            throw new Error(res.error || 'Failed to associate local file path');
          }
        }
      } else if (sourceMode === 'direct_url') {
        if (!directUrl.trim()) {
          throw new Error('Please provide a direct media URL.');
        }

        setLoadingStep('Validating and streaming direct media source...');
        const res = await api.ingestDirectUrl({
          url: directUrl.trim(),
          name: projectName || verifiedDirectData?.suggestedFilename,
          auto_analyze: autoAnalyze,
          force: forceOverwriteDirect,
        });

        if (res.success && res.project) {
          setSelectedProject(res.project.id);
          setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
        } else if (res.duplicate) {
          throw new Error(res.message || 'A project already exists for this direct media URL.');
        } else {
          throw new Error(res.error || 'Failed to ingest direct media URL');
        }
      } else if (sourceMode === 'local_video') {
        if (localInputMode === 'upload') {
          if (!localSelectedFile) {
            throw new Error('Please select or drop a video file to import.');
          }

          setLoadingStep('Uploading video to local studio storage...');
          const formData = new FormData();
          formData.append('video', localSelectedFile);
          formData.append('name', projectName || localSelectedFile.name);
          formData.append('auto_analyze', String(autoAnalyze));

          const res = await api.uploadProject(formData);
          if (res.success && res.project) {
            setSelectedProject(res.project.id);
            setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
          } else {
            throw new Error(res.error || 'Failed to upload project');
          }
        } else {
          if (!localFilePath.trim()) {
            throw new Error('Please provide an existing local file path.');
          }

          setLoadingStep('Inspecting local video metadata with FFprobe...');
          const res = await api.importLocalProject(localFilePath.trim(), projectName, autoAnalyze);
          if (res.success && res.project) {
            setSelectedProject(res.project.id);
            setActiveTab(autoAnalyze ? 'queue' : 'video-analysis');
          } else {
            throw new Error(res.error || 'Failed to import local file');
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during project creation');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const isFormValid = () => {
    if (isLoading) return false;
    if (sourceMode === 'youtube') {
      if (!verifiedYtData) return false;
      return ytLocalMode === 'upload' ? !!ytSelectedFile : !!ytLocalPath.trim();
    }
    if (sourceMode === 'direct_url') {
      return !!directUrl.trim();
    }
    if (sourceMode === 'local_video') {
      return localInputMode === 'upload' ? !!localSelectedFile : !!localFilePath.trim();
    }
    return false;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-vault-red/15 border border-vault-red/30 text-vault-red text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>CLIPVAULT AI 2.0 • URL-First Viral Studio</span>
        </div>
        <h2 className="text-2xl font-extrabold text-vault-silverLight tracking-tight">
          Create AI Clipping Project
        </h2>
        <p className="text-sm text-vault-muted mt-1">
          Paste any stream or video link. Local AI identifies viral moments, detects excitement peaks, and generates ready-to-post 9:16 vertical clips.
        </p>
      </div>

      {/* URL-First Source Modes Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => { setSourceMode('youtube'); setErrorMsg(null); }}
          className={`p-4 rounded-xl border text-left transition-all ${
            sourceMode === 'youtube'
              ? 'bg-vault-red/10 border-vault-red text-white shadow-glow-red'
              : 'bg-vault-surface border-vault-border text-vault-silver hover:bg-vault-surfaceHover'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-vault-bg flex items-center justify-center text-vault-red">
              <Youtube className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-vault-bg text-vault-muted">Assisted</span>
          </div>
          <div className="text-sm font-bold">YouTube URL</div>
          <p className="text-[11px] text-vault-muted mt-1 leading-snug">
            Stream VODs, Shorts & videos with creator export association
          </p>
        </button>

        <button
          type="button"
          onClick={() => { setSourceMode('direct_url'); setErrorMsg(null); }}
          className={`p-4 rounded-xl border text-left transition-all ${
            sourceMode === 'direct_url'
              ? 'bg-vault-red/10 border-vault-red text-white shadow-glow-red'
              : 'bg-vault-surface border-vault-border text-vault-silver hover:bg-vault-surfaceHover'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-vault-bg flex items-center justify-center text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">Auto Ingest</span>
          </div>
          <div className="text-sm font-bold">Direct Media URL</div>
          <p className="text-[11px] text-vault-muted mt-1 leading-snug">
            Paste direct HTTP/HTTPS link to MP4, MOV, MKV, or WEBM
          </p>
        </button>

        <button
          type="button"
          onClick={() => { setSourceMode('local_video'); setErrorMsg(null); }}
          className={`p-4 rounded-xl border text-left transition-all ${
            sourceMode === 'local_video'
              ? 'bg-vault-red/10 border-vault-red text-white shadow-glow-red'
              : 'bg-vault-surface border-vault-border text-vault-silver hover:bg-vault-surfaceHover'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-vault-bg flex items-center justify-center text-vault-silver">
              <HardDrive className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-vault-bg text-vault-muted">Local</span>
          </div>
          <div className="text-sm font-bold">Local Video</div>
          <p className="text-[11px] text-vault-muted mt-1 leading-snug">
            Drag & drop video file or link directly from your SSD
          </p>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-red-400 text-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">{errorMsg}</span>
            {verifiedYtData?.existingProject && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProject(verifiedYtData.existingProject.id);
                  setActiveTab('video-analysis');
                }}
                className="inline-flex items-center space-x-1.5 text-vault-silverLight hover:text-white underline font-semibold mt-1"
              >
                <span>Jump to Existing Project Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SOURCE 1: YouTube URL */}
        {sourceMode === 'youtube' && (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                YouTube Video, Shorts or Livestream Link
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerifyYouTubeUrl();
                    }
                  }}
                  className="flex-1 bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifyYouTubeUrl}
                  disabled={isVerifyingYt || !youtubeUrl.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-vault-red to-vault-redHover text-white hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 shadow-glow-red"
                >
                  {isVerifyingYt ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Youtube className="w-3.5 h-3.5" />
                      <span>Verify URL</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-vault-muted mt-1.5">
                Automatically retrieves video metadata via official YouTube Data API v3 or public oEmbed.
              </p>
            </div>

            {/* Verified YouTube Video Card */}
            {verifiedYtData && (
              <div className="p-5 rounded-xl bg-vault-bg/70 border border-vault-border space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="relative w-full sm:w-48 h-28 rounded-lg overflow-hidden bg-vault-surface shrink-0 border border-vault-border">
                    <img 
                      src={verifiedYtData.metadata.thumbnail_url} 
                      alt={verifiedYtData.metadata.title}
                      className="w-full h-full object-cover"
                    />
                    {verifiedYtData.metadata.is_live && (
                      <div className="absolute top-2 left-2 bg-vault-red text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow">
                        Live / VOD
                      </div>
                    )}
                    {verifiedYtData.metadata.duration_seconds > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                        {verifiedYtData.metadata.duration_formatted}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Verified YouTube Video
                      </span>
                      <span className="text-[11px] text-vault-muted font-mono">
                        ID: {verifiedYtData.videoId}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-vault-silverLight line-clamp-2">
                      {verifiedYtData.metadata.title}
                    </h4>
                    <p className="text-xs text-vault-silver/80 flex items-center space-x-1.5">
                      <span>Channel:</span>
                      <span className="text-vault-silver font-semibold">{verifiedYtData.metadata.channel_title}</span>
                    </p>
                    <div className="pt-1 flex items-center space-x-3 text-[11px] text-vault-muted">
                      <a 
                        href={verifiedYtData.metadata.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="hover:text-vault-red flex items-center space-x-1 text-vault-silver/70"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-200 space-y-2">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Authorized Video Acquisition Instructions</span>
                  </div>
                  <p className="text-[11px] text-blue-200/80 leading-relaxed">
                    To comply with platform policies and avoid unauthorized ripping, CLIPVAULT AI runs locally on your authorized video export:
                  </p>
                  <ul className="text-[11px] space-y-1 text-vault-silver/90 list-disc pl-5">
                    {verifiedYtData.instructions.export_methods.map((method, idx) => (
                      <li key={idx}>{method}</li>
                    ))}
                  </ul>
                </div>

                {/* Authorized Video Association */}
                <div className="pt-2 border-t border-vault-border space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-vault-silverLight tracking-wider flex items-center space-x-2">
                      <FileVideo className="w-4 h-4 text-vault-red" />
                      <span>Select Corresponding Authorized Local Video</span>
                    </label>
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setYtLocalMode('upload')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          ytLocalMode === 'upload' ? 'bg-vault-red text-white' : 'text-vault-muted hover:text-vault-silver'
                        }`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setYtLocalMode('path')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          ytLocalMode === 'path' ? 'bg-vault-red text-white' : 'text-vault-muted hover:text-vault-silver'
                        }`}
                      >
                        Local File Path
                      </button>
                    </div>
                  </div>

                  {ytLocalMode === 'upload' ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsYtDragging(true); }}
                      onDragLeave={() => setIsYtDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsYtDragging(false);
                        if (e.dataTransfer.files?.[0]) setYtSelectedFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => ytFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                        isYtDragging
                          ? 'border-vault-red bg-vault-red/10'
                          : ytSelectedFile
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-vault-border hover:border-vault-red/50 bg-vault-surface'
                      }`}
                    >
                      <input
                        ref={ytFileInputRef}
                        type="file"
                        accept=".mp4,.mkv,.mov,.webm,.avi"
                        onChange={(e) => e.target.files?.[0] && setYtSelectedFile(e.target.files[0])}
                        className="hidden"
                      />
                      {ytSelectedFile ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                          <h4 className="text-xs font-bold text-vault-silverLight">{ytSelectedFile.name}</h4>
                          <p className="text-[10px] text-vault-muted font-mono">
                            {(ytSelectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready for AI clipping
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Upload className="w-6 h-6 text-vault-red mx-auto" />
                          <p className="text-xs font-semibold text-vault-silverLight">
                            Click or drag & drop your authorized video file (MP4, MKV, MOV, WEBM)
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        placeholder="e.g. C:\Users\Dell\Videos\stream_recording.mp4"
                        value={ytLocalPath}
                        onChange={(e) => setYtLocalPath(e.target.value)}
                        className="w-full bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-mono"
                      />
                    </div>
                  )}

                  {verifiedYtData.existingProject && (
                    <div className="flex items-center space-x-2 pt-2">
                      <input
                        type="checkbox"
                        id="forceOverwriteYt"
                        checked={forceOverwriteYt}
                        onChange={(e) => setForceOverwriteYt(e.target.checked)}
                        className="rounded accent-vault-red cursor-pointer"
                      />
                      <label htmlFor="forceOverwriteYt" className="text-xs text-vault-silver cursor-pointer select-none">
                        Force overwrite / re-associate with existing project
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SOURCE 2: Direct Media URL (Auto Ingestion) */}
        {sourceMode === 'direct_url' && (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Direct Video Stream URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  placeholder="https://cdn.example.com/vod/gameplay_stream.mp4"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerifyDirectUrl();
                    }
                  }}
                  className="flex-1 bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleVerifyDirectUrl}
                  disabled={isVerifyingDirect || !directUrl.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-vault-red to-vault-redHover text-white hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 shadow-glow-red"
                >
                  {isVerifyingDirect ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Inspect URL</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-vault-muted mt-1.5">
                Protected by automated SSRF validation, DNS IP isolation, and streaming download pipeline.
              </p>
            </div>

            {verifiedDirectData && (
              <div className="p-4 rounded-xl bg-vault-bg border border-vault-border space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-vault-silverLight">Direct Media Accessible</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                    Automatic Ingestion Ready
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-vault-muted pt-2 border-t border-vault-border">
                  <div>
                    <span>Filename: </span>
                    <span className="text-vault-silver">{verifiedDirectData.suggestedFilename}</span>
                  </div>
                  <div>
                    <span>Size: </span>
                    <span className="text-vault-silver">
                      {verifiedDirectData.contentLength
                        ? `${(verifiedDirectData.contentLength / (1024 * 1024)).toFixed(1)} MB`
                        : 'Streaming Size'}
                    </span>
                  </div>
                  <div>
                    <span>Content-Type: </span>
                    <span className="text-vault-silver">{verifiedDirectData.contentType || 'video/mp4'}</span>
                  </div>
                  <div>
                    <span>IP Checked: </span>
                    <span className="text-vault-silver">{verifiedDirectData.resolvedIp} (SSRF Safe)</span>
                  </div>
                </div>

                {verifiedDirectData.existingProject && (
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="forceOverwriteDirect"
                      checked={forceOverwriteDirect}
                      onChange={(e) => setForceOverwriteDirect(e.target.checked)}
                      className="rounded accent-vault-red cursor-pointer"
                    />
                    <label htmlFor="forceOverwriteDirect" className="text-xs text-vault-silver cursor-pointer select-none">
                      Force re-download / overwrite existing project
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SOURCE 3: Local Video */}
        {sourceMode === 'local_video' && (
          <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider">
                Select Local Video Footage
              </label>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLocalInputMode('upload')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    localInputMode === 'upload' ? 'bg-vault-red text-white' : 'text-vault-muted hover:text-vault-silver'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setLocalInputMode('path')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    localInputMode === 'path' ? 'bg-vault-red text-white' : 'text-vault-muted hover:text-vault-silver'
                  }`}
                >
                  Local Drive Path
                </button>
              </div>
            </div>

            {localInputMode === 'upload' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingLocal(true); }}
                onDragLeave={() => setIsDraggingLocal(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingLocal(false);
                  if (e.dataTransfer.files?.[0]) {
                    setLocalSelectedFile(e.dataTransfer.files[0]);
                    if (!projectName) setProjectName(e.dataTransfer.files[0].name.replace(/\.[^/.]+$/, ''));
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDraggingLocal
                    ? 'border-vault-red bg-vault-red/10'
                    : localSelectedFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-vault-border hover:border-vault-red/50 bg-vault-surface'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mkv,.mov,.webm,.avi"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setLocalSelectedFile(e.target.files[0]);
                      if (!projectName) setProjectName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="hidden"
                />
                {localSelectedFile ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                    <h4 className="text-base font-bold text-vault-silverLight">{localSelectedFile.name}</h4>
                    <p className="text-xs text-vault-muted font-mono">
                      {(localSelectedFile.size / (1024 * 1024)).toFixed(1)} MB • Click or drag to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-vault-surfaceHover border border-vault-border flex items-center justify-center mx-auto text-vault-red shadow-glow-red">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-vault-silverLight">
                        Drag and drop your streamer recording here
                      </h4>
                      <p className="text-xs text-vault-muted mt-1">
                        Supports MP4, MKV, MOV, WEBM (Up to 4GB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="e.g. C:\Users\Dell\Videos\stream_vod_01.mp4"
                  value={localFilePath}
                  onChange={(e) => {
                    setLocalFilePath(e.target.value);
                    if (!projectName && e.target.value) {
                      const base = e.target.value.split(/[\\/]/).pop() || '';
                      setProjectName(base.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-mono"
                />
                <p className="text-[11px] text-vault-muted mt-1.5">
                  Direct filesystem linkage for large 4K/60FPS streamer recordings. Zero file copying overhead.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Project Name & AI Clipping Settings */}
        <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-1">
              Project Title
            </label>
            <input
              type="text"
              placeholder="e.g. Kai Cenat 24h Stream Best Moments"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-medium"
            />
          </div>

          <div className="pt-4 border-t border-vault-border grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-2">
                Target Duration ({minDuration}s - {maxDuration}s)
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
                Subtitle Typography
              </label>
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="red_highlight">Crimson Red Highlight (Viral Shorts)</option>
                <option value="classic_white">Classic Studio White</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-vault-muted tracking-wider block mb-2">
                Number of Clips
              </label>
              <select
                value={autoClipsCount}
                onChange={(e) => setAutoClipsCount(e.target.value)}
                className="w-full bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
              >
                <option value="3">Top 3 Viral Clips (Default)</option>
                <option value="5">Top 5 Best Clips</option>
                <option value="1">Single Best Moment</option>
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
              Automatically trigger speech transcription, audio excitement ranking, and vertical video rendering
            </label>
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={!isFormValid()}
          className="w-full py-4 rounded-xl text-sm font-extrabold bg-gradient-to-r from-vault-red via-vault-redHover to-vault-red text-white shadow-glow-red hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2 uppercase tracking-wider"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>{loadingStep || 'Processing Ingestion Pipeline...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>CREATE PROJECT & GENERATE CLIPS</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

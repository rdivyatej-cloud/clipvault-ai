import React, { useState } from 'react';
import { X, Download, Check, Ban, Edit2, RotateCw, Sparkles, Tag, Clock } from 'lucide-react';
import { Clip } from '../types';
import { api } from '../services/api';

interface ClipPlayerModalProps {
  clip: Clip | null;
  onClose: () => void;
  onUpdate: (updated: Clip) => void;
}

export const ClipPlayerModal: React.FC<ClipPlayerModalProps> = ({ clip, onClose, onUpdate }) => {
  if (!clip) return null;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(clip.title);
  const [category, setCategory] = useState(clip.category);
  const [status, setStatus] = useState(clip.status);
  const [subtitleStyle, setSubtitleStyle] = useState(clip.subtitle_style || 'red_highlight');
  const [isSaving, setIsSaving] = useState(false);
  const [isReRendering, setIsReRendering] = useState(false);

  const videoUrl = clip.video_path ? api.getMediaStreamUrl(clip.video_path, 'clip') : '';
  const downloadUrl = clip.video_path ? api.getDownloadUrl(clip.video_path) : '#';

  const handleSaveMetadata = async () => {
    setIsSaving(true);
    try {
      const res = await api.updateClip(clip.id, { title, category, status, subtitle_style: subtitleStyle });
      if (res.success && res.clip) {
        onUpdate(res.clip);
        setIsEditingTitle(false);
      }
    } catch (err) {
      console.error('Failed to update clip metadata', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: 'approved' | 'rejected') => {
    setStatus(newStatus);
    try {
      const res = await api.updateClip(clip.id, { status: newStatus });
      if (res.success && res.clip) {
        onUpdate(res.clip);
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleReRender = async () => {
    setIsReRendering(true);
    try {
      await api.updateClip(clip.id, { subtitle_style: subtitleStyle });
      await api.reRenderClip(clip.id);
      onClose();
    } catch (err) {
      console.error('Failed to trigger re-render', err);
    } finally {
      setIsReRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-vault-surface border border-vault-border rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh]">
        {/* Left: 9:16 Vertical Video Frame */}
        <div className="bg-black/90 p-6 flex items-center justify-center md:w-[420px] shrink-0 border-b md:border-b-0 md:border-r border-vault-border">
          <div className="w-[280px] h-[500px] bg-vault-bg rounded-2xl overflow-hidden border border-vault-border shadow-2xl relative flex items-center justify-center">
            {clip.video_path ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <Sparkles className="w-8 h-8 text-vault-red mx-auto mb-2 animate-spin" />
                <p className="text-xs text-vault-muted">Clip is being rendered...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Clip Details & Controls */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Header with Close */}
            <div className="flex items-center justify-between pb-4 border-b border-vault-border mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-vault-red/20 text-vault-red font-semibold border border-vault-red/30 uppercase">
                  9:16 VERTICAL CLIP
                </span>
                <span className="text-xs font-mono text-vault-muted">
                  ID: {clip.id.substring(0, 8)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-vault-muted hover:text-white hover:bg-vault-surfaceHover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title Section */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold uppercase text-vault-muted tracking-wider block mb-1">
                Clip Title
              </label>
              {isEditingTitle ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="flex-1 bg-vault-bg border border-vault-border rounded-lg px-3 py-1.5 text-sm text-vault-silverLight focus:border-vault-red focus:outline-none"
                  />
                  <button
                    onClick={handleSaveMetadata}
                    disabled={isSaving}
                    className="px-3 py-1.5 bg-vault-red text-white text-xs font-semibold rounded-lg hover:bg-vault-redHover transition-colors"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between group">
                  <h3 className="text-lg font-bold text-vault-silverLight tracking-tight">
                    {title}
                  </h3>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 text-vault-muted hover:text-vault-silver transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Metadata Pills */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-vault-bg/60 p-3 rounded-xl border border-vault-border">
                <div className="flex items-center text-vault-muted text-xs mb-1">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  <span>Duration</span>
                </div>
                <div className="text-sm font-semibold text-vault-silverLight font-mono">
                  {clip.duration.toFixed(1)}s ({clip.start_time.toFixed(1)}s - {clip.end_time.toFixed(1)}s)
                </div>
              </div>

              <div className="bg-vault-bg/60 p-3 rounded-xl border border-vault-border">
                <div className="flex items-center text-vault-muted text-xs mb-1">
                  <Tag className="w-3.5 h-3.5 mr-1" />
                  <span>Category</span>
                </div>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    api.updateClip(clip.id, { category: e.target.value });
                  }}
                  className="bg-transparent text-sm font-semibold text-vault-silverLight capitalize focus:outline-none cursor-pointer"
                >
                  <option value="funny" className="bg-vault-surface">Funny</option>
                  <option value="rage" className="bg-vault-surface">Rage</option>
                  <option value="hype" className="bg-vault-surface">Hype</option>
                  <option value="emotional" className="bg-vault-surface">Emotional</option>
                  <option value="conversation" className="bg-vault-surface">Conversation</option>
                  <option value="unexpected" className="bg-vault-surface">Unexpected</option>
                </select>
              </div>
            </div>

            {/* Subtitle Style Setting */}
            <div className="mb-5 bg-vault-bg/40 p-4 rounded-xl border border-vault-border">
              <label className="text-xs font-semibold text-vault-silverLight block mb-2">
                Subtitle Typography & Preset
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSubtitleStyle('red_highlight')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    subtitleStyle === 'red_highlight'
                      ? 'border-vault-red bg-vault-red/10 text-vault-silverLight font-bold'
                      : 'border-vault-border text-vault-muted hover:border-vault-borderLight'
                  }`}
                >
                  <div className="font-semibold text-white">Crimson Highlight</div>
                  <div className="text-[10px] text-vault-red font-mono">WHITE + RED WORD EMPHASIS</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubtitleStyle('classic_white')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    subtitleStyle === 'classic_white'
                      ? 'border-vault-red bg-vault-red/10 text-vault-silverLight font-bold'
                      : 'border-vault-border text-vault-muted hover:border-vault-borderLight'
                  }`}
                >
                  <div className="font-semibold text-white">Classic Studio</div>
                  <div className="text-[10px] text-vault-muted font-mono">BOLD BORDERED TEXT</div>
                </button>
              </div>

              <button
                onClick={handleReRender}
                disabled={isReRendering}
                className="mt-3 w-full py-1.5 flex items-center justify-center space-x-2 text-xs font-semibold text-vault-silver hover:text-white bg-vault-surfaceHover rounded-lg border border-vault-border transition-all"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isReRendering ? 'animate-spin' : ''}`} />
                <span>Re-Render Clip with Selected Style</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Approve / Reject / Download */}
          <div className="pt-4 border-t border-vault-border flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleStatusChange('approved')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'bg-vault-surfaceHover text-vault-muted hover:text-emerald-400 border border-vault-border'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Approve</span>
              </button>

              <button
                onClick={() => handleStatusChange('rejected')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  status === 'rejected'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                    : 'bg-vault-surfaceHover text-vault-muted hover:text-rose-400 border border-vault-border'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>

            <a
              href={downloadUrl}
              download={clip.title ? `${clip.title}.mp4` : 'clipvault_clip.mp4'}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-vault-red to-vault-redHover text-white shadow-glow-red hover:brightness-110 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

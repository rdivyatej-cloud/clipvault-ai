import React, { useState, useEffect } from 'react';
import { 
  Film, 
  Play, 
  Download, 
  Trash2, 
  Check, 
  Ban, 
  Search, 
  FolderOpen, 
  RotateCw,
  Sparkles,
  Filter
} from 'lucide-react';
import { Clip } from '../types';
import { api } from '../services/api';

interface GeneratedClipsProps {
  onSelectClip: (clip: Clip) => void;
  onRefresh?: () => void;
}

export const GeneratedClips: React.FC<GeneratedClipsProps> = ({ onSelectClip, onRefresh }) => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadClips();
  }, []);

  const loadClips = async () => {
    setLoading(true);
    try {
      const list = await api.getClips();
      setClips(list);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to load clips', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this clip?')) return;
    try {
      await api.deleteClip(id);
      setClips((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete clip', err);
    }
  };

  const handleStatusToggle = async (
    e: React.MouseEvent,
    id: string,
    newStatus: 'approved' | 'rejected'
  ) => {
    e.stopPropagation();
    try {
      const res = await api.updateClip(id, { status: newStatus });
      if (res.success && res.clip) {
        setClips((prev) => prev.map((c) => (c.id === id ? res.clip : c)));
      }
    } catch (err) {
      console.error('Failed to update clip status', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await api.openOutputFolder();
    } catch (e) {
      console.error('Failed to open output folder', e);
    }
  };

  const filteredClips = clips.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.project_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-vault-surface p-5 rounded-2xl border border-vault-border">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-vault-muted absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search clips by title or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-vault-bg border border-vault-border rounded-xl pl-9 pr-4 py-2 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silver font-semibold focus:border-vault-red focus:outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="funny">Funny</option>
            <option value="rage">Rage</option>
            <option value="hype">Hype</option>
            <option value="emotional">Emotional</option>
            <option value="conversation">Conversation</option>
            <option value="unexpected">Unexpected</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-vault-bg border border-vault-border rounded-xl px-3 py-2 text-xs text-vault-silver font-semibold focus:border-vault-red focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rendered">Rendered</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Open Output Folder */}
          <button
            onClick={handleOpenFolder}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-vault-surfaceHover text-vault-silver hover:text-white border border-vault-border hover:border-vault-borderLight transition-all"
          >
            <FolderOpen className="w-4 h-4 text-vault-red" />
            <span>Open in Explorer</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center rounded-2xl bg-vault-surface border border-vault-border">
          <RotateCw className="w-8 h-8 text-vault-red mx-auto mb-2 animate-spin" />
          <p className="text-xs text-vault-muted">Loading clip library...</p>
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-vault-surface border border-vault-border">
          <Film className="w-12 h-12 text-vault-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-vault-silverLight">No clips match your filters</h3>
          <p className="text-xs text-vault-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or head to the Video Analysis page to render clips.
          </p>
        </div>
      ) : (
        /* Vertical 9:16 Video Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredClips.map((clip) => {
            const thumbUrl = clip.thumbnail_path ? api.getThumbnailUrl(clip.thumbnail_path) : '';
            const downloadUrl = clip.video_path ? api.getDownloadUrl(clip.video_path) : '#';

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip)}
                className="group cursor-pointer rounded-2xl overflow-hidden bg-vault-surface border border-vault-border hover:border-vault-red/50 transition-all duration-300 flex flex-col hover:shadow-glow-red hover:-translate-y-1"
              >
                {/* 9:16 Poster */}
                <div className="aspect-[9/16] bg-vault-bg relative overflow-hidden flex items-center justify-center">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={clip.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Film className="w-10 h-10 text-vault-muted opacity-40" />
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-vault-red/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 ml-0.5 fill-white" />
                    </div>
                  </div>

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-black/80 text-vault-silverLight border border-white/10 uppercase">
                      {clip.category}
                    </span>

                    {clip.status === 'approved' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  {/* Bottom Duration Badge */}
                  <div className="absolute bottom-2.5 right-2.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/80 text-vault-silverLight border border-white/10">
                      {clip.duration.toFixed(0)}s
                    </span>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="text-xs font-bold text-vault-silverLight group-hover:text-white transition-colors line-clamp-2">
                      {clip.title}
                    </h4>
                    <p className="text-[10px] text-vault-muted truncate mt-0.5">
                      {clip.project_name || 'Stream Clip'}
                    </p>
                  </div>

                  {/* Quick Card Controls */}
                  <div className="pt-2 border-t border-vault-border/60 flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <button
                        title="Approve"
                        onClick={(e) => handleStatusToggle(e, clip.id, 'approved')}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          clip.status === 'approved'
                            ? 'text-emerald-400 bg-emerald-500/20'
                            : 'text-vault-muted hover:text-emerald-400 hover:bg-vault-surfaceHover'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Reject"
                        onClick={(e) => handleStatusToggle(e, clip.id, 'rejected')}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          clip.status === 'rejected'
                            ? 'text-rose-400 bg-rose-500/20'
                            : 'text-vault-muted hover:text-rose-400 hover:bg-vault-surfaceHover'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Delete"
                        onClick={(e) => handleDelete(e, clip.id)}
                        className="p-1.5 rounded-lg text-xs text-vault-muted hover:text-rose-400 hover:bg-vault-surfaceHover transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <a
                      href={downloadUrl}
                      download={`${clip.title || 'clip'}.mp4`}
                      onClick={(e) => e.stopPropagation()}
                      title="Download MP4"
                      className="p-1.5 rounded-lg text-vault-silver hover:text-white bg-vault-surfaceHover hover:bg-vault-red/20 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


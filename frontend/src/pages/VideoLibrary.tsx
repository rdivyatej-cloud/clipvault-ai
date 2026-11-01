import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Video, 
  Trash2, 
  RotateCw, 
  ArrowRight, 
  HardDrive, 
  Clock, 
  Film,
  Sparkles
} from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';

interface VideoLibraryProps {
  onSelectProject: (id: string) => void;
  setActiveTab: (tab: string) => void;
  onRefresh?: () => void;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  onSelectProject,
  setActiveTab,
  onRefresh,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await api.getProjects();
      setProjects(list);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to load video library', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}" and all its data?`)) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleReAnalyze = async (id: string) => {
    try {
      await api.analyzeProject(id);
      setActiveTab('queue');
    } catch (err) {
      console.error('Failed to trigger analysis', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-vault-surface rounded-2xl border border-vault-border">
        <div>
          <h2 className="text-xl font-extrabold text-vault-silverLight tracking-tight flex items-center space-x-2">
            <Library className="w-5 h-5 text-vault-red" />
            <span>Imported Stream Video Library</span>
          </h2>
          <p className="text-xs text-vault-muted mt-1">
            Manage your local stream footage, video metadata, and analysis states.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('new-project')}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-vault-red text-white hover:bg-vault-redHover shadow-glow-red transition-all"
        >
          Import Video
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center rounded-2xl bg-vault-surface border border-vault-border">
          <RotateCw className="w-8 h-8 text-vault-red mx-auto mb-2 animate-spin" />
          <p className="text-xs text-vault-muted">Loading video library...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-vault-surface border border-vault-border">
          <Video className="w-12 h-12 text-vault-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-vault-silverLight">No videos in your library</h3>
          <p className="text-xs text-vault-muted mt-1 max-w-sm mx-auto">
            Upload your first stream recording or point to a local file to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-vault-surface border border-vault-border hover:border-vault-red/40 transition-all flex flex-col justify-between shadow-card space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="p-2.5 rounded-xl bg-vault-bg border border-vault-border text-vault-red">
                    <Video className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      p.status === 'analyzed'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : p.status === 'analyzing'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                        : 'bg-vault-bg text-vault-muted border-vault-border'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-vault-silverLight group-hover:text-white transition-colors line-clamp-1">
                  {p.name}
                </h3>
                <p className="text-[11px] font-mono text-vault-muted truncate mt-0.5">
                  {p.source_path}
                </p>
              </div>

              {/* Specs Pills */}
              <div className="grid grid-cols-3 gap-2 text-[11px] bg-vault-bg/60 p-2.5 rounded-xl border border-vault-border font-mono text-center">
                <div>
                  <div className="text-vault-muted text-[10px]">DURATION</div>
                  <div className="text-vault-silverLight font-bold">
                    {Math.floor(p.duration / 60)}m {Math.floor(p.duration % 60)}s
                  </div>
                </div>
                <div>
                  <div className="text-vault-muted text-[10px]">CLIPS</div>
                  <div className="text-vault-red font-bold">{p.clips_count || 0}</div>
                </div>
                <div>
                  <div className="text-vault-muted text-[10px]">RESOLUTION</div>
                  <div className="text-vault-silverLight font-bold">
                    {p.width ? `${p.width}p` : 'HD'}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-vault-border flex items-center justify-between gap-2">
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="p-2 rounded-lg text-vault-muted hover:text-rose-400 hover:bg-vault-surfaceHover transition-colors"
                  title="Delete Video Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReAnalyze(p.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-vault-surfaceHover text-vault-silver hover:text-white border border-vault-border transition-colors flex items-center space-x-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Re-Analyze</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectProject(p.id);
                      setActiveTab('video-analysis');
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-vault-red text-white hover:bg-vault-redHover shadow-glow-red transition-all flex items-center space-x-1"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

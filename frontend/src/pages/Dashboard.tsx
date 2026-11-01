import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Film, 
  CheckCircle2, 
  Clock, 
  Flame, 
  ArrowRight, 
  Play, 
  Sparkles,
  TrendingUp,
  Cpu,
  PlusCircle
} from 'lucide-react';
import { SystemStats, Project, Clip } from '../types';
import { api } from '../services/api';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  setSelectedProject: (id: string) => void;
  setSelectedClip: (clip: Clip) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
  setSelectedProject,
  setSelectedClip,
}) => {
  const [stats, setStats] = useState<SystemStats>({
    total_projects: 0,
    total_clips: 0,
    total_approved: 0,
    queued_jobs: 0,
    processing_jobs: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const data = await api.getStats();
      if (data.success) {
        setStats(data.stats);
        setRecentProjects(data.recent_projects || []);
        setRecentClips(data.recent_clips || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Videos Processed',
      value: stats.total_projects,
      icon: Video,
      color: 'from-blue-500/20 to-blue-600/5',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Generated 9:16 Clips',
      value: stats.total_clips,
      icon: Film,
      color: 'from-vault-red/20 to-vault-redDark/10',
      borderColor: 'border-vault-red/40',
      iconColor: 'text-vault-red',
    },
    {
      title: 'Approved for Publishing',
      value: stats.total_approved,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-emerald-600/5',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Active Processing Queue',
      value: stats.queued_jobs + stats.processing_jobs,
      icon: Clock,
      color: 'from-amber-500/20 to-amber-600/5',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Studio Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-vault-surface to-vault-bg border border-vault-border p-8 shadow-card">
        <div className="absolute top-0 right-0 w-96 h-96 bg-vault-red/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-vault-red/15 border border-vault-red/30 text-vault-red text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Local AI Streamer Studio</span>
          </div>
          <h1 className="text-3xl font-extrabold text-vault-silverLight tracking-tight mb-2">
            Turn Full Stream VODs into <span className="text-vault-red">Viral Clips</span> In Seconds.
          </h1>
          <p className="text-sm text-vault-muted mb-6 leading-relaxed">
            Multi-modal local intelligence powered by faster-whisper, audio excitement tracking, OpenCV visual activity, and Qwen 2.5 3B. Runs 100% locally with zero cloud API costs.
          </p>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('new-project')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-vault-red to-vault-redHover text-white shadow-glow-red hover:brightness-110 active:scale-95 transition-all flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Import New Video</span>
            </button>
            <button
              onClick={() => setActiveTab('clips')}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-vault-surfaceHover text-vault-silver hover:text-white border border-vault-border hover:border-vault-borderLight transition-all flex items-center space-x-2"
            >
              <Film className="w-4 h-4" />
              <span>Browse All Clips</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} bg-vault-surface border ${card.borderColor} shadow-card relative overflow-hidden transition-all duration-300 hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-vault-muted uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl bg-vault-bg/60 border border-vault-border ${card.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-vault-silverLight tracking-tight font-mono">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Processing Alert */}
      {(stats.processing_jobs > 0 || stats.queued_jobs > 0) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <div className="text-sm font-semibold text-vault-silverLight">
                Processing Queue Active ({stats.processing_jobs} running, {stats.queued_jobs} queued)
              </div>
              <div className="text-xs text-vault-muted">
                Optimized sequential processing on Intel Core i5-11320H. UI remains fully responsive.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('queue')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
          >
            View Queue
          </button>
        </div>
      )}

      {/* Recent 9:16 Clips Carousel / Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-vault-red" />
            <h3 className="text-lg font-bold text-vault-silverLight">Recently Generated Clips</h3>
          </div>
          <button
            onClick={() => setActiveTab('clips')}
            className="text-xs text-vault-muted hover:text-vault-red font-semibold flex items-center space-x-1 transition-colors"
          >
            <span>View All ({stats.total_clips})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentClips.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-vault-surface border border-vault-border">
            <Film className="w-12 h-12 text-vault-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-vault-silver font-medium">No clips generated yet</p>
            <p className="text-xs text-vault-muted mt-1 max-w-sm mx-auto">
              Import a video to let local AI transcribe and automatically extract viral moments.
            </p>
            <button
              onClick={() => setActiveTab('new-project')}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-vault-red text-white hover:bg-vault-redHover shadow-glow-red transition-all"
            >
              Start First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recentClips.map((clip) => {
              const thumbUrl = clip.thumbnail_path ? api.getThumbnailUrl(clip.thumbnail_path) : '';
              return (
                <div
                  key={clip.id}
                  onClick={() => setSelectedClip(clip)}
                  className="group cursor-pointer rounded-xl overflow-hidden bg-vault-surface border border-vault-border hover:border-vault-red/50 transition-all duration-300 flex flex-col hover:shadow-glow-red"
                >
                  <div className="aspect-[9/16] bg-vault-bg relative overflow-hidden flex items-center justify-center">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={clip.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Film className="w-8 h-8 text-vault-muted opacity-50" />
                    )}
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-vault-red/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 ml-0.5 fill-white" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-black/70 text-vault-silverLight uppercase">
                        {clip.category}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-vault-silverLight">
                        {clip.duration.toFixed(0)}s
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <h4 className="text-xs font-semibold text-vault-silverLight truncate">
                      {clip.title}
                    </h4>
                    <p className="text-[10px] text-vault-muted truncate mt-0.5">
                      {clip.project_name || 'Project'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Projects Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-vault-silver" />
            <h3 className="text-lg font-bold text-vault-silverLight">Recent Stream Projects</h3>
          </div>
          <button
            onClick={() => setActiveTab('library')}
            className="text-xs text-vault-muted hover:text-vault-silverLight font-semibold flex items-center space-x-1 transition-colors"
          >
            <span>View All ({stats.total_projects})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-vault-surface border border-vault-border text-vault-muted text-xs">
            No projects found. Import a video above to begin!
          </div>
        ) : (
          <div className="rounded-2xl bg-vault-surface border border-vault-border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-vault-bg/60 text-vault-muted uppercase tracking-wider text-[10px] border-b border-vault-border">
                <tr>
                  <th className="py-3 px-5">Project Name</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Resolution</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Clips</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border">
                {recentProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-vault-surfaceHover transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-vault-silverLight flex items-center space-x-2">
                      <Video className="w-4 h-4 text-vault-red shrink-0" />
                      <span className="truncate max-w-xs">{p.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-vault-silver">
                      {Math.floor(p.duration / 60)}m {Math.floor(p.duration % 60)}s
                    </td>
                    <td className="py-3.5 px-4 font-mono text-vault-muted">
                      {p.width ? `${p.width}x${p.height}` : 'Probing...'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.status === 'analyzed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : p.status === 'analyzing'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-vault-bg text-vault-muted border border-vault-border'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-vault-silver">
                      {p.clips_count || 0}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => {
                          setSelectedProject(p.id);
                          setActiveTab('video-analysis');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-vault-surfaceHover text-vault-silverLight hover:text-white border border-vault-border hover:border-vault-red/50 transition-colors"
                      >
                        Open Studio
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  Play, 
  Pause, 
  Sparkles, 
  Film, 
  Search, 
  Clock, 
  Tag, 
  Zap, 
  Eye, 
  Volume2, 
  MessageSquare,
  RotateCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Project, CandidateMoment, Transcript, Clip } from '../types';
import { api } from '../services/api';

interface VideoAnalysisProps {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string) => void;
  setActiveTab: (tab: string) => void;
  setSelectedClip: (clip: Clip) => void;
}

export const VideoAnalysis: React.FC<VideoAnalysisProps> = ({
  selectedProjectId,
  setSelectedProjectId,
  setActiveTab,
  setSelectedClip,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectData, setProjectData] = useState<{
    project: Project;
    transcript: Transcript | null;
    moments: CandidateMoment[];
    clips: Clip[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [renderingMomentId, setRenderingMomentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const list = await api.getProjects();
      setProjects(list);
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const loadProjectDetails = async (id: string) => {
    setLoading(true);
    try {
      const data = await api.getProject(id);
      if (data.success) {
        setProjectData(data);
      }
    } catch (err) {
      console.error('Failed to load project details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleRenderMoment = async (moment: CandidateMoment) => {
    if (!selectedProjectId) return;
    setRenderingMomentId(moment.id);
    try {
      const res = await api.renderMoment(moment.id, selectedProjectId);
      if (res.success) {
        setActiveTab('queue');
      }
    } catch (err) {
      console.error('Failed to render moment', err);
    } finally {
      setRenderingMomentId(null);
    }
  };

  // Filter moments
  const moments = projectData?.moments || [];
  const filteredMoments = moments.filter((m) => {
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.transcript_excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Filter transcript segments
  const segments = projectData?.transcript?.segments || [];
  const filteredSegments = segments.filter((s) =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'funny':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'rage':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'hype':
        return 'bg-vault-red/20 text-vault-red border-vault-red/30';
      case 'emotional':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Bar: Project Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-vault-surface p-4 rounded-2xl border border-vault-border">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Film className="w-5 h-5 text-vault-red shrink-0" />
          <div className="w-full sm:w-80">
            <label className="text-[10px] uppercase font-bold text-vault-muted block tracking-wider">
              Active Video Studio
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-vault-bg border border-vault-border rounded-lg px-2.5 py-1.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none font-semibold truncate cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Math.floor(p.duration / 60)}m {Math.floor(p.duration % 60)}s)
                </option>
              ))}
            </select>
          </div>
        </div>

        {projectData?.project && (
          <div className="flex items-center space-x-4 text-xs font-mono text-vault-muted">
            <div>
              <span>Moments:</span>{' '}
              <span className="text-vault-silver font-bold">{moments.length}</span>
            </div>
            <div>
              <span>Clips:</span>{' '}
              <span className="text-vault-red font-bold">{projectData.clips.length}</span>
            </div>
            <div>
              <span>Status:</span>{' '}
              <span className="uppercase font-bold text-emerald-400">
                {projectData.project.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center rounded-2xl bg-vault-surface border border-vault-border">
          <RotateCw className="w-8 h-8 text-vault-red mx-auto mb-2 animate-spin" />
          <p className="text-xs text-vault-muted">Loading project analysis & transcript...</p>
        </div>
      ) : !projectData ? (
        <div className="p-12 text-center rounded-2xl bg-vault-surface border border-vault-border">
          <p className="text-sm text-vault-muted">No projects found. Create a project to begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Video Player & Transcript (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Source Video Player */}
            <div className="bg-vault-surface rounded-2xl border border-vault-border overflow-hidden shadow-card">
              <div className="aspect-video bg-black relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={api.getMediaStreamUrl(projectData.project.source_path, 'source')}
                  controls
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-3 bg-vault-bg/60 border-t border-vault-border flex items-center justify-between text-xs font-mono">
                <div className="text-vault-muted truncate max-w-[200px]">
                  {projectData.project.name}
                </div>
                <div className="text-vault-silverLight font-bold">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')} /{' '}
                  {Math.floor(projectData.project.duration / 60)}:
                  {(projectData.project.duration % 60).toFixed(0).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Timestamped Transcript Viewer */}
            <div className="bg-vault-surface rounded-2xl border border-vault-border p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-vault-border pb-3">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-vault-silver" />
                  <span className="text-xs font-bold text-vault-silverLight uppercase tracking-wider">
                    Full AI Speech Transcript
                  </span>
                </div>
                <span className="text-[10px] font-mono text-vault-muted">
                  {segments.length} segments
                </span>
              </div>

              {/* Transcript Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-vault-muted absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search spoken words or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-vault-bg border border-vault-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-vault-silverLight focus:border-vault-red focus:outline-none"
                />
              </div>

              {/* Segment List */}
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 divide-y divide-vault-border/50">
                {filteredSegments.length === 0 ? (
                  <p className="text-xs text-vault-muted text-center py-6">
                    No transcript segments match your search.
                  </p>
                ) : (
                  filteredSegments.map((seg) => {
                    const isCurrent =
                      currentTime >= seg.start && currentTime <= seg.end;
                    return (
                      <div
                        key={seg.id}
                        onClick={() => handleSeek(seg.start)}
                        className={`pt-2 p-2 rounded-lg cursor-pointer text-xs transition-all ${
                          isCurrent
                            ? 'bg-vault-red/15 border-l-2 border-vault-red text-white'
                            : 'hover:bg-vault-surfaceHover text-vault-silver/90'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-vault-muted mb-0.5">
                          <span>
                            {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                          </span>
                          {isCurrent && (
                            <span className="text-vault-red font-bold animate-pulse">
                              NOW PLAYING
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed">{seg.text}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Ranked Candidate Moments (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-vault-surface p-4 rounded-2xl border border-vault-border">
              <div>
                <h3 className="text-sm font-extrabold text-vault-silverLight uppercase tracking-wider flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-vault-red" />
                  <span>Ranked Viral Moments ({filteredMoments.length})</span>
                </h3>
                <p className="text-[11px] text-vault-muted">
                  Scored via multi-modal AI: Audio Energy + Scene Cuts + Qwen 2.5 3B
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto text-xs pb-1 sm:pb-0">
                {['all', 'funny', 'rage', 'hype', 'emotional', 'conversation'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-all ${
                      selectedCategory === cat
                        ? 'bg-vault-red text-white shadow-glow-red'
                        : 'bg-vault-bg text-vault-muted hover:text-vault-silver border border-vault-border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Moments List */}
            <div className="space-y-3.5">
              {filteredMoments.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-vault-surface border border-vault-border">
                  <AlertCircle className="w-8 h-8 text-vault-muted mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-vault-muted">
                    No candidate moments found. Click Analyze to process moments.
                  </p>
                </div>
              ) : (
                filteredMoments.map((m, index) => {
                  const isRendering = renderingMomentId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="p-5 rounded-2xl bg-vault-surface border border-vault-border hover:border-vault-red/40 transition-all shadow-card space-y-3 relative overflow-hidden group"
                    >
                      {/* Ranking Badge & Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-6 h-6 rounded-full bg-vault-bg border border-vault-border flex items-center justify-center text-xs font-mono font-bold text-vault-red">
                            #{index + 1}
                          </span>
                          <div>
                            <h4 className="text-base font-bold text-vault-silverLight group-hover:text-white transition-colors">
                              {m.title}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getCategoryColor(
                                  m.category
                                )}`}
                              >
                                {m.category}
                              </span>
                              <span className="text-[11px] font-mono text-vault-muted">
                                {m.start_time.toFixed(1)}s - {m.end_time.toFixed(1)}s ({m.duration.toFixed(1)}s)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Composite Score Circle */}
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black font-mono text-vault-silverLight">
                            {m.score}
                          </div>
                          <span className="text-[9px] uppercase font-bold text-vault-red tracking-wider block -mt-1">
                            VIRAL SCORE
                          </span>
                        </div>
                      </div>

                      {/* Multi-modal breakdown metric pills */}
                      <div className="grid grid-cols-3 gap-2 text-[11px] bg-vault-bg/60 p-2.5 rounded-xl border border-vault-border font-mono">
                        <div className="flex items-center space-x-1.5 text-vault-muted">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Hook:</span>
                          <span className="text-vault-silverLight font-bold">
                            {m.hook_strength}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-vault-muted">
                          <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Audio:</span>
                          <span className="text-vault-silverLight font-bold">
                            {m.audio_intensity}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-vault-muted">
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>Visual:</span>
                          <span className="text-vault-silverLight font-bold">
                            {m.visual_activity}
                          </span>
                        </div>
                      </div>

                      {/* AI Explanation & Transcript Excerpt */}
                      <div className="text-xs space-y-1.5">
                        <p className="text-vault-muted italic">"{m.explanation}"</p>
                        {m.transcript_excerpt && (
                          <p className="text-vault-silver/80 text-[11px] bg-vault-bg/30 p-2 rounded-lg border border-vault-border/60">
                            <span className="text-vault-red font-semibold">Transcript:</span>{' '}
                            {m.transcript_excerpt}
                          </p>
                        )}
                      </div>

                      {/* Moment Actions */}
                      <div className="pt-2 flex items-center justify-between border-t border-vault-border/60">
                        <button
                          onClick={() => handleSeek(m.start_time)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-vault-surfaceHover text-vault-silver hover:text-white border border-vault-border transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Preview on Timeline</span>
                        </button>

                        <button
                          onClick={() => handleRenderMoment(m)}
                          disabled={isRendering}
                          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-vault-red to-vault-redHover text-white shadow-glow-red hover:brightness-110 active:scale-95 transition-all"
                        >
                          {isRendering ? (
                            <>
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Enqueuing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Render 9:16 Vertical Clip</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


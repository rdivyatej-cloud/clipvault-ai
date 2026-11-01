import React, { useState, useEffect } from 'react';
import { 
  ListOrdered, 
  RotateCw, 
  XCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Terminal,
  Activity,
  Layers
} from 'lucide-react';
import { Job } from '../types';
import { api } from '../services/api';

interface ProcessingQueueProps {
  onRefresh?: () => void;
}

export const ProcessingQueue: React.FC<ProcessingQueueProps> = ({ onRefresh }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadJobs();
    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(loadJobs, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadJobs = async () => {
    try {
      const list = await api.getJobs();
      setJobs(list);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to load jobs', err);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.retryJob(id);
      loadJobs();
    } catch (err) {
      console.error('Failed to retry job', err);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.cancelJob(id);
      loadJobs();
    } catch (err) {
      console.error('Failed to cancel job', err);
    }
  };

  const activeJob = jobs.find((j) => j.status === 'processing');
  const queuedJobs = jobs.filter((j) => j.status === 'queued');
  const completedOrFailedJobs = jobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-vault-silverLight tracking-tight flex items-center space-x-2">
            <ListOrdered className="w-5 h-5 text-vault-red" />
            <span>Sequential Processing Queue</span>
          </h2>
          <p className="text-xs text-vault-muted mt-1">
            Strict single-video execution protects 16 GB RAM & CPU from thermal throttling.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <label className="flex items-center space-x-2 text-vault-silver cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded accent-vault-red"
            />
            <span>Auto-poll (2s)</span>
          </label>

          <button
            onClick={loadJobs}
            className="p-2 bg-vault-surfaceHover rounded-lg border border-vault-border text-vault-muted hover:text-white transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Currently Active Job Card */}
      {activeJob && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-vault-surface to-vault-surfaceHover border-2 border-vault-red/50 shadow-glow-red space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-vault-red/20 text-vault-red animate-pulse">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-vault-red font-mono tracking-wider">
                  CURRENTLY EXECUTING ON CPU
                </span>
                <h3 className="text-base font-bold text-vault-silverLight">
                  {activeJob.project_name || 'Project Analysis Job'}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-vault-silverLight">
                {activeJob.progress}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-vault-bg h-3 rounded-full overflow-hidden border border-vault-border">
              <div
                className="bg-gradient-to-r from-vault-red to-vault-redHover h-full transition-all duration-500 rounded-full"
                style={{ width: `${activeJob.progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs font-mono text-vault-silver">
              <span>{activeJob.current_step || 'Processing...'}</span>
              <span className="text-vault-muted">Job ID: {activeJob.id.substring(0, 8)}</span>
            </div>
          </div>

          {/* Pipeline Stage Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
            <div
              className={`p-2 rounded-lg border text-center ${
                activeJob.progress >= 25
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-vault-bg border-vault-border text-vault-muted'
              }`}
            >
              1. Audio Extraction
            </div>
            <div
              className={`p-2 rounded-lg border text-center ${
                activeJob.progress >= 45
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-vault-bg border-vault-border text-vault-muted'
              }`}
            >
              2. Whisper Speech
            </div>
            <div
              className={`p-2 rounded-lg border text-center ${
                activeJob.progress >= 70
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-vault-bg border-vault-border text-vault-muted'
              }`}
            >
              3. Qwen & Audio AI
            </div>
            <div
              className={`p-2 rounded-lg border text-center ${
                activeJob.progress >= 85
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-vault-bg border-vault-border text-vault-muted'
              }`}
            >
              4. 9:16 FFmpeg Render
            </div>
          </div>
        </div>
      )}

      {/* Queued Jobs */}
      {queuedJobs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-vault-muted flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Queued For Processing ({queuedJobs.length})</span>
          </h3>
          <div className="space-y-2">
            {queuedJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-vault-surface border border-vault-border flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-vault-silverLight">
                    {job.project_name || 'Project'} • {job.type}
                  </h4>
                  <p className="text-[11px] font-mono text-vault-muted">
                    Queued at {new Date(job.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => handleCancel(job.id)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finished / Historical Jobs */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-vault-muted flex items-center space-x-2">
          <Layers className="w-4 h-4 text-vault-silver" />
          <span>Job History & Logs</span>
        </h3>

        {completedOrFailedJobs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-vault-surface border border-vault-border text-xs text-vault-muted">
            No completed jobs yet.
          </div>
        ) : (
          <div className="rounded-2xl bg-vault-surface border border-vault-border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-vault-bg/60 text-vault-muted uppercase tracking-wider text-[10px] border-b border-vault-border">
                <tr>
                  <th className="py-3 px-5">Job ID</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Step / Message</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border">
                {completedOrFailedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-vault-surfaceHover transition-colors">
                    <td className="py-3 px-5 font-mono text-vault-muted">
                      {job.id.substring(0, 8)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-vault-silverLight truncate max-w-xs">
                      {job.project_name || 'Project'}
                    </td>
                    <td className="py-3 px-4 capitalize font-mono text-vault-silver">
                      {job.type}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : job.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-vault-bg text-vault-muted border border-vault-border'
                        }`}
                      >
                        {job.status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : job.status === 'failed' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{job.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-vault-muted max-w-xs truncate">
                      {job.error_message || job.current_step}
                    </td>
                    <td className="py-3 px-5 text-right">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-vault-surfaceHover text-vault-silverLight hover:text-white border border-vault-border hover:border-vault-red transition-colors"
                        >
                          Retry
                        </button>
                      )}
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

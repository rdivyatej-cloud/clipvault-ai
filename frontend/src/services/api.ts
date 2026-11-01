import { Project, Clip, Job, CandidateMoment, Transcript, SystemStats } from '../types';

const BASE_URL = '/api';

export const api = {
  // System & Stats
  async getStats(): Promise<{ success: boolean; stats: SystemStats; recent_projects: Project[]; recent_clips: Clip[] }> {
    const res = await fetch(`${BASE_URL}/system/stats`);
    const json = await res.json();
    return json;
  },

  async getDiagnostics(): Promise<any> {
    const res = await fetch(`${BASE_URL}/system/diagnostics`);
    return res.json();
  },

  async openOutputFolder(): Promise<any> {
    const res = await fetch(`${BASE_URL}/system/open-output`, { method: 'POST' });
    return res.json();
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${BASE_URL}/projects`);
    const json = await res.json();
    return json.projects || [];
  },

  async getProject(id: string): Promise<{
    success: boolean;
    project: Project;
    transcript: Transcript | null;
    moments: CandidateMoment[];
    clips: Clip[];
    jobs: Job[];
  }> {
    const res = await fetch(`${BASE_URL}/projects/${id}`);
    return res.json();
  },

  async uploadProject(formData: FormData): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async importLocalProject(filePath: string, name?: string, autoAnalyze: boolean = true): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, name, auto_analyze: autoAnalyze }),
    });
    return res.json();
  },

  async validateUrl(url: string, name?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name }),
    });
    return res.json();
  },

  async analyzeProject(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/${id}/analyze`, { method: 'POST' });
    return res.json();
  },

  async deleteProject(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/projects/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Jobs
  async getJobs(): Promise<Job[]> {
    const res = await fetch(`${BASE_URL}/jobs`);
    const json = await res.json();
    return json.jobs || [];
  },

  async retryJob(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/jobs/${id}/retry`, { method: 'POST' });
    return res.json();
  },

  async cancelJob(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/jobs/${id}/cancel`, { method: 'POST' });
    return res.json();
  },

  // Clips
  async getClips(filter?: { status?: string; category?: string; project_id?: string }): Promise<Clip[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.category) params.append('category', filter.category);
    if (filter?.project_id) params.append('project_id', filter.project_id);

    const res = await fetch(`${BASE_URL}/clips?${params.toString()}`);
    const json = await res.json();
    return json.clips || [];
  },

  async renderMoment(momentId: string, projectId: string, subtitleStyle: string = 'red_highlight'): Promise<any> {
    const res = await fetch(`${BASE_URL}/clips/from-moment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moment_id: momentId, project_id: projectId, subtitle_style: subtitleStyle }),
    });
    return res.json();
  },

  async updateClip(id: string, updates: Partial<Clip>): Promise<any> {
    const res = await fetch(`${BASE_URL}/clips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async reRenderClip(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/clips/${id}/render`, { method: 'POST' });
    return res.json();
  },

  async deleteClip(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/clips/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    const res = await fetch(`${BASE_URL}/settings`);
    const json = await res.json();
    return json.settings || {};
  },

  async updateSettings(settings: Record<string, string>): Promise<any> {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // Helpers
  getMediaStreamUrl(filename: string, type: 'source' | 'clip' = 'clip'): string {
    return `${BASE_URL}/media/stream/${type}/${encodeURIComponent(filename)}`;
  },

  getThumbnailUrl(filename: string): string {
    return `${BASE_URL}/media/thumbnail/${encodeURIComponent(filename)}`;
  },

  getDownloadUrl(filename: string): string {
    return `${BASE_URL}/media/download/${encodeURIComponent(filename)}`;
  },
};

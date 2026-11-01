export interface Project {
  id: string;
  name: string;
  source_type: 'file' | 'url';
  source_path: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  file_size: number;
  status: 'created' | 'analyzing' | 'analyzed' | 'error';
  created_at: string;
  updated_at: string;
  clips_count?: number;
  moments_count?: number;
  latest_job_id?: string;
  latest_job_status?: string;
  latest_job_progress?: number;
  latest_job_step?: string;
}

export interface CandidateMoment {
  id: string;
  project_id: string;
  title: string;
  category: 'funny' | 'rage' | 'hype' | 'emotional' | 'conversation' | 'clutch' | 'unexpected';
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  hook_strength: number;
  audio_intensity: number;
  visual_activity: number;
  semantic_score: number;
  explanation: string;
  transcript_excerpt: string;
  created_at: string;
}

export interface Clip {
  id: string;
  project_id: string;
  moment_id?: string;
  title: string;
  category: string;
  start_time: number;
  end_time: number;
  duration: number;
  video_path: string | null;
  thumbnail_path: string | null;
  file_size: number;
  status: 'pending' | 'rendering' | 'rendered' | 'approved' | 'rejected' | 'error';
  subtitle_style: string;
  aspect_ratio: string;
  created_at: string;
  project_name?: string;
}

export interface Job {
  id: string;
  project_id: string;
  type: 'analysis' | 'render_clip';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: string;
  clip_id?: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  project_name?: string;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: {
    word: string;
    start: number;
    end: number;
    probability: number;
  }[];
}

export interface Transcript {
  id: string;
  project_id: string;
  language: string;
  full_text: string;
  segments: TranscriptSegment[];
}

export interface SystemStats {
  total_projects: number;
  total_clips: number;
  total_approved: number;
  queued_jobs: number;
  processing_jobs: number;
}

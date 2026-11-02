import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ClipPlayerModal } from './components/ClipPlayerModal';

import { Dashboard } from './pages/Dashboard';
import { NewProject } from './pages/NewProject';
import { VideoAnalysis } from './pages/VideoAnalysis';
import { ProcessingQueue } from './pages/ProcessingQueue';
import { GeneratedClips } from './pages/GeneratedClips';
import { VideoLibrary } from './pages/VideoLibrary';
import { Settings } from './pages/Settings';

import { Clip } from './types';
import { api } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);

  const fetchActiveJobs = async () => {
    try {
      const data = await api.getStats();
      if (data.success && data.stats) {
        setActiveJobsCount(data.stats.queued_jobs + data.stats.processing_jobs);
      }
    } catch {
      // Ignore poll failures when server is starting
    }
  };

  useEffect(() => {
    fetchActiveJobs();
    const interval = setInterval(fetchActiveJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Dashboard', subtitle: 'Studio overview, real-time KPI metrics & recent clips' };
      case 'new-project':
        return { title: 'New Project', subtitle: 'Import authorized stream VOD or local gameplay recording' };
      case 'video-analysis':
        return { title: 'Video Analysis Studio', subtitle: 'Timeline waveform, AI transcript & ranked viral moments' };
      case 'queue':
        return { title: 'Processing Queue', subtitle: 'Sequential CPU execution queue & pipeline logs' };
      case 'clips':
        return { title: 'Generated 9:16 Clips', subtitle: 'Vertical clip library, subtitle styles & download manager' };
      case 'library':
        return { title: 'Video Library', subtitle: 'Manage imported stream footage and projects' };
      case 'settings':
        return { title: 'Engine Settings', subtitle: 'Configure faster-whisper, Ollama Qwen 2.5 1.5B & FFmpeg' };
      default:
        return { title: 'CLIPVAULT AI', subtitle: 'Streamer Studio' };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <div className="flex bg-vault-bg text-vault-silver min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeJobsCount={activeJobsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onQuickImport={() => setActiveTab('new-project')}
          activeJobsCount={activeJobsCount}
          onRefresh={fetchActiveJobs}
        />

        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              setActiveTab={setActiveTab}
              setSelectedProject={(id) => {
                setSelectedProjectId(id);
                setActiveTab('video-analysis');
              }}
              setSelectedClip={setSelectedClip}
            />
          )}

          {activeTab === 'new-project' && (
            <NewProject
              setActiveTab={setActiveTab}
              setSelectedProject={(id) => {
                setSelectedProjectId(id);
              }}
            />
          )}

          {activeTab === 'video-analysis' && (
            <VideoAnalysis
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              setActiveTab={setActiveTab}
              setSelectedClip={setSelectedClip}
            />
          )}

          {activeTab === 'queue' && (
            <ProcessingQueue onRefresh={fetchActiveJobs} />
          )}

          {activeTab === 'clips' && (
            <GeneratedClips
              onSelectClip={setSelectedClip}
              onRefresh={fetchActiveJobs}
            />
          )}

          {activeTab === 'library' && (
            <VideoLibrary
              onSelectProject={(id) => {
                setSelectedProjectId(id);
              }}
              setActiveTab={setActiveTab}
              onRefresh={fetchActiveJobs}
            />
          )}

          {activeTab === 'settings' && <Settings />}
        </main>
      </div>

      {/* 9:16 Vertical Video Player Modal */}
      <ClipPlayerModal
        clip={selectedClip}
        onClose={() => setSelectedClip(null)}
        onUpdate={(updated) => {
          setSelectedClip(updated);
        }}
      />
    </div>
  );
}
export default App;


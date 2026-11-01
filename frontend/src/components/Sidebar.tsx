import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Flame, 
  ListOrdered, 
  Film, 
  Library, 
  Settings as SettingsIcon,
  Cpu,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeJobsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, activeJobsCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-project', label: 'New Project', icon: PlusCircle },
    { id: 'video-analysis', label: 'Video Analysis', icon: Flame },
    { id: 'queue', label: 'Processing Queue', icon: ListOrdered, badge: activeJobsCount > 0 ? activeJobsCount : undefined },
    { id: 'clips', label: 'Generated Clips', icon: Film },
    { id: 'library', label: 'Video Library', icon: Library },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-vault-surface border-r border-vault-border flex flex-col h-screen fixed left-0 top-0 select-none z-20">
      {/* Brand Header */}
      <div className="p-6 border-b border-vault-border flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vault-red to-vault-redDark flex items-center justify-center shadow-glow-red">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider text-vault-silverLight flex items-center">
              CLIPVAULT <span className="text-vault-red ml-1">AI</span>
            </h1>
            <p className="text-[10px] text-vault-muted uppercase tracking-widest font-mono">Streamer Studio</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="text-[11px] font-semibold uppercase text-vault-muted px-3 mb-2 tracking-wider">
          Studio Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-vault-red/15 text-vault-red border-l-4 border-vault-red font-semibold shadow-inner'
                  : 'text-vault-silver/80 hover:text-vault-silverLight hover:bg-vault-surfaceHover'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-vault-red' : 'text-vault-muted'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="bg-vault-red text-white text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-glow-red">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Hardware Status Footer */}
      <div className="p-4 border-t border-vault-border bg-vault-bg/40 m-3 rounded-xl">
        <div className="flex items-center space-x-2.5 mb-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-vault-silverLight">Hardware Profile</span>
        </div>
        <div className="space-y-1 text-[11px] text-vault-muted font-mono">
          <div className="flex justify-between">
            <span>CPU:</span>
            <span className="text-vault-silver">i5-11320H (4C/8T)</span>
          </div>
          <div className="flex justify-between">
            <span>RAM:</span>
            <span className="text-vault-silver">16 GB (CPU-First)</span>
          </div>
          <div className="flex justify-between">
            <span>AI LLM:</span>
            <span className="text-emerald-400 font-medium">Qwen 2.5 3B</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

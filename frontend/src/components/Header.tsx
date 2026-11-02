import React from 'react';
import { FolderOpen, Plus, Activity, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onQuickImport: () => void;
  activeJobsCount: number;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onQuickImport,
  activeJobsCount,
  onRefresh
}) => {
  const handleOpenOutput = async () => {
    try {
      await api.openOutputFolder();
    } catch (e) {
      console.error('Failed to open output directory', e);
    }
  };

  return (
    <header className="h-16 border-b border-vault-border bg-vault-surface/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h2 className="text-xl font-bold text-vault-silverLight tracking-tight flex items-center gap-2">
          {title}
          {activeJobsCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              <Activity className="w-3 h-3 animate-spin" />
              {activeJobsCount} Processing
            </span>
          )}
        </h2>
        {subtitle && <p className="text-xs text-vault-muted mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-vault-surfaceHover text-vault-muted hover:text-vault-silverLight border border-vault-border hover:border-vault-borderLight transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={handleOpenOutput}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-vault-surfaceHover text-vault-silver hover:text-white border border-vault-border hover:border-vault-borderLight transition-all shadow-sm"
        >
          <FolderOpen className="w-4 h-4 text-vault-red" />
          <span>Output Folder</span>
        </button>

        <button
          onClick={onQuickImport}
          className="flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-vault-red to-vault-redHover text-white shadow-glow-red hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Import Video</span>
        </button>
      </div>
    </header>
  );
};


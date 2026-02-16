"use client";

import { TextItem } from "@/types";

interface PlayerProps {
  currentItem: TextItem | null;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
}

export function Player({ currentItem, isPlaying, progress, onToggle }: PlayerProps) {
  if (!currentItem) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom">
      <div className="h-1 bg-border">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-3 p-3 max-w-3xl mx-auto">
        <button
          onClick={onToggle}
          className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center flex-shrink-0 transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{currentItem.title}</p>
          <p className="text-sm text-muted">{progress}% complete</p>
        </div>
      </div>
    </div>
  );
}

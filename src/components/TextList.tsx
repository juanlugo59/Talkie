"use client";

import { TextItem, Folder } from "@/types";

interface TextListProps {
  items: TextItem[];
  folders: Folder[];
  showFolderBadge: boolean;
  currentPlayingId: string | null;
  isPlaying: boolean;
  onPlay: (item: TextItem) => void;
  onDelete: (id: string) => void;
  onItemClick: (item: TextItem) => void;
}

export function TextList({ items, folders, showFolderBadge, currentPlayingId, isPlaying, onPlay, onDelete, onItemClick }: TextListProps) {
  const getFolderName = (folderId?: string) => {
    if (!folderId) return null;
    return folders.find((f) => f.id === folderId)?.name ?? null;
  };
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg mb-2">No texts yet</p>
          <p className="text-sm">Tap the + button to add your first text</p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 p-4 border-b border-border hover:bg-card-hover transition-colors cursor-pointer ${
            currentPlayingId === item.id ? "bg-card" : ""
          }`}
          onClick={() => onItemClick(item)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(item);
            }}
            className="w-10 h-10 rounded-lg bg-accent/20 hover:bg-accent/30 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Play"
          >
            {currentPlayingId === item.id && isPlaying ? (
              <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{item.title}</h3>
            <p className="text-sm text-muted">
              {item.progress}% • {formatDate(item.createdAt)}
              {showFolderBadge && getFolderName(item.folderId) && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-accent/15 text-accent">
                  {getFolderName(item.folderId)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-2 hover:bg-card rounded-lg transition-colors text-muted hover:text-red-400"
            aria-label="Delete"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

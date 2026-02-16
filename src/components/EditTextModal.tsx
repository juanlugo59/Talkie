"use client";

import { useState, useEffect, useRef } from "react";
import { TextItem } from "@/types";

interface EditTextModalProps {
  item: TextItem | null;
  isPlaying: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => void;
  onDelete: (id: string) => void;
  onPlay: (item: TextItem) => void;
}

export function EditTextModal({
  item,
  isPlaying,
  onClose,
  onSave,
  onDelete,
  onPlay,
}: EditTextModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content);
      setIsEditing(false);
    }
  }, [item]);

  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (item && title.trim() && content.trim()) {
      onSave(item.id, title.trim(), content.trim());
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (item) {
      onDelete(item.id);
      onClose();
    }
  };

  const handlePlay = () => {
    if (item) {
      onPlay(item);
    }
  };

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <h2 className="text-lg font-semibold">Edit Text</h2>
            ) : (
              <h2 className="text-lg font-semibold truncate max-w-[200px]">{item.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isEditing && (
              <>
                <button
                  onClick={handlePlay}
                  className="p-2 hover:bg-card rounded-lg transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-card rounded-lg transition-colors"
                  aria-label="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 hover:bg-card rounded-lg transition-colors text-red-400"
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
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-card rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEditing ? (
            <>
              <div>
                <label htmlFor="edit-title" className="block text-sm font-medium mb-2">
                  Title
                </label>
                <input
                  ref={titleInputRef}
                  id="edit-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="edit-content" className="block text-sm font-medium mb-2">
                  Content
                </label>
                <textarea
                  id="edit-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-accent focus:outline-none transition-colors resize-none"
                />
              </div>
            </>
          ) : (
            <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
              {item.content}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="p-4 border-t border-border flex gap-2">
            <button
              onClick={() => {
                setTitle(item.title);
                setContent(item.content);
                setIsEditing(false);
              }}
              className="flex-1 py-3 rounded-lg bg-card hover:bg-card-hover font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !content.trim()}
              className="flex-1 py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

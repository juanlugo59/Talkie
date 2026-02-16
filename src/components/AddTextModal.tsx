"use client";

import { useState, useEffect, useRef } from "react";
import { Folder } from "@/types";

interface AddTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, content: string, folderId?: string) => void;
  folders: Folder[];
  defaultFolderId?: string;
}

export function AddTextModal({ isOpen, onClose, onAdd, folders, defaultFolderId }: AddTextModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [folderId, setFolderId] = useState<string | undefined>(defaultFolderId);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContent("");
      setFolderId(defaultFolderId);
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultFolderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && content.trim()) {
      onAdd(title.trim(), content.trim(), folderId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add New Text</h2>
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Title
              </label>
              <input
                ref={titleInputRef}
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give it a name..."
                className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-accent focus:outline-none transition-colors"
              />
            </div>
            {folders.length > 0 && (
              <div>
                <label htmlFor="folder" className="block text-sm font-medium mb-2">
                  Folder
                </label>
                <select
                  id="folder"
                  value={folderId ?? ""}
                  onChange={(e) => setFolderId(e.target.value || undefined)}
                  className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-accent focus:outline-none transition-colors"
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label htmlFor="content" className="block text-sm font-medium mb-2">
                Content
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your text here..."
                rows={8}
                className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-accent focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Text
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

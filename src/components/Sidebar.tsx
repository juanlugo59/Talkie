"use client";

import { useState, useRef, useEffect } from "react";
import { Folder, TextItem } from "@/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  items: TextItem[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onAddFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

export function Sidebar({
  isOpen,
  onClose,
  folders,
  items,
  selectedFolderId,
  onSelectFolder,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: SidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  const getItemCount = (folderId: string | null) => {
    if (folderId === null) return items.length;
    return items.filter((item) => item.folderId === folderId).length;
  };

  const getUnfiledCount = () => {
    return items.filter((item) => !item.folderId).length;
  };

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      onAddFolder(newFolderName.trim());
      setNewFolderName("");
      setIsAdding(false);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRenameFolder(id, editName.trim());
      setEditingId(null);
      setEditName("");
    }
  };

  const handleStartEdit = (folder: Folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-72 bg-background border-r border-border z-50 flex flex-col transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Folders</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto">
          {/* All Texts */}
          <button
            onClick={() => {
              onSelectFolder(null);
              onClose();
            }}
            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors ${
              selectedFolderId === null ? "bg-card text-accent font-medium" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>All Texts</span>
            </div>
            <span className="text-sm text-muted">{items.length}</span>
          </button>

          {/* Divider */}
          <div className="border-b border-border mx-4 my-1" />

          {/* Folders */}
          {folders.map((folder) => (
            <div key={folder.id} className="group relative">
              {editingId === folder.id ? (
                <div className="flex items-center gap-2 px-4 py-2">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(folder.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm"
                  />
                  <button
                    onClick={() => handleRename(folder.id)}
                    className="p-1.5 hover:bg-card rounded-lg text-accent"
                    aria-label="Save"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectFolder(folder.id);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectFolder(folder.id);
                      onClose();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors cursor-pointer ${
                    selectedFolderId === folder.id ? "bg-card text-accent font-medium" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted mr-1">{getItemCount(folder.id)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(folder);
                      }}
                      className="p-1 hover:bg-card rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Rename folder"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folder.id);
                      }}
                      className="p-1 hover:bg-card rounded opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                      aria-label="Delete folder"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Unfiled section */}
          {folders.length > 0 && getUnfiledCount() > 0 && (
            <>
              <div className="border-b border-border mx-4 my-1" />
              <button
                onClick={() => {
                  onSelectFolder("unfiled");
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors ${
                  selectedFolderId === "unfiled" ? "bg-card text-accent font-medium" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Unfiled</span>
                </div>
                <span className="text-sm text-muted">{getUnfiledCount()}</span>
              </button>
            </>
          )}
        </div>

        {/* Add folder */}
        <div className="border-t border-border p-4">
          {isAdding ? (
            <div className="flex items-center gap-2">
              <input
                ref={addInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddFolder();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="Folder name..."
                className="flex-1 px-3 py-2 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm"
              />
              <button
                onClick={handleAddFolder}
                disabled={!newFolderName.trim()}
                className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
                aria-label="Create folder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-card hover:bg-card-hover transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Folder
            </button>
          )}
        </div>
      </div>
    </>
  );
}

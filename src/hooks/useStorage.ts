"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TextItem, Folder, FOLDER_COLORS } from "@/types";

export function useStorage() {
  const [items, setItems] = useState<TextItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pendingUpdates = useRef<
    Map<string, { updates: Partial<TextItem>; timer: ReturnType<typeof setTimeout> }>
  >(new Map());

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("Failed to load items");
      const data: TextItem[] = await res.json();
      setItems(data);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/folders");
      if (!res.ok) throw new Error("Failed to load folders");
      const data: Folder[] = await res.json();
      setFolders(data);
    } catch (error) {
      console.error("Failed to load folders:", error);
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadFolders();
  }, [loadItems, loadFolders]);

  const addItem = useCallback(
    async (title: string, content: string, folderId?: string): Promise<TextItem> => {
      const newItem: TextItem = {
        id: crypto.randomUUID(),
        title,
        content,
        createdAt: Date.now(),
        progress: 0,
        lastPosition: 0,
        folderId,
      };
      setItems((prev) => [newItem, ...prev]);
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      return newItem;
    },
    []
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<TextItem>) => {
      // Optimistic local update (always immediate)
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );

      // Debounce progress-only updates to avoid flooding the API
      const isProgressOnly = Object.keys(updates).every(
        (k) => k === "progress" || k === "lastPosition"
      );

      if (isProgressOnly) {
        const existing = pendingUpdates.current.get(id);
        if (existing) {
          clearTimeout(existing.timer);
          existing.updates = { ...existing.updates, ...updates };
        }
        const entry = existing ?? { updates, timer: null as unknown as ReturnType<typeof setTimeout> };
        entry.timer = setTimeout(async () => {
          pendingUpdates.current.delete(id);
          await fetch(`/api/items/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry.updates),
          });
        }, 5000);
        if (!existing) pendingUpdates.current.set(id, entry);
      } else {
        // Non-progress updates go immediately
        await fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        // If content changed, invalidate audio cache
        if (updates.content !== undefined) {
          fetch(`/api/tts/cache/${id}`, { method: "DELETE" }).catch((err) =>
            console.error("Cache invalidation failed:", err)
          );
        }
      }
    },
    []
  );

  const deleteItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    // Delete audio cache blobs before deleting the item
    fetch(`/api/tts/cache/${id}`, { method: "DELETE" }).catch(() => {});
    await fetch(`/api/items/${id}`, { method: "DELETE" });
  }, []);

  const getItem = useCallback(async (id: string): Promise<TextItem | undefined> => {
    const res = await fetch(`/api/items/${id}`);
    if (!res.ok) return undefined;
    const data = await res.json();
    return data ?? undefined;
  }, []);

  const addFolder = useCallback(
    async (name: string): Promise<Folder> => {
      const colorIndex = folders.length % FOLDER_COLORS.length;
      const newFolder: Folder = {
        id: crypto.randomUUID(),
        name,
        color: colorIndex,
        createdAt: Date.now(),
      };
      setFolders((prev) => [newFolder, ...prev]);
      await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFolder),
      });
      return newFolder;
    },
    [folders.length]
  );

  const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) =>
      prev.map((item) =>
        item.folderId === id ? { ...item, folderId: undefined } : item
      )
    );
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
  }, []);

  return {
    items,
    folders,
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    getItem,
    addFolder,
    updateFolder,
    deleteFolder,
    refresh: loadItems,
  };
}

"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { useEffect, useState, useCallback } from "react";
import { TextItem, Folder } from "@/types";

interface TalkieDB extends DBSchema {
  texts: {
    key: string;
    value: TextItem;
    indexes: { "by-date": number; "by-folder": string };
  };
  folders: {
    key: string;
    value: Folder;
    indexes: { "by-date": number };
  };
}

const DB_NAME = "talkie-db";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<TalkieDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TalkieDB>(DB_NAME, DB_VERSION, {
      blocked() {
        // If another tab has the DB open, reset so we retry
        dbPromise = null;
      },
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const textStore = db.createObjectStore("texts", { keyPath: "id" });
          textStore.createIndex("by-date", "createdAt");
        }
        if (oldVersion < 2) {
          const folderStore = db.createObjectStore("folders", { keyPath: "id" });
          folderStore.createIndex("by-date", "createdAt");
          // Add folder index to existing texts store
          const textStore = transaction.objectStore("texts");
          if (!textStore.indexNames.contains("by-folder")) {
            textStore.createIndex("by-folder", "folderId");
          }
        }
      },
    });
  }
  return dbPromise;
}

export function useStorage() {
  const [items, setItems] = useState<TextItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      const db = await getDB();
      const allItems = await db.getAllFromIndex("texts", "by-date");
      setItems(allItems.reverse()); // newest first
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const db = await getDB();
      const allFolders = await db.getAllFromIndex("folders", "by-date");
      setFolders(allFolders.reverse());
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
      const db = await getDB();
      const newItem: TextItem = {
        id: crypto.randomUUID(),
        title,
        content,
        createdAt: Date.now(),
        progress: 0,
        lastPosition: 0,
        folderId,
      };
      await db.put("texts", newItem);
      setItems((prev) => [newItem, ...prev]);
      return newItem;
    },
    []
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<TextItem>) => {
      const db = await getDB();
      const existing = await db.get("texts", id);
      if (existing) {
        const updated = { ...existing, ...updates };
        await db.put("texts", updated);
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      }
    },
    []
  );

  const deleteItem = useCallback(async (id: string) => {
    const db = await getDB();
    await db.delete("texts", id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getItem = useCallback(async (id: string): Promise<TextItem | undefined> => {
    const db = await getDB();
    return db.get("texts", id);
  }, []);

  const addFolder = useCallback(async (name: string): Promise<Folder> => {
    const db = await getDB();
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
    };
    await db.put("folders", newFolder);
    setFolders((prev) => [newFolder, ...prev]);
    return newFolder;
  }, []);

  const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
    const db = await getDB();
    const existing = await db.get("folders", id);
    if (existing) {
      const updated = { ...existing, ...updates };
      await db.put("folders", updated);
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    }
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    const db = await getDB();
    await db.delete("folders", id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    // Unassign texts from this folder
    const allItems = await db.getAllFromIndex("texts", "by-date");
    for (const item of allItems) {
      if (item.folderId === id) {
        const updated = { ...item, folderId: undefined };
        await db.put("texts", updated);
      }
    }
    setItems((prev) =>
      prev.map((item) => (item.folderId === id ? { ...item, folderId: undefined } : item))
    );
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

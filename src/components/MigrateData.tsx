"use client";

import { useState, useEffect } from "react";
import { openDB } from "idb";

export function MigrateData({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<"checking" | "migrating" | "done" | "none">("checking");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    checkAndMigrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAndMigrate() {
    try {
      const databases = await indexedDB.databases();
      const exists = databases.some((db) => db.name === "talkie-db");
      if (!exists) {
        setStatus("none");
        return;
      }

      const db = await openDB("talkie-db", 2);
      const items = await db.getAll("texts");
      const folders = await db.getAll("folders");
      db.close();

      if (items.length === 0 && folders.length === 0) {
        setStatus("none");
        return;
      }

      setStatus("migrating");

      // Migrate folders first (items reference them)
      setProgress(`Migrating ${folders.length} folders...`);
      for (const folder of folders) {
        await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: folder.id,
            name: folder.name,
            color: folder.color ?? 0,
            createdAt: folder.createdAt,
          }),
        });
      }

      // Migrate items
      setProgress(`Migrating ${items.length} texts...`);
      for (const item of items) {
        await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            title: item.title,
            content: item.content,
            createdAt: item.createdAt,
            folderId: item.folderId,
          }),
        });
      }

      // Clear IndexedDB after successful migration
      const dbClear = await openDB("talkie-db", 2);
      await dbClear.clear("texts");
      await dbClear.clear("folders");
      dbClear.close();

      setProgress(`Migrated ${folders.length} folders and ${items.length} texts!`);
      setStatus("done");

      setTimeout(() => {
        onDone();
      }, 2000);
    } catch (error) {
      console.error("Migration error:", error);
      setStatus("none");
    }
  }

  if (status === "none" || status === "checking") return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg px-4 py-3 shadow-lg">
      <p className="text-sm">{progress}</p>
    </div>
  );
}

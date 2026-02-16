"use client";

import { useEffect, useRef, useCallback } from "react";
import { TextItem } from "@/types";

export function useAudioCache(items: TextItem[]) {
  const generatingRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const versionRef = useRef<Map<string, number>>(new Map());
  const completedRef = useRef<Set<string>>(new Set());

  const checkAndGenerate = useCallback(async (item: TextItem) => {
    if (generatingRef.current.has(item.id)) return;
    if (completedRef.current.has(item.id)) return;
    generatingRef.current.add(item.id);

    const version = (versionRef.current.get(item.id) ?? 0) + 1;
    versionRef.current.set(item.id, version);

    try {
      // Check current cache status
      const cacheRes = await fetch(`/api/tts/cache/${item.id}`);
      if (!cacheRes.ok || !mountedRef.current) return;
      const cache = await cacheRes.json();

      if (cache.complete) {
        completedRef.current.add(item.id);
        return;
      }

      const startChunk = cache.cached ? cache.generatedCount : 0;

      // Generate chunks sequentially
      let chunkIndex = startChunk;
      let done = false;

      while (
        !done &&
        mountedRef.current &&
        versionRef.current.get(item.id) === version
      ) {
        const genRes = await fetch("/api/tts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.id, chunkIndex }),
        });

        if (!genRes.ok) {
          if (genRes.status === 404) break; // Item deleted
          throw new Error("Generation failed");
        }

        const result = await genRes.json();
        done = result.done;
        chunkIndex++;
      }

      if (done) {
        completedRef.current.add(item.id);
      }
    } catch (error) {
      console.error(`Audio cache generation failed for ${item.id}:`, error);
    } finally {
      generatingRef.current.delete(item.id);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const processQueue = async () => {
      for (const item of items) {
        if (!mountedRef.current) break;
        if (
          completedRef.current.has(item.id) ||
          generatingRef.current.has(item.id)
        )
          continue;
        await checkAndGenerate(item);
      }
    };

    processQueue();

    return () => {
      mountedRef.current = false;
    };
  }, [items, checkAndGenerate]);

  const invalidate = useCallback(
    async (itemId: string) => {
      // Bump version to stop any in-progress generation
      versionRef.current.set(
        itemId,
        (versionRef.current.get(itemId) ?? 0) + 1
      );
      completedRef.current.delete(itemId);
      await fetch(`/api/tts/cache/${itemId}`, { method: "DELETE" });
      // Regenerate
      const item = items.find((i) => i.id === itemId);
      if (item) {
        checkAndGenerate(item);
      }
    },
    [items, checkAndGenerate]
  );

  return { invalidate };
}

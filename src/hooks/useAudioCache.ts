"use client";

import { useEffect, useRef, useCallback } from "react";
import { TextItem } from "@/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

      // Generate chunks sequentially with retry
      let chunkIndex = startChunk;
      let done = false;

      while (
        !done &&
        mountedRef.current &&
        versionRef.current.get(item.id) === version
      ) {
        let lastError: Error | null = null;
        let succeeded = false;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (!mountedRef.current || versionRef.current.get(item.id) !== version) break;

          try {
            const genRes = await fetch("/api/tts/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: item.id, chunkIndex }),
            });

            if (!genRes.ok) {
              if (genRes.status === 404) {
                // Item deleted, stop entirely
                return;
              }
              throw new Error(`Generation failed (${genRes.status})`);
            }

            const result = await genRes.json();
            done = result.done;
            chunkIndex++;
            succeeded = true;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < MAX_RETRIES - 1) {
              const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
              console.warn(
                `Chunk ${chunkIndex} for ${item.id} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms...`
              );
              await delay(backoff);
            }
          }
        }

        if (!succeeded) {
          throw lastError ?? new Error("Generation failed after retries");
        }
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

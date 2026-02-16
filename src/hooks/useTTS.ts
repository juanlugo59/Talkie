"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TextItem } from "@/types";

interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number;
  currentItemId: string | null;
}

interface UseTTSOptions {
  onProgressUpdate?: (id: string, progress: number, position: number) => void;
  onEnd?: (id: string) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    progress: 0,
    currentItemId: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentItemRef = useRef<TextItem | null>(null);
  const chunkIndexRef = useRef(0);
  const totalChunksRef = useRef(0);
  const optionsRef = useRef(options);
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  optionsRef.current = options;

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const fetchAndPlayChunk = useCallback(
    async (item: TextItem, chunkIndex: number) => {
      abortRef.current = new AbortController();

      if (chunkIndex === 0) {
        setState((prev) => ({ ...prev, isLoading: true }));
      }

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.content, chunkIndex }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "TTS request failed");
        }

        const data = await res.json();
        totalChunksRef.current = data.totalChunks;

        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audioRef.current = audio;

        const updateProgress = () => {
          if (!audio.duration || !currentItemRef.current || audio.paused) return;
          const chunkProgress = audio.currentTime / audio.duration;
          const overallProgress = ((chunkIndex + chunkProgress) / data.totalChunks) * 100;
          const position = Math.round(
            (overallProgress / 100) * currentItemRef.current.content.length
          );
          setState((prev) => ({ ...prev, progress: overallProgress }));
          optionsRef.current.onProgressUpdate?.(
            currentItemRef.current!.id,
            Math.round(overallProgress),
            position
          );
          rafRef.current = requestAnimationFrame(updateProgress);
        };

        const startProgressLoop = () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(updateProgress);
        };

        audio.onplay = () => startProgressLoop();
        audio.onpause = () => {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        };

        audio.onended = () => {
          if (data.hasMore && currentItemRef.current) {
            chunkIndexRef.current = chunkIndex + 1;
            fetchAndPlayChunk(currentItemRef.current, chunkIndex + 1);
          } else if (currentItemRef.current) {
            const id = currentItemRef.current.id;
            setState({
              isPlaying: false,
              isPaused: false,
              isLoading: false,
              progress: 100,
              currentItemId: null,
            });
            optionsRef.current.onProgressUpdate?.(
              id,
              100,
              currentItemRef.current.content.length
            );
            optionsRef.current.onEnd?.(id);
            currentItemRef.current = null;
          }
        };

        audio.onerror = () => {
          console.error("Audio playback error");
          setState({
            isPlaying: false,
            isPaused: false,
            isLoading: false,
            progress: 0,
            currentItemId: null,
          });
          currentItemRef.current = null;
        };

        await audio.play();
        setState((prev) => ({ ...prev, isPlaying: true, isPaused: false, isLoading: false }));
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("TTS error:", error);
        setState({
          isPlaying: false,
          isPaused: false,
          isLoading: false,
          progress: 0,
          currentItemId: null,
        });
        currentItemRef.current = null;
      }
    },
    []
  );

  const speak = useCallback(
    (item: TextItem) => {
      cleanup();
      currentItemRef.current = item;
      chunkIndexRef.current = 0;

      setState({
        isPlaying: true,
        isPaused: false,
        isLoading: true,
        currentItemId: item.id,
        progress: 0,
      });

      fetchAndPlayChunk(item, 0);
    },
    [cleanup, fetchAndPlayChunk]
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    currentItemRef.current = null;
    chunkIndexRef.current = 0;
    setState({
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      progress: 0,
      currentItemId: null,
    });
  }, [cleanup]);

  const toggle = useCallback(
    (item: TextItem) => {
      if (state.currentItemId === item.id) {
        if (state.isPlaying) {
          pause();
        } else if (state.isPaused) {
          resume();
        } else {
          speak(item);
        }
      } else {
        speak(item);
      }
    },
    [state.currentItemId, state.isPlaying, state.isPaused, pause, resume, speak]
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    isSupported: true,
    speak,
    pause,
    resume,
    stop,
    toggle,
  };
}

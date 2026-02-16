export interface TextItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  progress: number; // 0-100 percentage
  lastPosition: number; // character index for resuming
  folderId?: string;
}

export const FOLDER_COLORS = [
  { bg: "bg-violet-500/15", text: "text-violet-400", name: "violet" },
  { bg: "bg-sky-500/15", text: "text-sky-400", name: "sky" },
  { bg: "bg-emerald-500/15", text: "text-emerald-400", name: "emerald" },
  { bg: "bg-amber-500/15", text: "text-amber-400", name: "amber" },
  { bg: "bg-rose-500/15", text: "text-rose-400", name: "rose" },
  { bg: "bg-cyan-500/15", text: "text-cyan-400", name: "cyan" },
  { bg: "bg-orange-500/15", text: "text-orange-400", name: "orange" },
  { bg: "bg-pink-500/15", text: "text-pink-400", name: "pink" },
  { bg: "bg-teal-500/15", text: "text-teal-400", name: "teal" },
  { bg: "bg-indigo-500/15", text: "text-indigo-400", name: "indigo" },
] as const;

export interface Folder {
  id: string;
  name: string;
  color: number;
  createdAt: number;
}

export function estimateDuration(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = words / 150; // ~150 WPM for TTS
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export interface PlayerState {
  isPlaying: boolean;
  currentItemId: string | null;
  progress: number;
}

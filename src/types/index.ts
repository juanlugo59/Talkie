export interface TextItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  progress: number; // 0-100 percentage
  lastPosition: number; // character index for resuming
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface PlayerState {
  isPlaying: boolean;
  currentItemId: string | null;
  progress: number;
}

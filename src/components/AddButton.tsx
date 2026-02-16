"use client";

interface AddButtonProps {
  onClick: () => void;
  isPlayerVisible?: boolean;
}

export function AddButton({ onClick, isPlayerVisible = false }: AddButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed right-6 w-14 h-14 rounded-full bg-accent hover:bg-accent-hover shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
        isPlayerVisible ? "bottom-28" : "bottom-6"
      }`}
      aria-label="Add new text"
    >
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

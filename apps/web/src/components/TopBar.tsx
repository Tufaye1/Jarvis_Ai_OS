export default function TopBar() {
  return (
    <header className="flex h-[60px] flex-none items-center gap-[18px] border-b border-border-shell bg-canvas px-[18px]">
      {/* Logo lockup — width matches the sidebar */}
      <div className="flex w-[224px] flex-none items-center gap-[9px]">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-nav bg-ink">
          <span className="h-[9px] w-[9px] rounded-full bg-accent" />
        </span>
        <span className="text-[17px] font-bold tracking-[-0.4px] text-ink">
          Jarvis
        </span>
        <span className="rounded-[5px] border border-border-button px-[5px] py-[2px] text-[10px] font-semibold tracking-[0.6px] text-ink-os-badge">
          OS
        </span>
      </div>

      {/* ⌘K search field — visual only */}
      <div
        role="search"
        className="flex h-9 max-w-[620px] flex-1 cursor-text items-center gap-[10px] rounded-field border border-border-card bg-surface px-[14px] text-[13.5px] text-ink-faint transition-colors hover:border-border-hover"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#9A9A96"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.4" />
          <path d="M10.4 10.4 14 14" />
        </svg>
        <span className="truncate">
          Search everything — projects, files, meetings, people, web
        </span>
        <span className="ml-auto flex-none rounded-[5px] border border-border-kbd px-[5px] py-[1px] text-[11px] font-semibold text-ink-eyebrow">
          ⌘K
        </span>
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Voice"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="6" y="2" width="4" height="7.5" rx="2" />
            <path d="M3.6 8.2a4.4 4.4 0 0 0 8.8 0M8 12.6V14" />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border-card bg-surface"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#3A3A36"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 6.6a4 4 0 0 1 8 0c0 3 1.1 4.2 1.1 4.2H2.9S4 9.6 4 6.6ZM6.6 12.8a1.6 1.6 0 0 0 2.8 0" />
          </svg>
          <span className="absolute -top-[3px] -right-[3px] flex h-[15px] min-w-[15px] items-center justify-center rounded-chip bg-accent text-[9.5px] font-bold text-white">
            5
          </span>
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-avatar text-[12px] font-bold text-white">
          H
        </div>
      </div>
    </header>
  );
}

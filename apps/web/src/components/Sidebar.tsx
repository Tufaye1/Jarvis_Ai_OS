"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href?: string;
  icon: ReactNode;
};

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

const NAV: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: (
      <svg {...iconProps}>
        <path d="M2.6 7 8 2.6 13.4 7v6.4H2.6z" />
      </svg>
    ),
  },
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: (
      <svg {...iconProps}>
        <path d="M8 3.2c-1.6-1.4-4.4-.6-4.4 1.8 0 2.6 4.4 6 4.4 6s4.4-3.4 4.4-6c0-2.4-2.8-3.2-4.4-1.8Z" />
      </svg>
    ),
  },
  {
    label: "Projects",
    icon: (
      <svg {...iconProps}>
        <path d="M2.4 5.2h4l1.2 1.6h6v6.2H2.4z" />
        <path d="M2.4 5.2V3.4h3.2" />
      </svg>
    ),
  },
  {
    label: "Chat",
    href: "/chat",
    icon: (
      <svg {...iconProps}>
        <path d="M2.8 4.2h10.4v6.4H7l-3 2.4v-2.4H2.8z" />
      </svg>
    ),
  },
  {
    label: "Planner",
    icon: (
      <svg {...iconProps}>
        <rect x="2.6" y="3.6" width="10.8" height="9.8" rx="1.6" />
        <path d="M2.6 6.6h10.8M5.6 2.4v2.4M10.4 2.4v2.4" />
      </svg>
    ),
  },
  {
    label: "Research",
    icon: (
      <svg {...iconProps}>
        <circle cx="8" cy="8" r="5.4" />
        <path d="M2.6 8h10.8M8 2.6c2.6 2.8 2.6 8 0 10.8-2.6-2.8-2.6-8 0-10.8Z" />
      </svg>
    ),
  },
  {
    label: "Content Studio",
    icon: (
      <svg {...iconProps}>
        <path d="M3 13h10M4.4 10.6l6.4-6.4 1.8 1.8-6.4 6.4H4.4z" />
      </svg>
    ),
  },
  {
    label: "Browser",
    icon: (
      <svg {...iconProps}>
        <rect x="2.6" y="3.4" width="10.8" height="9.2" rx="1.6" />
        <path d="M2.6 6.2h10.8" />
      </svg>
    ),
  },
  {
    label: "Voice",
    icon: (
      <svg {...iconProps}>
        <rect x="6" y="2.4" width="4" height="7.4" rx="2" />
        <path d="M3.6 8.2a4.4 4.4 0 0 0 8.8 0M8 12.6V14" />
      </svg>
    ),
  },
  {
    label: "Settings",
    icon: (
      <svg {...iconProps}>
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.7 3.7l1.1 1.1M11.2 11.2l1.1 1.1M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1" />
      </svg>
    ),
  },
];

const ITEM_CLASS =
  "flex h-[34px] items-center gap-[10px] rounded-nav px-[10px] text-[13.5px] font-semibold cursor-pointer";

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex w-[224px] flex-none flex-col gap-[2px] overflow-auto border-r border-border-shell px-3 py-[14px]">
      {NAV.map((item) => {
        if (!item.href) {
          return (
            <div
              key={item.label}
              aria-disabled="true"
              className={`${ITEM_CLASS} bg-transparent text-ink-secondary hover:bg-hover-2`}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          );
        }

        const active = isActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${ITEM_CLASS} ${
              active
                ? "bg-ink text-white hover:text-white"
                : "bg-transparent text-ink-secondary hover:bg-hover-2 hover:text-ink"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col gap-[6px] pt-[14px]">
        <div className="px-[10px] text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
          EXPLORATIONS
        </div>
        <div className="flex h-[30px] cursor-pointer items-center gap-2 rounded-chip px-[10px] text-[12.5px] font-semibold text-ink-muted hover:bg-hover-2">
          <span>Mobile screens</span>
        </div>
      </div>
    </nav>
  );
}

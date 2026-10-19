import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const DayIcon = () => (
  <Icon>
    <path d="M8 3h8M9 3v2.5C6.5 6.5 5 8.5 5 11v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7c0-2.5-1.5-4.5-4-5.5V3" />
    <circle cx="10" cy="16.5" r="1.6" />
    <circle cx="14.2" cy="16.5" r="1.6" />
  </Icon>
);

export const WeekIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3M7.5 14h9" />
  </Icon>
);

export const MonthIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" />
  </Icon>
);

export const StatsIcon = () => (
  <Icon>
    <path d="M5 20V12M12 20V5M19 20v-9" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);


export const Icon = ({ children, size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
export const DropletIcon = () => <Icon><path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z" /></Icon>;
export const CheckCircleIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></Icon>;
export const XCircleIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></Icon>;
export const TagIcon = () => <Icon><path d="M20 12l-8 8-9-9V3h8l9 9z" /><circle cx="7.5" cy="7.5" r="1.3" /></Icon>;
export const ScanIcon = () => <Icon size={16}><path d="M3 7V4a1 1 0 011-1h3M17 3h3a1 1 0 011 1v3M21 17v3a1 1 0 01-1 1h-3M7 21H4a1 1 0 01-1-1v-3" /></Icon>;
export const PlusIcon = () => <Icon size={16}><path d="M12 5v14M5 12h14" /></Icon>;
export const BellIcon = () => <Icon size={16}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></Icon>;
export const CalendarIcon = () => <Icon><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>;
export const UsersIcon = () => <Icon><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></Icon>;
export const CarIcon = () => <Icon><path d="M5 17h14M5 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM3 17V11l2-5h14l2 5v6" /></Icon>;
export const SearchIcon = () => <Icon size={16}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icon>;
export const DownloadIcon = () => <Icon size={16}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Icon>;
export const ChevronLeftIcon = () => <Icon size={16}><path d="M15 18l-6-6 6-6" /></Icon>;
export const ChevronRightIcon = () => <Icon size={16}><path d="M9 18l6-6-6-6" /></Icon>;
export const ArrowUpIcon = () => <Icon size={12}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>;
export const ArrowDownIcon = () => <Icon size={12}><path d="M12 5v14M19 12l-7 7-7-7" /></Icon>;
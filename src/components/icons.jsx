const base = { viewBox: "0 0 24 24", fill: "currentColor" };

export const IconPrev = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
  </svg>
);
export const IconNext = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M16 5h2v14h-2zM4 5l11 7L4 19z" />
  </svg>
);
export const IconPlay = ({ size = 22 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
export const IconPause = ({ size = 22 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
export const IconVolDown = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M5 12h14" />
  </svg>
);
export const IconVolUp = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconVolMute = ({ size = 16 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 9v6h3.5L12 19V5L7.5 9H4z" />
    <path
      d="M15.5 9.5l5 5M20.5 9.5l-5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);
export const IconReset = ({ size = 18 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
  </svg>
);
export const IconTimer = ({ size = 16, color = "#ff9f0a" }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M9 2h6" />
  </svg>
);
export const IconClose = ({ size = 12 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconNote = ({ size = 22 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </svg>
);
export const IconChat = ({ size = 16 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
  </svg>
);
export const IconChevronLeft = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconChevronRight = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const IconPlus = ({ size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconTrash = ({ size = 12 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
export const IconFile = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);
export const IconImage = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);
export const IconClipboard = ({ size = 18 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 3h6v3H9zM8 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
  </svg>
);

// Menu icons (stroke, clean)
const S = ({ size, children }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);
export const IconMenuMusic = ({ size = 15 }) => (
  <S size={size}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.2" />
    <circle cx="17.5" cy="16" r="2.2" />
  </S>
);
export const IconMenuTimer = ({ size = 15 }) => (
  <S size={size}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M9 2h6" />
  </S>
);
export const IconMenuTemp = ({ size = 15 }) => (
  <S size={size}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </S>
);
export const IconMenuNotes = ({ size = 15 }) => (
  <S size={size}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </S>
);
export const IconMenuSettings = ({ size = 15 }) => (
  <S size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </S>
);
export const IconMenuMail = ({ size = 15 }) => (
  <S size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </S>
);
export const IconMenuList = ({ size = 15 }) => (
  <S size={size}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </S>
);
export const IconMenuCalendar = ({ size = 15 }) => (
  <S size={size}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </S>
);
export const IconMenuPrayer = ({ size = 15 }) => (
  <S size={size}>
    <path d="M12 3c1 3 4 5 4 9a4 4 0 1 1-8 0c0-4 3-6 4-9z" />
    <path d="M9 21h6" />
  </S>
);
export const IconMenuApps = ({ size = 15 }) => (
  <S size={size}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </S>
);
export const IconMenuSearch = ({ size = 15 }) => (
  <S size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </S>
);
export const IconMenuPin = ({ size = 15 }) => (
  <S size={size}>
    <path d="M12 17v5M9 3h6l-1 7h3l-5 6-5-6h3L9 3z" />
  </S>
);
export const IconWA = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#25D366">
    <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 6.7 12.3l-.3.4.8 2.9-3-.8-.4.2A8 8 0 1 1 12 4zm-2.7 3.5c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.9 3 4.7 4.1 2.2.9 2.7.7 3.2.7.5 0 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3 0-.1-.2-.2-.5-.3l-1.8-.9c-.3-.1-.4-.2-.6.1l-.8 1c-.2.2-.3.2-.6.1-1.5-.7-2.5-1.3-3.5-3-.3-.4 0-.6.2-.8l.7-.8c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-.8-1.9c-.2-.5-.4-.5-.6-.5z" />
  </svg>
);
export const IconTG = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#2AABEE">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.8 6.8-1.6 7.6c-.1.5-.4.6-.9.4l-2.4-1.8-1.2 1.1c-.1.1-.3.3-.5.3l.2-2.5 4.5-4.1c.2-.2 0-.3-.3-.1l-5.6 3.5-2.4-.8c-.5-.1-.5-.5.1-.8l9.4-3.6c.4-.2.8.1.7.8z" />
  </svg>
);
export const IconGmail = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path
      fill="#EA4335"
      d="M3 6.5v11A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-11L12 13 3 6.5z"
    />
    <path
      fill="#34A853"
      d="M3 6.5 12 13l9-6.5V5.5A1.5 1.5 0 0 0 19.5 4H4.5A1.5 1.5 0 0 0 3 5.5v1z"
    />
    <path fill="#FBBC05" d="M3 6.5v11" />
    <path fill="#C5221F" d="M21 6.5v11" />
  </svg>
);

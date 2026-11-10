import { AnimatePresence, motion } from "framer-motion";

// Tombol menu island. Menu yang aktif melebar jadi pil berisi ikon + nama menu,
// menu lain tetap ikon saja. Gaya dasar ditulis inline supaya tidak bergantung pada CSS lain;
// kalau mau disetel lewat CSS, pakai kelas .menu-item, .menu-item.on, dan .menu-label.

const LABEL_T = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };

const BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "auto",
  padding: "0 10px",
  borderRadius: 999,
  transition: "background-color 200ms ease, color 200ms ease",
};

const ACTIVE = {
  background: "rgba(255, 255, 255, 0.14)",
  color: "#fff",
};

export default function MenuItem({ Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`menu-item ${active ? "on" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ ...BASE, ...(active ? ACTIVE : null) }}
    >
      <Icon size={14} />
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            key="label"
            className="menu-label"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={LABEL_T}
            style={{
              display: "inline-block",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            <span style={{ display: "inline-block", paddingLeft: 7 }}>
              {label}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

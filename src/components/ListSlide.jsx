import { useRef } from "react";
import { IconPlus, IconTrash } from "./icons.jsx";

export default function ListSlide({
  items,
  onAdd,
  onToggle,
  onRemove,
  onFocusChange,
}) {
  const inputRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    const input = inputRef.current;
    const v = input?.value?.trim();
    if (!v) return;
    onAdd(v);
    input.value = "";
  };

  const focusIn = async (e) => {
    const input = inputRef.current;
    if (!input) return;
    // Sudah fokus: biarkan klik berjalan normal (geser kursor, seleksi teks).
    if (document.activeElement === input) return;
    e.preventDefault();
    await window.island?.setFocusable(true);
    // Pakai ref, BUKAN e.currentTarget: setelah await, e.currentTarget sudah null,
    // sehingga .focus() lama selalu error dan input tidak pernah bisa diketik.
    input.focus();
    onFocusChange?.(true);
  };

  return (
    <div className="todo">
      <form
        className="todo-add"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          placeholder="Tambah item…"
          onMouseDown={focusIn}
          onBlur={() => {
            window.island?.setFocusable(false);
            onFocusChange?.(false);
          }}
        />
        <button
          type="submit"
          className="todo-add-btn"
          aria-label="Tambah"
          onMouseDown={(e) => e.preventDefault()} // input tetap fokus setelah klik +
        >
          <IconPlus />
        </button>
      </form>
      <div className="todo-list">
        {items.length === 0 && <div className="todo-empty">Belum ada list</div>}
        {items.map((it) => (
          <div key={it.id} className={`todo-item ${it.done ? "done" : ""}`}>
            <button
              type="button"
              className="todo-check"
              onClick={() => onToggle(it.id)}
              aria-label="Selesai"
            >
              <span />
            </button>
            <span className="todo-text">{it.text}</span>
            <button
              type="button"
              className="mini"
              onClick={() => onRemove(it.id)}
              aria-label="Hapus"
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

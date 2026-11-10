import { useCallback, useEffect, useMemo, useState } from "react";

let seq = 0;
const api = () => window.island?.convert;

// status item: idle | wait | run | done | error
export default function useConvert() {
  const [items, setItems] = useState([]);
  const [target, setTarget] = useState(null);
  const [merge, setMerge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Progress dari main process
  useEffect(() => {
    return api()?.onProgress?.((e) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === e.id
            ? {
                ...it,
                status: e.status,
                out: e.out ?? it.out,
                outName: e.outName ?? it.outName,
                error: e.error,
              }
            : it,
        ),
      );
    });
  }, []);

  // Format tujuan yang bisa dipakai SEMUA file yang valid
  const targets = useMemo(() => {
    const ok = items.filter((i) => i.targets.length);
    if (!ok.length) return [];
    return ok[0].targets.filter((t) => ok.every((i) => i.targets.includes(t)));
  }, [items]);

  useEffect(() => {
    if (target && !targets.includes(target)) setTarget(null);
  }, [targets, target]);

  const eligible = useMemo(
    () => (target ? items.filter((i) => i.targets.includes(target)) : []),
    [items, target],
  );
  const canMerge =
    target === "pdf" &&
    eligible.length > 1 &&
    eligible.every((i) => i.kind === "image");

  const addPaths = useCallback(async (paths) => {
    if (!paths.length) {
      setNotice("Lokasi file tidak terbaca");
      return;
    }
    setNotice("");
    try {
      const res = await api().probe(paths);
      const fresh = res.files.map((f) => ({ ...f, id: ++seq, status: "idle" }));
      setItems((prev) => {
        const have = new Set(prev.map((i) => i.path));
        return [...prev, ...fresh.filter((f) => !have.has(f.path))];
      });
    } catch (e) {
      setNotice("Gagal membaca file");
    }
  }, []);

  // Dari drag & drop
  const addFiles = useCallback(
    (fileList) => {
      const getPath = window.island?.temp?.getPath;
      const paths = Array.from(fileList || [])
        .map((f) => {
          try {
            return getPath?.(f);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return addPaths(paths);
    },
    [addPaths],
  );

  // Dari dialog "Pilih file"
  const pick = useCallback(async () => {
    try {
      const paths = await api()?.pick?.();
      if (paths && paths.length) await addPaths(paths);
    } catch {
      setNotice("Gagal membuka dialog");
    }
  }, [addPaths]);

  const run = useCallback(async () => {
    if (!target || busy || !eligible.length) return;
    const ids = new Set(eligible.map((i) => i.id));
    setBusy(true);
    setItems((prev) =>
      prev.map((i) =>
        ids.has(i.id)
          ? {
              ...i,
              status: "wait",
              out: undefined,
              outName: undefined,
              error: undefined,
            }
          : i,
      ),
    );
    try {
      const results = await api().run({
        target,
        merge: merge && canMerge,
        items: eligible.map((i) => ({ id: i.id, path: i.path })),
      });
      // Jaga-jaga kalau ada event progress yang terlewat
      setItems((prev) =>
        prev.map((i) => {
          const r = results.find((x) => x.id === i.id);
          return r
            ? {
                ...i,
                status: r.status,
                out: r.out,
                outName: r.outName,
                error: r.error,
              }
            : i;
        }),
      );
    } catch (e) {
      setNotice("Konversi gagal");
      setItems((prev) =>
        prev.map((i) =>
          ids.has(i.id) ? { ...i, status: "error", error: "Gagal" } : i,
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [target, busy, eligible, merge, canMerge]);

  const remove = useCallback(
    (id) => setItems((p) => p.filter((i) => i.id !== id)),
    [],
  );
  const clear = useCallback(() => {
    setItems([]);
    setTarget(null);
    setMerge(false);
    setNotice("");
  }, []);

  return {
    items,
    targets,
    target,
    setTarget,
    merge,
    setMerge,
    canMerge,
    eligibleCount: eligible.length,
    busy,
    notice,
    addFiles,
    pick,
    run,
    remove,
    clear,
    reveal: (p) => api()?.reveal?.(p),
    openFolder: () => api()?.openFolder?.(),
    startDrag: (p) => api()?.startDrag?.(p),
  };
}

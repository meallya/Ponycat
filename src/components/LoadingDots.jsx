// Tiga titik memantul: tanda "sedang memuat lagu berikutnya".
export default function LoadingDots() {
  return (
    <span className="ld" role="status" aria-label="Memuat lagu">
      <i />
      <i />
      <i />
    </span>
  );
}

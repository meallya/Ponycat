// Equalizer kecil. Bergerak hanya saat musik diputar.
export default function Eq({ on }) {
  return (
    <div className={`eq ${on ? 'on' : ''}`}>
      <i />
      <i />
      <i />
      <i />
    </div>
  )
}

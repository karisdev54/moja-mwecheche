export default function Loader({ label = "Loading", full = false }: { label?: string; full?: boolean }) {
  return (
    <div
      className={
        full
          ? "fixed inset-0 z-[60] grid place-items-center"
          : "py-10 grid place-items-center"
      }
      style={full ? { background: "var(--bg)" } : undefined}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="fx-orb">
          <span className="fx-ring" />
          <span className="fx-ring fx-ring2" />
          <span className="fx-core" />
        </div>
        <p className="fx-label">{label}</p>
      </div>
    </div>
  );
}
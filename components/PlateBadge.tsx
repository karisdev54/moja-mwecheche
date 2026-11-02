import { formatPlate } from "@/lib/validate";

export default function PlateBadge({
  plate,
  small = false,
}: {
  plate: string | null | undefined;
  small?: boolean;
}) {
  if (!plate) return null;
  return (
    <span
      className={`inline-block rounded-md font-extrabold tracking-widest ${
        small ? "px-2 py-0.5 text-sm" : "px-3 py-1 text-xl"
      }`}
      style={{
        background: "#facc15",
        color: "#111827",
        border: "2px solid #111827",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      }}
    >
      {formatPlate(plate)}
    </span>
  );
}
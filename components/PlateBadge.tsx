import { Icon } from "@/components/AdminUI";
import { formatPlate } from "@/lib/validate";

export default function PlateBadge({
  plate,
  small = false,
  verified = false,
}: {
  plate: string | null | undefined;
  small?: boolean;
  verified?: boolean;
}) {
  if (!plate) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block rounded-md font-extrabold tracking-widest ${small ? "px-2 py-0.5 text-sm" : "px-3 py-1 text-xl"}`}
        style={{
          background: "#facc15",
          color: "#111827",
          border: "2px solid #111827",
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        }}
      >
        {formatPlate(plate)}
      </span>
      {verified && (
        <span
          title="Verified vehicle"
          className={`inline-flex items-center gap-1 rounded-full font-bold ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}`}
          style={{ background: "color-mix(in srgb, #059669 16%, var(--surface))", color: "#059669" }}
        >
          <Icon name="tick" className={small ? "w-3 h-3" : "w-3.5 h-3.5"} size={small ? 12 : 14} />
          Verified
        </span>
      )}
    </span>
  );
}
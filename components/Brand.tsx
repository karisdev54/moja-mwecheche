import Link from "next/link";
import Image from "next/image";

export default function Brand({ size = 44 }: { size?: number }) {
  return (
    <Link href="/" aria-label="KEY AND GO home" className="inline-flex items-center gap-3">
      <Image src="/icon-192.png" alt="" width={size} height={size} priority className="rounded-xl shadow" />
      <span className="text-xl font-extrabold tracking-wide" style={{ color: "var(--heading)" }}>
        KEY AND GO
      </span>
    </Link>
  );
}
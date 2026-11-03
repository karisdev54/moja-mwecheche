export default function Badge({ n }: { n: number }) {
  return (
    <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold inline-flex items-center justify-center">
      {n > 99 ? "99+" : n}
    </span>
  );
}
/**
 * Fade-up reveal wrapper. Use `delay` (ms) to stagger lists.
 * Pure CSS animation (db-reveal) — runs once on mount.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`db-reveal ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

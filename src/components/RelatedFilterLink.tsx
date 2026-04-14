'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect, useRef } from 'react';

type Props = {
  href: string;
  label: string;
};

/**
 * Client link for <RelatedFilters /> that gives immediate visual feedback
 * when clicked:
 *  1. Dispatches a global `dish-loading` event so <DishGrid /> shows its
 *     spinner (same mechanism the SearchSection already uses).
 *  2. Marks the clicked chip as "loading" with a subtle spinner + dim state.
 *  3. Falls back to the normal Next.js Link behaviour if the user Ctrl/⌘+clicks
 *     (new tab), right-clicks, or uses modifier keys.
 */
export default function RelatedFilterLink({ href, label }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the visual loading state when the transition completes (route swapped).
  useEffect(() => {
    if (!isPending && loading) {
      setLoading(false);
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
    }
  }, [isPending, loading]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modifier clicks (open in new tab etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    setLoading(true);
    // Tell DishGrid to show its spinner immediately.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dish-loading'));
    }
    // Scroll back up so the user sees the new Hero/DishGrid loading state.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    startTransition(() => {
      router.push(href);
    });

    // Safety net: clear loading after 8s if the nav never completes (offline,
    // network stall, etc.) so the user can retry.
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => setLoading(false), 8000);
  };

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={handleClick}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border2)] bg-[var(--surface)] transition-all duration-200 capitalize ${
        loading
          ? 'cursor-wait opacity-60 border-[var(--primary)] text-[var(--primary)]'
          : 'text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:-translate-y-0.5'
      }`}
    >
      {loading && (
        <span
          className="inline-block w-3 h-3 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </Link>
  );
}

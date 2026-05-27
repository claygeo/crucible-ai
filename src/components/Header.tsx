import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border-subtle bg-canvas/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-1 shrink-0">
          <span className="heading text-base text-text-primary tracking-tight">
            eivra
          </span>
          <span
            className="text-accent text-base font-bold leading-none"
            aria-hidden="true"
          >
            _
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm text-text-secondary min-w-0">
          <Link
            href="/live"
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors shrink-0"
          >
            <span className="live-dot" aria-hidden="true" />
            <span className="text-accent">Live</span>
          </Link>
          <Link
            href="/benchmark"
            className="hover:text-text-primary transition-colors shrink-0"
          >
            Benchmark
          </Link>
          <Link
            href="/trading"
            className="hover:text-text-primary transition-colors shrink-0"
          >
            Trading
          </Link>
          <Link
            href="/leaderboard"
            className="hover:text-text-primary transition-colors shrink-0"
          >
            Leaderboard
          </Link>
          <Link
            href="/agents"
            className="hover:text-text-primary transition-colors shrink-0"
          >
            Agents
          </Link>
          <Link
            href="/markets"
            className="hidden sm:block hover:text-text-primary transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/about"
            className="hidden sm:block hover:text-text-primary transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}

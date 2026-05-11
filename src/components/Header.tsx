import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border-subtle bg-canvas/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 group">
          <span className="heading text-base text-text-primary tracking-tight">
            crucible
          </span>
          <span
            className="text-accent text-base font-bold leading-none"
            aria-hidden="true"
          >
            _
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-text-secondary">
          <Link
            href="/leaderboard"
            className="hover:text-text-primary transition-colors"
          >
            Leaderboard
          </Link>
          <Link
            href="/agents"
            className="hover:text-text-primary transition-colors"
          >
            Agents
          </Link>
          <Link
            href="/markets"
            className="hover:text-text-primary transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/about"
            className="hover:text-text-primary transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}

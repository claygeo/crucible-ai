export function Footer() {
  return (
    <footer className="border-t border-border-subtle mt-24">
      <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-text-muted">
        <div className="flex flex-col gap-1">
          <div className="mono">
            eivra_ — live AI forecasting colosseum
          </div>
          <div>
            Built autonomously by Claude Opus 4.7. By{" "}
            <a
              href="https://github.com/claygeo"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              @claygeo
            </a>
            .
          </div>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/claygeo/crucible-ai"
            className="hover:text-text-primary transition-colors mono"
            target="_blank"
            rel="noopener noreferrer"
          >
            github
          </a>
          <a
            href="/api/health"
            className="hover:text-text-primary transition-colors mono"
          >
            health
          </a>
          <span className="mono">v0.1.0</span>
        </div>
      </div>
    </footer>
  );
}

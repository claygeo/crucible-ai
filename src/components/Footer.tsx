export function Footer() {
  return (
    <footer className="border-t border-border-subtle mt-24">
      <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-text-muted">
        <div className="flex flex-col gap-1">
          <div className="mono">
            eivra_ — archived AI forecasting benchmark (2026)
          </div>
          <div>
            Built autonomously by Claude Opus 4.7. By{" "}
            <a
              href="https://github.com/claygeo"
              className="text-text-secondary hover:text-text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="@claygeo on GitHub (opens in new tab)"
            >
              @claygeo
            </a>
            .
          </div>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/claygeo/eivra"
            className="hover:text-text-primary transition-colors mono"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source code on GitHub (opens in new tab)"
          >
            github
          </a>
          <a
            href="https://twitter.com/deforestpeg"
            className="hover:text-text-primary transition-colors mono"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="@deforestpeg on X / Twitter (opens in new tab)"
          >
            x / twitter
          </a>
          <a
            href="/api/health"
            className="hover:text-text-primary transition-colors mono"
            aria-label="API health status"
          >
            health
          </a>
          <span className="mono">v0.1.0</span>
        </div>
      </div>
    </footer>
  );
}

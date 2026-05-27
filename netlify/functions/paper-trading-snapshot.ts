declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

const DEFAULT_QUERY = {
  sample: "live_only",
  agent: "all",
  category: "all",
  side: "all",
  min_edge: "0.1",
  stake_mode: "kelly_capped",
  ticket_usd: "25",
  max_stake_usd: "100",
  max_open_exposure_usd: "500",
};

function siteUrl(): string | null {
  return Netlify.env.get("DEPLOY_URL") ?? Netlify.env.get("URL") ?? null;
}

export default async () => {
  const baseUrl = siteUrl();
  const secret = Netlify.env.get("CRON_SHARED_SECRET");

  if (!baseUrl || !secret) {
    return new Response(
      JSON.stringify({
        error: "unconfigured",
        message: "URL and CRON_SHARED_SECRET are required.",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  const url = new URL("/api/trading-snapshots", baseUrl);
  for (const [key, value] of Object.entries(DEFAULT_QUERY)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "text/plain" },
  });
};

export const config = {
  schedule: "12 5 * * *",
};

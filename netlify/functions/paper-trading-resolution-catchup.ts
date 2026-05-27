declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
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
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const url = new URL("/api/trading-resolution-catchup", baseUrl);
  url.searchParams.set("limit", "50");
  url.searchParams.set("dry_run", "false");

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
    headers: {
      "content-type": response.headers.get("content-type") ?? "text/plain",
    },
  });
};

export const config = {
  schedule: "2 5 * * *",
};

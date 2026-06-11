import type { MetadataRoute } from "next";
import { AGENTS } from "@/lib/agents";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://eivra.xyz";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/live`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/benchmark`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/agents`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/markets`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${base}/trading`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];

  const agentPages: MetadataRoute.Sitemap = AGENTS.map((agent) => ({
    url: `${base}/agents/${agent.id}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticPages, ...agentPages];
}

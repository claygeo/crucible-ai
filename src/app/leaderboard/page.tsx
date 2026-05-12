import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Leaderboard } from "@/components/Leaderboard";
import { getAgentStats } from "@/lib/data";

export const revalidate = 120; // 2-min ISR so backfill updates show fast

export const metadata = {
  title: "Leaderboard — Eivra",
};

export default async function LeaderboardPage() {
  const stats = await getAgentStats();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="heading text-3xl text-text-primary tracking-tight">
            Leaderboard
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl">
            Composite Eivra Score = 50% normalized Brier · 30% win rate · 20%
            normalized log-loss. Ranked over the last 30 days of resolved
            markets.
          </p>
        </div>
        <Leaderboard stats={stats.rows} source={stats.source} />
      </main>
      <Footer />
    </div>
  );
}

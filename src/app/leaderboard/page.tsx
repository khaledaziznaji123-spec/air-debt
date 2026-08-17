import Board from "./board.tsx";

export const metadata = {
  title: "Air Debt — leaderboards",
};

/**
 * Not behind `SignedIn`, unlike `/play` and `/home`.
 *
 * A leaderboard is the one page worth showing to somebody who has not made an
 * account: it is the argument for making one. Signing in only adds the marker
 * on your own rows.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Read on the server and passed down as the initial state rather than sniffed
  // off `location` in an effect, for the same reason `/play` does it: an effect
  // sets state after the first paint, so the page would show the riches board
  // for a frame and then swap. The home screen's Speed run card links straight
  // here with `?board=speed`, and landing on the wrong board is the one thing
  // that link must not do.
  return (
    <Board
      board={params.board === "speed" ? "speed" : "riches"}
      period={params.period === "all" ? "all" : "week"}
    />
  );
}
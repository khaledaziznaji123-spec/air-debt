import { NextResponse } from "next/server";
import { userFromToken } from "../../../server/progress.ts";
import { top, weekStart } from "../../../server/leaderboard.ts";
import { BOARDS, type Board } from "../../../sim/score.ts";

/**
 * Reading a board.
 *
 * The only endpoint in the game that answers without a token. A leaderboard is
 * public by definition and the rows hold nothing private — a score, a time and
 * a name the player chose. A signed-in caller gets one thing extra: `mine` set
 * on their own rows, so the page can find them without the client having to
 * work out which of a hundred "scavenger"s is it.
 *
 * `period` is a fixed set rather than a date the caller supplies. An open
 * `since` parameter would let anyone ask for an arbitrary window, which is a
 * fine feature and a bad default — every distinct window is a query the indexes
 * were not built for.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("board") ?? "riches";
  if (!BOARDS.includes(asked as Board))
    return NextResponse.json({ error: "Unknown board." }, { status: 400 });
  const board = asked as Board;

  const period = url.searchParams.get("period") === "week" ? "week" : "all";

  // Optional. No token is not an error here; it just means no row is `mine`.
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  const userId = /^bearer$/i.test(scheme) && token
    ? await userFromToken(token)
    : null;

  try {
    const rows = await top(board, {
      since: period === "week" ? weekStart() : undefined,
      limit: 100,
      userId,
    });
    return NextResponse.json({ board, period, rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
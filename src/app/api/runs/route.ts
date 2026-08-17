import { NextResponse } from "next/server";
import { userFromToken } from "../../../server/progress.ts";
import { start, submit } from "../../../server/leaderboard.ts";

/**
 * A run's two ends: opening one, and handing in the log.
 *
 * WHO is always taken from the bearer token and never from the body, the same
 * as `/api/progress`. A user id in a payload is a user id the caller picked.
 *
 * There is deliberately no way in here to state a score, a seed, or a starting
 * tank. `start` decides all three and writes them down; `submit` replays
 * against exactly those. The only thing this endpoint accepts from the outside
 * is which keys were held on which tick, which is the one thing the player
 * genuinely owns.
 *
 * Replaying twenty minutes of ticks is real work, so this route is a natural
 * thing to hammer. `submit` bounds the log length and refuses a run that has
 * already been handed in; a rate limit in front of it would be the next thing
 * to add if this ever gets abused.
 */

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return /^bearer$/i.test(scheme) && token ? token : null;
}

export async function POST(request: Request) {
  const userId = await userFromToken(bearer(request));
  if (!userId)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "start":
        return NextResponse.json(await start(userId));
      case "submit": {
        const result = await submit(
          userId,
          typeof body.runId === "string" ? body.runId : "",
          Array.isArray(body.log) ? body.log : [],
        );
        return "error" in result
          ? NextResponse.json(result, { status: 400 })
          : NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
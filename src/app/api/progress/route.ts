import { NextResponse } from "next/server";
import {
  buy,
  load,
  userFromToken,
  wear,
} from "../../../server/progress.ts";

/**
 * The one door into a player's balances.
 *
 * GET reads your own progress. POST does one of two things to it, chosen by an
 * `action` field. One route rather than two because they share every line of
 * the important part — working out who is asking — and that is not a check you
 * want two copies of.
 *
 * THERE IS NO "bank" ACTION, and its absence is the point. It used to take the
 * run's haul from the browser and clamp it to a per-run ceiling, which meant
 * anyone signed in could post that ceiling from a console without playing.
 * Loot is credited by `/api/runs` now, out of a replay of the run, and there is
 * no longer any request anywhere that adds to a balance by asking.
 *
 * WHO is always taken from the bearer token and never from the body. A user id
 * in a payload is a user id the caller picked.
 */

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return /^bearer$/i.test(scheme) && token ? token : null;
}

async function whoever(request: Request) {
  const userId = await userFromToken(bearer(request));
  return userId;
}

export async function GET(request: Request) {
  const userId = await whoever(request);
  if (!userId)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    return NextResponse.json({ progress: await load(userId) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await whoever(request);
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
      case "buy": {
        const id = typeof body.item === "string" ? body.item : "";
        const result = await buy(userId, id);
        return "error" in result
          ? NextResponse.json(result, { status: 400 })
          : NextResponse.json(result);
      }
      case "wear": {
        const result = await wear(userId, {
          skin: body.skin as string | null | undefined,
          pet: body.pet as string | null | undefined,
        });
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

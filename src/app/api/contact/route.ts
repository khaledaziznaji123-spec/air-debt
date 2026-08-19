import { NextResponse } from "next/server";
import { userFromToken } from "../../../server/progress.ts";
import { send } from "../../../server/support.ts";

/**
 * The support form.
 *
 * Answers without a token on purpose. Somebody who cannot sign in is exactly
 * the person most likely to need to write, and a support form behind a login is
 * a support form that misses the one report worth having.
 *
 * A token is still read if one is offered, so a signed-in message carries the
 * account it came from and can be matched to a save file without asking the
 * sender to describe it. As everywhere else in this codebase, that identity
 * comes from the token and never from the body — a `userId` field in the
 * request would be a way to sign somebody else's name to a complaint.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const b = payload as Record<string, unknown>;
  if (
    typeof b?.name !== "string" ||
    typeof b?.email !== "string" ||
    typeof b?.body !== "string"
  ) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  const userId =
    /^bearer$/i.test(scheme) && token ? await userFromToken(token) : null;

  try {
    const result = await send({
      name: b.name,
      email: b.email,
      body: b.body,
      userId,
      agent: request.headers.get("user-agent"),
    });
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    // The real reason is in the server log. What comes back to a form is what a
    // person can act on, and "Supabase returned PGRST205" is not that.
    return NextResponse.json(
      { error: "Something broke on our side. Try again in a moment." },
      { status: 500 },
    );
  }
}
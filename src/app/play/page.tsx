import Game from "./game";
import SignedIn from "../signed-in.tsx";

export const metadata = {
  title: "Air Debt — play",
};

// Game is a client component and only touches PixiJS inside an effect, so the
// server renders an empty canvas and the renderer attaches after hydration.
//
// `?shop=1` is how the home screen's Shop corner gets here. Read on the server
// and passed down as the initial state rather than sniffed off `location` in an
// effect: an effect would set state after the first paint, which is both a
// cascading render and a hydration mismatch — the server would have rendered
// the lobby and the client would immediately replace it with the shop.
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      {/*
        Outside the sign-in gate on purpose.
        A phone held upright cannot play this whichever side of signing in it is
        on — the game is a fixed 16:9 canvas and portrait makes it a postage
        stamp. Inside the gate, a signed-out visitor got no explanation at all,
        just a small dark rectangle. It is CSS-only: see `.rotate-nudge` in
        globals.css, which matches on a coarse pointer so a narrow desktop
        window is never nagged.
      */}
      <div className="rotate-nudge">
        <p className="font-mono text-sm tracking-[0.2em] text-[#5fd9cf] uppercase">
          Turn your phone
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-[#8a94a6]">
          Air Debt is played sideways. Rotate to landscape and the controls
          appear under your thumbs.
        </p>
      </div>
    <SignedIn>
      <Game
        openShop={params.shop !== undefined}
        tutorial={params.tutorial !== undefined}
        ranked={params.ranked !== undefined}
      />
    </SignedIn>
    </>
  );
}

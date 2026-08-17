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
    <SignedIn>
      <Game
        openShop={params.shop !== undefined}
        tutorial={params.tutorial !== undefined}
        ranked={params.ranked !== undefined}
      />
    </SignedIn>
  );
}

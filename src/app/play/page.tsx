import Game from "./game";

export const metadata = {
  title: "Air Debt — play",
};

// Game is a client component and only touches PixiJS inside an effect, so the
// server renders an empty canvas and the renderer attaches after hydration.
export default function PlayPage() {
  return <Game />;
}

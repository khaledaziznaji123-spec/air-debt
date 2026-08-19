import Link from "next/link";
import ContactForm from "./form";
import Faqs from "./faqs";

export const metadata = {
  title: "Air Debt — support",
};

/**
 * How to reach the person who made this.
 *
 * The home screen has had a "Contact us" corner since the first version of it,
 * and until now it was a label with nowhere to go — it rendered, you clicked it,
 * and nothing happened. Worse than not having it.
 *
 * Every channel here is a real one, given deliberately and knowing the page is
 * public: a number on an open page is scraped within days and the spam is
 * permanent. That trade was made on purpose in favour of being easy to reach,
 * so it should not be quietly undone later — if these ever need to come down,
 * that is a decision, not a tidy-up.
 *
 * A server component: nothing on it moves, so there is no reason to ship any
 * JavaScript for it.
 */

/** One place to change a number rather than four. */
const WHATSAPP = { display: "+971 52 513 4070", dial: "971525134070" };
const DISCORD = "crusher_21_33";

const WAYS = [
  {
    label: "WhatsApp",
    value: WHATSAPP.display,
    // wa.me wants the number with no plus, no spaces and no punctuation.
    href: `https://wa.me/${WHATSAPP.dial}`,
    note: "Fastest. Messages get read.",
    external: true,
  },
  {
    label: "Phone",
    value: WHATSAPP.display,
    // `tel:` needs the international form to work from outside the country,
    // which is the whole point of putting it on a public page.
    href: `tel:+${WHATSAPP.dial}`,
    note: "Same number, if you would rather talk.",
    external: false,
  },
  {
    label: "Discord",
    value: DISCORD,
    // A username rather than a link. Discord has no reliable public URL for a
    // user — the /users/ form needs a numeric id, not a handle — so linking it
    // would send people to a page that does not exist.
    href: null,
    note: "Add me, or say hello in a shared server.",
    external: false,
  },
];

export default function ContactPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/home"
          className="rounded-full border border-[#2b3644] px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#8a94a6] uppercase transition-colors hover:border-lens/50 hover:text-lens"
        >
          ← Home
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/privacy"
            className="text-xs font-semibold tracking-[0.16em] text-[#6b7a89] uppercase transition-colors hover:text-[#e7ecf2]"
          >
            Privacy
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold tracking-[0.16em] text-[#6b7a89] uppercase transition-colors hover:text-[#e7ecf2]"
          >
            About the game
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#e7ecf2]">
          Support
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b7a89]">
          Air Debt is made by one person. Anything you send here reaches me
          directly — bugs, ideas, a score you think is wrong, or a conversation
          about the project. The answer may already be below.
        </p>
      </div>

      <Faqs />

      {/* The form first and the channels under it.
          A form asks for a sentence; a phone number asks somebody to start a
          conversation with a stranger, and the people who would never do the
          second are exactly the ones whose bug reports are worth having. Both
          are here, in the order most people will use them. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-[#5fd9cf] uppercase">
          Send a message
        </h2>
        <ContactForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-[#5fd9cf] uppercase">
          Or reach me directly
        </h2>

        <ul className="flex flex-col gap-3">
          {WAYS.map((way) => (
          <li
            key={way.label}
            className="rounded-lg border border-[#1c2531] bg-[#10151d] p-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs tracking-[0.2em] text-[#5fd9cf] uppercase">
                {way.label}
              </span>
              {way.href ? (
                <a
                  href={way.href}
                  {...(way.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="font-mono text-base text-[#e7ecf2] underline decoration-[#2b3644] underline-offset-4 transition-colors hover:decoration-lens hover:text-lens"
                >
                  {way.value}
                </a>
              ) : (
                /* Selectable rather than a dead link, so it can be copied. */
                <span className="font-mono text-base text-[#e7ecf2] select-all">
                  {way.value}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-[#6b7a89]">{way.note}</p>
          </li>
        ))}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-[#5a6875]">
        Reporting something broken? Say what you were doing and roughly when —
        every run is recorded as the keys that were pressed, so a run can be
        replayed exactly as it happened and the bug found rather than guessed at.
      </p>
    </main>
  );
}
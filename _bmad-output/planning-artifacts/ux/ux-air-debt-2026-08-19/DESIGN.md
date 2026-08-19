# DESIGN — Air Debt

**Written 2026-08-19, from the built product.**

This document is honest about its own order. The UX pass was skipped: the
simulation, the renderer and the run loop were built straight from the PRD and
the architecture spine, and the design decisions were made in the code as they
came up. So this is not a specification that was handed to a builder — it is the
system that ended up existing, written down so the next change can be consistent
with it instead of guessing.

Everything below is checkable against `src/app/globals.css`, `src/render/` and
the pages themselves. If a rule here and the code disagree, the code is what
users see, and one of the two is a bug.

---

## 1. The idea the design serves

**The player is running out of air.** Every visual decision answers to that. The
palette is cold, the light is scarce, and the one warm thing on the screen is
the number counting down. A menu in default greys in front of this game reads as
a different piece of software, which is why the shell is lit by the same lamp as
the dungeon.

Three states the design must always distinguish, at a glance and without reading:

| State | How it reads |
|---|---|
| **Alive, with time** | The lens glows. Cyan is present. |
| **Alive, nearly out** | The clock turns to the warning red; the flash is the only full-screen event. |
| **Carrying something** | Brass. Gems and gold are the only warm colour in the dungeon. |

---

## 2. Colour

Lifted directly from `src/app/globals.css`, which is the single source. Nothing
should introduce a colour that is not in this table.

| Token | Hex | What it means | Rule |
|---|---|---|---|
| `--background` | `#0B0E14` | The dungeon, and every page | Ground for everything |
| `--foreground` | `#DFE6EF` | Text | Never pure white |
| `--lens` | `#5FD9CF` | **Oxygen. Alive. Time remaining.** | **Reserved.** Nothing else in the game may use this colour. It is the brightest thing on the player sprite and the only colour that means "you are still breathing" |
| `--brass` | `#F0B73F` | Gems, gold, what you carried back | Loot, and loot only |
| `--rock` / `--rock-edge` | `#232C39` / `#46586E` | Surfaces and borders | Structure, never emphasis |
| `--punch` | `#F2678F` | Menu accent | **Menu only.** The dungeon has no pink in it |
| `--sprout` | `#7FD06A` | Menu accent | **Menu only.** Same reason |
| warning red | `#E56B6F` | The clock under ten seconds, and errors | Danger, and only danger |

### The shop is deliberately the wrong colour

| Token | Hex |
|---|---|
| `--shop-bg` | `#2C1F26` |
| `--shop-card` | `#F7E9D8` |
| `--shop-ink` | `#4D382F` |
| `--shop-honey` | `#F0A93C` |

Warm where everything else is cold, and light where everything else is dark.
**The dungeon is lit at "you are running out of air" and the menu is lit at
"press this". The shop is neither — it is the one room in the game that nothing
is chasing you in, so it is the one room that gets to be cosy.** Cream shelves,
warm brown ink, honey and coral for anything that matters.

This works because the pixel icons carry their own dark outlines, so they still
read on a cream card instead of dissolving into it.

### Why the menu has colours the dungeon does not

Four game modes that all look alike is a list. Four that do not is a choice.
`--punch` and `--sprout` exist only so the home screen can differentiate modes
at a glance — and they are forbidden below ground, so the dungeon never inherits
menu language.

---

## 3. Type

| Role | Face | Where |
|---|---|---|
| Display / HUD / data | **Monospace** (Geist Mono, Consolas) | The clock, every number, every label, page headings |
| Body | **Geist Sans** | Explanations, the landing page, support answers |

**The HUD is monospace because a countdown that changes width as it counts is a
countdown that jitters.** Once the HUD was monospace, everything that reports a
fact became monospace too — scores, gem counts, shortcut fractions — and the
split settled into: *sans explains, mono reports*.

Uppercase labels carry wide letter-spacing (`0.16em`–`0.25em`). It is the
signage voice: short, spaced, and never used for a sentence.

---

## 4. Layout and the press

- **The stage is 1280×720, always.** A fixed 16:9 canvas stretched to fit. It is
  not responsive and must not become responsive: a different playfield on a
  different device is a different game, and it would break replay verification.
  This is a design constraint that comes from the architecture, and it is the
  reason the phone is asked to turn rather than reflowed.
- **Buttons are pressed, not clicked.** `border-b-4` with `active:border-b-2`
  and a translate — the button physically goes down. Cheap, and it makes a
  keyboard-and-mouse menu feel like a game rather than a form.
- **Rounded, but not soft.** `rounded-2xl` on panels, `rounded-full` on
  controls, two-pixel borders throughout. Hard edges everywhere would read as a
  terminal; soft everything would read as a productivity app.
- **No emoji anywhere in the game or the home screen.** They are a different
  art style, and a screen with pixel art on it cannot also have Apple's
  illustrations on it.

---

## 5. Art

- **168 frames, all generated by scripts** in `art-src/*.py`. Nothing was drawn
  by hand and nothing was licensed. The consequence for design: a change to the
  palette is a re-run, not a repaint.
- **`image-rendering: pixelated` everywhere.** A blurred pixel is a mistake.
- **The menu's looping run is CSS**, not a canvas. Three scroll speeds — far
  wall slow, floor fast, runner in place — and the difference between the rates
  is the entire illusion of travel. A canvas would mean booting a second
  renderer for a decoration.

---

## 6. Sound

Every noise is **synthesised at the moment it plays**. There is not one audio
file in the project. Design consequences worth keeping:

- Each monster has its own voice in a `VOICE` table, so a threat is identifiable
  before it is visible.
- A **telegraph** sound precedes every attack that can be parried. The 0.3s
  parry window is only fair if it can be heard as well as seen.
- The interface has its own layer: opening the shop, buying, choosing a mode,
  and changing a setting all sound different from each other and from the game.

---

## 7. Accessibility, and what it is honestly not

**Done:**

- **Reduce flashing** damps the full-screen colour flash to a fifth rather than
  removing it — the flash marks a real event, and deleting it would take away
  information. It is not a small thing to somebody photosensitive, and there was
  no reason for it to be unavoidable.
- **`prefers-reduced-motion`** stops the menu's scrolling dungeon and the
  swaying sign.
- **Fully rebindable keys**, including removing a binding entirely.
- **On-screen controls are movable and resizable**, per device.
- Volume and mute, live, without restarting a run.
- Every control has an accessible name; focus is visible.

**Not done, and not pretended:**

- **No colourblind mode.** Brass-vs-lens is the one distinction that carries
  meaning by colour alone, and it is not currently backed by a second channel.
  This is a real gap.
- **No screen-reader path through the game itself.** A timed action game is not
  reachable that way without being a different product.
- **No language but English.** A picker offering a translation nobody has
  written is a lie with a flag next to it.

---

## 8. The rule the whole design is held to

**Nothing on a settings page may be a greyed-out promise.** Volume did not
appear until there was sound. The on-screen pad's arranger did not appear until
there was a pad. Resolution is still absent, because the canvas is a fixed size
stretched to fit and there is nothing to change.

A screen full of disabled controls tells a player the product is unfinished
everywhere. A short screen where everything works tells them it is small and
solid. **The second is true, so the second is what is shown.**
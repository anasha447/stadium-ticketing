---
name: stadium-design-system
description: The design system of the stadium ticketing web app (frontend/stadium-site) - colour tokens, typography, spacing, glass panels, seat colours in 3D, motion rules and UI wording. Use it for every change under frontend/, whenever a screen, component, style, animation, Three.js scene, or piece of UI copy is created, restyled or reviewed, even if the request does not mention design. Read it before frontend-design, impeccable or ui-taste so their output lands inside this system.
---

# Stadium design system

One idea drives every choice: **a night match under floodlights**. The page is the dark
sky, the stadium is the lit object, and the interface is thin glass laid over it. The
stadium is the hero, so the UI stays quiet and gets out of its way.

The tokens are in [`assets/tokens.css`](assets/tokens.css). They are the source of truth:
`frontend/stadium-site/app/globals.css` carries a copy of them, and a change is made in
both places in the same commit. Use the tokens through Tailwind utilities
(`bg-night-900`, `text-flood-50`); a raw hex value in a component means a token is
missing, so add the token instead.

## Colour

Colour has three separate jobs. Keeping them apart is what makes the screen readable.

**1. Interface: night and floodlight.** Backgrounds are `night-950` to `night-800`. Text is
`flood-50`, with `flood-300` for secondary and `flood-500` for hints. Nothing in the
chrome is saturated.

**2. Action: one orange.** `signal-500` is used for the one thing the Fan should do next
on this screen ("Join the Waiting Room", "Hold seats", "Pay") and for nothing else. An
isolated, high-contrast control is what actually gets pressed; the hue matters less than
the fact that it is alone. Two orange buttons on one screen cancel each other, so the
second one becomes a ghost button. Text on orange is `signal-ink`.

**3. Seats: two modes, never mixed.**

| Mode | When | Seat colours |
|---|---|---|
| **Mosaic** | Stadium view | `seat-blau`, `seat-grana`, and `seat-or` for the marks (Spotify symbol, crest, "FC BARCELONA"). Realistic: this is what the stadium looks like |
| **State** | Block view and Seat view | available = its Tier colour · held = `state-held`, pulsing · sold = `state-sold` with a seated fan · yours = `state-mine` outline |

The four Tier colours (`tier-premium`, `tier-1`, `tier-2`, `tier-3`) were chosen to stay
apart from amber and from each other for colour-blind Fans, and they also colour the
legend. A state is never carried by colour alone: held pulses, sold has a figure, yours
has an outline, and the hover card says the state in words.

`ok`, `warn` and `danger` are for messages only, never for seats.

### Honest urgency

The conversion levers on this site are true facts shown clearly: the Hold countdown, the
seats left in a Block, the position in the Waiting Room. Show them, in tabular numerals,
where the decision is made. Do not invent pressure ("12 people are looking at this
seat", fake timers, pre-ticked extras). It is dishonest, and this project's whole
argument is fairness.

The countdown is `flood-50` until 60 seconds remain, then `warn`, then `danger` under
15 seconds. That change is the only place the interface raises its voice.

## Typography

| Role | Font | Use |
|---|---|---|
| Display | **Big Shoulders** (800, uppercase, the `display` utility) | fixture names, screen titles, Block numbers, big numerals. It is cut like stadium signage |
| Text | **Geist** | everything read as a sentence, labels, buttons |
| Data | **Geist Mono**, tabular (the `data` utility) | countdown, prices, seat ids, queue position: anything that changes while you look at it, so digits do not jump |

Scale (rem): 0.75 · 0.875 · 1 · 1.125 · 1.5 · 2.25 · 3.5 · 5.5. Display sizes use
`clamp()` so a fixture title fills a phone and a desktop alike. Body text is never below
0.875rem; hints are 0.75rem and never carry something the Fan must read to proceed.
Uppercase is for display and short labels only (tracking +0.06em), never for sentences.

## Layout

- The 3D canvas is full-screen and sits under everything. Panels float over it and
  cover as little of it as they can: a top bar, a legend, one card, one drawer.
- Spacing is a 4px grid: 4, 8, 12, 16, 24, 32, 48, 64.
- Radii: 16px panels, 10px controls, full for pills. Seats and the mini-map stay square.
- **Glass** (`.glass` in the tokens) is only for panels over the canvas. On ordinary
  pages (match list, checkout, tickets) surfaces are solid `night-900`; glass with
  nothing behind it is just grey.
- Phone: panels dock to the bottom as sheets, the legend collapses to a chip, the
  mini-map shrinks to a corner. Touch targets are at least 44px. A seat is too small to
  tap in Stadium view by design; tapping picks the Block.
- One screen, one job, one orange button.

## Motion

Read [`references/motion.md`](references/motion.md) before writing any animation or
camera move. The short version: motion explains where the Fan is going (stadium → Block
→ seat) or what just changed (a seat was taken, time is running out). If it does neither,
it is removed. Everything has a reduced-motion version.

## Words

`GLOSSARY.md` is law in the UI as well as in code: Fan, Match, Level, Block, Row, Seat,
Tier, Hold, Quote, Order, Ticket, Waiting Room, Draw. So the drawer is "Your seats", not
a cart or basket; the button is "Hold seats", not "Reserve". Buttons say what happens
("Hold 3 seats for 10:00"), errors say what to do next, and prices always show the
currency. The footer carries: fan-made demo, not affiliated with FC Barcelona or Spotify.

## Working with the other skills

| Step | Skill |
|---|---|
| Starting a new screen: direction, composition | `frontend-design`, constrained by this file |
| Building a 3D model from the photos | `img2threejs`, colours from the Seats section above |
| The screen works: critique, animate, polish, audit | `impeccable` |
| Before the PR: final visual review | `ui-taste` |

If one of them proposes a new colour, font or easing, either map it to a token here or
change this file first. The system changes on purpose, not by drift.

## Checklist before saying a screen is done

- Exactly one `signal-500` control is visible.
- No raw hex values or font names in components.
- Seat state is readable without colour.
- Every number that changes uses the data font.
- It works at 375px wide, by touch, and with `prefers-reduced-motion`.
- Every word on screen is a glossary word where one exists.

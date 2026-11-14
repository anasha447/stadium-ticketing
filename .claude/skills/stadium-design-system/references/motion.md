# Motion

Two libraries, two jobs. `motion` animates the interface (panels, cards, numbers). The
3D scene animates itself inside the React Three Fiber frame loop. They do not drive
each other: the UI reacts to the view state ("stadium" | "block" | "seat"), not to
camera positions.

## Where motion earns its place

Ordered by impact. Spend effort in this order.

| # | Moment | What moves | Why it matters |
|---|---|---|---|
| 1 | **Camera flights** stadium → Block → Seat | camera position and target on one curve, 1.2–1.8s, `ease-in-out` | it is the product: the Fan understands where the seat is because they travelled there |
| 2 | **Seat view arrival** | camera settles at seated eye height, small overshoot-free ease, pitch in frame | "this is what I will see" is the moment the decision is made |
| 3 | **Waiting Room / Draw** | the Fan's marker moving through the crowd, position counting down in the data font | turns waiting into visible progress; the Draw must look fair, so everyone shuffles at once, then order is revealed |
| 4 | **Hold created** | selected seats lock (outline closes), countdown ring starts, Quote lines appear one by one, total last | confirms the seats are theirs and shows the price is now fixed |
| 5 | **Live seat changes** | a seat taken by someone else pulses amber once, then settles; a sold seat gets its fan | proves the map is live without shouting |
| 6 | **Mosaic → State** on entering a Block | seat colours cross-fade over 300ms, staggered outward from the clicked point | explains the colour change instead of surprising with it |
| 7 | **Ticket reveal** on confirmation | the Ticket slides up and the code draws in | the one celebratory moment; keep it under a second |
| 8 | Hover, press, focus | 120ms colour and 1–2px lift | feedback only |

## Rules

- **Duration by distance.** Hover 120ms, panels 220ms, drawers 420ms, camera 1.2–1.8s
  scaled by how far it flies. Nothing in the interface is slower than 420ms.
- **Arrive with `ease-out`, travel with `ease-in-out`.** No bounce, no elastic: this
  is a ticket office, and money is involved.
- **Camera flights are interruptible.** Choosing another place during a flight (a
  click, an arrow key, Escape) sends the camera there from where it is. Dragging waits
  until the camera lands, which is at most 1.8 seconds.
- **Auto-rotation stops on first touch** and does not resume until the Fan asks (the
  "360 tour" button).
- **Animate transform and opacity** in the DOM. In the scene, change instance colours
  and matrices in place; never rebuild 60K instances for an animation.
- **Numbers tick, they do not roll.** The countdown changes once a second in the data
  font. Its colour steps at 60s and 15s; it does not flash.
- **One thing moves at a time.** If the camera is flying, panels wait until it lands.

## Reduced motion

With `prefers-reduced-motion: reduce`:

- camera flights become a 200ms cross-fade cut to the destination,
- auto-rotation and the live match are off by default (a button turns them on),
- pulses become a static outline,
- the Draw shows the final order without the shuffle.

The experience must be complete this way, not degraded: every state still reads.

## Performance budget

60 fps on a mid-range laptop, 30 fps on a phone. Seats and fans are instanced. Fans on
sold seats are only drawn for the Blocks near the camera. If a frame budget is missed,
remove decoration (stars, crowd detail, LED boards) before touching the booking
animations 1–5.

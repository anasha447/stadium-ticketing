Build the 3D stadium booking experience inside the existing Next.js app (`frontend/stadium-site`), using Three.js through React Three Fiber. Don't copy any existing repo. Run it locally and test it in the browser yourself before you tell me it's done.

Words follow `GLOSSARY.md`: Fan, Match, Level, Block, Row, Seat, Tier, Hold, Quote, Order, Ticket.
Decisions that differ from the backend docs are logged in `docs/process/FRONTEND-DEVIATIONS.md`.

THE STADIUM
- Model Spotify Camp Nou in Barcelona (photos in `.claude/skills/photos/`): a football-only bowl with about 60K seats, on a rounded-rectangle plan around a 105 x 68 m pitch.
- Three Levels (lower, club, upper), stepped concrete terraces, a roof ring, an outer facade, LED boards around the pitch and two big scoreboards.
- Every Seat is its own bookable 3D seat. Split each Level into 40 numbered Blocks (101-140, 201-240, 301-340) with aisles between them. A Block is a group of Seats; a Row is one row of Seats inside a Block. Use instanced meshes so it stays smooth.
- Four Tiers: Club Premium 650, Category 1 320, Category 2 180, Category 3 90 (EUR, base prices). Best seats are along the long sides, cheapest behind the goals.
- Seat colours in stadium view are the real ones: blue and garnet seats, with the marks drawn in yellow seats.
  - Behind one goal: the Spotify symbol.
  - Left long side: the FC Barcelona crest.
  - Right long side: the text "FC BARCELONA".
  - All three in yellow, matched to the high-quality logo files in `.claude/skills/photos/`.
- Mark roughly half the seats as sold, in natural-looking clumps, and put a simple seated fan on every sold seat. Fans wear blue/garnet at one end and blue/white at the other.
- Night match atmosphere: dark sky with stars, a striped pitch with correct markings, goals, and a simple live match with 22 players, a referee and a ball moving around.

THE EXPERIENCE (Waiting Room, then three levels of view)
0. Waiting Room: the Fan registers, waits, and sees their position move through the Draw with a proper animation, then is admitted into the stadium.
1. Stadium view: drag to spin the stadium 360 degrees, scroll to zoom, slow automatic rotation until I touch it, plus a "360 tour" button. Hovering a Block highlights it and shows its number, Tier, price and seats left. Seats show the blue/garnet/yellow mosaic.
2. Block view: clicking a Block (or tapping it on the mini-map) flies the camera in close so single seats are easy to click. Here the colours change from the mosaic to Seat State: available, held, sold, yours. Hovering a seat shows Block, Row, seat number, price and a view score.
3. Seat view: clicking an available seat flies the camera smoothly into that exact seat at seated eye height, looking at the pitch. I can drag to look around 360 degrees and scroll to zoom. Arrow keys and buttons jump to the next available seat or Row. This must show exactly what the match looks like from that seat.

BOOKING
- A seat card in seat view: Block, Row, seat, Level, Tier, price, a view score out of 100 (based on distance, height and angle to the pitch) and distance to the touchline, with an "Add seat" button.
- A "Your seats" drawer for up to 4 seats (the Hold and Purchase Limit), with "View from seat" and "Remove" on each.
- "Hold seats" creates the Hold: a countdown starts and the Quote appears. The total always comes from the Quote (Group Discount included). No service fee.
- Checkout follows the backend flow: mobile number and a fake one-time code, then Apple Pay or card. No real payment and no card fields. Say clearly that it is a demo.
- A confirmation screen with the Order reference and a Ticket per seat with a decorative QR-style code. My seats then show as mine in the stadium. They come from the mock API, which remembers them in localStorage, with a way to reset.

INTERFACE
- Dark glass panels over a full-screen 3D canvas: top bar with the fixture (FC Barcelona vs Espanyol, the Barcelona Derby) and the "Your seats" button, breadcrumbs (Stadium > Block > Seat), a price legend that filters seats by Tier, a top-down mini-map that shows where I am sitting and which way I am looking, and a short hint line.
- Must work with mouse and touch, and adapt to phone screens.
- Footer line: fan-made demo, not affiliated with FC Barcelona or Spotify.

Fixture, prices and sold seats are demo data. When you finish, tell me how to run it and what is stylised rather than accurate.

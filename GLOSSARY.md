# Stadium Ticketing

Selling a fixed number of football-stadium seats per match to a flash crowd, fairly and
without overselling. These words are the project's language: use them in code, tables,
topics, tickets and commits, and never the words listed under _Avoid_. A new term enters
this file in the same PR that introduces it. (⭐ marks stretch-goal concepts.)

## People

**Fan**:
A person who buys tickets for a Match and enters the stadium.
_Avoid_: customer, user, buyer

**Admin**:
A staff member who manages Matches and their Seat Maps.
_Avoid_: operator

**Steward**:
A staff member who checks Tickets at the stadium gates.
_Avoid_: scanner, guard

## Matches

**Match**:
One football fixture with seats for sale.
_Avoid_: event, game

**Standings**:
The league table the Match belongs to.
_Avoid_: ranking

**Importance**:
How much a Match matters (a derby, a title decider); it raises the price.
_Avoid_: hype

**Final Score**:
The result of a finished Match.
_Avoid_: result

## Seats

**Seat Map**:
All the Seats of one Match, grouped into Levels, Blocks and Rows.
_Avoid_: layout, venue map

**Level**:
One of the three floors of the stadium: lower, club or upper.
_Avoid_: tier, deck, ring

**Tier**:
The price class of a Seat, from best to cheapest: Club Premium, VIP 1, VIP 2 or Standard.
_Avoid_: class, price band, category

**Block**:
A numbered group of Seats on one Level, with aisles on both sides (101–140, 201–240, 301–340).
_Avoid_: section, zone, area, segment

**Row**:
One line of Seats inside a Block. Seats are adjacent only inside one Row.
_Avoid_: line

**Seat**:
One place a Fan can buy for a Match.
_Avoid_: spot, place

**Seat State**:
Whether a Seat is available, held or sold right now.
_Avoid_: status, availability

**Seat Claim**:
The permanent record that a Seat was sold (or that the sale was cancelled).
_Avoid_: booking, sale row

**Warmup**:
Rebuilding the live Seat States of a Match from the permanent records.
_Avoid_: sync, cache load

**Occupancy**:
How many Seats of a Match are available, held and sold.
_Avoid_: stats

**Hold**:
A short, all-or-nothing lock of 1–4 Seats for one Fan while they pay; it expires on its own.
_Avoid_: reservation, lock, cart

**Run**:
Consecutive free Seats inside one Row.
_Avoid_: streak, range

**Orphan**:
A single free Seat left alone by an allocation, which is hard to sell.
_Avoid_: gap, single

**Allocator**:
The part that picks the best Run when a Fan asks for seats together.
_Avoid_: picker, assigner

## Prices

**Base Price**:
The starting price of a Seat's Tier, before Importance, Time Decay and the Group Discount.
_Avoid_: list price, face value

**Price Override**:
A Match's own Base Price for a Tier, set by an Admin before booking opens.
_Avoid_: custom price, special price

**Quote**:
The fixed price of a Hold, given when the Hold is made and never recalculated.
_Avoid_: estimate, cart total

**Group Discount**:
A discount that grows with each extra Seat bought together, up to four.
_Avoid_: bulk discount

**Time Decay**:
A published drop in price for unsold Seats as kickoff gets closer.
_Avoid_: markdown

**Price Floor**:
The lowest price a Seat can ever have.
_Avoid_: minimum price

**Yield**:
The revenue actually earned from a Match's Seats.
_Avoid_: profit

**Booking Velocity** ⭐:
How fast Seats of a Match are being held.
_Avoid_: traffic

**Demand Multiplier** ⭐:
A capped price factor that follows Booking Velocity.
_Avoid_: surge factor

## Admission and identity

**Verified Identity**:
A Fan proven to own a phone number through a one-time code; the unit that limits and queue places count.
_Avoid_: account, user

**Device**:
The phone or browser a Fan has bound to their tickets.
_Avoid_: client

**Purchase Limit**:
The most Tickets one Verified Identity may buy for a Match: four.
_Avoid_: quota

**Registration Window**:
The period before booking opens when Fans join the Waiting Room.
_Avoid_: pre-sale

**Waiting Room**:
Where Fans wait before booking, so the crowd enters at a steady pace.
_Avoid_: queue page, lobby

**Draw**:
The random ordering of everyone in the Waiting Room when booking opens, so arrival time and speed give no advantage.
_Avoid_: lottery, raffle

**Admission Token**:
Permission for one Fan to start booking a Match.
_Avoid_: pass

**Admission Cap**:
The most Fans admitted to book one Match at the same time.
_Avoid_: capacity, slots

**Checkout Grant**:
Permission to pay for one specific Hold; it ends with the Hold.
_Avoid_: session

**Bot Risk** ⭐:
An advisory score that a visitor is automated; it adds friction, never blocks.
_Avoid_: bot flag

**Fraud Ring Detection** ⭐:
Finding groups of accounts that buy together to get around the Purchase Limit.
_Avoid_: fraud check

## Orders and tickets

**Order**:
A purchase made from exactly one Hold.
_Avoid_: booking, purchase

**Payment Attempt**:
One try at charging an Order; an Order can have several, and at most one succeeds.
_Avoid_: payment, transaction

**Idempotency Key**:
A key the client sends so that repeating the same request has the same effect as sending it once.
_Avoid_: request id

**Confirmation Saga**:
The steps that turn a paid Hold into Tickets, each with an undo step if a later one fails.
_Avoid_: checkout flow

**Outbox**:
Events stored together with the change that caused them, then published.
_Avoid_: event queue

**Ticket**:
The right of one Fan to enter for one Seat at one Match.
_Avoid_: pass

**Rotating Credential**:
The in-app code that proves a Ticket at the gate and changes every few seconds, so screenshots are useless.
_Avoid_: QR code

**Scan Ledger**:
The record of which Tickets have entered; the first scan wins.
_Avoid_: entry log

**Dispute**:
A second scan of a Ticket that has already entered.
_Avoid_: conflict

**Resale** ⭐:
Selling a Ticket back through the platform at the original price.
_Avoid_: resell, transfer

**Print Credential** ⭐:
A fixed, signed code for a printed Ticket; the Steward checks ID.
_Avoid_: barcode

**Ticket Document** ⭐:
The PDF version of a Ticket.
_Avoid_: ticket file

**Souvenir** ⭐:
A used Ticket turned into a keepsake with the Final Score.
_Avoid_: memento

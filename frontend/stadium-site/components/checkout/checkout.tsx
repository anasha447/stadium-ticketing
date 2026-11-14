"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isProblem, PROBLEM } from "@/lib/api/problem";
import {
  loadPlan,
  orderReference,
  type PaymentPlan,
  planFor,
  savePlan,
  watchOrder,
} from "@/lib/booking/checkout";
import { countdown, type CountdownTone } from "@/lib/booking/countdown";
import { parseSeatId } from "@/lib/domain/seat-id";
import type { Hold, Order, OtpChallenge, PaymentMethod, Session } from "@/lib/domain/types";
import { formatMoney, TIER_NAME } from "@/lib/format";
import { useNow } from "@/lib/hooks/use-now";

// The checkout for one Hold. It follows the backend's order: prove a mobile
// number with a one-time code, choose how to pay, then wait for the Order to
// be confirmed. The Hold's Quote and its countdown stay in view throughout.
// It is a demo: the code is shown on screen and no money moves.

const ACTION =
  "inline-flex h-12 items-center justify-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600 disabled:bg-night-800 disabled:text-flood-500";
const SMALL =
  "inline-flex min-h-11 items-center text-sm text-flood-300 underline-offset-4 hover:text-flood-50 hover:underline sm:min-h-0";
const FIELD =
  "data h-12 w-full rounded-control border border-night-700 bg-night-800 px-4 text-lg text-flood-50 placeholder:text-flood-500";
const PANEL = "flex flex-col gap-4 rounded-panel bg-night-900 p-6";

const TONE: Record<CountdownTone, string> = {
  calm: "text-flood-50",
  warn: "text-warn",
  danger: "text-danger",
};

const METHOD_NAME: Record<PaymentMethod, string> = {
  APPLE_PAY: "Apple Pay",
  CARD: "Card",
};

const pad = (n: number) => String(n).padStart(2, "0");

function seatWords(seatId: string): string {
  const seat = parseSeatId(seatId);
  return seat ? `Block ${seat.blockId}, row ${pad(seat.row)}, seat ${pad(seat.seat)}` : seatId;
}

/** sessionStorage, or nothing if the browser will not give it. */
function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

export function Checkout({ matchId, holdId }: { matchId: number; holdId: string }) {
  const now = useNow();
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdGone, setHoldGone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("APPLE_PAY");
  const [paying, setPaying] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  // Everything the page needs at once: the Hold, who the Fan is, and
  // whether they already pressed Pay for this Hold before a reload.
  useEffect(() => {
    let cancelled = false;
    const saved = loadPlan(storage(), holdId);
    // Reading storage is only possible in the browser, after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlan(saved);
    if (saved) setMethod(saved.method);
    api
      .getHold(matchId, holdId)
      .then((found) => !cancelled && setHold(found))
      .catch(() => !cancelled && setHoldGone(true));
    api
      .getSession()
      .then((found) => !cancelled && setSession(found))
      .catch(() => !cancelled && setSession({ fanId: "", verified: false }));
    return () => {
      cancelled = true;
    };
  }, [matchId, holdId]);

  // Once there is an Order, follow it until it is settled.
  const orderId = plan?.orderId;
  useEffect(() => {
    if (!orderId) return;
    return watchOrder(api, orderId, setOrder);
  }, [orderId]);

  const remember = (next: PaymentPlan) => {
    savePlan(storage(), holdId, next);
    setPlan(next);
  };

  const pay = () => {
    // The first press fixes the key and the method; a retry sends the same.
    const attempt = planFor(plan, method, () => crypto.randomUUID());
    remember(attempt);
    setPaying(true);
    setPayNotice(null);
    api
      .createOrder({ holdId, paymentMethod: attempt.method }, attempt.idempotencyKey)
      .then((made) => {
        setOrder(made);
        remember({ ...attempt, orderId: made.orderId });
      })
      .catch((error: unknown) => {
        if (isProblem(error, PROBLEM.notSignedIn)) {
          setSession((known) => (known ? { ...known, verified: false } : known));
          setPayNotice("Confirm your mobile number again, then pay.");
        } else if (isProblem(error, PROBLEM.holdExpired) || isProblem(error, PROBLEM.notFound)) {
          setHoldGone(true);
        } else if (isProblem(error, PROBLEM.orderExists)) {
          const existing = error.document.orderId;
          if (typeof existing === "string") remember({ ...attempt, orderId: existing });
        } else {
          setPayNotice("The payment could not be started just now. Try again: you will not pay twice.");
        }
      })
      .finally(() => setPaying(false));
  };

  const left = hold ? countdown(hold.expiresAt, now) : null;
  const backToSeats = `/matches/${matchId}/seats`;

  if (order) return <OrderStatus order={order} matchId={matchId} />;

  // A paid Hold is gone, so wait for the Order rather than say the Hold ran out.
  if (orderId) {
    return (
      <Page>
        <p className="text-flood-300" role="status">
          Finding your Order
        </p>
      </Page>
    );
  }

  if (holdGone || left?.expired) {
    return (
      <Page>
        <p className="max-w-md text-flood-300">
          This Hold has run out, so the seats are free again. Nothing was paid.
        </p>
        <div>
          <Link href={backToSeats} className={ACTION}>
            Choose seats again
          </Link>
        </div>
      </Page>
    );
  }

  if (!hold || !left || !session) {
    return (
      <Page>
        <p className="text-flood-300" role="status">
          Finding your Hold
        </p>
      </Page>
    );
  }

  const total = formatMoney(hold.quote.total, hold.quote.currency);
  // While a payment is on its way the Fan cannot change how they pay.
  const methodFixed = plan !== null;

  return (
    <Page>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <section className={PANEL} aria-labelledby="step-mobile">
            <h2 id="step-mobile" className="display text-2xl">
              1. Your mobile number
            </h2>
            {session.verified ? (
              <p className="text-flood-300">
                Confirmed: <span className="data text-flood-50">{session.mobile}</span>
              </p>
            ) : (
              <SignIn onSignedIn={setSession} />
            )}
          </section>

          <section className={PANEL} aria-labelledby="step-pay">
            <h2
              id="step-pay"
              className={`display text-2xl ${session.verified ? "" : "text-flood-500"}`}
            >
              2. Pay
            </h2>
            {!session.verified ? (
              <p className="text-sm text-flood-500">After your mobile number is confirmed.</p>
            ) : (
              <>
                <fieldset className="flex flex-col gap-2" disabled={methodFixed || paying}>
                  <legend className="mb-2 text-sm text-flood-300">How you pay</legend>
                  {(["APPLE_PAY", "CARD"] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex h-12 cursor-pointer items-center gap-3 rounded-control border px-4 transition-colors duration-fast has-[:disabled]:cursor-default ${
                        method === option ? "border-flood-300 bg-night-800" : "border-night-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="method"
                        value={option}
                        checked={method === option}
                        onChange={() => setMethod(option)}
                        className="accent-signal-500"
                      />
                      <span className="font-semibold">{METHOD_NAME[option]}</span>
                    </label>
                  ))}
                </fieldset>
                <p className="text-sm text-flood-300">
                  This is a demo. No card details are asked for and no money is taken.
                </p>
                {payNotice && (
                  <p role="alert" className="rounded-control border border-warn px-3 py-2 text-sm">
                    {payNotice}
                  </p>
                )}
                <button type="button" className={ACTION} onClick={pay} disabled={paying}>
                  {paying ? "Paying" : `Pay ${total}`}
                </button>
              </>
            )}
          </section>
        </div>

        {/* What is being paid for. First on a phone, so the time left is never out of sight. */}
        <section className={`${PANEL} order-1 lg:order-2`} aria-label="Your Hold">
          <div>
            <p className="text-sm text-flood-300">Held for you for</p>
            <p className={`data text-5xl ${TONE[left.tone]}`} role="timer">
              {left.text}
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-night-700 border-y border-night-700">
            {hold.quote.lines.map((line) => (
              <li key={line.seatId} className="flex items-baseline justify-between gap-3 py-2">
                <div>
                  <p className="text-sm">{seatWords(line.seatId)}</p>
                  <p className="text-xs text-flood-300">
                    {TIER_NAME[line.tier]}
                    {line.discountPercent > 0 && <>, {line.discountPercent}% off</>}
                  </p>
                </div>
                <p className="data">{formatMoney(line.price, hold.quote.currency)}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Total</p>
            <p className="data text-2xl">{total}</p>
          </div>
          <Link href={backToSeats} className={SMALL}>
            Back to the stadium
          </Link>
        </section>
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-12 sm:px-12">
      <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">Checkout</h1>
      {children}
    </main>
  );
}

/** The one-time code: send it to a mobile number, then type it back. */
function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setNotice(null);
    api
      .requestOtp(mobile.trim())
      .then((sent) => {
        setChallenge(sent);
        setCode("");
      })
      .catch((error: unknown) =>
        setNotice(
          isProblem(error, PROBLEM.otpInvalid)
            ? "Enter your mobile number with its country code, like +34 600 123 456."
            : "The code could not be sent just now. Try again.",
        ),
      )
      .finally(() => setBusy(false));
  };

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    api
      .verifyOtp(mobile.trim(), code.trim())
      .then(onSignedIn)
      .catch((error: unknown) =>
        setNotice(
          isProblem(error, PROBLEM.otpInvalid)
            ? "That code is not right, or it has run out. Check it, or send a new one."
            : "The code could not be checked just now. Try again.",
        ),
      )
      .finally(() => setBusy(false));
  };

  const alert = notice && (
    <p role="alert" className="rounded-control border border-warn px-3 py-2 text-sm">
      {notice}
    </p>
  );

  if (!challenge) {
    return (
      <form className="flex flex-col gap-3" onSubmit={send}>
        <p id="mobile-why" className="text-sm text-flood-300">
          We send a code to this number to make sure each Fan buys at most four seats.
        </p>
        <label htmlFor="mobile" className="text-sm font-semibold">
          Mobile number
        </label>
        <input
          id="mobile"
          aria-describedby="mobile-why"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+34 600 123 456"
          className={FIELD}
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          required
        />
        {alert}
        <button type="submit" className={ACTION} disabled={busy || mobile.trim() === ""}>
          {busy ? "Sending" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={confirm}>
      <p className="text-sm text-flood-300">
        We sent a 6-digit code to <span className="data text-flood-50">{mobile}</span>.
      </p>
      {challenge.demoCode && (
        <p className="rounded-control border border-night-700 px-3 py-2 text-sm text-flood-300">
          Demo: no text message is sent. Your code is{" "}
          <span className="data text-base text-flood-50">{challenge.demoCode}</span>
        </p>
      )}
      <label htmlFor="code" className="text-sm text-flood-300">
        Code
      </label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        className={`${FIELD} tracking-[0.3em]`}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        required
      />
      {alert}
      <button type="submit" className={ACTION} disabled={busy || code.length !== 6}>
        {busy ? "Checking" : "Confirm code"}
      </button>
      <p className="flex gap-6">
        <button type="button" className={SMALL} onClick={() => send()} disabled={busy}>
          Send a new code
        </button>
        <button
          type="button"
          className={SMALL}
          onClick={() => {
            setChallenge(null);
            setNotice(null);
          }}
        >
          Use another number
        </button>
      </p>
    </form>
  );
}

/** Where the Order is: on its way, paid, or failed. */
function OrderStatus({ order, matchId }: { order: Order; matchId: number }) {
  const amount = formatMoney(order.amount, order.currency);
  const reference = (
    <p className="text-sm text-flood-300">
      Order <span className="data text-base text-flood-50">{orderReference(order.orderId)}</span>
    </p>
  );

  if (order.status === "PENDING") {
    return (
      <Page>
        <section className={`${PANEL} max-w-xl`} aria-live="polite">
          {reference}
          <p className="text-xl font-semibold">Paying {amount}</p>
          <p className="text-flood-300">
            Waiting for the payment to go through. Your seats stay held meanwhile;
            you can leave this page and come back.
          </p>
        </section>
      </Page>
    );
  }

  if (order.status === "FAILED") {
    return (
      <Page>
        <section className={`${PANEL} max-w-xl`} aria-live="polite">
          {reference}
          <p className="text-xl font-semibold">The payment did not go through</p>
          <p className="text-flood-300">
            Your Hold ran out before the payment finished, so the seats are free
            again. Nothing was taken.
          </p>
          <div>
            <Link href={`/matches/${matchId}/seats`} className={ACTION}>
              Choose seats again
            </Link>
          </div>
        </section>
      </Page>
    );
  }

  return (
    <Page>
      <section className={`${PANEL} max-w-xl`} aria-live="polite">
        {reference}
        <p className="text-xl font-semibold">
          Paid <span className="data">{amount}</span>. These seats are yours:
        </p>
        <ul className="flex flex-col divide-y divide-night-700 border-y border-night-700">
          {order.seatIds.map((seatId) => (
            <li key={seatId} className="py-2 text-sm">
              {seatWords(seatId)}
            </li>
          ))}
        </ul>
        <div>
          <Link href={`/matches/${matchId}`} className={ACTION}>
            Back to the Match
          </Link>
        </div>
      </section>
    </Page>
  );
}

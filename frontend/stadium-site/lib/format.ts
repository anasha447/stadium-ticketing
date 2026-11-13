import type { Currency, Money, Tier } from "@/lib/domain/types";

// Turning values into words for the screen. Nothing here calculates a price.

/** Kickoff and booking times are shown in the stadium's time, not the Fan's. */
const VENUE_TIME_ZONE = "Europe/Madrid";
const LOCALE = "en-GB";

const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: VENUE_TIME_ZONE,
});

const shortDayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: VENUE_TIME_ZONE,
});

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: VENUE_TIME_ZONE,
});

/** "Saturday 19 December" */
export const formatDay = (iso: string) => dayFormat.format(new Date(iso));

/** "Sat 19 Dec" */
export const formatShortDay = (iso: string) =>
  shortDayFormat.format(new Date(iso)).replace(",", "");

/** "21:00" */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** "60,560" */
export const formatCount = (count: number) => count.toLocaleString(LOCALE);

/** "€650" for whole amounts, "€304.50" otherwise. */
export function formatMoney(amount: Money, currency: Currency): string {
  const whole = amount.endsWith(".00");
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(Number(amount));
}

export const TIER_NAME: Record<Tier, string> = {
  CLUB_PREMIUM: "Club Premium",
  CATEGORY_1: "Category 1",
  CATEGORY_2: "Category 2",
  CATEGORY_3: "Category 3",
};

/** Best Tier first. */
export const TIER_ORDER: Tier[] = [
  "CLUB_PREMIUM",
  "CATEGORY_1",
  "CATEGORY_2",
  "CATEGORY_3",
];

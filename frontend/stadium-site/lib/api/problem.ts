// Every failed call throws an ApiProblem: an RFC 9457 problem document.
// Screens decide what to show from `type`, never from the status alone.

export const PROBLEM = {
  seatsUnavailable: "/problems/seats-unavailable",
  // The rest are names the frontend proposed; the backend tickets confirm them.
  holdExpired: "/problems/hold-expired",
  purchaseLimit: "/problems/purchase-limit",
  invalidHold: "/problems/invalid-hold",
  bookingNotOpen: "/problems/booking-not-open",
  notAdmitted: "/problems/not-admitted",
  notFound: "/problems/not-found",
  notSignedIn: "/problems/not-signed-in",
  otpInvalid: "/problems/otp-invalid",
  idempotencyMismatch: "/problems/idempotency-mismatch",
  orderExists: "/problems/order-exists",
  unknown: "about:blank",
} as const;

export type ProblemType = (typeof PROBLEM)[keyof typeof PROBLEM];

export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail?: string;
  /** Sent with seats-unavailable. */
  conflictingSeatIds?: string[];
  [extension: string]: unknown;
}

export class ApiProblem extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly document: ProblemDocument;

  constructor(document: ProblemDocument) {
    super(document.detail ?? document.title);
    this.name = "ApiProblem";
    this.type = document.type;
    this.title = document.title;
    this.status = document.status;
    this.detail = document.detail;
    this.document = document;
  }

  get conflictingSeatIds(): string[] {
    return this.document.conflictingSeatIds ?? [];
  }
}

export function isProblem(error: unknown, type?: ProblemType): error is ApiProblem {
  return error instanceof ApiProblem && (type === undefined || error.type === type);
}

export function problem(
  status: number,
  type: ProblemType,
  title: string,
  extensions: Partial<ProblemDocument> = {},
): ApiProblem {
  return new ApiProblem({ ...extensions, type, title, status });
}

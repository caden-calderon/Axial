import { RoomServiceError } from "./errors";

export const FEEDBACK_KINDS = ["bug", "idea", "review"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const MIN_FEEDBACK_MESSAGE_LENGTH = 10;
export const MAX_FEEDBACK_MESSAGE_LENGTH = 2000;
export const MAX_FEEDBACK_JSON_BYTES = 16_384;
export const FEEDBACK_SENDER = "feedback@playaxial.dev";
/** Turnstile tokens are minted for this action, so a token from another form cannot be replayed here. */
export const FEEDBACK_TURNSTILE_ACTION = "feedback";

const MAX_NAME_LENGTH = 60;
const MAX_CONTACT_LENGTH = 120;
const MAX_CONTEXT_LENGTH = 80;
const MAX_TOKEN_LENGTH = 2048;
const MAX_LINKS = 3;
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Bug report",
  idea: "Suggestion",
  review: "Review",
};

export type FeedbackRequest = {
  kind: FeedbackKind;
  message: string;
  name: string;
  contact: string;
  turnstileToken: string;
  /** Hidden from people; anything typed here came from a bot filling every field. */
  honeypot: string;
  context: {
    mode: string;
    viewport: string;
    build: string;
  };
};

export function parseFeedbackRequest(value: unknown): FeedbackRequest {
  if (!value || typeof value !== "object") {
    throw invalid("Feedback must be a JSON object.");
  }
  const body = value as Record<string, unknown>;

  const kind = body.kind;
  if (typeof kind !== "string" || !isFeedbackKind(kind)) {
    throw invalid("Pick bug, suggestion or review.");
  }

  const message = cleanMultiline(body.message);
  if (message.length < MIN_FEEDBACK_MESSAGE_LENGTH) {
    throw invalid(
      `Write at least ${MIN_FEEDBACK_MESSAGE_LENGTH} characters so there is something to go on.`,
    );
  }
  if (message.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
    throw invalid(`Keep it under ${MAX_FEEDBACK_MESSAGE_LENGTH} characters.`);
  }
  if ((message.match(/https?:\/\/|www\./gi) ?? []).length > MAX_LINKS) {
    throw invalid("Too many links. Describe the problem in words instead.");
  }

  const name = cleanLine(body.name, MAX_NAME_LENGTH);
  const contact = cleanLine(body.contact, MAX_CONTACT_LENGTH);
  if (contact && !isEmailAddress(contact)) {
    throw invalid(
      "That email address doesn't look right. Leave it blank if you'd rather not say.",
    );
  }

  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!turnstileToken || turnstileToken.length > MAX_TOKEN_LENGTH) {
    throw new RoomServiceError(
      "auth-failed",
      "The spam check didn't finish. Try sending again.",
      403,
    );
  }

  const context =
    body.context && typeof body.context === "object"
      ? (body.context as Record<string, unknown>)
      : {};

  return {
    kind,
    message,
    name,
    contact,
    turnstileToken,
    honeypot: typeof body.website === "string" ? body.website : "",
    context: {
      mode: cleanLine(context.mode, MAX_CONTEXT_LENGTH),
      viewport: cleanLine(context.viewport, MAX_CONTEXT_LENGTH),
      build: cleanLine(context.build, MAX_CONTEXT_LENGTH),
    },
  };
}

type SiteverifyResult = {
  success: boolean;
  action?: string;
  "error-codes"?: string[];
};

/** Confirms the Turnstile token with Cloudflare; tokens are single use and expire after five minutes. */
export async function verifyTurnstile(input: {
  secret: string;
  token: string;
  remoteIp: string | null;
  fetcher?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const form = new FormData();
  form.set("secret", input.secret);
  form.set("response", input.token);
  if (input.remoteIp) form.set("remoteip", input.remoteIp);

  const response = await (input.fetcher ?? fetch)(SITEVERIFY_URL, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    return { ok: false, reason: `siteverify-http-${response.status}` };
  }

  const result = (await response.json()) as SiteverifyResult;
  if (!result.success) {
    return {
      ok: false,
      reason: (result["error-codes"] ?? ["unknown"]).join(","),
    };
  }
  // Cloudflare's test secret used in local dev returns no action at all.
  if (result.action && result.action !== FEEDBACK_TURNSTILE_ACTION) {
    return { ok: false, reason: `wrong-action:${result.action ?? "none"}` };
  }
  return { ok: true };
}

export type FeedbackEmail = {
  subject: string;
  text: string;
  replyTo?: string;
};

export function composeFeedbackEmail(
  feedback: FeedbackRequest,
  meta: { userAgent: string; country: string; receivedAt: Date },
): FeedbackEmail {
  const label = KIND_LABELS[feedback.kind];
  const summary = feedback.message.replace(/\s+/g, " ").slice(0, 60);
  const ellipsis = feedback.message.length > 60 ? "…" : "";

  const lines = [
    `${label} from ${feedback.name || "an anonymous player"}`,
    feedback.contact
      ? `Reply to: ${feedback.contact}`
      : "No reply address given.",
    "",
    feedback.message,
    "",
    "---",
    `Mode: ${feedback.context.mode || "unknown"}`,
    `Viewport: ${feedback.context.viewport || "unknown"}`,
    `Build: ${feedback.context.build || "unknown"}`,
    `Browser: ${meta.userAgent || "unknown"}`,
    `Country: ${meta.country || "unknown"}`,
    `Received: ${meta.receivedAt.toISOString()}`,
  ];

  return {
    subject: `[Axial ${label}] ${summary}${ellipsis}`,
    text: lines.join("\n"),
    ...(feedback.contact ? { replyTo: feedback.contact } : {}),
  };
}

function isFeedbackKind(value: string): value is FeedbackKind {
  return (FEEDBACK_KINDS as readonly string[]).includes(value);
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(value);
}

/** Keeps line breaks and tabs, drops other control characters, and caps runs of blank lines. */
function cleanMultiline(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** Single-line fields end up in the subject and Reply-To, so line breaks never survive. */
function cleanLine(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function invalid(message: string): RoomServiceError {
  return new RoomServiceError("invalid-message", message, 400);
}

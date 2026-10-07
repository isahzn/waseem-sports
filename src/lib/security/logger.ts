import "server-only";

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { ctx: context } : {}),
  };
  // Never log secrets, passwords, or card data — callers must redact.
  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};

/**
 * A refusal from a route handler: the HTTP status and a short code the client
 * maps to what it shows. Nothing has been changed when one is thrown.
 */
export class RequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
  }
}

/** The JSON answer for a failed request. Unexpected errors don't leak details. */
export function errorResponse(err: unknown): Response {
  if (err instanceof RequestError) {
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "failed" }, { status: 500 });
}

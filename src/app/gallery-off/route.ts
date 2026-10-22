// Where next.config.ts sends the component gallery's addresses when its switch
// is off. A plain 404 of its own: without this route, the new UI's catch-all
// page would answer the address with its not-found screen and a 200 once the
// new UI serves the site root (review P6-S12).
export function GET() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

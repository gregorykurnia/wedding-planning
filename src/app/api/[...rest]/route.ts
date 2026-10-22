// Any /api address no route handles. Since the new UI serves the site root
// (Task 7.1), its catch-all page would otherwise answer it with the not-found
// screen and a 200, which a caller would take for an answer.
function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };

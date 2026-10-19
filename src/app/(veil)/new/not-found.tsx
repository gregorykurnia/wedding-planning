import { NotHere } from "@/veil/screens/not-here/not-here";

// An address that leads nowhere in the planner (guide §5.25). It renders inside
// the new UI's layout, so the top bar stays. The catch-all page beside the
// screens calls notFound() for any address that no other page matches.
export default function NotFound() {
  return <NotHere />;
}

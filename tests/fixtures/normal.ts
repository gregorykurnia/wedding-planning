import { buildFixture, type FixtureContext } from "./build";
import { prototypeSets } from "./prototype";

/** The prototype's normal set: a planner in the middle of planning, with every screen filled. */
export default function normal(ctx: FixtureContext) {
  return buildFixture(prototypeSets().NORMAL, ctx);
}

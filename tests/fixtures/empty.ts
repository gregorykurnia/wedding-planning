import { buildFixture, type FixtureContext } from "./build";
import { prototypeSets } from "./prototype";

/** The prototype's empty set: the couple, who pays and the categories, and nothing planned yet. */
export default function empty(ctx: FixtureContext) {
  return buildFixture(prototypeSets().EMPTY, ctx);
}

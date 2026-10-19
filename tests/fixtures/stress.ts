import { buildFixture, type FixtureContext } from "./build";
import { prototypeSets } from "./prototype";

/** The prototype's stress set: thousands of records, very long and non-Latin words, deep nesting, huge and tiny values. */
export default function stress(ctx: FixtureContext) {
  return buildFixture(prototypeSets().STRESS, ctx);
}

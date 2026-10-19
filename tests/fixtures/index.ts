import empty from "./empty";
import normal from "./normal";
import stress from "./stress";

export const FIXTURES = { normal, empty, stress };

export type FixtureName = keyof typeof FIXTURES;

export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];

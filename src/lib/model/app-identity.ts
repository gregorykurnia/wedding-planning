/**
 * The planner's own name, description and colours, shown outside its pages: the
 * installed app, the browser bar and the opening screen (guide §4.31; tokens
 * section 15). The manifest and the new UI's layout both read them from here.
 */
export const APP_IDENTITY = {
  name: "Gregory & Bella's Wedding",
  shortName: "Greg & Bella",
  description: "Our wedding planner, for the two of us.",
  /** The browser bar and the installed window's title bar (`--app-theme`). */
  themeColor: "#fce6ec",
  /** The opening screen behind the mark (`--app-splash`). */
  backgroundColor: "#ffffff",
} as const;

/** What the planner is called where there are no names to show (guide §4.1, §4.31). */
export const APP_NAME = "Our wedding planner";
const SUFFIX = ` · ${APP_NAME}`;

/**
 * The screen a tab title names, when the title is in the form the pages give it ("Budget · Our
 * wedding planner"; "" for the bare app name). `undefined` for any other title, such as one that
 * already carries the names.
 */
export function screenOfTitle(title: string): string | undefined {
  if (title === APP_NAME) return "";
  return title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : undefined;
}

/**
 * A tab's title (guide §4.31): "*screen* · *what the top bar says*", so it follows the names set in
 * settings ("Budget · Greg & Bella") and reads "Budget · Our wedding planner" without them.
 */
export function tabTitle(screen: string, names: string | null): string {
  const tail = names || APP_NAME;
  return screen ? `${screen} · ${tail}` : tail;
}

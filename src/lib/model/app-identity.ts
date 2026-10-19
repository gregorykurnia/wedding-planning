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

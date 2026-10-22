import type { Ref } from "react";
import { Search } from "@/veil/icons/search";
import styles from "./tools.module.css";

type SearchFieldProps = {
  /** Hidden text that says what's searched, "Search vendors". Screen readers hear it; sighted people don't see it. */
  label: string;
  /** Says what's searched too: "Search names, contacts and notes". */
  placeholder: string;
  value: string;
  onChange: (query: string) => void;
  /** Lets the screen move focus here, such as back to the search after Clear the search. */
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * Guide §4.12. An underline field with a magnifier; the underline turns rose on
 * focus. Keep it mounted while the results below change, so it keeps focus.
 */
export function SearchField({ label, placeholder, value, onChange, inputRef }: SearchFieldProps) {
  return (
    <label className={styles.search}>
      <Search className={styles.icon} />
      <span className="sr">{label}</span>
      <input
        ref={inputRef}
        type="search"
        dir="auto"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

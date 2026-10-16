import { Search } from "@/veil/icons/search";
import styles from "./tools.module.css";

type SearchFieldProps = {
  /** Hidden text that says what's searched, "Search vendors". Screen readers hear it; sighted people don't see it. */
  label: string;
  /** Says what's searched too: "Search names, contacts and notes". */
  placeholder: string;
  value: string;
  onChange: (query: string) => void;
};

/**
 * Guide §4.12. An underline field with a magnifier; the underline turns rose on
 * focus. Keep it mounted while the results below change, so it keeps focus.
 */
export function SearchField({ label, placeholder, value, onChange }: SearchFieldProps) {
  return (
    <label className={styles.search}>
      <Search className={styles.icon} />
      <span className="sr">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

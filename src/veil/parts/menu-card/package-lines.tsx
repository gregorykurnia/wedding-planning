import { rp } from "@/lib/model/format";
import styles from "./package-lines.module.css";

export interface PackageLine {
  id: string;
  name: string;
  price: number;
  /** The package the couple lean towards, in gold italic. */
  preferred?: boolean;
}

/**
 * The packages on a finalist's card (guide §4.8): a name, a dotted leader and the
 * price. The one we're leaning towards is gold italic, as on the vendor screens.
 */
export function PackageLines({ packages }: { packages: PackageLine[] }) {
  return (
    <ul className={styles.pkgs}>
      {packages.map((pkg) => (
        <li key={pkg.id} className={pkg.preferred ? styles.preferred : undefined}>
          <span className={styles.pn} dir="auto">
            {pkg.name}
          </span>
          <span className={styles.lead} aria-hidden="true" />
          <span className={`${styles.pv} num`}>{rp(pkg.price)}</span>
        </li>
      ))}
    </ul>
  );
}

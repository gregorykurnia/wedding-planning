import type { ComponentType } from "react";
import { Back } from "@/veil/icons/back";
import { Chevron } from "@/veil/icons/chevron";
import { EnvelopeFolder } from "@/veil/icons/envelope-folder";
import { FileTypeTag } from "@/veil/icons/file-type-tag";
import { GoogleMark } from "@/veil/icons/google-mark";
import { Heart } from "@/veil/icons/heart";
import type { IconProps } from "@/veil/icons/icon-props";
import { RibbonKnot } from "@/veil/icons/ribbon-knot";
import { Search } from "@/veil/icons/search";
import { SixDotHandle } from "@/veil/icons/six-dot-handle";
import { Star } from "@/veil/icons/star";
import { StruckCloud } from "@/veil/icons/struck-cloud";
import { Tick } from "@/veil/icons/tick";
import { WhatsApp } from "@/veil/icons/whatsapp";
import styles from "./gallery.module.css";

// Every icon in the set, by the name a reader would give it. The Google mark keeps
// its brand colours; the rest take the colour around them (currentColor).
const ICONS: { name: string; Icon: ComponentType<IconProps> }[] = [
  { name: "Back", Icon: Back },
  { name: "Chevron", Icon: Chevron },
  { name: "Search", Icon: Search },
  { name: "Ribbon knot", Icon: RibbonKnot },
  { name: "Struck cloud", Icon: StruckCloud },
  { name: "WhatsApp", Icon: WhatsApp },
  { name: "Heart", Icon: Heart },
  { name: "Envelope folder", Icon: EnvelopeFolder },
  { name: "Six-dot handle", Icon: SixDotHandle },
  { name: "Star", Icon: Star },
  { name: "Tick", Icon: Tick },
  { name: "Google", Icon: GoogleMark },
];

/**
 * The icon set (Task 2.2), shown in the gallery (Task 3.0) in the text colour and
 * in the gold accent, so the currentColor drawings can be seen taking both.
 */
export function IconsDemo() {
  return (
    <>
      <p className={styles.caption}>In the text colour</p>
      <ul className={styles.icons} aria-label="Icons in the text colour">
        {ICONS.map(({ name, Icon }) => (
          <li key={name} className={styles.icon}>
            <Icon />
            <span>{name}</span>
          </li>
        ))}
        <li className={styles.icon}>
          <FileTypeTag ext="pdf" className={styles.tag} />
          <span>File type tag</span>
        </li>
      </ul>
      <p className={styles.caption}>In the gold accent (the Google mark keeps its colours)</p>
      <ul className={`${styles.icons} ${styles.gold}`} aria-label="Icons in the gold accent">
        {ICONS.map(({ name, Icon }) => (
          <li key={name} className={styles.icon}>
            <Icon />
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

import Link from "next/link";
import { EARLIER_DEMOS, GALLERY_SECTIONS, type GallerySection } from "./sections";
import styles from "./gallery.module.css";

/** The anchor of a task's section: task 3.1 is `section-3-1`. */
function sectionId(task: string) {
  return `section-${task.replace(/\./g, "-")}`;
}

function Section({ section }: { section: GallerySection }) {
  const id = sectionId(section.task);
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.section}>
      <h2 id={`${id}-title`} className={styles.heading}>
        <span className={styles.task}>Task {section.task}</span>
        {" · "}
        {section.title}
      </h2>
      {section.demo ?? (
        <p className={styles.pending}>Not built yet. Task {section.task} builds it.</p>
      )}
    </section>
  );
}

/**
 * The component gallery (Task 3.0): a section for each task that builds components,
 * the icon set, and links to the Phase 2 demos. The page checks the gallery switch.
 */
export function Gallery() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Component gallery</h1>
      <p className={styles.note}>
        Development only. This page is absent unless <code>NEXT_PUBLIC_VEIL_GALLERY</code> is{" "}
        <code>1</code>. Each section is built by the task named beside it in the redesign plan.
      </p>

      <h2 className={styles.heading}>Earlier demos</h2>
      <ul className={styles.list}>
        {EARLIER_DEMOS.map((demo) => (
          <li key={demo.href}>
            <Link href={demo.href}>{demo.title}</Link>{" "}
            <span className={styles.task}>Task {demo.task}</span>
          </li>
        ))}
      </ul>

      <h2 className={styles.heading}>Sections</h2>
      <nav aria-label="Gallery sections">
        <ol className={styles.list}>
          {GALLERY_SECTIONS.map((section) => (
            <li key={section.task}>
              <a href={`#${sectionId(section.task)}`}>{section.title}</a>{" "}
              <span className={styles.task}>Task {section.task}</span>
            </li>
          ))}
        </ol>
      </nav>

      {GALLERY_SECTIONS.map((section) => (
        <Section key={section.task} section={section} />
      ))}
    </div>
  );
}

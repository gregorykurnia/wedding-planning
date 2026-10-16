import { threadShape, type StageKind } from "./stage-text";
import styles from "./stage.module.css";

export interface StageThreadProps {
  kind: StageKind;
  /** The stored stage, such as "Consideration" or the ruled-out value. */
  stage: string;
}

/**
 * Guide §4.21: one short gold dash per step, filled up to the current stage,
 * then the stage's name in words. The dashes are decoration, so the name is
 * always there as text. Ruled out is drawn as italic words with no dashes.
 */
export function StageThread({ kind, stage }: StageThreadProps) {
  const shape = threadShape(kind, stage);
  if (shape.ruledOut) {
    return <span className={`${styles.stage} ${styles.out}`}>{shape.name}</span>;
  }
  return (
    <span className={styles.stage}>
      <span className={styles.steps} aria-hidden="true">
        {Array.from({ length: shape.steps }, (_, step) => (
          <i key={step} className={step <= shape.reached ? styles.on : undefined} />
        ))}
      </span>
      {shape.name}
    </span>
  );
}

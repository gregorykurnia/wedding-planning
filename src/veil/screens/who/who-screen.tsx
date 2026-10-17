"use client";

import { useState, type FormEvent } from "react";
import { chooseWho, startNames } from "@/lib/data/who";
import {
  MY_NAME_LABEL,
  THEIR_NAME_LABEL,
  WELCOME_TITLE,
  WHO_NAMES_FAILED,
  WHO_PICK_FAILED,
  WHO_QUESTION,
  WHO_WHY,
  continueAs,
  type Slot,
  type WhoAsk,
} from "@/lib/model/who";
import { RibbonKnot } from "@/veil/icons/ribbon-knot";
import { Btn } from "@/veil/parts/actions/btn";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Problem } from "@/veil/shell/banner";
import styles from "./who.module.css";

/**
 * After an account's first sign-in, while neither account has a name
 * (guide §5.1, N3): "Which of you is this?" with the two names, or the two
 * name fields when none are set yet. Asked once; the other account is then
 * given the other name without asking. The gate shows it, in place of the
 * screen the visitor came for, until it is answered.
 */
export function WhoScreen({
  ask,
  email,
  names,
}: {
  ask: Exclude<WhoAsk, "none">;
  email: string;
  names: { first: string; second: string };
}) {
  const [picked, setPicked] = useState<Slot | null>(null);
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const ready = ask === "choose" ? picked !== null : Boolean(mine.trim() && theirs.trim());
  const pickedName = picked === null ? null : names[picked];

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      if (ask === "choose" && picked) await chooseWho(picked);
      else await startNames(mine, theirs);
      // Saved: the settings now say who this is, and the gate lets the visitor through.
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.gate}>
        <RibbonKnot className={styles.mark} />
        <h1 className={styles.title}>{WELCOME_TITLE}</h1>
        <p className={styles.sub}>
          You’re signed in as <b>{email}</b>.
        </p>
        <form onSubmit={submit} noValidate>
          {ask === "choose" ? (
            <>
              <p className={`${styles.sub} ${styles.ask}`}>{WHO_QUESTION}</p>
              <ChipGroup
                label={WHO_QUESTION}
                // Nothing is chosen until one is pressed; the group needs a value to tab to.
                options={[
                  { value: "first", label: names.first },
                  { value: "second", label: names.second },
                ]}
                value={picked ?? ("" as Slot)}
                onChange={setPicked}
                className={styles.chips}
                chipClassName={styles.chip}
              />
            </>
          ) : (
            <div className={styles.form}>
              <Fields className={styles.bare}>
                <FieldRow label={MY_NAME_LABEL} stacked>
                  <FieldInput autoComplete="given-name" autoFocus value={mine} readOnly={saving} onChange={setMine} />
                </FieldRow>
                <FieldRow label={THEIR_NAME_LABEL} stacked>
                  <FieldInput value={theirs} readOnly={saving} onChange={setTheirs} />
                </FieldRow>
              </Fields>
            </div>
          )}
          <p className={styles.why}>{WHO_WHY}</p>
          {failed && (
            <div className={styles.problem}>
              <Problem role="alert">{ask === "choose" ? WHO_PICK_FAILED : WHO_NAMES_FAILED}</Problem>
            </div>
          )}
          <Btn type="submit" className={styles.go} disabled={!ready} busy={saving} busyLabel="Saving">
            {continueAs(ask === "choose" ? pickedName : null)}
          </Btn>
        </form>
      </div>
    </div>
  );
}

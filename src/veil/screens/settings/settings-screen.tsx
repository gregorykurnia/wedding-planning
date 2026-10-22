"use client";

import { useState, type ReactNode } from "react";
import { forgetThisDevice, sendTestReminder } from "@/lib/data/push";
import { useRemindersThatCantArrive } from "@/lib/data/schedule";
import { useSession } from "@/lib/data/session";
import { saveCoupleName, saveWeddingDate, useSettings } from "@/lib/data/settings";
import { useToday } from "@/lib/data/use-today";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { swapNames, useMembers, useWho } from "@/lib/data/who";
import { isIsoDate } from "@/lib/model/dates";
import {
  ACCOUNTS_DEMO,
  ACCOUNTS_HEADING,
  ACCOUNTS_NOTE,
  ALSO_HEADING,
  ANDROID_STEP,
  DATE_HINT,
  DOOR_CATEGORIES,
  DOOR_WHO_PAYS,
  FIRST_NAME_LABEL,
  INSTALLED,
  INSTALL_HEADING,
  INSTALL_INTRO,
  IPHONE_STEP,
  NAMES_HEADING,
  PARTNER_NOT_YET,
  REMINDERS_CHOOSE_AGAIN,
  SECOND_NAME_LABEL,
  SETTINGS_TITLE,
  SIGN_OUT_FAILED,
  SWAP_FAILED,
  WEDDING_DATE_LABEL,
  accountDetail,
  myAccountName,
  namesHint,
  partnerAccountName,
  reminderCantArriveLine,
} from "@/lib/model/settings";
import { PARTNER_FALLBACK, SWAP_LINK, SWAP_NOTE, nameOfSlot, swapToast } from "@/lib/model/who";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Device, NotificationState } from "@/veil/parts/device/notification-state";
import { useInstalled } from "@/veil/parts/device/use-installed";
import { useNotificationPermission } from "@/veil/parts/device/use-permission";
import { Doors, type DoorItem } from "@/veil/parts/doors/doors";
import { DateInput, FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { SaveLine, SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { Hero } from "@/veil/parts/hero/hero";
import { veilHref } from "@/veil/href";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useToast } from "@/veil/shell/toasts";
import styles from "./settings.module.css";

const ALLOWED_TOAST = "Notifications allowed on this device";
const TEST_SENT = "Test reminder sent. It should appear in a moment.";

/**
 * Wedding settings (guide §5.3; O5, O6, A3, A5, S10): the two names and the
 * wedding date, saved as you go, who can open the planner with Swap them and
 * Sign out, what this device allows for reminders, the install steps, and the
 * doors to Who pays and Vendor categories. Allowing notifications saves this
 * device for the daily reminders, and signing out stops them arriving here.
 */
export function SettingsScreen() {
  const read = useSettings();
  return (
    <PageColumn>
      <ScreenState read={read} what="your settings" onRetry={() => window.location.reload()}>
        {() => (
          <SaveScopeProvider>
            <Settings />
          </SaveScopeProvider>
        )}
      </ScreenState>
    </PageColumn>
  );
}

function Section({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 className={styles.section} id={id}>
      {children}
    </h2>
  );
}

function Settings() {
  const { data } = useSettings();
  const { status, user, signOut } = useSession();
  const demo = status === "demo";
  const who = useWho();
  const members = useMembers();
  const toast = useToast();
  const { permission, allow, setup, retrySetup } = useNotificationPermission();
  const installed = useInstalled();
  const today = useToday();

  const first = useAutosaveField({
    value: data?.yourName ?? "",
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => saveCoupleName("yourName", next),
  });
  const second = useAutosaveField({
    value: data?.partnerName ?? "",
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => saveCoupleName("partnerName", next),
  });
  const date = useAutosaveField({
    value: data?.weddingDate ?? "",
    required: true,
    save: (next: string) => (isIsoDate(next) ? saveWeddingDate(next) : Promise.reject(new Error("Not a date"))),
  });

  const [swapping, setSwapping] = useState(false);
  const [swapFailed, setSwapFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testFailed, setTestFailed] = useState(false);

  const badReminders = useRemindersThatCantArrive(today);

  const email = user?.email ?? "";
  const mine = members.find((m) => m.id === user?.uid);
  const other = members.find((m) => m.id !== user?.uid);
  const partnerEmail = other?.email || data?.partnerEmail || "";

  async function swap() {
    if (swapping) return;
    setSwapping(true);
    setSwapFailed(false);
    try {
      const done = await swapNames(who.settings, email, members);
      if (done) {
        toast.undoable(swapToast(nameOfSlot(who.settings, done.slot)), done.undo);
      }
    } catch {
      setSwapFailed(true);
    }
    setSwapping(false);
  }

  async function leave() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await forgetThisDevice();
      await signOut();
    } catch {
      setSignOutFailed(true);
      setSigningOut(false);
    }
  }

  async function test() {
    if (testing) return;
    setTesting(true);
    setTestFailed(false);
    try {
      await sendTestReminder();
      toast.confirmation(TEST_SENT);
    } catch {
      setTestFailed(true);
    }
    setTesting(false);
  }

  const doors: DoorItem[] = [
    {
      id: "who-pays",
      name: DOOR_WHO_PAYS.name,
      href: veilHref("/budget/who-pays"),
      summary: [{ text: DOOR_WHO_PAYS.summary }],
    },
    {
      id: "categories",
      name: DOOR_CATEGORIES.name,
      href: `${veilHref("/vendors")}?categories=1`,
      summary: [{ text: DOOR_CATEGORIES.summary }],
    },
  ];

  return (
    <>
      <Hero title={SETTINGS_TITLE} nav={<SaveLine />} />

      <Section>{NAMES_HEADING}</Section>
      <Fields>
        <FieldRow label={FIRST_NAME_LABEL} field={first}>
          <FieldInput {...first.bind} />
        </FieldRow>
        <FieldRow label={SECOND_NAME_LABEL} field={second} hint={namesHint(first.draft, second.draft)}>
          <FieldInput {...second.bind} />
        </FieldRow>
        <FieldRow label={WEDDING_DATE_LABEL} field={date} hint={DATE_HINT}>
          <DateInput {...date.bind} />
        </FieldRow>
      </Fields>

      <Section>{ACCOUNTS_HEADING}</Section>
      {demo ? (
        <p className={styles.note}>{ACCOUNTS_DEMO}</p>
      ) : (
        <>
          <ul className={styles.who}>
            <li>
              <b>{myAccountName(who.myName)}</b>
              <span>{accountDetail(email, mine?.provider ?? "")}</span>
            </li>
            <li>
              <b>{partnerAccountName(who.partnerName === PARTNER_FALLBACK ? "" : who.partnerName)}</b>
              <span>{partnerEmail ? accountDetail(partnerEmail, other?.provider ?? "") : PARTNER_NOT_YET}</span>
            </li>
          </ul>
          <p className={styles.note}>{ACCOUNTS_NOTE}</p>
          <p className={styles.note}>
            {SWAP_NOTE}{" "}
            <TextLink busy={swapping} onClick={() => void swap()}>
              {SWAP_LINK}
            </TextLink>
          </p>
          {swapFailed && (
            <p className={`${styles.note} ${styles.rose}`} role="alert">
              {SWAP_FAILED}
            </p>
          )}
          <p className={styles.signOut}>
            <Btn variant="quiet" small busy={signingOut} busyLabel="Signing out" onClick={() => void leave()}>
              Sign out of this <Device />
            </Btn>
          </p>
          {signOutFailed && (
            <p className={`${styles.note} ${styles.rose}`} role="alert">
              {SIGN_OUT_FAILED}
            </p>
          )}
        </>
      )}

      <Section>
        Reminders on this <Device />
      </Section>
      <NotificationState
        permission={permission}
        disabled={demo}
        onAllow={() => void allow().then((now) => now === "granted" && toast.confirmation(ALLOWED_TOAST))}
        onTest={() => void test()}
        testing={testing}
        testFailed={testFailed}
        setupFailed={setup === "failed" && !demo}
        onRetrySetup={retrySetup}
      />
      {badReminders > 0 && !demo && (
        <p className={`${styles.note} ${styles.rose}`}>
          {reminderCantArriveLine(badReminders)}{" "}
          <TextLink tone="rose" href={veilHref("/schedule")}>
            {REMINDERS_CHOOSE_AGAIN}
          </TextLink>
        </p>
      )}

      <Section id="install">{INSTALL_HEADING}</Section>
      {installed ? (
        <p className={styles.note}>{INSTALLED}</p>
      ) : (
        <>
          <p className={styles.note}>{INSTALL_INTRO}</p>
          <ol className={styles.steps}>
            <li>
              <b>iPhone:</b> {IPHONE_STEP}
            </li>
            <li>
              <b>Android:</b> {ANDROID_STEP}
            </li>
          </ol>
        </>
      )}

      <Section>{ALSO_HEADING}</Section>
      <Doors doors={doors} className={styles.doors} />
    </>
  );
}

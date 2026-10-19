"use client";

import { useState } from "react";
import { Btn } from "@/veil/parts/actions/btn";
import { Chip, ChipGroup } from "@/veil/parts/chips/chip";
import { InstallCard } from "@/veil/parts/device/install-card";
import { NotificationState, type Permission } from "@/veil/parts/device/notification-state";

const PERMISSIONS: { value: Permission; label: string }[] = [
  { value: "granted", label: "Allowed" },
  { value: "default", label: "Not yet allowed" },
  { value: "denied", label: "Turned off" },
  { value: "install", label: "iPhone, not installed" },
  { value: "unsupported", label: "Browser can’t" },
];

/**
 * Task 3.9's section of the component gallery, part two: the install card and
 * the notification state, with fixed fake data. Pick a permission to see each
 * state; the gallery's e2e test drives them.
 */
export function DeviceDemos() {
  const [installShown, setInstallShown] = useState(true);
  const [permission, setPermission] = useState<Permission>("default");
  const [demo, setDemo] = useState(false);
  const [tests, setTests] = useState(0);

  return (
    <>
      <h3>Install card</h3>
      {installShown ? (
        <InstallCard howHref="#install" onNotNow={() => setInstallShown(false)} />
      ) : (
        <p>
          <Btn variant="quiet" small onClick={() => setInstallShown(true)}>
            Show the install card again
          </Btn>
        </p>
      )}

      <h3>Notification state</h3>
      <ChipGroup
        label="Permission on this device"
        options={PERMISSIONS}
        value={permission}
        onChange={setPermission}
        disabled={demo}
      />
      <p>
        <Chip pressed={demo} onClick={() => setDemo((on) => !on)}>
          Demonstration mode
        </Chip>
      </p>

      <h3>In settings</h3>
      <NotificationState
        permission={permission}
        where="settings"
        disabled={demo}
        onAllow={() => setPermission("granted")}
        onTest={() => setTests((count) => count + 1)}
      />
      <p>Test reminders sent: {tests}</p>

      <h3>In the event sheet’s Remind us</h3>
      <NotificationState
        permission={permission}
        where="sheet"
        disabled={demo}
        onAllow={() => setPermission("granted")}
      />
    </>
  );
}

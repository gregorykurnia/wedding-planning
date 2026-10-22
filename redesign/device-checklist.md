# Real-device checklist (Task 8.5)

For you, before the merge (`redesign/before-merge.md`, "In person"). Run it on an installed iPhone, Android Chrome and a Mac. Each check says what to tap and what should happen. Write down what fails in section 3 and tell Claude in a redesign session: each failure becomes a fix task before the merge.

**Test data only.** Section 1 points the build at a test copy of everything it touches. Don't skip it: the new screens write to the same Firestore, Cloudinary and push services as the app in production.

## 1. Set-up (once)

1. **Test Firebase project.** In the Firebase console, create a new project with Firestore and Google sign-in on. Note its web config values and the project ID. Under Authentication › Settings › Authorized domains, add the Tailscale address from step 6.
2. **Test Cloudinary.** A second cloud, or a test account, with an unsigned upload preset (Settings › Upload › Add upload preset › Signing mode: Unsigned). Note the cloud name, the preset, and the API key and secret.
3. **Test keys.** Generate a service-account key for the test project (Project settings › Service accounts › Generate new private key). In the project folder, run `npx web-push generate-vapid-keys` for a push key pair.
4. **Swap the environment file.** Keep the live file: `mv .env.local .env.local.saved`. Create a new `.env.local` with only the test values: the six `NEXT_PUBLIC_FIREBASE_*` values and `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT` (the test key), the Cloudinary cloud name, preset, key and secret, and the VAPID public and private keys. Nothing from the live file. Open it and check no value matches the live project.
5. **Build and start the production build** (not `npm run dev`, which is slow on phones): `npm run build && npm start`. It serves on port 3000. Leave that window open for the run.
6. **Addresses.** On the Mac, `ipconfig getifaddr en0` gives its Wi-Fi address. Phones on the same Wi-Fi can open `http://<that address>:3000`, but over plain http an iPhone can't install the app or get reminders. So use HTTPS for the installed iPhone and the reminder checks: run `tailscale serve --bg 3000` (Tailscale on the Mac and the phone). It prints an `https://…ts.net` address, private to your own devices. Use that address on the phones and add it to Authorized domains (step 1).
7. **First sign-in.** Confirm the new sign-in appears under Authentication › Users in the **test** project and not in the live one.

## 2. Checks

A check is done when every device on its "Devices" line passes.

### 2.1 Sign in
**Devices:** all five.
- On the sign-in page, tap **Sign in with Google**. The button says "Waiting for Google" and a note asks you to finish in the Google window. Finish there.
- You land on the overview, signed in, with your names in the top bar.
- Close the tab, open the planner again: still signed in.
- Sign out from Settings: "You've signed out. Nothing is shown on this device until one of you signs in again."
- If the Google window doesn't open in iPhone Safari, allow pop-ups for the site and try again.

### 2.2 Add and edit with the keyboard open
**Devices:** iPhone (installed and Safari), Android Chrome.
- Open Guests and add a guest. Tap the name field: the keyboard opens and the sheet moves so the field you're typing in and the Save button stay visible.
- Save: the toast says "Added …" and the guest is listed. Open that guest, change the name, tap Done: the change shows.
- In a sheet with an amount (for example Budget › a payment), tap the amount field: the numeric keyboard opens. Type `12 juta`: the field refuses it and says why. Type `12500000`: it reads Rp 12.500.000 when you leave the field.
- **Passes when:** no field or button hides under the keyboard, Save works, and words are refused in the amount.

### 2.3 Editor docking
**Devices:** iPhone (installed and Safari), Android Chrome.
- Go to Documents, then a new document. Tap into the body.
- The formatting toolbar docks at the bottom, just above the keyboard, and scrolls sideways. Scroll it to the end: every button is reachable.
- Tap **B**, then type: the text is bold.
- The save line floats as a small pill at the top centre. A few seconds after typing it reads "Saved just now" with a tick.
- **Passes when:** the toolbar stays above the keyboard while you type and scroll, and nothing is covered.

### 2.4 Uploads from the camera roll
**Devices:** iPhone (installed and Safari), Android Chrome, Mac (Safari and Chrome, using the file picker).
- Open a booking or Documents › Files. Tap **Add files** and pick a photo from the camera roll (iPhone: Photo Library in the picker; Android: Photos or Gallery). The tile shows "Uploading, n%", then "Uploaded", and a thumbnail.
- Pick a video or other file over 10 MB. Expect "Too large: … Files can be up to 10 MB; only PDFs are shrunk." (A photo may be under the limit, which is fine.)
- Pick a PDF over 10 MB. Expect "Shrinking from … to fit under 10 MB", then "Uploaded, shrunk to …", or the "still over 10 MB" note if it can't get small enough.
- **Passes when:** the photo arrives with its thumbnail, and each message reads as above.

### 2.5 Reminders
**Devices:** iPhone (installed), iPhone (Safari, not installed), Android Chrome, Mac (Safari and Chrome).
- In Settings, read the notifications line. If it offers **Allow notifications**, tap it and allow. The allowed note says reminders arrive on this device and on your other devices, even when the planner is closed.
- Tap **Send a test reminder**. A notification arrives on this device within about a minute.
- **iPhone in Safari, not installed:** the notes say reminders need the planner on the home screen, with **Show me how**. Add it (Share › Add to Home Screen), open it from the home screen, allow notifications, and send the test again.
- **Mac with notifications turned off** (System Settings › Notifications, or the browser's site settings): the note says where to turn them on. Turn them on and test again.
- **Passes when:** the test reminder arrives on each device where notifications are allowed, and the notes say what's missing where they aren't.

### 2.6 Offline
**Devices:** all five.
- With a screen open, turn on Airplane mode (phones) or turn off Wi-Fi (Mac). Open a screen you haven't opened yet: the offline message appears, "You're offline. The planner needs a connection to show …", with **Try again**. Nothing spins forever.
- In a document or a sheet, type something: the save line reads "Not saved: you're offline. Keep this page open. Try again".
- Turn the connection back on and tap **Try again**: "Saved", and the text you typed is still there.
- **Passes when:** no blank page, no endless spinner, and the typed text is kept and saves after Try again.

### 2.7 The partner's change arriving
**Devices:** two devices at once: the iPhone signed in as Bella and the Mac signed in as Greg, both on the test planner.
- On the iPhone, record a payment or tick a task. On the Mac, without reloading, a toast names Bella (about 9 seconds) and the figure or task updates.
- The other way round: Greg changes a guest's RSVP on the Mac, and the iPhone updates without a reload.
- **Passes when:** each change shows on the other device within a few seconds, with no reload, and the toast names the partner.

### 2.8 Your other device
**Devices:** the Mac and the iPhone, both signed in as Greg.
- Record a payment on the iPhone. The Mac shows "You recorded … on your other phone", with a champagne circle and your initial.
- **Passes when:** the toast says "your other phone" and never shows the partner's name.

### 2.9 Screen readers and keyboard
**Devices:** iPhone (VoiceOver), Android Chrome (TalkBack), Mac (keyboard only).
- **VoiceOver** (Settings › Accessibility › VoiceOver, on): open Schedule › Tasks and move to a task's tick. It should announce a checkbox, "Finish …" or "Reopen …", with the task's name. Activate it: the task finishes and the announcement changes to match. Note whether the row reads as one control. The tick sits inside the row's summary (gap G43 in the plan): write down what you hear. The design stays as built unless you decide to change it.
- **VoiceOver** on a save toast: "Saved …" is read once, not twice.
- **TalkBack** on Android: the same two steps.
- **Mac, keyboard only:** Tab to a task's tick and press Space. Open a sheet and press Escape: it closes and focus returns to the button that opened it.
- **Passes when:** each control is announced with its name and state, and Escape returns focus.

## 3. Record

| Check | iPhone installed | iPhone Safari | Android Chrome | Mac Safari | Mac Chrome |
|---|---|---|---|---|---|
| 2.1 Sign in | | | | | |
| 2.2 Keyboard, add and edit | | | | — | — |
| 2.3 Editor docking | | | | — | — |
| 2.4 Uploads | | | | | |
| 2.5 Reminders | | | | | |
| 2.6 Offline | | | | | |
| 2.7 Partner's change | | | | | |
| 2.8 Your other device | | | | | |
| 2.9 Screen readers and keyboard | VoiceOver | | TalkBack | keyboard | keyboard |

For each failure, write the device, the screen, what happened, and a screenshot if you can. Tell Claude in a redesign session; it becomes a fix task before the merge. When every check passes, tick **Device checklist** in `redesign/before-merge.md`.

## 4. Clean up

1. Stop the server (Ctrl+C in its window).
2. `tailscale serve reset`.
3. `mv .env.local .env.device-test` (test values only; keep it or delete it, your choice), then `mv .env.local.saved .env.local` to restore the live file.

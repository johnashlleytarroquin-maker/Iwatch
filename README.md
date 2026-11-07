# School SOS

An Android app (Expo / React Native) plus a small server for school emergency reporting.

| Role | What they can do |
|------|------------------|
| **Student** | Press **SOS**, pick the emergency type (medical, fire, fight, accident, harassment, other), share GPS + a typed location ("Science Bldg, Room 204"), add a note, watch the status change live, cancel a false alarm. |
| **Responder** | Gets a full-screen red alert + vibration the moment an SOS arrives. Sees type, location (opens GPS in Maps), student name/ID/phone (tap to call). Marks **Received → On my way → Resolved**. Can browse past reports. |
| **Admin** | **Approves or rejects responder registrations**, enables/disables any account, resets passwords, searches accounts, sees live stats, and reads the **full history** (every registration, approval, SOS and status change, with who did it and when). |

Responders always need admin approval. Students sign up freely by default (set `STUDENT_APPROVAL=true` on the server to require approval for them too).

```
school-sos/
  server/   Node + Express + SQLite + Socket.IO  (accounts, approvals, reports, history, live alerts)
  app/      App.js + src/  (the Expo app source: login, student / responder / admin screens)
```

---

## 1. Run the server

Needs Node 18+ (22 recommended).

```bash
cd server
npm install
npm start
```

On the first run it creates `sos.db` and a default admin, and prints:

```
Default admin created: admin@school.local / admin123
```

**Change that before real use.** Set your own on the first run:

```bash
ADMIN_EMAIL=you@school.edu ADMIN_PASSWORD='a-long-password' npm start
```

(Windows PowerShell: `$env:ADMIN_EMAIL="you@school.edu"; $env:ADMIN_PASSWORD="a-long-password"; npm start`)

Other settings (environment variables): `PORT` (default 3000), `JWT_SECRET` (otherwise generated once into `server/.secret`), `STUDENT_APPROVAL=true`.

If `npm install` fails on `better-sqlite3`, install your platform's build tools (Windows: "Desktop development with C++" from Visual Studio Build Tools) or use an LTS Node version, which has prebuilt binaries.

## 2. Run the app on your phone

Your phone and computer must be on the **same Wi-Fi**. Install **Expo Go** from the Play Store.

The `app/` folder here holds only the source files. Create a fresh Expo project so the library versions match the current Expo release, then drop the source in:

```bash
npx create-expo-app@latest sos-app --template blank
cd sos-app
```

Copy `app/App.js` over `sos-app/App.js`, and copy the `app/src` folder to `sos-app/src`. Then:

```bash
npx expo install expo-location expo-constants @react-native-async-storage/async-storage
npm install socket.io-client
npx expo start
```

Scan the QR code with Expo Go. In development the app finds your computer automatically and talks to the server on port 3000 (the server address is shown at the bottom of the login screen, which helps if it can't connect).

If the phone can't reach the server: allow Node through your computer's firewall for port 3000, and make sure both devices are on the same network (guest/"isolated" Wi-Fi blocks this).

## 3. Try the whole flow (about 5 minutes)

1. Sign in as the admin (`admin@school.local` / `admin123`, or what you set).
2. On a second phone or after signing out, **Create an account** as **Responder**. You'll see "waiting for approval", and sign-in is refused.
3. Back in the admin account: the **Approvals** tab shows a badge. Tap **Approve**.
4. Sign in as the responder. Leave it open on **Live alerts**.
5. Register/sign in a **Student** (another phone or Expo Go on an emulator). Press **SOS**, choose a type, send.
6. The responder phone should vibrate and show the red alert. Tap **View & respond**, then **I received this → I'm on my way → Mark resolved**. The student's screen updates live at each step.
7. In the admin account, open **History**: every step above should be listed, and **Overview** should show the counts.

## Settings you will want to change

- `app/src/config.js` → `EMERGENCY_NUMBER` is the number the student's "Call" button dials. Set it to your school's security line or local emergency number.
- `EXPO_PUBLIC_API_URL` → address of the server when you deploy it (see below).

---

## Honest status: what has and hasn't been checked

This project was written in a sandbox that could **not download npm packages**, so **nothing has been run end to end**. What was verified:

- Server and app files all parse (JSX included).
- No undefined variables or missing imports (checked with ESLint on the server and TypeScript name resolution on the app, with a seeded-bug test confirming the check works).

What was **not** verified, so expect to fix small things on first run: server startup and every API route, the realtime alerts, GPS permission flow on a real phone, and screen layout on real devices. If something breaks, send me the error text and I'll fix it.

## Before using this for real emergencies

This is a working prototype, not a certified safety system. It should **supplement** your school's existing emergency procedures and local emergency services, never replace them. Gaps to close first:

1. **Background alerts.** Responders currently get alerts only while the app is open (live socket connection). Android may suspend the app in the background or when the screen is off. Reliable alerts need push notifications through Firebase Cloud Messaging with a development/production build (Expo Go can't do this). This is the most important next step.
2. **Hosting + HTTPS.** Running on your laptop only works on the school Wi-Fi while the laptop is on. Deploy the server (any small VPS or a service like Render/Railway/Fly) behind HTTPS and set `EXPO_PUBLIC_API_URL`. A standalone APK also needs HTTPS (Android blocks plain HTTP in release builds). The app only works with Wi-Fi/mobile data, so consider an SMS fallback for outages.
3. **Abuse and false alarms.** There's one-active-report-per-student, and every report is logged with the student's identity, but you'll want a school policy and maybe cooldowns/escalation rules.
4. **Security hardening.** Add login rate limiting, stronger password rules, and regular backups of `sos.db`. Change the default admin password.
5. **Student privacy.** The app stores names, IDs, phone numbers and locations of minors. Check your school's data-protection rules, restrict who becomes an admin/responder, and decide how long history is kept.
6. **Drills.** Test with real responders and a practice mode before launch.

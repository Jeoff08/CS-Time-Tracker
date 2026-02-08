# Time Tracker

## Setup

1. Install dependencies:
   - `npm install`
2. Create a `.env` file in the project root with your Firebase config:
   - `VITE_FIREBASE_API_KEY=...`
   - `VITE_FIREBASE_AUTH_DOMAIN=...`
   - `VITE_FIREBASE_PROJECT_ID=...`
   - `VITE_FIREBASE_STORAGE_BUCKET=...`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID=...`
   - `VITE_FIREBASE_APP_ID=...`
3. Run the app:
   - `npm run dev`

## Features

- Firebase Auth (email/password) + Firestore database
- Dashboard with live clock, time in/out, and totals toward 500 hours
- Weekly report text + PDF export
- Profile page with totals and first session date
- Seeded sessions for Feb 2–5, 2026 (full/half-day per your request)


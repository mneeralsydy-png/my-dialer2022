# replit.md

## Overview

Private Dialer is a web-based phone dialer application that allows users to make private phone calls using Twilio's voice SDK. The app features Google authentication via Firebase, a PayPal integration for balance top-ups, and a mobile-app-like UI designed in Arabic (RTL layout). Users can make VoIP calls through the browser with caller ID masking/aliasing capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Single Page Application (SPA)**: The entire UI lives in `public/index.html` with `public/script.js` and `public/style.css`. There's no frontend framework — it's vanilla HTML/CSS/JavaScript.
- **RTL Arabic UI**: The interface is designed in Arabic with right-to-left layout, styled to look like a mobile phone app (max-width 400px, max-height 850px).
- **Firebase JS SDK (v10.7.1)**: Loaded via ES modules from Google's CDN for authentication and cloud functions.
- **Twilio Client SDK (v1.17)**: Loaded from Twilio's CDN to handle browser-based VoIP calls.
- **PayPal SDK**: Integrated for payment processing to add calling balance.
- **Screen Flow**: Permission screen → Login screen → Active call interface. The app requests microphone, contacts, and call log permissions before proceeding.

### Backend
- **Express.js server** (`index.js`): A minimal static file server that serves the `public/` directory and falls back to `index.html` for all routes (SPA pattern). Runs on port 5000.
- **Firebase Cloud Functions**: The app calls Firebase Cloud Functions (via `httpsCallable`) for server-side operations like generating Twilio tokens. These functions are deployed separately to Firebase, not in this repository.
- **No database in this repo**: User state and balance are managed client-side in `appState`. Persistent storage likely happens through Firebase's backend services.

### Key Design Decisions
- **Client-side state management**: All app state (balance, call history, transactions, Twilio token) is kept in a simple `appState` JavaScript object — no state management library.
- **Static file serving over Express**: Chosen for simplicity. Express serves static files and handles SPA routing with a catch-all `*` route.
- **Firebase for auth + serverless functions**: Firebase handles Google OAuth and provides cloud functions for secure server-side operations (like Twilio token generation), avoiding the need to build a full backend.
- **Twilio for VoIP**: Browser-based calling via Twilio's JavaScript SDK, allowing calls directly from the web app without native phone integration.

## External Dependencies

### Third-Party Services
- **Firebase** (Auth + Cloud Functions): Google sign-in authentication and serverless backend functions. Project ID: `call-now-24582`.
- **Twilio**: Voice SDK for making browser-based phone calls. Requires a Twilio account with voice capabilities and a server-side token endpoint (handled by Firebase Cloud Functions).
- **PayPal**: Payment processing SDK for users to add calling credit/balance. Client ID is embedded in the HTML.

### NPM Packages
- **express** (v4.18.2): Web server for serving static files.
- Note: `package-lock.json` references `firebase-admin`, `firebase-functions`, and `twilio` packages, but these are NOT in the current `package.json`. They may have been removed or are intended for Firebase Cloud Functions deployment separately.

### CDN Resources
- Google Fonts (Cairo - Arabic font)
- Font Awesome 6.4.0 (icons)
- Firebase JS SDK v10.7.1 (ES modules)
- Twilio Client SDK v1.17
- PayPal JS SDK
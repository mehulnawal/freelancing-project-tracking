# Firebase setup

1. Create/open a Firebase project and register a Web App.
2. Copy its public web configuration into local `.env` with `.env.example`.
3. Enable Email/Password Authentication.
4. Create the single admin user manually in Firebase Console; there is no signup flow.
5. Add its UID, email, and chosen login ID to `VITE_ADMIN_UID`, `VITE_ADMIN_EMAIL`, and `VITE_ADMIN_LOGIN_ID`.
6. Create Firestore.
7. Replace `REPLACE_WITH_FIREBASE_ADMIN_UID` in `firestore.rules` with the UID.
8. Deploy rules manually later. Never use Test Mode rules in production.
9. Restart Vite after editing `.env`.

Never add Admin SDK keys, service-account JSON, passwords, or encryption secrets to frontend variables.

Financial writes such as Income, account balances, and transfers must be made through the application’s Firestore transaction services. Firestore rules enforce admin ownership and document shape, while transactions provide cross-document balance consistency. Do not edit balances directly in the Firebase console except for a deliberate recovery procedure.

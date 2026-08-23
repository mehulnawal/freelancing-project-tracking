# Implementation Status

## Current architecture

- React + Vite frontend, JavaScript only.
- Firebase Authentication plus Firebase Realtime Database (RTDB) for active application data.
- All live records are scoped to `users/{authenticatedAdminUid}/...`; application data is never written at the RTDB root.
- Cloud Firestore remains initialized only for the one-time, non-destructive rollback/migration utility. It is not an active application persistence layer.
- Firebase configuration fails safely when required environment variables are absent.

## RTDB collections

The active application uses these children under the authenticated user namespace:

- `clients`, `projects`, `accounts`, `accountTransfers`
- `income`, `expenses`, `recurringExpenseTemplates`
- `masterOptions`, `settings`, `projectDocuments`
- `credentials`, `credentialVaultConfigs`
- `notificationPreferences`, `notificationStates`, `recordVersions`

Financial records retain their existing stable IDs. Dates are stored as serializable business-date strings or numeric audit timestamps; Firestore Timestamp objects are serialized by the migration utility.

## Migration

`migrateFirestoreToRealtimeDatabase(uid)` is a deliberate one-time operation. It:

- reads legacy Firestore data without deleting or changing it;
- writes a complete RTDB namespace only when that namespace does not already exist;
- maps legacy `appSettings/global` to `settings/global`;
- maps the legacy credential-vault configuration to its RTDB global record;
- records migration metadata under `migration`.

Run it only after deploying the restrictive RTDB rules and taking a backup. Do not run it against an already-populated RTDB namespace.

## Financial rules

- Money is stored as non-negative integer minor units.
- Income is the only source of truth for project payments.
- Account balance effects for Income, transfers, and paid Expenses are performed through atomic RTDB root transactions.
- Voiding/restoring reverses/reapplies the applicable financial effect. Financial records are never hard deleted.
- Project received, remaining, and overpaid amounts are recalculated from active project-payment Income records.

## Validation and data safety

- Shared normalization handles names, email addresses, phone numbers, master labels, and import values.
- Client create/edit uses service-level duplicate protection for normalized email, phone, and uncontactable duplicate names.
- CSV values that could execute spreadsheet formulae are escaped.
- Import rows are validated before writes; import validation has focused automated coverage.
- Shared form fields support visible required indicators and inline field errors.

## Verification

Commands run successfully:

```bash
npm test
npm run build
```

`npm run lint` completes with one existing non-blocking Fast Refresh warning in `NotificationsPage.jsx`; there are no lint errors.

## Required environment variables

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`
- Any existing optional Cloudinary variables required for uploads.

## Live verification still required

The following must be run against the configured Firebase project with the intended administrator account before release:

- deploy and test RTDB rules for unauthenticated, wrong-UID, and authorized-UID access;
- run the one-time Firestore-to-RTDB migration on a controlled backup;
- test all create/edit/void/restore financial flows, including two-tab realtime updates;
- test login, password reset, offline failure/retry, import/export, backup/restore, and PWA update behavior.

No Firestore production data has been deleted.


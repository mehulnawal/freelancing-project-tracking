# Implementation Status

This document is the durable handoff for the completed UI, Firebase foundation, Clients/Projects, and financial work. It contains no Firebase credentials or `.env` values.

## Technology stack

- React with Vite, JavaScript only (no TypeScript source files).
- Tailwind CSS and central CSS design tokens, with locally bundled Inter and Manrope fonts.
- React Router for protected application routes and responsive AppShell navigation.
- Firebase modular Web SDK: Email/Password Authentication and Cloud Firestore.
- React Hook Form with Zod for forms and validation.
- Lucide React icons, Motion for restrained UI transitions, Sonner notifications.
- Vitest for pure business-logic tests.
- `vite-plugin-pwa` for the existing PWA build and generated service worker.

## Firestore collections and relationships

| Collection/document | Purpose and relationship |
| --- | --- |
| `appSettings/global` | Branding and global preferences. |
| `users/{adminUid}` | Single-admin profile/preferences foundation. |
| `masterOptions/{optionId}` | Editable dropdown options, scoped by `group`. |
| `clients/{clientId}` | Client identity and contact information. |
| `projects/{projectId}` | Related to a Client only by `clientId`; no copied client object is the relationship source. |
| `accounts/{accountId}` | Safe account metadata, opening balance, and calculated current balance. |
| `income/{incomeId}` | Canonical received-money ledger. Project payments are Income records with `sourceType: 'Project Payment'`, `projectId`, and `clientId`. Independent income has no project. |
| `accountTransfers/{transferId}` | Non-income movement between two distinct financial accounts. |
| `expenses/{expenseId}` | Canonical payable records; only paid, non-cancelled records debit their selected account. |
| `recurringExpenseTemplates/{templateId}` | Reusable recurrence definitions, not financial records themselves. |

`payments` is intentionally unused. A separate payment collection must never be introduced. Future unimplemented collections remain default-deny in Firestore rules.

## Completed routes and features (Prompts 1â€“5)

### Foundation, authentication, and settings

- Responsive light/dark AppShell, mobile drawer/bottom navigation, route metadata, breadcrumbs, keyboard shell shortcuts, PWA configuration, shared UI primitives and reusable design tokens.
- Safe Firebase configuration layer that renders a setup state instead of initializing with missing values.
- Email/Password login with Email-or-User-ID mapping, Remember Me persistence, single-admin UID authorization, protected routes, logout, password reset, password change, and controlled development preview mode.
- Global Settings for branding, preferences, inactivity setting, trusted-device cache preference, master-data management, and reusable creatable master-option selects.

### Clients and projects

- Client list, detail, add/edit flows, connected Project rendering, canonical financial summary, next-payment indicator, and recent project-payment history.
- Project list, detail, add/edit flows, Client relationship selection, status/priority handling, deadline states, integer minor-unit project financial foundation, and dynamic Project/Work Type master data.
- Project Detail has URL-backed tabs; Payments lives inside the Project Detail, never on a standalone payment page.

### Accounts, income, and project payments

- Account listing, filters/sorting, responsive cards/table, safe account create/edit, archive/reactivate, account detail and ledger CSV export.
- Account-to-account transfer create/edit/void/restore with source/destination validation and balance updates in a Firestore transaction.
- Income listing, filters, pagination, CSV export, create/edit/duplicate, void/restore, master-data category/payment-mode/payment-type selection, and account/project/client links.
- Project Payment recording through the canonical Income form; Project Payments tab with history, filters, export, payment summary, progress, overpayment indicator, and next-payment reminder controls.
- Quick Add and command palette actions for Account, Income, Project Payment, and transfers.

## Canonical financial calculation rules

### Money

- All persisted money is an integer minor-unit amount. For example, INR 40,000.50 is stored as `4000050`.
- UI formatting uses the selected locale/currency utilities. Do not concatenate currency symbols or use floating-point totals.

### Project payments

- Only active Income documents whose `sourceType` is `Project Payment` and whose `projectId` matches a Project count as that Project's received money.
- `receivedAmountMinor` is the sum of those records.
- `remainingAmountMinor = max(totalAmountMinor - receivedAmountMinor, 0)`.
- `overpaidAmountMinor = max(receivedAmountMinor - totalAmountMinor, 0)`.
- Cached Project payment status and `lastPaymentDate` are recomputed from canonical active Income records. Voided, independent Income, and transfers do not count.
- Completed Projects may still have an unpaid or partially paid balance.

### Accounts

```text
currentBalanceMinor = openingBalanceMinor
                    + active Income credited to this account
                    + active incoming transfers
                    - active outgoing transfers
                    - paid, non-cancelled Expenses charged to this account
```

Pending and cancelled Expenses never affect account balances. Expenses are deliberately kept separate from Income and Transfers.

## Transaction rules

- Financial create/edit/void/restore operations use Firestore transactions.
- Editing Income reverses the old account effect and applies the new one atomically; changing project classification also recomputes every affected Project summary.
- Void preserves the original financial record and reverses its effect once. Restore reapplies it once after validating linked records.
- Transfer edits reverse the old source/destination effects before applying the new effects. Transfers must use two different matching-currency accounts and never count as Income.
- Do not permanently delete financial records, Clients, Projects, or Accounts.
- Firestore Security Rules enforce the configured admin, owner/audit immutability, basic data shapes, fixed values, and default deny. Cross-document accounting consistency is enforced by the transaction services and must not be bypassed with direct writes.

## Master Data behavior

- Master-option groups are Firestore-backed and customizable: examples include Client Types, Project Types, Work Types, Income Categories, Payment Modes, Payment Types, and Account Types.
- Creatable Select trims labels, prevents case-insensitive duplicates, writes only when Firebase is configured and preview mode is off, and selects the newly created option.
- Archived options remain for historical display but are excluded from new selections by default.
- Calculation-dependent statuses, priorities, and source types remain centralized fixed constants, not editable master data.

## Environment-dependent verification still pending

The repository's pure logic tests, lint, production build, and PWA generation run without Firebase values. The following require the real Firebase project, configured administrator UID, deployed rules/indexes, and deliberate non-destructive manual testing:

- Firestore reads/writes, transaction retries, permission-denied behavior, and offline transaction failures.
- Real Email/Password sign-in, password-reset email delivery, and protected-route redirect against the configured Firebase project.
- Account/Income/Project Payment CRUD with real data and rule deployment.
- Firestore composite-index provisioning after manual deployment.

No documentation should claim these external checks passed until they are performed against the real Firebase project.

## Remaining roadmap: Prompts 6â€“10

1. Prompt 6 â€” Expenses and their account-balance debit integration.
2. Prompt 7 â€” Monthly Tracking and related reporting views.
3. Prompt 8 â€” Credentials Vault and secure credential workflow.
4. Prompt 9 â€” Documents, bills, Cloudinary uploads, and linking.
5. Prompt 10 â€” Dashboard enhancements, exports/backups, and final PWA work.

## Current extension status

- This status supersedes the earlier numbered roadmap entries for Expenses and Monthly Tracking.
- Expenses and their controlled paid-account debit integration are implemented.
- Monthly Tracking is implemented as a cash-basis view: active Income uses `receivedDate`, paid Expenses use `paidDate`, and transfers/project contract values are excluded.
- Credentials Vault, document uploads/linking, and later dashboard/export enhancements remain separate future work.

## Verification commands

Run from the repository root:

```bash
npm test
npm run lint
npm run build
```

The build must complete with PWA service-worker generation. The Vite bundle-size advisory is a performance warning, not a lint or build failure.


## Prompt 7 extension

Project Detail now includes Documents & Bills (Cloudinary uploads or safe external links) and an encrypted Credentials Vault route. Cloudinary remains environment-dependent; the UI retains external-link support when configuration is absent. Credentials use browser Web Crypto AES-GCM envelope encryption with a passphrase-derived PBKDF2 wrapping key. Real Firebase/Cloudinary verification still requires configured credentials and deployed rules/indexes.

## Prompt 9 extension: settings, version history, backups and PWA

- Settings now carries expanded safe branding, regional defaults and accessibility preferences with safe defaults. Branding is cached locally only as sanitized display data for the login interface; private business settings are never exposed publicly.
- `recordVersions` is an immutable, same-project Automatic Version History collection. It records safe before/after snapshots for settings, master data, clients and projects, redacting credential-sensitive keys. This is accidental-edit protection, not a disaster-recovery system.
- Settings ? Data & Backup can create a user-triggered, AES-GCM/PBKDF2 encrypted `.fmbak` download. The passphrase is never stored. Safe restore intentionally excludes direct ledger overwrites: accounts, transfers, income and expenses must use their controlled domain flows. Credential payloads remain ciphertext.
- Settings ? Install App / PWA reports connectivity and detects a waiting service-worker update. Browser installation remains browser-controlled. Installed OS-level manifest names/icons can require cache refresh, reinstall, or a newly deployed manifest.
- Firestore rules now include immutable `recordVersions` and notification collections. Deploy rules/indexes and manually test them only against the real Firebase project.

### Prompt 9 verification

- `npm run build` passed and generated the PWA service worker.
- `npm run lint` currently fails on pre-existing Prompt 7/8 source lint/parser issues (`useDashboardData`, `DashboardPage`, `NotificationsPage`, `dashboardLogic`, and `notifications.js`); these are unrelated to the Prompt 9 additions. Prompt 9-specific unused imports were corrected.

## Prompt 9.1 extension

- Added shared page, grid, toolbar, form, modal and data-management spacing rules so logical page groups retain a consistent responsive gap without changing table density or navigation design.
- Settings now submits only dirty fields. A name-only, logo-only or favicon-only edit preserves all untouched settings and avoids a no-op Firestore write.
- Settings ? Data & Backup now includes separate Data Management import/export. Clients, Projects, Income, Expenses and Accounts export to CSV, XLSX or a readable PDF; Credential Vault records are excluded. CSV/XLSX imports require a selected data type, template, validation preview and confirmation. Invalid rows block the write, and relationship/duplicate checks are performed before import.
- Spreadsheet/PDF libraries load only when selected so the PWA build remains within cache limits.

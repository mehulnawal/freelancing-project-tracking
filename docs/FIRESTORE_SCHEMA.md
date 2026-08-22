# Firestore schema

`appSettings/global` holds branding, global preferences and audit fields.

`users/{adminUid}` is the reserved admin profile/preferences document with ownerId and audit fields.

`masterOptions/{optionId}` holds group, label, normalizedLabel, description, isActive, isSystem, sortOrder, ownerId and audit timestamps/UIDs.

Reserved future top-level names: credentials, documents, activityLogs and deletedItems. The former `payments` name is intentionally unused: Project Payments are canonical `income` documents. Unimplemented collections remain denied by current rules.

`income` is the canonical received-money collection. Project payments are Income records with `projectId`; the `payments` collection is intentionally unused. Accounts derive balances from opening balance plus active income and transfers; expenses come later. Financial records are voided, never deleted.

`accounts/{accountId}` stores account identity, currency, openingBalanceMinor and derived currentBalanceMinor. `accountTransfers/{transferId}` records non-income transfers between two accounts; both account balance changes must occur in the same Firestore transaction. Expenses will be subtracted from the account formula in a later module.

## Financial consistency

Income is the canonical project-payment source. Active project-linked Income records determine project received, remaining, overpaid, payment status, and latest payment date; voided records are excluded. Account balances are changed only by controlled Firestore transactions: opening balance, active Income credits, transfer-in credits, and transfer-out debits. Transfers never count as Income. Financial records are voided/restored rather than deleted. Cross-document accounting consistency is enforced by the client transaction services; Firestore rules enforce authorization, basic shapes, and immutable ownership/audit fields.

## Clients and projects

`clients/{clientId}` contains name, normalizedName, clientTypeId, fixed status (Active, Inactive, Archived), optional contact/address/business fields, audit fields, and soft-delete placeholders. `projects/{projectId}` relates to its client only through `clientId`, and contains fixed status/priority, schedule fields, master-data IDs, links and minor-unit financial summaries. `totalAmountMinor`, `receivedAmountMinor`, and `remainingAmountMinor` are integers. Projects and clients are archived rather than deleted.

## Financial collections

`accounts/{accountId}` stores only safe account metadata, `openingBalanceMinor`, calculated `currentBalanceMinor`, currency and lifecycle status. It never stores account passwords, full card numbers, CVV, PINs, OTPs or banking credentials.

`income/{incomeId}` is the canonical received-money collection. A Project Payment is an Income document with `sourceType: 'Project Payment'`, `projectId` and `clientId`; independent income uses `sourceType: 'Independent Income'`. The reserved `payments` collection is intentionally unused. Active project-payment income records are the source of `receivedAmountMinor`, `remainingAmountMinor`, `overpaidAmountMinor`, `paymentStatus` and `lastPaymentDate` cached on a project. Voided income remains auditable and does not contribute to balances or project totals.

`accountTransfers/{transferId}` represents account-to-account movement only. It never contributes to Income. A transfer has distinct source/destination account IDs, a positive minor-unit amount, timestamp, status, void audit fields and stable ledger references such as `transfer:{id}:out`.

All financial documents include owner/audit fields and soft-delete placeholders. Client transactions are never hard-deleted. Service functions use Firestore transactions to reverse and apply old/new financial effects in one commit. Current account balance is opening balance plus active income plus incoming transfers minus outgoing transfers; Expenses will add debits in a later implementation.

## Expenses and monthly tracking

`expenses/{expenseId}` is the canonical payable record. Amounts are integer minor units. Its fixed `expenseType` is Business, Project-related, Personal or Household; category, subcategory, vendor and payment mode use editable Master Data. A Pending expense has no account effect. A Paid expense requires account, payment mode and paid date, and deducts the account once in the same transaction as the expense write. Cancelled expenses remain auditable and restore their paid deduction exactly once; restoration reapplies it exactly once. `Overdue` is derived only for pending expenses with an elapsed due date.

`recurringExpenseTemplates/{templateId}` stores recurrence defaults and is never counted as an expense. The client generates due occurrences only when the app is open or the user chooses Generate Due Expenses. Each occurrence uses the deterministic ID `{templateId}_{YYYY-MM-DD}`, so generation is idempotent.

Project expenses relate through `projectId` and client expenses through `clientId`; they do not alter project contract or project-payment totals. Project cash indicators use active linked expenses: net received margin = received project income minus paid project expenses; contract margin after recorded expenses = contract total minus active linked expenses. A client-reimbursable expense stays an expense. It is reimbursed only by an active canonical income record with `linkedExpenseId`; independent income and transfers do not count.

Monthly Tracking is cash basis: an active income counts by `receivedDate`, and a non-cancelled Paid expense counts by `paidDate`. Pending payables/receivables are displayed separately; project contract values and transfers never count as monthly cash income or expense.


## Project documents and encrypted credentials

projectDocuments/{documentId} belongs to a project/client and stores only link metadata or Cloudinary response metadata. Uploaded files are never stored in Firestore. Archiving only archives the Firestore record; Cloudinary cleanup is manual without a secure signed deletion endpoint.

credentials/{credentialId} stores safe service/project metadata plus an AES-GCM encrypted envelope (ciphertext, iv, algorithm/version). Credential labels, values, URLs, notes and identifiers are encrypted together. credentialVaultConfigs/{ownerUid} stores only PBKDF2 salt/configuration and an AES-GCM wrapped random vault key. Forgotten passphrases cannot be recovered. Decrypted values, passphrases, keys and Cloudinary URLs are excluded from intentional PWA caching.

## Cloudinary setup

Configure a restricted unsigned upload preset with JPG/JPEG, PNG, WebP and PDF formats, a maximum file size, no user-controlled public IDs, an isolated folder and no unnecessary transformations. Set VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET and optional VITE_CLOUDINARY_BASE_FOLDER. Never add a Cloudinary API secret to frontend variables. Unsigned delivery URLs may be accessible to anyone possessing them.

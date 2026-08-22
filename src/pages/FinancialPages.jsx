import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Archive,
  Download,
  Landmark,
  Pencil,
  Plus,
  WalletCards,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Modal,
  SelectShell,
  TableShell,
  Textarea,
} from "../components/ui";
import { CreatableSelect } from "../components/CreatableSelect";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { useSettings } from "../context/useSettings";
import { useClients, useProjects } from "../hooks/useData";
import { useExpenses } from "../hooks/useExpenses";
import { useMasterOptions } from "../hooks/useMasterOptions";
import {
  archiveAccount,
  createAccount,
  createIncome,
  createTransfer,
  reactivateAccount,
  restoreIncome,
  restoreTransfer,
  subscribeAccounts,
  subscribeIncome,
  subscribeTransfers,
  updateAccount,
  updateIncome,
  updateTransfer,
  voidIncome,
  voidTransfer,
} from "../services/financial";
import { csvFilename, csvText } from "../utils/csv";
import { formatCurrency, toMinorUnits } from "../utils/money";

const ACTIVE = "Active";
const nowInput = () => new Date().toISOString().slice(0, 10);
const dateInput = (value) =>
  value?.toDate?.().toISOString().slice(0, 10) ||
  (typeof value === "string" ? value.slice(0, 10) : "");
const dateText = (value, locale) =>
  value?.toDate?.().toLocaleDateString(locale) ||
  (value ? new Date(value).toLocaleDateString(locale) : "—");
const statusTone = (status) =>
  status === ACTIVE
    ? "success"
    : status === "Voided" || status === "Archived"
      ? "danger"
      : "warning";
const safeError = (error, fallback = "That action could not be completed.") =>
  error?.message || fallback;
const downloadCsv = (prefix, rows, name = "") => {
  const url = URL.createObjectURL(
    new Blob([rows], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = csvFilename(prefix, name);
  anchor.click();
  URL.revokeObjectURL(url);
};

function useFinancial(subscribe) {
  const { user, isConfigured, preview } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(
    Boolean(user && isConfigured && !preview),
  );
  useEffect(() => {
    if (!user || !isConfigured || preview) return undefined;
    return subscribe(
      user.uid,
      (next) => {
        setItems(next);
        setError("");
        setLoading(false);
      },
      () => {
        setError(
          "Financial data could not be loaded. Check your Firebase permissions and connection.",
        );
        setLoading(false);
      },
    );
  }, [user, isConfigured, preview, subscribe]);
  return { items, error, loading };
}
function FinancialToolbar({ children }) {
  return <div className="list-toolbar financial-toolbar">{children}</div>;
}
function VoidModal({ open, title = "Void transaction", onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="helper-text">
        This preserves the record and reverses its financial effect. It cannot
        be undone by deleting history.
      </p>
      <FormField label="Reason">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
        />
      </FormField>
      <div className="settings-actions">
        <Button
          variant="danger"
          disabled={!reason.trim()}
          onClick={() => {
            onConfirm(reason);
            setReason("");
          }}
        >
          Void record
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setReason("");
            onClose();
          }}
        >
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <Button
        variant="secondary"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page + 1} of {pages}
      </span>
      <Button
        variant="secondary"
        disabled={page + 1 >= pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export function AccountsPage() {
  const { items: accounts, error, loading } = useFinancial(subscribeAccounts);
  const { items: income } = useFinancial(subscribeIncome);
  const { items: transfers } = useFinancial(subscribeTransfers);
  const { settings } = useSettings();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [sort, setSort] = useState("updated");
  const { options: accountTypes } = useMasterOptions("accountTypes");
  const typeName = (id) =>
    accountTypes.find((item) => item.id === id)?.label || id || "—";
  const filtered = useMemo(
    () =>
      accounts
        .filter(
          (item) =>
            (status === "all" || item.status === status) &&
            (type === "all" || item.accountTypeId === type) &&
            (currency === "all" || item.currency === currency) &&
            `${item.name} ${item.institutionName || ""} ${item.displayIdentifier || ""}`
              .toLowerCase()
              .includes(term.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "high"
              ? b.currentBalanceMinor - a.currentBalanceMinor
              : sort === "low"
                ? a.currentBalanceMinor - b.currentBalanceMinor
                : (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0),
        ),
    [accounts, status, type, currency, term, sort],
  );
  const active = accounts.filter((item) => item.status === ACTIVE);
  const totals = {
    balance: active.reduce(
      (sum, item) => sum + (item.currentBalanceMinor || 0),
      0,
    ),
    received: income
      .filter((item) => item.status === ACTIVE)
      .reduce((sum, item) => sum + item.amountMinor, 0),
    transferIn: transfers
      .filter((item) => item.status === ACTIVE)
      .reduce((sum, item) => sum + item.amountMinor, 0),
    transferOut: transfers
      .filter((item) => item.status === ACTIVE)
      .reduce((sum, item) => sum + item.amountMinor, 0),
  };
  const clear = () => {
    setTerm("");
    setStatus("all");
    setType("all");
    setCurrency("all");
    setSort("updated");
  };
  return (
    <div className="page-view">
      <PageHeader
        title="Accounts"
        description="Balances are calculated from opening balances, income and transfers."
        icon={WalletCards}
      />
      <div className="summary-grid finance-summary">
        <Card>
          <span>Total active balance</span>
          <strong>
            {formatCurrency(totals.balance, settings.currency, settings.locale)}
          </strong>
        </Card>
        <Card>
          <span>Total received</span>
          <strong>
            {formatCurrency(
              totals.received,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Transfers in / out</span>
          <strong>
            {formatCurrency(
              totals.transferIn,
              settings.currency,
              settings.locale,
            )}{" "}
            /{" "}
            {formatCurrency(
              totals.transferOut,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Accounts</span>
          <strong>
            {active.length} active ·{" "}
            {accounts.filter((item) => item.status === "Archived").length}{" "}
            archived
          </strong>
        </Card>
      </div>
      <FinancialToolbar>
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search accounts"
        />
        <SelectShell
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Archived">Archived</option>
        </SelectShell>
        <SelectShell
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="all">All types</option>
          {accountTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        >
          <option value="all">All currencies</option>
          {[...new Set(accounts.map((item) => item.currency))].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SelectShell>
        <SelectShell
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
          <option value="high">Highest balance</option>
          <option value="low">Lowest balance</option>
        </SelectShell>
        <Button variant="secondary" onClick={clear}>
          Clear
        </Button>
        <Link className="button" to="/accounts/new">
          <Plus size={16} />
          Add Account
        </Link>
      </FinancialToolbar>
      {loading ? (
        <Card>Loading accounts…</Card>
      ) : error ? (
        <EmptyState
          icon={WalletCards}
          title="Accounts unavailable"
          description={error}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={WalletCards}
          title={accounts.length ? "No matching accounts" : "No accounts yet"}
          description="Add a financial account before recording income or transfers."
        />
      ) : (
        <>
          <TableShell>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Institution</th>
                  <th>Opening</th>
                  <th>Current balance</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/accounts/${item.id}`}>{item.name}</Link>
                      <small>
                        {item.displayIdentifier || item.lastFourDigits
                          ? `•••• ${item.lastFourDigits || item.displayIdentifier}`
                          : ""}
                      </small>
                    </td>
                    <td>{typeName(item.accountTypeId)}</td>
                    <td>{item.institutionName || "—"}</td>
                    <td>
                      {formatCurrency(
                        item.openingBalanceMinor,
                        item.currency,
                        settings.locale,
                      )}
                    </td>
                    <td className="tabular">
                      {formatCurrency(
                        item.currentBalanceMinor,
                        item.currency,
                        settings.locale,
                      )}
                    </td>
                    <td>{item.currency}</td>
                    <td>
                      <Badge tone={statusTone(item.status)}>
                        {item.status}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        className="button button-secondary"
                        to={`/accounts/${item.id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          <div className="financial-cards">
            {filtered.map((item) => (
              <Card key={item.id}>
                <div className="card-line">
                  <strong>{item.name}</strong>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                </div>
                <p>
                  {typeName(item.accountTypeId)} · {item.currency}
                </p>
                <strong className="money-value">
                  {formatCurrency(
                    item.currentBalanceMinor,
                    item.currency,
                    settings.locale,
                  )}
                </strong>
                <Link
                  className="button button-secondary"
                  to={`/accounts/${item.id}`}
                >
                  Open account
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AccountFormPage() {
  const { accountId } = useParams();
  const { user, preview } = useAuth();
  const { settings } = useSettings();
  const { items: accounts } = useFinancial(subscribeAccounts);
  const nav = useNavigate();
  const existing = accounts.find((item) => item.id === accountId);
  const [form, setForm] = useState({
    name: "",
    accountTypeId: "",
    institutionName: "",
    displayIdentifier: "",
    lastFourDigits: "",
    upiId: "",
    openingBalance: "0",
    currency: settings.currency,
    notes: "",
    status: ACTIVE,
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!existing) return undefined;
    const timer = window.setTimeout(
      () =>
        setForm({
          name: existing.name || "",
          accountTypeId: existing.accountTypeId || "",
          institutionName: existing.institutionName || "",
          displayIdentifier: existing.displayIdentifier || "",
          lastFourDigits: existing.lastFourDigits || "",
          upiId: existing.upiId || "",
          openingBalance: String((existing.openingBalanceMinor || 0) / 100),
          currency: existing.currency || settings.currency,
          notes: existing.notes || "",
          status: existing.status || ACTIVE,
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [existing, settings.currency]);
  const save = async (event) => {
    event.preventDefault();
    const openingBalanceMinor = toMinorUnits(form.openingBalance, {
      allowNegative: form.accountTypeId === "creditCard",
    });
    if (
      !form.name.trim() ||
      !form.accountTypeId ||
      openingBalanceMinor === null ||
      (form.lastFourDigits && !/^\d{4}$/.test(form.lastFourDigits))
    )
      return toast.error(
        "Complete the required account fields with a valid opening balance and last four digits.",
      );
    setBusy(true);
    try {
      if (existing) {
        const changingOpening =
          openingBalanceMinor !== existing.openingBalanceMinor;
        if (
          changingOpening &&
          !window.confirm(
            "This corrects the opening balance and adjusts the current balance. Continue?",
          )
        )
          return;
        await updateAccount(
          user.uid,
          existing.id,
          { ...form, openingBalanceMinor },
          { confirmOpeningAdjustment: changingOpening },
        );
        toast.success("Account updated.");
        nav(`/accounts/${existing.id}`);
      } else {
        const duplicate = accounts.some(
          (item) =>
            item.status !== "Archived" &&
            item.normalizedName === form.name.trim().toLowerCase(),
        );
        if (duplicate)
          throw new Error("An active account already uses this name.");
        const ref = await createAccount(user.uid, {
          ...form,
          openingBalanceMinor,
        });
        toast.success("Account created.");
        nav(`/accounts/${ref.id}`);
      }
    } catch (error) {
      toast.error(safeError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-view">
      <PageHeader
        title={existing ? "Edit Account" : "Add Account"}
        description="Never store banking passwords, PINs, card numbers or OTPs here."
        icon={WalletCards}
      />
      <Card>
        <form className="settings-form financial-form" onSubmit={save}>
          <div className="settings-grid">
            <FormField label="Account name">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Account type">
              <CreatableSelect
                group="accountTypes"
                value={form.accountTypeId}
                onChange={(accountTypeId) =>
                  setForm({ ...form, accountTypeId })
                }
                required
              />
            </FormField>
            <FormField label="Institution / provider">
              <Input
                value={form.institutionName}
                onChange={(event) =>
                  setForm({ ...form, institutionName: event.target.value })
                }
              />
            </FormField>
            <FormField label="Masked identifier">
              <Input
                value={form.displayIdentifier}
                onChange={(event) =>
                  setForm({ ...form, displayIdentifier: event.target.value })
                }
                placeholder="e.g. Salary account"
              />
            </FormField>
            <FormField label="Last four digits">
              <Input
                inputMode="numeric"
                maxLength="4"
                value={form.lastFourDigits}
                onChange={(event) =>
                  setForm({
                    ...form,
                    lastFourDigits: event.target.value.replace(/\D/g, ""),
                  })
                }
              />
            </FormField>
            <FormField label="UPI ID (optional)">
              <Input
                value={form.upiId}
                onChange={(event) =>
                  setForm({ ...form, upiId: event.target.value })
                }
              />
            </FormField>
            <FormField label="Opening balance">
              <Input
                inputMode="decimal"
                value={form.openingBalance}
                onChange={(event) =>
                  setForm({ ...form, openingBalance: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Currency">
              <SelectShell
                value={form.currency}
                onChange={(event) =>
                  setForm({ ...form, currency: event.target.value })
                }
              >
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </SelectShell>
            </FormField>
          </div>
          {existing && (
            <Card className="subtle-card">
              <span>Current balance (calculated)</span>
              <strong>
                {formatCurrency(
                  existing.currentBalanceMinor,
                  existing.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
          )}
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </FormField>
          <div className="settings-actions">
            <Button loading={busy} disabled={preview}>
              {existing ? "Save changes" : "Save account"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                nav(existing ? `/accounts/${existing.id}` : "/accounts")
              }
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AccountDetailPage() {
  const { accountId } = useParams();
  const { user, preview } = useAuth();
  const { items: accounts, loading } = useFinancial(subscribeAccounts);
  const { items: income } = useFinancial(subscribeIncome);
  const { items: transfers } = useFinancial(subscribeTransfers);
  const { items: expenses } = useExpenses();
  const { settings } = useSettings();
  const [voidItem, setVoidItem] = useState(null);
  const [kind, setKind] = useState("all");
  const [term, setTerm] = useState("");
  const account = accounts.find((item) => item.id === accountId);
  if (loading) return <Card>Loading account…</Card>;
  if (!account)
    return (
      <EmptyState
        icon={WalletCards}
        title="Account not found"
        description="This account may have been removed from your authorized workspace."
      />
    );
  const ledger = [
    {
      id: "opening",
      date: account.createdAt,
      kind: "Opening balance",
      label: "Opening balance",
      credit: Math.max(account.openingBalanceMinor, 0),
      debit: Math.max(-account.openingBalanceMinor, 0),
      status: "Active",
      reference: "opening",
    },
    ...income
      .filter((item) => item.accountId === accountId)
      .map((item) => ({
        id: `income:${item.id}`,
        date: item.receivedDate,
        kind: "Income",
        label: item.title,
        credit: item.status === ACTIVE ? item.amountMinor : 0,
        debit: 0,
        status: item.status,
        reference: item.referenceId || item.id,
        projectId: item.projectId,
        clientId: item.clientId,
      })),
    ...expenses
      .filter((item) => item.accountId === accountId)
      .map((item) => ({
        id: `expense:${item.id}`,
        date: item.paidDate || item.expenseDate,
        kind: "Expense",
        label: item.title,
        credit: 0,
        debit: item.paymentStatus === "Paid" ? item.amountMinor : 0,
        status: item.paymentStatus,
        reference: item.ledgerReference || `expense:${item.id}`,
        projectId: item.projectId,
        clientId: item.clientId,
      })),
    ...transfers
      .filter(
        (item) =>
          item.fromAccountId === accountId || item.toAccountId === accountId,
      )
      .map((item) => ({
        id: `transfer:${item.id}:${item.fromAccountId === accountId ? "out" : "in"}`,
        date: item.transferDate,
        kind: item.fromAccountId === accountId ? "Transfer out" : "Transfer in",
        label: item.notes || "Account transfer",
        credit:
          item.status === ACTIVE && item.toAccountId === accountId
            ? item.amountMinor
            : 0,
        debit:
          item.status === ACTIVE && item.fromAccountId === accountId
            ? item.amountMinor
            : 0,
        status: item.status,
        reference: item.referenceId || item.id,
        transfer: item,
      })),
  ]
    .filter(
      (item) =>
        (kind === "all" || item.kind === kind) &&
        `${item.label} ${item.reference}`
          .toLowerCase()
          .includes(term.toLowerCase()),
    )
    .sort(
      (a, b) =>
        dateInput(a.date).localeCompare(dateInput(b.date)) ||
        a.id.localeCompare(b.id),
    );
  const rows = ledger.reduce((result, item) => {
    const previous = result.at(-1)?.running || 0;
    result.push({ ...item, running: previous + item.credit - item.debit });
    return result;
  }, []);
  const transfersForAccount = transfers.filter(
    (item) =>
      item.fromAccountId === accountId || item.toAccountId === accountId,
  );
  const archive = async () => {
    const action =
      account.status === "Archived" ? reactivateAccount : archiveAccount;
    const reason =
      account.status === "Archived"
        ? ""
        : window.prompt("Archive reason (optional)") || "";
    try {
      await action(user.uid, account.id, reason);
      toast.success(
        account.status === "Archived"
          ? "Account reactivated."
          : "Account archived.",
      );
    } catch (error) {
      toast.error(safeError(error));
    }
  };
  const exportLedger = () =>
    downloadCsv(
      "Account_Ledger",
      csvText(
        [
          "Account",
          "Date",
          "Type",
          "Description",
          "Credit",
          "Debit",
          "Running balance",
          "Reference",
          "Status",
        ],
        rows.map((item) => [
          account.name,
          dateText(item.date, settings.locale),
          item.kind,
          item.label,
          formatCurrency(item.credit, account.currency, settings.locale),
          formatCurrency(item.debit, account.currency, settings.locale),
          formatCurrency(item.running, account.currency, settings.locale),
          item.reference,
          item.status,
        ]),
      ),
      account.name,
    );
  return (
    <div className="page-view">
      <PageHeader
        title={account.name}
        description="A deterministic ledger of received income and account transfers."
        icon={WalletCards}
      />
      <div className="summary-grid finance-summary">
        <Card>
          <span>Opening</span>
          <strong>
            {formatCurrency(
              account.openingBalanceMinor,
              account.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Current</span>
          <strong>
            {formatCurrency(
              account.currentBalanceMinor,
              account.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Status</span>
          <strong>
            <Badge tone={statusTone(account.status)}>{account.status}</Badge>
          </strong>
        </Card>
      </div>
      <FinancialToolbar>
        <Link className="button" to={`/accounts/${account.id}/edit`}>
          <Pencil size={16} />
          Edit
        </Link>
        <Link
          className="button button-secondary"
          to={`/accounts/${account.id}/transfer`}
        >
          <ArrowLeftRight size={16} />
          Transfer money
        </Link>
        <Button variant="secondary" onClick={exportLedger}>
          <Download size={16} />
          Export ledger
        </Button>
        <Button variant="secondary" disabled={preview} onClick={archive}>
          <Archive size={16} />
          {account.status === "Archived" ? "Reactivate" : "Archive"}
        </Button>
      </FinancialToolbar>
      <Card>
        <div className="card-line">
          <h2>Ledger</h2>
          <div className="ledger-filters">
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search ledger"
            />
            <SelectShell
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All entries</option>
              <option>Income</option>
              <option>Expense</option>
              <option>Transfer in</option>
              <option>Transfer out</option>
            </SelectShell>
          </div>
        </div>
        {rows.length ? (
          <TableShell>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Credit</th>
                  <th>Debit</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>{dateText(item.date, settings.locale)}</td>
                    <td>{item.kind}</td>
                    <td>
                      {item.label}
                      <small>{item.reference}</small>
                    </td>
                    <td>
                      {item.credit
                        ? formatCurrency(
                            item.credit,
                            account.currency,
                            settings.locale,
                          )
                        : "—"}
                    </td>
                    <td>
                      {item.debit
                        ? formatCurrency(
                            item.debit,
                            account.currency,
                            settings.locale,
                          )
                        : "—"}
                    </td>
                    <td>
                      {formatCurrency(
                        item.running,
                        account.currency,
                        settings.locale,
                      )}
                    </td>
                    <td>
                      <Badge tone={statusTone(item.status)}>
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <p className="helper-text">No ledger entries match this view.</p>
        )}
      </Card>
      <Card>
        <div className="card-line">
          <h2>Transfers</h2>
          <Link
            className="button button-secondary"
            to={`/accounts/${account.id}/transfer`}
          >
            New transfer
          </Link>
        </div>
        {transfersForAccount.length ? (
          transfersForAccount.map((item) => (
            <div className="list-row" key={item.id}>
              <span>
                {dateText(item.transferDate, settings.locale)} ·{" "}
                {item.fromAccountId === accountId ? "Outgoing" : "Incoming"}
              </span>
              <strong>
                {formatCurrency(
                  item.amountMinor,
                  item.currency,
                  settings.locale,
                )}
              </strong>
              <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              <Link
                to={`/accounts/${account.id}/transfer?transferId=${item.id}`}
              >
                Edit
              </Link>
              {item.status === ACTIVE ? (
                <Button
                  variant="secondary"
                  disabled={preview}
                  onClick={() => setVoidItem({ type: "transfer", id: item.id })}
                >
                  Void
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={preview}
                  onClick={async () => {
                    try {
                      await restoreTransfer(user.uid, item.id);
                      toast.success("Transfer restored.");
                    } catch (error) {
                      toast.error(safeError(error));
                    }
                  }}
                >
                  Restore
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="helper-text">No transfers yet.</p>
        )}
      </Card>
      <VoidModal
        open={Boolean(voidItem)}
        title="Void transfer"
        onClose={() => setVoidItem(null)}
        onConfirm={async (reason) => {
          try {
            await voidTransfer(user.uid, voidItem.id, reason);
            toast.success("Transfer voided.");
            setVoidItem(null);
          } catch (error) {
            toast.error(safeError(error));
          }
        }}
      />
    </div>
  );
}

export function TransferFormPage() {
  const { accountId } = useParams();
  const [params] = useSearchParams();
  const transferId = params.get("transferId");
  const { user, preview } = useAuth();
  const { items: accounts } = useFinancial(subscribeAccounts);
  const { items: transfers } = useFinancial(subscribeTransfers);
  const nav = useNavigate();
  const existing = transfers.find((item) => item.id === transferId);
  const [form, setForm] = useState({
    fromAccountId: accountId || "",
    toAccountId: "",
    amount: "",
    transferDate: nowInput(),
    referenceId: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!existing) return undefined;
    const timer = window.setTimeout(
      () =>
        setForm({
          fromAccountId: existing.fromAccountId,
          toAccountId: existing.toAccountId,
          amount: String(existing.amountMinor / 100),
          transferDate: dateInput(existing.transferDate),
          referenceId: existing.referenceId || "",
          notes: existing.notes || "",
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [existing]);
  const activeAccounts = accounts.filter((item) => item.status === ACTIVE);
  const from = accounts.find((item) => item.id === form.fromAccountId);
  const save = async (event) => {
    event.preventDefault();
    const amountMinor = toMinorUnits(form.amount);
    if (!amountMinor || !from)
      return toast.error("Choose both accounts and enter a valid amount.");
    setBusy(true);
    try {
      const data = { ...form, amountMinor, currency: from.currency };
      if (existing) {
        await updateTransfer(user.uid, existing.id, data);
        toast.success("Transfer updated.");
      } else {
        await createTransfer(user.uid, data);
        toast.success("Transfer created.");
      }
      nav(`/accounts/${form.fromAccountId}`);
    } catch (error) {
      toast.error(safeError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-view">
      <PageHeader
        title={existing ? "Edit Transfer" : "Transfer Money"}
        description="Transfers move money between accounts and never count as income."
        icon={ArrowLeftRight}
      />
      <Card>
        <form className="settings-form financial-form" onSubmit={save}>
          <FormField label="From account">
            <SelectShell
              required
              value={form.fromAccountId}
              onChange={(event) =>
                setForm({ ...form, fromAccountId: event.target.value })
              }
            >
              <option value="">Select source account</option>
              {activeAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.currency}
                </option>
              ))}
            </SelectShell>
          </FormField>
          <FormField label="To account">
            <SelectShell
              required
              value={form.toAccountId}
              onChange={(event) =>
                setForm({ ...form, toAccountId: event.target.value })
              }
            >
              <option value="">Select destination account</option>
              {activeAccounts
                .filter(
                  (item) =>
                    item.id !== form.fromAccountId &&
                    (!from || item.currency === from.currency),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.currency}
                  </option>
                ))}
            </SelectShell>
          </FormField>
          <div className="settings-grid">
            <FormField label="Amount">
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Transfer date">
              <Input
                type="date"
                value={form.transferDate}
                onChange={(event) =>
                  setForm({ ...form, transferDate: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Reference ID">
              <Input
                value={form.referenceId}
                onChange={(event) =>
                  setForm({ ...form, referenceId: event.target.value })
                }
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </FormField>
          <div className="settings-actions">
            <Button loading={busy} disabled={preview}>
              {existing ? "Save transfer" : "Transfer money"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                nav(`/accounts/${form.fromAccountId || accountId}`)
              }
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function IncomePage() {
  const { items, error, loading } = useFinancial(subscribeIncome);
  const { items: accounts } = useFinancial(subscribeAccounts);
  const { items: projects } = useProjects();
  const { items: clients } = useClients();
  const { settings } = useSettings();
  const { user, preview } = useAuth();
  const { options: categories } = useMasterOptions("incomeCategories");
  const { options: modes } = useMasterOptions("paymentModes");
  const { options: paymentTypes } = useMasterOptions("paymentTypes");
  const [term, setTerm] = useState("");
  const [filters, setFilters] = useState({
    source: "all",
    status: "all",
    account: "all",
    category: "all",
    mode: "all",
    paymentType: "all",
    client: "all",
    project: "all",
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
    sort: "newest",
  });
  const [page, setPage] = useState(0);
  const [voidId, setVoidId] = useState(null);
  const limit = Number(settings.defaultPageSize) || 25;
  const byId = (list, id) =>
    list.find((item) => item.id === id)?.name ||
    list.find((item) => item.id === id)?.label ||
    "—";
  const filtered = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (filters.source === "all" || item.sourceType === filters.source) &&
            (filters.status === "all" || item.status === filters.status) &&
            (filters.account === "all" || item.accountId === filters.account) &&
            (filters.category === "all" ||
              item.incomeCategoryId === filters.category) &&
            (filters.mode === "all" || item.paymentModeId === filters.mode) &&
            (filters.paymentType === "all" ||
              item.paymentTypeId === filters.paymentType) &&
            (filters.client === "all" || item.clientId === filters.client) &&
            (filters.project === "all" || item.projectId === filters.project) &&
            (!filters.dateFrom ||
              dateInput(item.receivedDate) >= filters.dateFrom) &&
            (!filters.dateTo ||
              dateInput(item.receivedDate) <= filters.dateTo) &&
            (!filters.minAmount ||
              item.amountMinor >= toMinorUnits(filters.minAmount)) &&
            (!filters.maxAmount ||
              item.amountMinor <= toMinorUnits(filters.maxAmount)) &&
            `${item.title} ${item.referenceId || ""} ${item.notes || ""} ${byId(clients, item.clientId)} ${byId(projects, item.projectId)}`
              .toLowerCase()
              .includes(term.toLowerCase()),
        )
        .sort((a, b) =>
          filters.sort === "oldest"
            ? dateInput(a.receivedDate).localeCompare(dateInput(b.receivedDate))
            : filters.sort === "high"
              ? b.amountMinor - a.amountMinor
              : filters.sort === "low"
                ? a.amountMinor - b.amountMinor
                : filters.sort === "updated"
                  ? (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
                  : dateInput(b.receivedDate).localeCompare(
                      dateInput(a.receivedDate),
                    ),
        ),
    [items, filters, term, projects, clients],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(currentPage * limit, (currentPage + 1) * limit);
  const activeRows = filtered.filter((item) => item.status === ACTIVE);
  const summary = {
    total: activeRows.reduce((sum, item) => sum + item.amountMinor, 0),
    project: activeRows
      .filter((item) => item.sourceType === "Project Payment")
      .reduce((sum, item) => sum + item.amountMinor, 0),
    independent: activeRows
      .filter((item) => item.sourceType === "Independent Income")
      .reduce((sum, item) => sum + item.amountMinor, 0),
    voided: filtered.filter((item) => item.status === "Voided").length,
  };
  const exportRows = () =>
    downloadCsv(
      "Income_Export",
      csvText(
        [
          "Received date",
          "Title",
          "Type",
          "Client",
          "Project",
          "Category",
          "Payment type",
          "Payment mode",
          "Account",
          "Amount",
          "Reference",
          "Status",
        ],
        filtered.map((item) => [
          dateText(item.receivedDate, settings.locale),
          item.title,
          item.sourceType,
          byId(clients, item.clientId),
          byId(projects, item.projectId),
          byId(categories, item.incomeCategoryId),
          byId(paymentTypes, item.paymentTypeId),
          byId(modes, item.paymentModeId),
          byId(accounts, item.accountId),
          formatCurrency(item.amountMinor, item.currency, settings.locale),
          item.referenceId || "",
          item.status,
        ]),
      ),
    );
  const set = (key, value) => setFilters({ ...filters, [key]: value });
  return (
    <div className="page-view">
      <PageHeader
        title="Income"
        description="Project payments and independent income share one canonical, auditable ledger."
        icon={Landmark}
      />
      <div className="summary-grid finance-summary">
        <Card>
          <span>Active income</span>
          <strong>
            {formatCurrency(summary.total, settings.currency, settings.locale)}
          </strong>
        </Card>
        <Card>
          <span>Project payments</span>
          <strong>
            {formatCurrency(
              summary.project,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Independent income</span>
          <strong>
            {formatCurrency(
              summary.independent,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Voided records</span>
          <strong>{summary.voided}</strong>
        </Card>
      </div>
      <FinancialToolbar>
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search title, client, project or reference"
        />
        <SelectShell
          value={filters.source}
          onChange={(event) => set("source", event.target.value)}
        >
          <option value="all">All income types</option>
          <option>Project Payment</option>
          <option>Independent Income</option>
        </SelectShell>
        <SelectShell
          value={filters.status}
          onChange={(event) => set("status", event.target.value)}
        >
          <option value="all">All statuses</option>
          <option>Active</option>
          <option>Voided</option>
        </SelectShell>
        <SelectShell
          value={filters.account}
          onChange={(event) => set("account", event.target.value)}
        >
          <option value="all">All accounts</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={filters.category}
          onChange={(event) => set("category", event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={filters.mode}
          onChange={(event) => set("mode", event.target.value)}
        >
          <option value="all">All payment modes</option>
          {modes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={filters.paymentType}
          onChange={(event) => set("paymentType", event.target.value)}
        >
          <option value="all">All payment types</option>
          {paymentTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={filters.client}
          onChange={(event) => set("client", event.target.value)}
        >
          <option value="all">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectShell>
        <Input
          type="date"
          aria-label="Income received from"
          value={filters.dateFrom}
          onChange={(event) => set("dateFrom", event.target.value)}
        />
        <Input
          type="date"
          aria-label="Income received to"
          value={filters.dateTo}
          onChange={(event) => set("dateTo", event.target.value)}
        />
        <Input
          inputMode="decimal"
          aria-label="Minimum income amount"
          placeholder="Minimum amount"
          value={filters.minAmount}
          onChange={(event) => set("minAmount", event.target.value)}
        />
        <Input
          inputMode="decimal"
          aria-label="Maximum income amount"
          placeholder="Maximum amount"
          value={filters.maxAmount}
          onChange={(event) => set("maxAmount", event.target.value)}
        />
        <SelectShell
          value={filters.project}
          onChange={(event) => set("project", event.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={filters.sort}
          onChange={(event) => set("sort", event.target.value)}
        >
          <option value="newest">Newest received</option>
          <option value="oldest">Oldest received</option>
          <option value="high">Highest amount</option>
          <option value="low">Lowest amount</option>
          <option value="updated">Recently updated</option>
        </SelectShell>
        <Button
          variant="secondary"
          onClick={() => {
            setTerm("");
            setFilters({
              source: "all",
              status: "all",
              account: "all",
              category: "all",
              mode: "all",
              paymentType: "all",
              client: "all",
              project: "all",
              dateFrom: "",
              dateTo: "",
              minAmount: "",
              maxAmount: "",
              sort: "newest",
            });
          }}
        >
          Clear
        </Button>
        <Button variant="secondary" onClick={exportRows}>
          <Download size={16} />
          Export CSV
        </Button>
        <Link className="button" to="/income/new">
          <Plus size={16} />
          Add Income
        </Link>
      </FinancialToolbar>
      {loading ? (
        <Card>Loading income…</Card>
      ) : error ? (
        <EmptyState
          icon={Landmark}
          title="Income unavailable"
          description={error}
        />
      ) : !rows.length ? (
        <EmptyState
          icon={Landmark}
          title={items.length ? "No matching income" : "No income yet"}
          description="Record money only after it has been received."
        />
      ) : (
        <>
          <TableShell>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Client / project</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>{dateText(item.receivedDate, settings.locale)}</td>
                    <td>
                      {item.title}
                      <small>{item.referenceId || ""}</small>
                    </td>
                    <td>{item.sourceType}</td>
                    <td>
                      {byId(clients, item.clientId)}
                      <small>{byId(projects, item.projectId)}</small>
                    </td>
                    <td>{byId(categories, item.incomeCategoryId)}</td>
                    <td>{byId(accounts, item.accountId)}</td>
                    <td>
                      {formatCurrency(
                        item.amountMinor,
                        item.currency,
                        settings.locale,
                      )}
                    </td>
                    <td>
                      <Badge tone={statusTone(item.status)}>
                        {item.status}
                      </Badge>
                    </td>
                    <td>
                      <Link to={`/income/${item.id}/edit`}>Edit</Link>
                      {item.status === ACTIVE ? (
                        <Button
                          variant="secondary"
                          disabled={preview}
                          onClick={() => setVoidId(item.id)}
                        >
                          Void
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          disabled={preview}
                          onClick={async () => {
                            try {
                              await restoreIncome(user.uid, item.id);
                              toast.success("Income restored.");
                            } catch (error) {
                              toast.error(safeError(error));
                            }
                          }}
                        >
                          Restore
                        </Button>
                      )}
                      <Link to={`/income/new?duplicate=${item.id}`}>
                        Duplicate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          <div className="financial-cards">
            {rows.map((item) => (
              <Card key={item.id}>
                <div className="card-line">
                  <strong>{item.title}</strong>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                </div>
                <p>
                  {dateText(item.receivedDate, settings.locale)} ·{" "}
                  {byId(projects, item.projectId) ||
                    byId(clients, item.clientId)}
                </p>
                <strong className="money-value">
                  {formatCurrency(
                    item.amountMinor,
                    item.currency,
                    settings.locale,
                  )}
                </strong>
                <div className="settings-actions">
                  <Link
                    className="button button-secondary"
                    to={`/income/${item.id}/edit`}
                  >
                    Edit
                  </Link>
                  {item.status === ACTIVE ? (
                    <Button
                      variant="secondary"
                      disabled={preview}
                      onClick={() => setVoidId(item.id)}
                    >
                      Void
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={preview}
                      onClick={() => restoreIncome(user.uid, item.id)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}
      <VoidModal
        open={Boolean(voidId)}
        title="Void income"
        onClose={() => setVoidId(null)}
        onConfirm={async (reason) => {
          try {
            await voidIncome(user.uid, voidId, reason);
            toast.success("Income voided and its balance effect reversed.");
            setVoidId(null);
          } catch (error) {
            toast.error(safeError(error));
          }
        }}
      />
    </div>
  );
}

export function IncomeFormPage() {
  const { incomeId } = useParams();
  const [params] = useSearchParams();
  const { user, preview } = useAuth();
  const { settings } = useSettings();
  const { items: accounts } = useFinancial(subscribeAccounts);
  const { items: income } = useFinancial(subscribeIncome);
  const { items: projects } = useProjects();
  const { items: clients } = useClients();
  const { items: expenses } = useExpenses();
  const nav = useNavigate();
  const existing =
    income.find((item) => item.id === incomeId) ||
    income.find((item) => item.id === params.get("duplicate"));
  const initialProjectId = params.get("projectId") || "";
  const projectMode = params.get("type") === "project";
  const [form, setForm] = useState({
    sourceType:
      initialProjectId || projectMode
        ? "Project Payment"
        : "Independent Income",
    title: "",
    amount: "",
    accountId: "",
    clientId: "",
    projectId: initialProjectId,
    incomeCategoryId: "",
    paymentTypeId: "",
    paymentModeId: "",
    receivedDate: nowInput(),
    referenceId: "",
    notes: "",
    nextPaymentDateAfterTransaction: "",
    nextExpectedAmount: "",
    linkedExpenseId: "",
  });
  const [busy, setBusy] = useState(false);
  const [confirmOverpayment, setConfirmOverpayment] = useState(false);
  useEffect(() => {
    if (!existing) return undefined;
    const timer = window.setTimeout(
      () =>
        setForm({
          sourceType: existing.sourceType,
          title: existing.title || "",
          amount: String(existing.amountMinor / 100),
          accountId: existing.accountId || "",
          clientId: existing.clientId || "",
          projectId: existing.projectId || "",
          incomeCategoryId: existing.incomeCategoryId || "",
          paymentTypeId: existing.paymentTypeId || "",
          paymentModeId: existing.paymentModeId || "",
          receivedDate: dateInput(existing.receivedDate),
          referenceId: existing.referenceId || "",
          notes: existing.notes || "",
          nextPaymentDateAfterTransaction: dateInput(
            existing.nextPaymentDateAfterTransaction,
          ),
          nextExpectedAmount:
            existing.nextExpectedAmountMinorAfterTransaction === null ||
            existing.nextExpectedAmountMinorAfterTransaction === undefined
              ? ""
              : String(existing.nextExpectedAmountMinorAfterTransaction / 100),
          linkedExpenseId: existing.linkedExpenseId || "",
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [existing]);
  const project = projects.find((item) => item.id === form.projectId);
  const activeAccounts = accounts.filter((item) => item.status === ACTIVE);
  const amountMinor = toMinorUnits(form.amount);
  const available = project
    ? Math.max(
        (project.totalAmountMinor || 0) -
          (project.receivedAmountMinor || 0) +
          (existing?.projectId === project.id && existing?.status === ACTIVE
            ? existing.amountMinor
            : 0),
        0,
      )
    : null;
  const mayOverpay = project && amountMinor !== null && amountMinor > available;
  const chooseProject = (projectId) => {
    const selected = projects.find((item) => item.id === projectId);
    setForm({
      ...form,
      projectId,
      clientId: selected?.clientId || "",
      sourceType: "Project Payment",
      title: form.title || (selected ? `${selected.name} payment` : ""),
    });
  };
  const save = async (event) => {
    event.preventDefault();
    if (form.sourceType === "Project Payment" && !project)
      return toast.error("Choose a valid project.");
    if (!amountMinor) return toast.error("Enter an amount greater than zero.");
    if (mayOverpay && !confirmOverpayment)
      return toast.error("Confirm the overpayment before saving.");
    const data = {
      ...form,
      amountMinor,
      currency:
        project?.currency ||
        accounts.find((item) => item.id === form.accountId)?.currency ||
        settings.currency,
      nextExpectedAmountMinorAfterTransaction: form.nextExpectedAmount
        ? toMinorUnits(form.nextExpectedAmount)
        : null,
      linkedExpenseId: form.linkedExpenseId || null,
      confirmOverpayment,
    };
    setBusy(true);
    try {
      if (existing && incomeId) {
        await updateIncome(user.uid, incomeId, data);
        toast.success("Income updated.");
      } else {
        await createIncome(user.uid, data);
        toast.success("Income recorded.");
      }
      nav(project ? `/projects/${project.id}?tab=payments` : "/income");
    } catch (error) {
      toast.error(safeError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-view">
      <PageHeader
        title={incomeId ? "Edit Income" : "Add Income"}
        description="Every project payment is an Income transaction—never a duplicate payment record."
        icon={Landmark}
      />
      <Card>
        <form className="settings-form financial-form" onSubmit={save}>
          <FormField label="Income type">
            <SelectShell
              value={form.sourceType}
              onChange={(event) =>
                setForm({
                  ...form,
                  sourceType: event.target.value,
                  projectId:
                    event.target.value === "Independent Income"
                      ? ""
                      : form.projectId,
                  clientId:
                    event.target.value === "Independent Income"
                      ? form.clientId
                      : form.clientId,
                })
              }
            >
              <option>Independent Income</option>
              <option>Project Payment</option>
            </SelectShell>
          </FormField>
          {form.sourceType === "Project Payment" && (
            <>
              <FormField label="Project">
                <SelectShell
                  value={form.projectId}
                  onChange={(event) => chooseProject(event.target.value)}
                  required
                >
                  <option value="">Select project</option>
                  {projects
                    .filter(
                      (item) =>
                        item.status !== "Archived" &&
                        item.status !== "Cancelled",
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </SelectShell>
              </FormField>
              <FormField label="Client">
                <SelectShell value={form.clientId} disabled required>
                  <option value="">Select project first</option>
                  {clients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </SelectShell>
              </FormField>
              {project && (
                <Card className="subtle-card">
                  <span>Project total / received / remaining</span>
                  <strong>
                    {formatCurrency(
                      project.totalAmountMinor,
                      project.currency || settings.currency,
                      settings.locale,
                    )}{" "}
                    ·{" "}
                    {formatCurrency(
                      project.receivedAmountMinor,
                      project.currency || settings.currency,
                      settings.locale,
                    )}{" "}
                    ·{" "}
                    {formatCurrency(
                      available,
                      project.currency || settings.currency,
                      settings.locale,
                    )}
                  </strong>
                </Card>
              )}
            </>
          )}
          <div className="settings-grid">
            <FormField label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                required={form.sourceType === "Independent Income"}
              />
            </FormField>
            <FormField label="Amount received">
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Receiving account">
              <SelectShell
                value={form.accountId}
                onChange={(event) =>
                  setForm({ ...form, accountId: event.target.value })
                }
                required
              >
                <option value="">Select active account</option>
                {activeAccounts
                  .filter(
                    (item) =>
                      !project ||
                      item.currency === (project.currency || settings.currency),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.currency}
                    </option>
                  ))}
              </SelectShell>
            </FormField>
            <FormField label="Received date">
              <Input
                type="date"
                value={form.receivedDate}
                onChange={(event) =>
                  setForm({ ...form, receivedDate: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Income category">
              <CreatableSelect
                group="incomeCategories"
                value={form.incomeCategoryId}
                onChange={(incomeCategoryId) =>
                  setForm({ ...form, incomeCategoryId })
                }
                required
              />
            </FormField>
            <FormField label="Payment mode">
              <CreatableSelect
                group="paymentModes"
                value={form.paymentModeId}
                onChange={(paymentModeId) =>
                  setForm({ ...form, paymentModeId })
                }
                required
              />
            </FormField>
            {form.sourceType === "Project Payment" && (
              <FormField label="Payment type">
                <CreatableSelect
                  group="paymentTypes"
                  value={form.paymentTypeId}
                  onChange={(paymentTypeId) =>
                    setForm({ ...form, paymentTypeId })
                  }
                  required
                />
              </FormField>
            )}
            {form.sourceType === "Independent Income" && (
              <FormField label="Client (optional)">
                <SelectShell
                  value={form.clientId}
                  onChange={(event) =>
                    setForm({ ...form, clientId: event.target.value })
                  }
                >
                  <option value="">No linked client</option>
                  {clients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </SelectShell>
              </FormField>
            )}
            {form.sourceType === "Independent Income" && (
              <FormField label="Reimbursed expense (optional)">
                <SelectShell
                  value={form.linkedExpenseId}
                  onChange={(event) => {
                    const selected = expenses.find(
                      (item) => item.id === event.target.value,
                    );
                    setForm({
                      ...form,
                      linkedExpenseId: event.target.value,
                      clientId: selected?.clientId || form.clientId,
                      title:
                        form.title ||
                        (selected
                          ? `Reimbursement: ${selected.title}`
                          : form.title),
                    });
                  }}
                >
                  <option value="">Not linked to an expense</option>
                  {expenses
                    .filter(
                      (item) =>
                        item.isClientReimbursable &&
                        item.paymentStatus !== "Cancelled",
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </SelectShell>
              </FormField>
            )}
            <FormField label="Reference ID">
              <Input
                value={form.referenceId}
                onChange={(event) =>
                  setForm({ ...form, referenceId: event.target.value })
                }
              />
            </FormField>
          </div>
          {form.sourceType === "Project Payment" && (
            <div className="settings-grid">
              <FormField label="Next payment date (optional)">
                <Input
                  type="date"
                  value={form.nextPaymentDateAfterTransaction}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      nextPaymentDateAfterTransaction: event.target.value,
                    })
                  }
                />
              </FormField>
              <FormField label="Expected next amount (optional)">
                <Input
                  inputMode="decimal"
                  value={form.nextExpectedAmount}
                  onChange={(event) =>
                    setForm({ ...form, nextExpectedAmount: event.target.value })
                  }
                />
              </FormField>
            </div>
          )}
          {mayOverpay && (
            <label className="settings-readonly">
              <input
                type="checkbox"
                checked={confirmOverpayment}
                onChange={(event) =>
                  setConfirmOverpayment(event.target.checked)
                }
              />{" "}
              This payment exceeds the current contract remainder by{" "}
              {formatCurrency(
                amountMinor - available,
                project.currency || settings.currency,
                settings.locale,
              )}
              . Record it as an overpayment.
            </label>
          )}
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </FormField>
          <div className="settings-actions">
            <Button loading={busy} disabled={preview}>
              {incomeId ? "Save changes" : "Record income"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                nav(
                  project ? `/projects/${project.id}?tab=payments` : "/income",
                )
              }
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

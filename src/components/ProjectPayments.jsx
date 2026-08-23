import { useEffect, useMemo, useState } from "react";
import { Download, Plus, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, FormField, Input, SelectShell } from "./ui";
import {
  subscribeProjectIncome,
  updateProjectPaymentReminder,
} from "../services/financial";
import { useAuth } from "../context/useAuth";
import { useSettings } from "../context/useSettings";
import { useMasterOptions } from "../hooks/useMasterOptions";
import { csvFilename, csvText } from "../utils/csv";
import { projectPaymentSummary } from "../utils/financialConsistency";
import { formatCurrency, toMinorUnits } from "../utils/money";

const stamp = (value) => value?.toMillis ? value.toMillis() : value?.seconds ? value.seconds * 1000 : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00").getTime() : Number(value) || 0;
const dateText = (value, locale) => { const time = stamp(value); return time ? new Date(time).toLocaleDateString(locale) : "Not set" };
const dateInput = (value) => typeof value === "string" ? value.slice(0, 10) : value?.toDate ? value.toDate().toISOString().slice(0, 10) : value ? new Date(value).toISOString().slice(0, 10) : "";
const tone = (status) =>
  status === "Active" ? "success" : status === "Voided" ? "danger" : "warning";

export function ProjectPayments({ project }) {
  const { user, preview, isConfigured } = useAuth();
  const { settings } = useSettings();
  const { options: modes } = useMasterOptions("paymentModes");
  const { options: types } = useMasterOptions("paymentTypes");
  const [payments, setPayments] = useState([]);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [sort, setSort] = useState("newest");
  const [reminder, setReminder] = useState({
    date: dateInput(project.nextPaymentDate),
    amount:
      project.nextExpectedAmountMinor === null ||
      project.nextExpectedAmountMinor === undefined
        ? ""
        : String(project.nextExpectedAmountMinor / 100),
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setReminder({
          date: dateInput(project.nextPaymentDate),
          amount:
            project.nextExpectedAmountMinor === null ||
            project.nextExpectedAmountMinor === undefined
              ? ""
              : String(project.nextExpectedAmountMinor / 100),
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [project.nextPaymentDate, project.nextExpectedAmountMinor]);
  useEffect(() => {
    if (!user || preview || !isConfigured) return undefined;
    return subscribeProjectIncome(user.uid, project.id, setPayments, () =>
      toast.error("Project payments could not be loaded."),
    );
  }, [user, preview, isConfigured, project.id]);
  const active = payments.filter(
    (item) => item.status === "Active" && item.sourceType === "Project Payment",
  );
  const summary = projectPaymentSummary(project.totalAmountMinor, active);
  const percent =
    project.totalAmountMinor > 0
      ? Math.min(
          100,
          Math.round(
            (summary.receivedAmountMinor / project.totalAmountMinor) * 100,
          ),
        )
      : 0;
  const rows = useMemo(
    () =>
      payments
        .filter(
          (item) =>
            (status === "all" || item.status === status) &&
            (mode === "all" || item.paymentModeId === mode) &&
            `${item.title} ${item.referenceId || ""} ${item.notes || ""}`
              .toLowerCase()
              .includes(term.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "oldest"
            ? stamp(a.receivedDate) - stamp(b.receivedDate)
            : sort === "amount"
              ? b.amountMinor - a.amountMinor
              : stamp(b.receivedDate) - stamp(a.receivedDate),
        ),
    [payments, status, mode, term, sort],
  );
  const label = (list, id) => list.find((item) => item.id === id)?.label || "-";
  const exportRows = () => {
    const metadata = [
      [
        "Project total",
        formatCurrency(
          project.totalAmountMinor,
          project.currency || settings.currency,
          settings.locale,
        ),
      ],
      [
        "Total received",
        formatCurrency(
          summary.receivedAmountMinor,
          project.currency || settings.currency,
          settings.locale,
        ),
      ],
      [
        "Remaining",
        formatCurrency(
          summary.remainingAmountMinor,
          project.currency || settings.currency,
          settings.locale,
        ),
      ],
      [
        "Overpaid",
        formatCurrency(
          summary.overpaidAmountMinor,
          project.currency || settings.currency,
          settings.locale,
        ),
      ],
    ];
    const content = [
      csvText(["Summary", "Value"], metadata),
      "",
      csvText(
        [
          "Project",
          "Client ID",
          "Amount",
          "Received date",
          "Payment mode",
          "Payment type",
          "Reference",
          "Notes",
          "Status",
        ],
        rows.map((item) => [
          project.name,
          project.clientId,
          formatCurrency(item.amountMinor, item.currency, settings.locale),
          dateText(item.receivedDate, settings.locale),
          label(modes, item.paymentModeId),
          label(types, item.paymentTypeId),
          item.referenceId || "",
          item.notes || "",
          item.status,
        ]),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = csvFilename("Project_Payments", project.name);
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const saveReminder = async (clear = false) => {
    const amount =
      clear || !reminder.amount ? null : toMinorUnits(reminder.amount);
    if (amount === null && reminder.amount && !clear)
      return toast.error("Expected amount must be a valid non-negative value.");
    setSaving(true);
    try {
      await updateProjectPaymentReminder(user.uid, project.id, {
        nextPaymentDate: clear ? null : reminder.date || null,
        nextExpectedAmountMinor: clear ? null : amount,
      });
      toast.success(
        clear ? "Payment reminder cleared." : "Payment reminder saved.",
      );
    } catch (error) {
      toast.error(error.message || "Payment reminder could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <div className="card-line">
        <div>
          <h2>Payments</h2>
          <p className="helper-text">
            These are canonical Income records. There is no separate payments
            collection.
          </p>
        </div>
        <div className="settings-actions">
          <Button variant="secondary" onClick={exportRows}>
            <Download size={16} />
            Export CSV
          </Button>
          <Link className="button" to={`/income/new?projectId=${project.id}`}>
            <Plus size={16} />
            Record Payment
          </Link>
        </div>
      </div>
      <div className="summary-grid finance-summary">
        <Card>
          <span>Project total</span>
          <strong>
            {formatCurrency(
              project.totalAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Received</span>
          <strong>
            {formatCurrency(
              summary.receivedAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Remaining</span>
          <strong>
            {formatCurrency(
              summary.remainingAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Payment status</span>
          <strong>
            <Badge
              tone={
                summary.paymentStatus === "Fully Paid"
                  ? "success"
                  : summary.paymentStatus === "Overpaid"
                    ? "warning"
                    : "info"
              }
            >
              {summary.paymentStatus}
            </Badge>
          </strong>
        </Card>
      </div>
      <div className="payment-progress" aria-label={`${percent}% paid`}>
        <span style={{ width: `${percent}%` }} />
        <small>
          {percent}% paid
          {summary.overpaidAmountMinor
            ? ` / Overpaid ${formatCurrency(summary.overpaidAmountMinor, project.currency || settings.currency, settings.locale)}`
            : ""}
        </small>
      </div>
      <Card className="subtle-card">
        <div className="card-line">
          <h3>Next expected payment</h3>
          <Button
            variant="secondary"
            disabled={preview || saving}
            onClick={() => saveReminder(true)}
          >
            <RotateCcw size={15} />
            Clear reminder
          </Button>
        </div>
        <div className="settings-grid">
          <FormField label="Next payment date">
            <Input
              type="date"
              value={reminder.date}
              onChange={(event) =>
                setReminder({ ...reminder, date: event.target.value })
              }
              disabled={preview}
            />
          </FormField>
          <FormField label="Expected amount">
            <Input
              inputMode="decimal"
              value={reminder.amount}
              onChange={(event) =>
                setReminder({ ...reminder, amount: event.target.value })
              }
              disabled={preview}
            />
          </FormField>
        </div>
        <Button
          loading={saving}
          disabled={preview}
          onClick={() => saveReminder(false)}
        >
          Save reminder
        </Button>
      </Card>
      <div className="financial-toolbar">
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search payment history"
        />
        <SelectShell
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option>Active</option>
          <option>Voided</option>
        </SelectShell>
        <SelectShell
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="all">All payment modes</option>
          {modes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectShell>
        <SelectShell
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Highest amount</option>
        </SelectShell>
      </div>
      {rows.length ? (
        <div className="payment-history">
          {rows.map((item) => (
            <div className="list-row" key={item.id}>
              <span>{dateText(item.receivedDate, settings.locale)}</span>
              <strong>
                {formatCurrency(
                  item.amountMinor,
                  item.currency,
                  settings.locale,
                )}
              </strong>
              <span>
                {label(types, item.paymentTypeId)} /{" "}
                {label(modes, item.paymentModeId)}
              </span>
              <span>{item.referenceId || "No reference"}</span>
              <Badge tone={tone(item.status)}>{item.status}</Badge>
              <Link to={`/income/${item.id}/edit`}>Open</Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="helper-text">No payment records match these filters.</p>
      )}
    </Card>
  );
}



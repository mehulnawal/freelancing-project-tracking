import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Download,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  Checkbox,
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
  cancelExpense,
  createExpense,
  createRecurringTemplate,
  generateDueExpenses,
  restoreExpense,
  subscribeMonthlyPaidExpenses,
  subscribeMonthlyPendingExpenses,
  subscribeRecurringTemplates,
  updateExpense,
  updateRecurringTemplate,
} from "../services/expenses";
import {
  subscribeAccounts,
  subscribeMonthlyIncome,
} from "../services/financial";
import { csvFilename, csvText } from "../utils/csv";
import {
  expenseDisplayStatus,
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_TYPES,
  isActiveExpense,
  isPaidExpense,
  projectExpenseSummary,
} from "../utils/expenseLogic";
import {
  dailySeries,
  groupBy,
  monthLabel,
  monthRange,
  monthlyCashSummary,
  percentageDifference,
  previousMonth,
} from "../utils/monthlyLogic";
import { formatCurrency, toMinorUnits } from "../utils/money";

const ACTIVE = "Active";
const today = () => new Date().toISOString().slice(0, 10);
const dateInput = (value) =>
  value?.toDate?.().toISOString().slice(0, 10) ||
  String(value || "").slice(0, 10);
const dateText = (value, locale) =>
  value?.toDate?.().toLocaleDateString(locale) || "—";
const tone = (status) =>
  status === "Paid" || status === ACTIVE
    ? "success"
    : status === "Overdue" || status === "Cancelled"
      ? "danger"
      : "warning";
const download = (prefix, content, name = "") => {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFilename(prefix, name);
  link.click();
  URL.revokeObjectURL(url);
};
function useCollection(subscribe, first, second) {
  const { user, isConfigured, preview } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(
    Boolean(user && isConfigured && !preview),
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || !isConfigured || preview) return undefined;
    return subscribe(
      user.uid,
      ...(first === undefined
        ? []
        : second === undefined
          ? [first]
          : [first, second]),
      (next) => {
        setItems(next);
        setLoading(false);
        setError("");
      },
      () => {
        setError("This financial data could not be loaded.");
        setLoading(false);
      },
    );
  }, [user, isConfigured, preview, subscribe, first, second]);
  return { items, loading, error };
}
function ExpenseStatus({ expense }) {
  const status = expenseDisplayStatus(expense);
  return <Badge tone={tone(status)}>{status}</Badge>;
}
function optionLabel(options, id) {
  return options.find((item) => item.id === id)?.label || "—";
}

export function ExpensesPage() {
  const { items: expenses, loading, error } = useExpenses();
  const { items: accounts } = useCollection(subscribeAccounts);
  const { items: clients } = useClients();
  const { items: projects } = useProjects();
  const { settings } = useSettings();
  const { user, preview } = useAuth();
  const { options: categories } = useMasterOptions("expenseCategories");
  const { options: subcategories } = useMasterOptions("expenseSubcategories");
  const { options: modes } = useMasterOptions("paymentModes");
  const { options: vendors } = useMasterOptions("vendors");
  const [tab, setTab] = useState("expenses");
  const [term, setTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    category: "all",
    client: "all",
    project: "all",
    account: "all",
    subcategory: "all",
    mode: "all",
    reimbursable: "all",
    start: "",
    end: "",
    min: "",
    max: "",
    sort: "newest",
  });
  const [cancelId, setCancelId] = useState(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const { items: templates } = useCollection(subscribeRecurringTemplates);
  const generatedOnStartup = useRef(false);
  useEffect(() => {
    if (!user || preview || !templates.length || generatedOnStartup.current)
      return;
    generatedOnStartup.current = true;
    generateDueExpenses(user.uid, templates).catch(() => {
      generatedOnStartup.current = false;
    });
  }, [user, preview, templates]);
  const filtered = useMemo(
    () =>
      expenses
        .filter(
          (item) =>
            (filters.status === "all" ||
              (filters.status === "Overdue"
                ? expenseDisplayStatus(item) === "Overdue"
                : item.paymentStatus === filters.status)) &&
            (filters.type === "all" || item.expenseType === filters.type) &&
            (filters.category === "all" ||
              item.categoryId === filters.category) &&
            (filters.subcategory === "all" ||
              item.subcategoryId === filters.subcategory) &&
            (filters.client === "all" || item.clientId === filters.client) &&
            (filters.project === "all" || item.projectId === filters.project) &&
            (filters.account === "all" || item.accountId === filters.account) &&
            (filters.mode === "all" || item.paymentModeId === filters.mode) &&
            (!filters.start || dateInput(item.expenseDate) >= filters.start) &&
            (!filters.end || dateInput(item.expenseDate) <= filters.end) &&
            (!filters.min ||
              item.amountMinor >= (toMinorUnits(filters.min) || 0)) &&
            (!filters.max ||
              item.amountMinor <=
                (toMinorUnits(filters.max) || Number.MAX_SAFE_INTEGER)) &&
            (filters.reimbursable === "all" ||
              String(Boolean(item.isClientReimbursable)) ===
                filters.reimbursable) &&
            `${item.title} ${item.notes || ""} ${item.transactionReference || ""} ${optionLabel(vendors, item.vendorId)}`
              .toLowerCase()
              .includes(term.toLowerCase()),
        )
        .sort((left, right) =>
          filters.sort === "oldest"
            ? dateInput(left.expenseDate).localeCompare(
                dateInput(right.expenseDate),
              )
            : filters.sort === "high"
              ? right.amountMinor - left.amountMinor
              : filters.sort === "low"
                ? left.amountMinor - right.amountMinor
                : filters.sort === "due"
                  ? dateInput(left.dueDate).localeCompare(
                      dateInput(right.dueDate),
                    )
                  : dateInput(right.expenseDate).localeCompare(
                      dateInput(left.expenseDate),
                    ),
        ),
    [expenses, filters, term, vendors],
  );
  const active = filtered.filter(isActiveExpense);
  const paid = active
    .filter(isPaidExpense)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const pending = active
    .filter((item) => item.paymentStatus === "Pending")
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const overdue = active
    .filter((item) => expenseDisplayStatus(item) === "Overdue")
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const reimbursable = active
    .filter((item) => item.isClientReimbursable)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const exportRows = () =>
    download(
      "Expense_Export",
      csvText(
        [
          "Title",
          "Type",
          "Category",
          "Client",
          "Project",
          "Amount",
          "Expense date",
          "Due date",
          "Paid date",
          "Account",
          "Status",
          "Reimbursable",
          "Reference",
        ],
        filtered.map((item) => [
          item.title,
          item.expenseType,
          optionLabel(categories, item.categoryId),
          clients.find((client) => client.id === item.clientId)?.name || "",
          projects.find((project) => project.id === item.projectId)?.name || "",
          formatCurrency(item.amountMinor, item.currency, settings.locale),
          dateText(item.expenseDate, settings.locale),
          dateText(item.dueDate, settings.locale),
          dateText(item.paidDate, settings.locale),
          accounts.find((account) => account.id === item.accountId)?.name || "",
          expenseDisplayStatus(item),
          item.isClientReimbursable ? "Yes" : "No",
          item.transactionReference || "",
        ]),
      ),
    );
  const generate = async () => {
    try {
      const count = await generateDueExpenses(user.uid, templates);
      toast.success(
        count
          ? `${count} due expense occurrence(s) generated.`
          : "No due recurring expenses to generate.",
      );
    } catch (err) {
      toast.error(err.message || "Due expenses could not be generated.");
    }
  };
  const set = (key, value) => setFilters({ ...filters, [key]: value });
  return (
    <div className="page-view">
      <PageHeader
        title="Expenses"
        description="Track pending, paid, reimbursable and recurring expenses without changing project income."
        icon={ReceiptText}
      />
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "expenses"}
          onClick={() => setTab("expenses")}
        >
          Expenses
        </button>
        <button
          role="tab"
          aria-selected={tab === "recurring"}
          onClick={() => setTab("recurring")}
        >
          Recurring
        </button>
      </div>
      {tab === "expenses" ? (
        <>
          <div className="summary-grid finance-summary">
            <Card>
              <span>Paid expenses</span>
              <strong>
                {formatCurrency(paid, settings.currency, settings.locale)}
              </strong>
            </Card>
            <Card>
              <span>Pending expenses</span>
              <strong>
                {formatCurrency(pending, settings.currency, settings.locale)}
              </strong>
            </Card>
            <Card>
              <span>Overdue payable</span>
              <strong>
                {formatCurrency(overdue, settings.currency, settings.locale)}
              </strong>
            </Card>
            <Card>
              <span>Client reimbursable</span>
              <strong>
                {formatCurrency(
                  reimbursable,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Cancelled records</span>
              <strong>
                {
                  filtered.filter((item) => item.paymentStatus === "Cancelled")
                    .length
                }
              </strong>
            </Card>
          </div>
          <div className="financial-toolbar">
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search title, notes or reference"
            />
            <SelectShell
              value={filters.status}
              onChange={(event) => set("status", event.target.value)}
            >
              <option value="all">All statuses</option>
              <option>Pending</option>
              <option>Paid</option>
              <option>Cancelled</option>
              <option>Overdue</option>
            </SelectShell>
            <SelectShell
              value={filters.type}
              onChange={(event) => set("type", event.target.value)}
            >
              <option value="all">All types</option>
              {EXPENSE_TYPES.map((item) => (
                <option key={item}>{item}</option>
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
              value={filters.subcategory}
              onChange={(event) => set("subcategory", event.target.value)}
            >
              <option value="all">All subcategories</option>
              {subcategories.map((item) => (
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
            <Input
              type="date"
              aria-label="Expense start date"
              value={filters.start}
              onChange={(event) => set("start", event.target.value)}
            />
            <Input
              type="date"
              aria-label="Expense end date"
              value={filters.end}
              onChange={(event) => set("end", event.target.value)}
            />
            <Input
              inputMode="decimal"
              aria-label="Minimum amount"
              placeholder="Min amount"
              value={filters.min}
              onChange={(event) => set("min", event.target.value)}
            />
            <Input
              inputMode="decimal"
              aria-label="Maximum amount"
              placeholder="Max amount"
              value={filters.max}
              onChange={(event) => set("max", event.target.value)}
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
              value={filters.reimbursable}
              onChange={(event) => set("reimbursable", event.target.value)}
            >
              <option value="all">All reimbursement states</option>
              <option value="true">Reimbursable</option>
              <option value="false">Not reimbursable</option>
            </SelectShell>
            <SelectShell
              value={filters.sort}
              onChange={(event) => set("sort", event.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="high">Highest amount</option>
              <option value="low">Lowest amount</option>
              <option value="due">Due date</option>
            </SelectShell>
            <Button
              variant="secondary"
              onClick={() => {
                setTerm("");
                setFilters({
                  status: "all",
                  type: "all",
                  category: "all",
                  client: "all",
                  project: "all",
                  account: "all",
                  subcategory: "all",
                  mode: "all",
                  reimbursable: "all",
                  start: "",
                  end: "",
                  min: "",
                  max: "",
                  sort: "newest",
                });
              }}
            >
              Clear filters
            </Button>
            <Button variant="secondary" onClick={exportRows}>
              <Download size={16} />
              Export CSV
            </Button>
            <Link className="button" to="/expenses/new">
              <Plus size={16} />
              Add Expense
            </Link>
          </div>
          {loading ? (
            <Card>Loading expenses…</Card>
          ) : error ? (
            <EmptyState
              icon={ReceiptText}
              title="Expenses unavailable"
              description={error}
            />
          ) : !filtered.length ? (
            <EmptyState
              icon={ReceiptText}
              title="No expenses found"
              description="Add an expense or adjust the current filters."
            />
          ) : (
            <>
              <TableShell>
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Expense</th>
                      <th>Type / category</th>
                      <th>Client / project</th>
                      <th>Amount</th>
                      <th>Dates</th>
                      <th>Account</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={`/expenses/${item.id}`}>{item.title}</Link>
                          <small>{item.transactionReference || ""}</small>
                        </td>
                        <td>
                          {item.expenseType}
                          <small>
                            {optionLabel(categories, item.categoryId)}
                          </small>
                        </td>
                        <td>
                          {clients.find((client) => client.id === item.clientId)
                            ?.name || "—"}
                          <small>
                            {projects.find(
                              (project) => project.id === item.projectId,
                            )?.name || ""}
                          </small>
                        </td>
                        <td>
                          {formatCurrency(
                            item.amountMinor,
                            item.currency,
                            settings.locale,
                          )}
                        </td>
                        <td>
                          {dateText(item.expenseDate, settings.locale)}
                          <small>
                            {item.paymentStatus === "Paid"
                              ? `Paid ${dateText(item.paidDate, settings.locale)}`
                              : item.dueDate
                                ? `Due ${dateText(item.dueDate, settings.locale)}`
                                : ""}
                          </small>
                        </td>
                        <td>
                          {accounts.find(
                            (account) => account.id === item.accountId,
                          )?.name || "—"}
                        </td>
                        <td>
                          <ExpenseStatus expense={item} />
                        </td>
                        <td>
                          <Link to={`/expenses/${item.id}/edit`}>
                            <Pencil size={15} />
                            Edit
                          </Link>
                          {item.paymentStatus === "Pending" && (
                            <Link to={`/expenses/${item.id}/edit`}>
                              Mark paid
                            </Link>
                          )}
                          <Link to={`/expenses/new?duplicate=${item.id}`}>
                            Duplicate
                          </Link>
                          {item.paymentStatus === "Cancelled" ? (
                            <Button
                              variant="secondary"
                              disabled={preview}
                              onClick={async () => {
                                try {
                                  await restoreExpense(user.uid, item.id);
                                  toast.success("Expense restored.");
                                } catch (err) {
                                  toast.error(
                                    err.message ||
                                      "Expense could not be restored.",
                                  );
                                }
                              }}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              disabled={preview}
                              onClick={() => setCancelId(item.id)}
                            >
                              <XCircle size={15} />
                              Cancel
                            </Button>
                          )}
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
                      <strong>{item.title}</strong>
                      <ExpenseStatus expense={item} />
                    </div>
                    <p>
                      {item.expenseType} ·{" "}
                      {optionLabel(categories, item.categoryId)}
                    </p>
                    <strong className="money-value">
                      {formatCurrency(
                        item.amountMinor,
                        item.currency,
                        settings.locale,
                      )}
                    </strong>
                    <Link
                      className="button button-secondary"
                      to={`/expenses/${item.id}`}
                    >
                      Open expense
                    </Link>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <RecurringSection
          templates={templates}
          onGenerate={generate}
          onAdd={() => setRecurringOpen(true)}
          onEdit={(template) => {
            setEditingTemplate(template);
            setRecurringOpen(true);
          }}
          settings={settings}
        />
      )}
      <CancelExpenseModal
        open={Boolean(cancelId)}
        onClose={() => setCancelId(null)}
        onConfirm={async (reason) => {
          try {
            await cancelExpense(user.uid, cancelId, reason);
            toast.success(
              "Expense cancelled and any account deduction reversed.",
            );
            setCancelId(null);
          } catch (err) {
            toast.error(err.message || "Expense could not be cancelled.");
          }
        }}
      />
      <RecurringTemplateModal
        open={recurringOpen}
        template={editingTemplate}
        onClose={() => {
          setRecurringOpen(false);
          setEditingTemplate(null);
        }}
        onSaved={() => {
          setRecurringOpen(false);
          setEditingTemplate(null);
        }}
      />
    </div>
  );
}
function CancelExpenseModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Cancel expense">
      <FormField label="Cancellation reason">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <div className="settings-actions">
        <Button
          variant="danger"
          disabled={!reason.trim()}
          onClick={() => onConfirm(reason)}
        >
          Cancel expense
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Keep expense
        </Button>
      </div>
    </Modal>
  );
}
function RecurringSection({ templates, onGenerate, onAdd, onEdit, settings }) {
  return (
    <>
      <Card>
        <div className="card-line">
          <div>
            <h2>Recurring expenses</h2>
            <p className="helper-text">
              Occurrences are generated when you open the app or use the action
              below; no background server is used.
            </p>
          </div>
          <div className="settings-actions">
            <Button variant="secondary" onClick={onGenerate}>
              <RotateCcw size={16} />
              Generate Due Expenses
            </Button>
            <Button onClick={onAdd}>
              <Plus size={16} />
              Add Recurring Expense
            </Button>
          </div>
        </div>
        {templates.length ? (
          templates.map((item) => (
            <div className="list-row" key={item.id}>
              <strong>{item.title}</strong>
              <span>
                {item.frequency} · next{" "}
                {dateText(item.nextOccurrenceDate, settings.locale)}
              </span>
              <span>
                {formatCurrency(
                  item.amountMinor,
                  item.currency,
                  settings.locale,
                )}
              </span>
              <Badge tone={item.isActive ? "success" : "neutral"}>
                {item.isActive ? "Active" : "Inactive"}
              </Badge>
              <Button variant="secondary" onClick={() => onEdit(item)}>
                Edit
              </Button>
            </div>
          ))
        ) : (
          <p className="helper-text">No recurring templates yet.</p>
        )}
      </Card>
    </>
  );
}
function RecurringTemplateModal({ open, onClose, onSaved, template }) {
  const { user, preview } = useAuth();
  const { settings } = useSettings();
  const { items: accounts } = useCollection(subscribeAccounts);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    expenseType: "Business",
    categoryId: "",
    frequency: "Monthly",
    startDate: today(),
    nextOccurrenceDate: today(),
    defaultPaymentStatus: "Pending",
    defaultAccountId: "",
    defaultPaymentModeId: "",
  });
  useEffect(() => {
    if (!template) return;
    const timer = window.setTimeout(
      () =>
        setForm({
          title: template.title || "",
          amount: String((template.amountMinor || 0) / 100),
          expenseType: template.expenseType || "Business",
          categoryId: template.categoryId || "",
          frequency: template.frequency || "Monthly",
          startDate: dateInput(template.startDate) || today(),
          nextOccurrenceDate: dateInput(template.nextOccurrenceDate) || today(),
          defaultPaymentStatus: template.defaultPaymentStatus || "Pending",
          defaultAccountId: template.defaultAccountId || "",
          defaultPaymentModeId: template.defaultPaymentModeId || "",
          customIntervalDays: template.customIntervalDays || "",
          endDate: dateInput(template.endDate),
          isActive: template.isActive !== false,
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [template]);
  const save = async (event) => {
    event.preventDefault();
    const amountMinor = toMinorUnits(form.amount);
    if (!amountMinor || !form.categoryId)
      return toast.error("Enter a valid amount and category.");
    try {
      const data = {
        ...form,
        amountMinor,
        currency: settings.currency,
      };
      if (template) await updateRecurringTemplate(user.uid, template.id, data);
      else await createRecurringTemplate(user.uid, data);
      toast.success(
        template
          ? "Recurring expense template updated."
          : "Recurring expense template saved.",
      );
      onSaved();
    } catch (err) {
      toast.error(err.message || "Template could not be saved.");
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Edit Recurring Expense" : "Add Recurring Expense"}
    >
      <form className="settings-form" onSubmit={save}>
        <FormField label="Title">
          <Input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            required
          />
        </FormField>
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
        <FormField label="Category">
          <CreatableSelect
            group="expenseCategories"
            value={form.categoryId}
            onChange={(categoryId) => setForm({ ...form, categoryId })}
            required
          />
        </FormField>
        <FormField label="Frequency">
          <SelectShell
            value={form.frequency}
            onChange={(event) =>
              setForm({ ...form, frequency: event.target.value })
            }
          >
            {[
              "Monthly",
              "Quarterly",
              "Half-yearly",
              "Yearly",
              "Custom interval",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectShell>
        </FormField>
        {form.frequency === "Custom interval" && (
          <FormField label="Interval days">
            <Input
              type="number"
              min="1"
              value={form.customIntervalDays || ""}
              onChange={(event) =>
                setForm({ ...form, customIntervalDays: event.target.value })
              }
              required
            />
          </FormField>
        )}
        <FormField label="Start date">
          <Input
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm({ ...form, startDate: event.target.value })
            }
            required
          />
        </FormField>
        <FormField label="End date (optional)">
          <Input
            type="date"
            value={form.endDate || ""}
            onChange={(event) =>
              setForm({ ...form, endDate: event.target.value })
            }
          />
        </FormField>
        <FormField label="Next occurrence">
          <Input
            type="date"
            value={form.nextOccurrenceDate}
            onChange={(event) =>
              setForm({ ...form, nextOccurrenceDate: event.target.value })
            }
          />
        </FormField>
        <FormField label="Default payment state">
          <SelectShell
            value={form.defaultPaymentStatus}
            onChange={(event) =>
              setForm({ ...form, defaultPaymentStatus: event.target.value })
            }
          >
            <option>Pending</option>
            <option>Paid</option>
          </SelectShell>
        </FormField>
        {form.defaultPaymentStatus === "Paid" && (
          <>
            <FormField label="Default account">
              <SelectShell
                value={form.defaultAccountId}
                onChange={(event) =>
                  setForm({ ...form, defaultAccountId: event.target.value })
                }
              >
                <option value="">Select account</option>
                {accounts
                  .filter((item) => item.status === ACTIVE)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </SelectShell>
            </FormField>
            <FormField label="Default payment mode">
              <CreatableSelect
                group="paymentModes"
                value={form.defaultPaymentModeId}
                onChange={(defaultPaymentModeId) =>
                  setForm({ ...form, defaultPaymentModeId })
                }
              />
            </FormField>
          </>
        )}
        <Checkbox
          label="Template is active"
          checked={form.isActive !== false}
          onChange={(event) =>
            setForm({ ...form, isActive: event.target.checked })
          }
        />
        <div className="settings-actions">
          <Button disabled={preview}>Save template</Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ExpenseFormPage() {
  const { expenseId } = useParams();
  const [params] = useSearchParams();
  const { user, preview } = useAuth();
  const { settings } = useSettings();
  const { items: expenses } = useExpenses();
  const { items: accounts } = useCollection(subscribeAccounts);
  const { items: clients } = useClients();
  const { items: projects } = useProjects();
  const nav = useNavigate();
  const existing = expenses.find(
    (item) => item.id === expenseId || item.id === params.get("duplicate"),
  );
  const [form, setForm] = useState({
    title: "",
    amount: "",
    currency: settings.currency,
    expenseType: "Business",
    categoryId: "",
    subcategoryId: "",
    clientId: params.get("clientId") || "",
    projectId: params.get("projectId") || "",
    vendorId: "",
    expenseDate: today(),
    dueDate: "",
    paidDate: today(),
    accountId: "",
    paymentModeId: "",
    paymentStatus: "Pending",
    transactionReference: "",
    notes: "",
    isClientReimbursable: false,
    reimbursementNotes: "",
    reimbursementWaived: false,
    reimbursementWaivedReason: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!existing) return undefined;
    const timer = window.setTimeout(
      () =>
        setForm({
          title: existing.title || "",
          amount: String(existing.amountMinor / 100),
          currency: existing.currency || settings.currency,
          expenseType: existing.expenseType || "Business",
          categoryId: existing.categoryId || "",
          subcategoryId: existing.subcategoryId || "",
          clientId: existing.clientId || "",
          projectId: existing.projectId || "",
          vendorId: existing.vendorId || "",
          expenseDate: dateInput(existing.expenseDate),
          dueDate: dateInput(existing.dueDate),
          paidDate: dateInput(existing.paidDate) || today(),
          accountId: existing.accountId || "",
          paymentModeId: existing.paymentModeId || "",
          paymentStatus: existing.paymentStatus || "Pending",
          transactionReference: existing.transactionReference || "",
          notes: existing.notes || "",
          isClientReimbursable: Boolean(existing.isClientReimbursable),
          reimbursementNotes: existing.reimbursementNotes || "",
          description: existing.description || "",
          reimbursementWaived: Boolean(existing.reimbursementWaived),
          reimbursementWaivedReason: existing.reimbursementWaivedReason || "",
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [existing, settings.currency]);
  const projectChoices = projects.filter(
    (item) => !form.clientId || item.clientId === form.clientId,
  );
  const chooseClient = (clientId) => {
    const selectedProject = projects.find((item) => item.id === form.projectId);
    setForm({
      ...form,
      clientId,
      projectId:
        selectedProject && selectedProject.clientId !== clientId
          ? ""
          : form.projectId,
    });
  };
  const chooseProject = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    setForm({
      ...form,
      projectId,
      clientId: project?.clientId || form.clientId,
      expenseType: project ? "Project-related" : form.expenseType,
    });
  };
  const save = async (event) => {
    event.preventDefault();
    const amountMinor = toMinorUnits(form.amount);
    if (!amountMinor) return toast.error("Enter a valid expense amount.");
    setBusy(true);
    try {
      const data = { ...form, amountMinor };
      if (existing && expenseId) {
        const balanceChange =
          existing.paymentStatus === "Paid" || data.paymentStatus === "Paid";
        if (
          balanceChange &&
          !window.confirm(
            "This change may adjust an account balance. Continue?",
          )
        )
          return;
        await updateExpense(user.uid, existing.id, data, {
          confirmBalanceChange: balanceChange,
        });
        toast.success("Expense updated.");
        nav(`/expenses/${existing.id}`);
      } else {
        await createExpense(user.uid, data);
        toast.success("Expense created.");
        nav("/expenses");
      }
    } catch (err) {
      toast.error(err.message || "Expense could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  if (expenseId && !existing)
    return (
      <EmptyState
        icon={ReceiptText}
        title="Expense not found"
        description="This expense may no longer be available."
      />
    );
  return (
    <div className="page-view">
      <PageHeader
        title={existing ? "Edit Expense" : "Add Expense"}
        description="Pending expenses do not affect accounts; paid expenses are deducted atomically."
        icon={ReceiptText}
      />
      <Card>
        <form
          className="settings-form financial-form"
          onSubmit={save}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter")
              save(event);
          }}
        >
          <div className="settings-grid">
            <FormField label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                value={form.description || ""}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </FormField>
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
            <FormField label="Expense type">
              <SelectShell
                value={form.expenseType}
                onChange={(event) =>
                  setForm({ ...form, expenseType: event.target.value })
                }
              >
                {EXPENSE_TYPES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectShell>
            </FormField>
            <FormField label="Expense date">
              <Input
                type="date"
                value={form.expenseDate}
                onChange={(event) =>
                  setForm({ ...form, expenseDate: event.target.value })
                }
                required
              />
            </FormField>
            <FormField label="Category">
              <CreatableSelect
                group="expenseCategories"
                value={form.categoryId}
                onChange={(categoryId) => setForm({ ...form, categoryId })}
                required
              />
            </FormField>
            <FormField label="Subcategory">
              <CreatableSelect
                group="expenseSubcategories"
                value={form.subcategoryId}
                onChange={(subcategoryId) =>
                  setForm({ ...form, subcategoryId })
                }
              />
            </FormField>
            <FormField label="Client">
              <SelectShell
                value={form.clientId}
                onChange={(event) => chooseClient(event.target.value)}
              >
                <option value="">No linked client</option>
                {clients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectShell>
            </FormField>
            <FormField label="Project">
              <SelectShell
                value={form.projectId}
                onChange={(event) => chooseProject(event.target.value)}
              >
                <option value="">No linked project</option>
                {projectChoices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectShell>
            </FormField>
            <FormField label="Vendor">
              <CreatableSelect
                group="vendors"
                value={form.vendorId}
                onChange={(vendorId) => setForm({ ...form, vendorId })}
              />
            </FormField>
            <FormField label="Payment status">
              <SelectShell
                value={form.paymentStatus}
                onChange={(event) =>
                  setForm({ ...form, paymentStatus: event.target.value })
                }
              >
                {EXPENSE_PAYMENT_STATUSES.filter(
                  (item) => item !== "Cancelled",
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectShell>
            </FormField>
            {form.paymentStatus === "Pending" && (
              <FormField label="Due date">
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm({ ...form, dueDate: event.target.value })
                  }
                />
              </FormField>
            )}
            {form.paymentStatus === "Paid" && (
              <>
                <FormField label="Paid date">
                  <Input
                    type="date"
                    value={form.paidDate}
                    onChange={(event) =>
                      setForm({ ...form, paidDate: event.target.value })
                    }
                    required
                  />
                </FormField>
                <FormField label="Account">
                  <SelectShell
                    value={form.accountId}
                    onChange={(event) =>
                      setForm({ ...form, accountId: event.target.value })
                    }
                    required
                  >
                    <option value="">Select active account</option>
                    {accounts
                      .filter(
                        (item) =>
                          item.status === ACTIVE &&
                          item.currency === form.currency,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </SelectShell>
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
              </>
            )}
            <FormField label="Transaction reference">
              <Input
                value={form.transactionReference}
                onChange={(event) =>
                  setForm({ ...form, transactionReference: event.target.value })
                }
              />
            </FormField>
          </div>
          <Checkbox
            label="Client reimbursable expense"
            checked={form.isClientReimbursable}
            onChange={(event) =>
              setForm({ ...form, isClientReimbursable: event.target.checked })
            }
          />
          {form.isClientReimbursable && (
            <FormField label="Reimbursement notes">
              <Textarea
                value={form.reimbursementNotes}
                onChange={(event) =>
                  setForm({ ...form, reimbursementNotes: event.target.value })
                }
              />
            </FormField>
          )}
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </FormField>
          {form.isClientReimbursable && (
            <>
              <Checkbox
                checked={form.reimbursementWaived}
                onChange={(event) =>
                  setForm({
                    ...form,
                    reimbursementWaived: event.target.checked,
                  })
                }
                label="Waive this reimbursement"
              />
              {form.reimbursementWaived && (
                <FormField label="Waiver reason">
                  <Textarea
                    value={form.reimbursementWaivedReason}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        reimbursementWaivedReason: event.target.value,
                      })
                    }
                    required
                  />
                </FormField>
              )}
            </>
          )}
          <div className="settings-actions">
            <Button loading={busy} disabled={preview}>
              {existing ? "Save changes" : "Save expense"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                nav(existing ? `/expenses/${existing.id}` : "/expenses")
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
export function ExpenseDetailPage() {
  const { expenseId } = useParams();
  const { items: expenses } = useExpenses();
  const { settings } = useSettings();
  const expense = expenses.find((item) => item.id === expenseId);
  if (!expense)
    return (
      <EmptyState
        icon={ReceiptText}
        title="Expense not found"
        description="This expense may no longer be available."
      />
    );
  return (
    <div className="page-view">
      <PageHeader
        title={expense.title}
        description="Expense details and payment state."
        icon={ReceiptText}
      />
      <div className="settings-actions">
        <ExpenseStatus expense={expense} />
        <Link className="button" to={`/expenses/${expense.id}/edit`}>
          Edit expense
        </Link>
      </div>
      <div className="summary-grid finance-summary">
        <Card>
          <span>Amount</span>
          <strong>
            {formatCurrency(
              expense.amountMinor,
              expense.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Payment status</span>
          <strong>
            <ExpenseStatus expense={expense} />
          </strong>
        </Card>
      </div>
      <Card>
        <h2>Overview</h2>
        <p>{expense.description || expense.notes || "No notes added."}</p>
        <p>Expense date: {dateText(expense.expenseDate, settings.locale)}</p>
        <p>
          Due date: {dateText(expense.dueDate, settings.locale)} · Paid date:{" "}
          {dateText(expense.paidDate, settings.locale)}
        </p>
      </Card>
    </div>
  );
}
export function ProjectExpensesPanel({ project }) {
  const { items: expenses } = useExpenses();
  const { settings } = useSettings();
  const summary = projectExpenseSummary(project, expenses);
  const linked = expenses.filter((item) => item.projectId === project.id);
  return (
    <Card>
      <div className="card-line">
        <h2>Expenses</h2>
        <Link
          className="button"
          to={`/expenses/new?projectId=${project.id}&clientId=${project.clientId}`}
        >
          <Plus size={16} />
          Add Project Expense
        </Link>
      </div>
      <div className="summary-grid finance-summary">
        <Card>
          <span>Paid project expenses</span>
          <strong>
            {formatCurrency(
              summary.paidAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Pending project expenses</span>
          <strong>
            {formatCurrency(
              summary.pendingAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Net received margin</span>
          <strong>
            {formatCurrency(
              summary.netReceivedMarginMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          <span>Contract margin after expenses</span>
          <strong>
            {formatCurrency(
              summary.contractMarginMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
      </div>
      <p className="helper-text">
        Margins are project cash indicators, not accounting profit.
      </p>
      {linked.length ? (
        linked.map((item) => (
          <div className="list-row" key={item.id}>
            <Link to={`/expenses/${item.id}`}>{item.title}</Link>
            <span>
              {formatCurrency(item.amountMinor, item.currency, settings.locale)}
            </span>
            <ExpenseStatus expense={item} />
          </div>
        ))
      ) : (
        <p className="helper-text">No expenses linked to this project.</p>
      )}
    </Card>
  );
}
export function MonthlyTrackingPage() {
  const { settings } = useSettings();
  const { user, isConfigured, preview } = useAuth();
  const current = new Date();
  const [year, setYear] = useState(current.getFullYear());
  const [month, setMonth] = useState(current.getMonth());
  const range = monthRange(year, month);
  const previous = previousMonth(year, month);
  const previousRange = monthRange(previous.year, previous.month);
  const { items: income, loading: incomeLoading } = useCollection(
    subscribeMonthlyIncome,
    range.start,
    range.end,
  );
  const { items: expenses, loading: expenseLoading } = useCollection(
    subscribeMonthlyPaidExpenses,
    range.start,
    range.end,
  );
  const { items: pendingExpenses } = useCollection(
    subscribeMonthlyPendingExpenses,
    range.end,
  );
  const { items: previousIncome } = useCollection(
    subscribeMonthlyIncome,
    previousRange.start,
    previousRange.end,
  );
  const { items: previousExpenses } = useCollection(
    subscribeMonthlyPaidExpenses,
    previousRange.start,
    previousRange.end,
  );
  const summary = monthlyCashSummary({
    income,
    expenses: [...expenses, ...pendingExpenses],
    range,
  });
  const priorSummary = monthlyCashSummary({
    income: previousIncome,
    expenses: previousExpenses,
    range: previousRange,
  });
  const categoryData = groupBy(summary.paidExpenses, "categoryId");
  const typeData = groupBy(summary.paidExpenses, "expenseType");
  const projectIncomeData = groupBy(summary.receivedIncome, "projectId");
  const series = dailySeries(
    summary.receivedIncome,
    summary.paidExpenses,
    range,
  );
  const label = monthLabel(year, month, settings.locale);
  const comparison = [
    {
      name: monthLabel(previous.year, previous.month, settings.locale),
      income: priorSummary.totalIncomeMinor,
      expenses: priorSummary.totalExpensesMinor,
    },
    {
      name: label,
      income: summary.totalIncomeMinor,
      expenses: summary.totalExpensesMinor,
    },
  ];
  const exportReport = () =>
    download(
      "Monthly_Financial_Report",
      csvText(
        ["Summary", "Amount"],
        [
          [
            "Total received income",
            formatCurrency(
              summary.totalIncomeMinor,
              settings.currency,
              settings.locale,
            ),
          ],
          [
            "Total paid expenses",
            formatCurrency(
              summary.totalExpensesMinor,
              settings.currency,
              settings.locale,
            ),
          ],
          [
            "Net cash flow",
            formatCurrency(
              summary.netCashFlowMinor,
              settings.currency,
              settings.locale,
            ),
          ],
          [],
          ...summary.receivedIncome.map((item) => [
            "Income",
            `${item.title} — ${formatCurrency(item.amountMinor, item.currency, settings.locale)}`,
          ]),
          ...summary.paidExpenses.map((item) => [
            "Expense",
            `${item.title} — ${formatCurrency(item.amountMinor, item.currency, settings.locale)}`,
          ]),
        ],
      ),
      label.replace(/\s+/g, "_"),
    );
  if (!user || !isConfigured || preview)
    return (
      <EmptyState
        icon={BarChart3}
        title="Monthly Tracking needs Firebase data"
        description="Sign in with configured Firebase to view range-based cash-basis reporting."
      />
    );
  return (
    <div className="page-view">
      <PageHeader
        title="Monthly Tracking"
        description="Cash-basis financial analysis using received-income and paid-expense dates."
        icon={BarChart3}
      />
      <div className="financial-toolbar">
        <Button
          variant="secondary"
          onClick={() => {
            if (month === 0) {
              setMonth(11);
              setYear(year - 1);
            } else setMonth(month - 1);
          }}
        >
          Previous
        </Button>
        <SelectShell
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <option key={index} value={index}>
              {new Intl.DateTimeFormat(settings.locale, {
                month: "long",
              }).format(new Date(2026, index, 1))}
            </option>
          ))}
        </SelectShell>
        <Input
          type="number"
          value={year}
          onChange={(event) =>
            setYear(Number(event.target.value) || current.getFullYear())
          }
        />
        <Button
          variant="secondary"
          onClick={() => {
            setMonth(current.getMonth());
            setYear(current.getFullYear());
          }}
        >
          Current month
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (month === 11) {
              setMonth(0);
              setYear(year + 1);
            } else setMonth(month + 1);
          }}
        >
          Next
        </Button>
        <Button variant="secondary" onClick={exportReport}>
          <Download size={16} />
          Export CSV
        </Button>
      </div>
      {incomeLoading || expenseLoading ? (
        <Card>Loading monthly records…</Card>
      ) : (
        <>
          <div className="summary-grid finance-summary">
            <Card>
              <span>Total received income</span>
              <strong>
                {formatCurrency(
                  summary.totalIncomeMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Total paid expenses</span>
              <strong>
                {formatCurrency(
                  summary.totalExpensesMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Net cash flow</span>
              <strong>
                {formatCurrency(
                  summary.netCashFlowMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Project / other income</span>
              <strong>
                {formatCurrency(
                  summary.projectIncomeMinor,
                  settings.currency,
                  settings.locale,
                )}{" "}
                /{" "}
                {formatCurrency(
                  summary.otherIncomeMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Business / project expenses</span>
              <strong>
                {formatCurrency(
                  summary.businessExpensesMinor,
                  settings.currency,
                  settings.locale,
                )}{" "}
                /{" "}
                {formatCurrency(
                  summary.projectExpensesMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Pending payable</span>
              <strong>
                {formatCurrency(
                  summary.pendingPayableMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </Card>
            <Card>
              <span>Income change vs previous</span>
              <strong>
                {percentageDifference(
                  summary.totalIncomeMinor,
                  priorSummary.totalIncomeMinor,
                ) === null
                  ? "Not available"
                  : `${percentageDifference(summary.totalIncomeMinor, priorSummary.totalIncomeMinor).toFixed(1)}%`}
              </strong>
            </Card>
          </div>
          <div className="monthly-charts">
            <Card>
              <h2>Income vs expenses — {label}</h2>
              <ChartEmpty data={series}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(
                          value,
                          settings.currency,
                          settings.locale,
                        )
                      }
                    />
                    <Legend />
                    <Bar dataKey="income" fill="var(--teal)" />
                    <Bar dataKey="expenses" fill="var(--danger)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartEmpty>
            </Card>
            <Card>
              <h2>Expense categories</h2>
              <ChartEmpty data={categoryData}>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="amountMinor"
                      nameKey="name"
                      fill="var(--brand)"
                      label
                    />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(
                          value,
                          settings.currency,
                          settings.locale,
                        )
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartEmpty>
            </Card>
            <Card>
              <h2>Expense types</h2>
              <ChartEmpty data={typeData}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={typeData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(
                          value,
                          settings.currency,
                          settings.locale,
                        )
                      }
                    />
                    <Bar dataKey="amountMinor" fill="var(--info)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartEmpty>
            </Card>
            <Card>
              <h2>Income by project</h2>
              <ChartEmpty data={projectIncomeData}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={projectIncomeData}>
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(
                          value,
                          settings.currency,
                          settings.locale,
                        )
                      }
                    />
                    <Bar dataKey="amountMinor" fill="var(--teal)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartEmpty>
            </Card>
            <Card>
              <h2>Current vs previous month</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparison}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(value, settings.currency, settings.locale)
                    }
                  />
                  <Legend />
                  <Bar dataKey="income" fill="var(--teal)" />
                  <Bar dataKey="expenses" fill="var(--danger)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <Card>
            <h2>Monthly records</h2>
            <div className="list-row">
              <strong>Received income</strong>
              <span>{summary.receivedIncome.length} records</span>
              <strong>
                {formatCurrency(
                  summary.totalIncomeMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </div>
            <div className="list-row">
              <strong>Pending payables</strong>
              <span>
                {summary.pendingPayableMinor ? "Open expenses" : "None"}
              </span>
              <strong>
                {formatCurrency(
                  summary.pendingPayableMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </div>
            <div className="list-row">
              <strong>Paid expenses</strong>
              <span>{summary.paidExpenses.length} records</span>
              <strong>
                {formatCurrency(
                  summary.totalExpensesMinor,
                  settings.currency,
                  settings.locale,
                )}
              </strong>
            </div>
            <p className="helper-text">
              Pending payables and receivables are intentionally separate from
              cash-basis totals.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
function ChartEmpty({ data, children }) {
  return data.length ? (
    children
  ) : (
    <p className="helper-text">No records for this chart period.</p>
  );
}

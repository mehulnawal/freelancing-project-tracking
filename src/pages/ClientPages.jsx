/* eslint-disable react-hooks/incompatible-library */
import { useEffect, useMemo, useState } from "react";
import { Building2, FolderKanban, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "../components/PageHeader";
import { VersionHistory } from "../components/VersionHistory";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  SelectShell,
} from "../components/ui";
import { CreatableSelect } from "../components/CreatableSelect";
import { useClients, useProjects } from "../hooks/useData";
import { useAuth } from "../context/useAuth";
import { createClient, updateClient } from "../services/clients";
import { summarizeProjects } from "../utils/projectLogic";
import { clientFinancialSummary } from "../utils/financialConsistency";
import { formatCurrency } from "../utils/money";
import { useSettings } from "../context/useSettings";
import { useExpenses } from "../hooks/useExpenses";
import { subscribeIncome } from "../services/financial";
import { reimbursementSummary } from "../utils/expenseLogic";
const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  clientTypeId: z.string().min(1, "Client type is required"),
  status: z.enum(["Active", "Inactive", "Archived"]),
  contactPerson: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  mobile: z
    .string()
    .regex(/^$|^[+0-9 ()-]{6,20}$/, "Enter a valid phone number"),
  whatsapp: z
    .string()
    .regex(/^$|^[+0-9 ()-]{6,20}$/, "Enter a valid phone number"),
  notes: z.string().max(3000).optional(),
});
const date = (value) => { const raw = value?.toMillis ? value.toMillis() : value?.seconds ? value.seconds * 1000 : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00").getTime() : Number(value) || 0; return raw ? new Date(raw).toLocaleDateString("en-IN") : "" };
export function ClientsPage() {
  const { items: clients, loading, error } = useClients();
  const { items: projects } = useProjects();
  const [term, setTerm] = useState("");
  const view = useMemo(
    () =>
      clients.filter((client) =>
        [
          client.name,
          client.contactPerson,
          client.email,
          client.mobile,
          client.whatsapp,
        ].some((v) => v?.toLowerCase().includes(term.toLowerCase())),
      ),
    [clients, term],
  );
  return (
    <div className="page-view">
      <PageHeader
        title="Clients"
        description="Manage client relationships and connected project work."
        icon={Building2}
      />
      <div className="list-toolbar">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search clients"
        />
        <Link className="button" to="/clients/new">
          <Plus size={16} />
          Add Client
        </Link>
      </div>
      {loading ? (
        <p>Loading clients</p>
      ) : error ? (
        <EmptyState
          icon={Building2}
          title="Clients could not be loaded"
          description={error}
        />
      ) : !view.length ? (
        <EmptyState
          icon={Building2}
          title={term ? "No matching clients" : "No clients yet"}
          description="Add your first client to begin organizing project work."
        />
      ) : (
        <div className="data-list">
          {view.map((client) => {
            const summary = summarizeProjects(
              projects.filter((p) => p.clientId === client.id),
            );
            return (
              <Card className="client-card" key={client.id}>
                <div>
                  <h2>{client.name}</h2>
                  <p>
                    {client.contactPerson && client.contactPerson.trim().toLowerCase() !== client.name.trim().toLowerCase() ? client.contactPerson : client.email || client.mobile || "No contact details yet"}
                  </p>
                </div>
                <Badge
                  tone={client.status === "Active" ? "success" : "neutral"}
                >
                  {client.status}
                </Badge>
                <p>
                  {summary.total} Projects / {summary.active} Active / {summary.completed} Completed
                </p>
                <Link
                  className="button button-secondary"
                  to={`/clients/${client.id}`}
                >
                  Open Client
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function ClientFormPage() {
  const { clientId } = useParams();
  const { items: clients } = useClients();
  const { user, preview } = useAuth();
  const navigate = useNavigate();
  const existing = clients.find((item) => item.id === clientId);
  const form = useForm({
    resolver: zodResolver(clientSchema),
    values: existing || {
      name: "",
      clientTypeId: "",
      status: "Active",
      contactPerson: "",
      email: "",
      mobile: "",
      whatsapp: "",
      notes: "",
    },
  });
  if (clientId && !existing)
    return (
      <EmptyState
        icon={Building2}
        title="Client not found"
        description="This client may not exist or may no longer be available."
      />
    );
  const submit = async (values) => {
    if (preview) return;
    const payload = {
      ...values,
      name: values.name.trim(),
      normalizedName: values.name.trim().toLowerCase(),
      address: {},
    };
    try {
      const ref = existing
        ? await updateClient(user.uid, existing.id, payload)
        : await createClient(user.uid, payload);
      toast.success("Client saved.");
      navigate(existing ? `/clients/${existing.id}` : `/clients/${ref.id}`);
    } catch (error) {
      toast.error(error.message || "Client could not be saved.");
    }
  };
  return (
    <div className="page-view form-page">
      <PageHeader
        title={existing ? "Edit Client" : "Add Client"}
        description="Keep client information organized and ready for projects."
        icon={Building2}
      />
      <Card>
        <form className="settings-form" onSubmit={form.handleSubmit(submit)}>
          <h2>Basic information</h2>
          <FormField label="Client name" required error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
            {form.formState.errors.name && (
              <small className="form-error">
                {form.formState.errors.name.message}
              </small>
            )}
          </FormField>
          <FormField label="Client type" required error={form.formState.errors.clientTypeId?.message}>
            <CreatableSelect
              group="clientTypes"
              value={form.watch("clientTypeId")}
              onChange={(value) => form.setValue("clientTypeId", value)}
            />
          </FormField>
          <FormField label="Status" required error={form.formState.errors.status?.message}>
            <SelectShell {...form.register("status")}>
              <option>Active</option>
              <option>Inactive</option>
              <option>Archived</option>
            </SelectShell>
          </FormField>
          <h2>Contact information</h2>
          <FormField label="Contact person">
            <Input {...form.register("contactPerson")} />
          </FormField>
          <FormField label="Email">
            <Input type="email" {...form.register("email")} />
          </FormField>
          <FormField label="Mobile">
            <Input {...form.register("mobile")} />
          </FormField>
          <FormField label="WhatsApp">
            <Input {...form.register("whatsapp")} />
          </FormField>
          <FormField label="Notes">
            <textarea className="input textarea" {...form.register("notes")} />
          </FormField>
          <div className="settings-actions">
            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              disabled={preview}
            >
              Save Client
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
export function ClientDetailPage() {
  const { clientId } = useParams();
  const { items: clients } = useClients();
  const { items: projects } = useProjects();
  const { settings } = useSettings();
  const { user, isConfigured, preview } = useAuth();
  const { items: expenses } = useExpenses();
  const [income, setIncome] = useState([]);
  useEffect(() => {
    if (!user || !isConfigured || preview) return undefined;
    return subscribeIncome(user.uid, setIncome, () => setIncome([]));
  }, [user, isConfigured, preview]);
  const client = clients.find((item) => item.id === clientId);
  if (!client)
    return (
      <EmptyState
        icon={Building2}
        title="Client not found"
        description="This client may not exist or may no longer be available."
      />
    );
  const connected = projects.filter((item) => item.clientId === client.id);
  const summary = summarizeProjects(connected);
  const financial = clientFinancialSummary(connected);
  const connectedProjectIds = new Set(connected.map((item) => item.id));
  const projectPayments = income
    .filter(
      (item) =>
        item.status === "Active" &&
        item.sourceType === "Project Payment" &&
        connectedProjectIds.has(item.projectId),
    )
    .slice()
    .sort(
      (left, right) =>
        (right.receivedDate?.toMillis?.() || right.receivedDate?.seconds * 1000 || 0) -
        (left.receivedDate?.toMillis?.() || left.receivedDate?.seconds * 1000 || 0),
    );
  const nextPaymentProject = connected
    .filter((item) => item.nextPaymentDate)
    .slice()
    .sort(
      (left, right) =>
        (left.nextPaymentDate?.toMillis?.() || left.nextPaymentDate?.seconds * 1000 || 0) -
        (right.nextPaymentDate?.toMillis?.() || right.nextPaymentDate?.seconds * 1000 || 0),
    )[0];
  const clientExpenses = expenses.filter(
    (item) => item.clientId === client.id && item.paymentStatus !== "Cancelled",
  );
  const reimbursable = clientExpenses.filter(
    (item) => item.isClientReimbursable,
  );
  const reimbursements = income.filter(
    (item) =>
      item.status === "Active" &&
      item.clientId === client.id &&
      item.linkedExpenseId,
  );
  const expenseTotal = clientExpenses.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );
  const reimbursementTotal = reimbursements.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );
  const pendingReimbursement = reimbursable.reduce(
    (sum, item) =>
      sum + reimbursementSummary(item, reimbursements).pendingAmountMinor,
    0,
  );
  return (
    <div className="page-view">
      <PageHeader
        title={client.name}
        description="Client details and connected project summary."
        icon={Building2}
      />
      <div className="settings-actions">
        <Link className="button" to={`/clients/${client.id}/edit`}>
          Edit Client
        </Link>
        <Link
          className="button button-secondary"
          to={`/projects/new?clientId=${client.id}`}
        >
          Add Project for this Client
        </Link>
      </div>
      <VersionHistory entityId={client.id} />
      <div className="summary-grid">
        <Card>
          Total Projects <strong>{summary.total}</strong>
        </Card>
        <Card>
          Active Projects <strong>{summary.active}</strong>
        </Card>
        <Card>
          Completed <strong>{summary.completed}</strong>
        </Card>
        <Card>
          Project value{" "}
          <strong>
            {formatCurrency(
              financial.totalProjectValueMinor,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          Received{" "}
          <strong>
            {formatCurrency(
              financial.receivedAmountMinor,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          Remaining{" "}
          <strong>
            {formatCurrency(
              financial.remainingAmountMinor,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          Overpaid{" "}
          <strong>
            {formatCurrency(
              financial.overpaidAmountMinor,
              settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          Fully paid <strong>{financial.fullyPaidProjects}</strong>
        </Card>
        <Card>
          Partially paid <strong>{financial.partiallyPaidProjects}</strong>
        </Card>
        <Card>
          Not started <strong>{financial.unpaidProjects}</strong>
        </Card>
        <Card>
          Next payment{" "}
          <strong>
            {nextPaymentProject
              ? date(nextPaymentProject.nextPaymentDate)
              : ""}
          </strong>
        </Card>
      </div>
      <Card>
        <h2>Overview</h2>
        <p>
          {client.contactPerson || "No contact person"} {" "}
          {client.email || client.mobile || "No contact method"}
        </p>
        <p>{client.notes || "No notes added."}</p>
        <p>
          Created {date(client.createdAt)}  Updated {date(client.updatedAt)}
        </p>
      </Card>
      <Card>
        <h2>Client financial summary</h2>
        <div className="summary-grid finance-summary">
          <Card>
            <span>Linked active expenses</span>
            <strong>
              {formatCurrency(expenseTotal, settings.currency, settings.locale)}
            </strong>
          </Card>
          <Card>
            <span>Reimbursable expenses</span>
            <strong>
              {formatCurrency(
                reimbursable.reduce((sum, item) => sum + item.amountMinor, 0),
                settings.currency,
                settings.locale,
              )}
            </strong>
          </Card>
          <Card>
            <span>Reimbursed income</span>
            <strong>
              {formatCurrency(
                reimbursementTotal,
                settings.currency,
                settings.locale,
              )}
            </strong>
          </Card>
          <Card>
            <span>Pending reimbursement</span>
            <strong>
              {formatCurrency(
                pendingReimbursement,
                settings.currency,
                settings.locale,
              )}
            </strong>
          </Card>
        </div>
      </Card>
      <Card>
        <div className="card-line">
          <div>
            <h2>Recent project payments</h2>
            <p className="helper-text">
              Active canonical Income records only; transfers and independent
              income are excluded.
            </p>
          </div>
          <Link className="button button-secondary" to="/income">
            View Income
          </Link>
        </div>
        {projectPayments.length ? (
          <div className="data-list">
            {projectPayments.slice(0, 5).map((payment) => {
              const project = connected.find((item) => item.id === payment.projectId);
              return (
                <div className="list-row" key={payment.id}>
                  <span>{date(payment.receivedDate)}</span>
                  <strong>
                    {formatCurrency(
                      payment.amountMinor,
                      payment.currency || settings.currency,
                      settings.locale,
                    )}
                  </strong>
                  <Link to={`/projects/${payment.projectId}`}>
                    {project?.name || "Project"}
                  </Link>
                  <Link to={`/income/${payment.id}/edit`}>Open payment</Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="helper-text">No active project payments yet.</p>
        )}
      </Card>
      <Card>
        <h2>Projects</h2>
        {connected.length ? (
          connected.map((project) => (
            <p key={project.id}>
              <Link to={`/projects/${project.id}`}>{project.name}</Link> {" "}
              {project.status}
            </p>
          ))
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No connected projects"
            description="Create a project for this client when work begins."
          />
        )}
      </Card>
    </div>
  );
}




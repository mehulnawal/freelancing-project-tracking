/* eslint-disable react-hooks/incompatible-library */
import { useMemo, useState } from "react";
import { FolderKanban, Plus, WalletCards } from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
  TableShell,
} from "../components/ui";
import { CreatableSelect } from "../components/CreatableSelect";
import { useClients, useProjects } from "../hooks/useData";
import { useAuth } from "../context/useAuth";
import { createProject, updateProject } from "../services/projects";
import { formatCurrency, toMinorUnits } from "../utils/money";
import {
  deadlineState,
  initializeFinancials,
  PROJECT_STATUSES,
  PRIORITIES,
  transitionProjectStatus,
} from "../utils/projectLogic";
import { useSettings } from "../context/useSettings";
import { ProjectPayments } from "../components/ProjectPayments";
import { PaymentDrawer } from "../components/PaymentDrawer";
import { ProjectExpensesPanel } from "./ExpensesPages";
import { ProjectDocuments } from "../components/ProjectDocuments";
import { ProjectCredentialsPanel } from "./CredentialsPage";
const dateInput = (value) => value?.toDate ? value.toDate().toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : value ? new Date(value).toISOString().slice(0, 10) : "";
const dateText = (value) => { const input = dateInput(value); return input ? new Date(input + "T12:00:00").toLocaleDateString("en-IN") : "Not set" };
const schema = z
  .object({
    name: z.string().trim().min(1, "Project name is required"),
    clientId: z.string().min(1, "Client is required"),
    projectTypeId: z.string().min(1, "Project type is required"),
    status: z.string(),
    startDate: z.string().min(1, "Start date is required"),
    priority: z.string(),
    amount: z.string().optional(),
    expectedCompletionDate: z.string().optional(),
    actualCompletionDate: z.string().optional(),
    description: z.string().max(5000).optional(),
    notes: z.string().max(3000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      ["Confirmed", "In Progress", "On Hold", "Completed"].includes(
        value.status,
      ) &&
      !(toMinorUnits(value.amount) > 0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "A project amount is required for this status.",
      });
    if (value.status === "Completed" && !value.actualCompletionDate)
      ctx.addIssue({
        code: "custom",
        path: ["actualCompletionDate"],
        message: "Actual completion date is required.",
      });
  });
export function ProjectsPage() {
  const { items: projects, loading, error } = useProjects(); const { items: clients } = useClients(); const { settings } = useSettings(); const [term,setTerm]=useState(''); const [status,setStatus]=useState('all'); const [sort,setSort]=useState('newest'); const [paymentProject,setPaymentProject]=useState(null)
  const clientMap=useMemo(()=>Object.fromEntries(clients.map(item=>[item.id,item])),[clients]); const view=useMemo(()=>projects.filter(p => (status === 'all' || p.status === status) && `${p.name} ${p.description||''} ${clientMap[p.clientId]?.name||''} ${p.projectTypeId||''}`.toLowerCase().includes(term.toLowerCase())).sort((a,b)=>sort==='oldest'?String(a.createdAt||'').localeCompare(String(b.createdAt||'')):sort==='az'?a.name.localeCompare(b.name):sort==='za'?b.name.localeCompare(a.name):String(b.createdAt||'').localeCompare(String(a.createdAt||''))),[projects,status,term,sort,clientMap])
  return <div className="page-view"><div className="page-title-row"><PageHeader title="Projects" description="Keep work, deadlines and client payments in one clear view." icon={FolderKanban}/><Link className="button" to="/projects/new"><Plus size={16}/> New Project</Link></div><div className="filter-row"><Input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search projects"/><SelectShell value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{PROJECT_STATUSES.map(item=><option key={item}>{item}</option>)}</SelectShell><SelectShell value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="az">A–Z</option><option value="za">Z–A</option></SelectShell></div>{loading ? <Card>Loading projects…</Card> : error ? <EmptyState icon={FolderKanban} title="Projects could not be loaded" description={error}/> : !view.length ? <EmptyState icon={FolderKanban} title="No matching projects" description="Create a project when a new client engagement begins."/> : <TableShell><table className="project-table"><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Type</th><th>Priority</th><th>Dates</th><th>Quotation</th><th>Received</th><th>Pending</th><th aria-label="Actions"/></tr></thead><tbody>{view.map(project=><tr key={project.id}><td><Link to={`/projects/${project.id}`}><strong>{project.name}</strong></Link><small>{project.description || '—'}</small></td><td>{clientMap[project.clientId]?.name || 'Unavailable'}</td><td><Badge tone={project.status==='Completed'?'success':project.status==='On Hold'?'warning':'info'}>{project.status}</Badge></td><td>{project.projectTypeId || '—'}</td><td><Badge tone={project.priority==='High'||project.priority==='Urgent'?'danger':'neutral'}>{project.status==='Completed'?'N/A':project.priority || '—'}</Badge></td><td><small>{dateText(project.startDate)}{project.expectedCompletionDate ? ` → ${dateText(project.expectedCompletionDate)}` : ''}</small></td><td className="money-cell">{formatCurrency(project.totalAmountMinor,project.currency||settings.currency,settings.locale)}</td><td className="money-cell positive">{formatCurrency(project.receivedAmountMinor||0,project.currency||settings.currency,settings.locale)}</td><td className={project.remainingAmountMinor>0?'money-cell negative':'money-cell'}>{formatCurrency(project.remainingAmountMinor||0,project.currency||settings.currency,settings.locale)}</td><td><button className="icon-button" onClick={()=>setPaymentProject(project)} title="Record payment" aria-label={`Record payment for ${project.name}`}><WalletCards size={18}/></button></td></tr>)}</tbody></table></TableShell>}<PaymentDrawer project={paymentProject} client={clientMap[paymentProject?.clientId]} open={Boolean(paymentProject)} onClose={()=>setPaymentProject(null)}/></div>
}
export function ProjectFormPage() {
  const { projectId } = useParams();
  const [search] = useSearchParams();
  const { items: projects } = useProjects();
  const { items: clients } = useClients();
  const { user, preview } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const existing = projects.find((item) => item.id === projectId);
  const defaults = {
    name: "",
    clientId: search.get("clientId") || "",
    projectTypeId: "",
    assignmentTypeId: "",
    status: "Planning",
    priority: "Medium",
    startDate: new Date().toISOString().slice(0, 10),
    amount: "",
    expectedCompletionDate: "",
    actualCompletionDate: "",
    description: "",
    notes: "",
  };
  const form = useForm({
    resolver: zodResolver(schema),
    values: existing
      ? {
          ...existing,
          amount: existing.totalAmountMinor
            ? String(existing.totalAmountMinor / 100)
            : "",
          startDate:
            dateInput(existing.startDate),
          expectedCompletionDate:
            dateInput(existing.expectedCompletionDate),
          actualCompletionDate:
            dateInput(existing.actualCompletionDate),
        }
      : defaults,
  });
  if (projectId && !existing)
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="This project may not exist or may no longer be available."
      />
    );
  const status = form.watch("status");
  const save = async (values) => {
    if (preview) return;
    const amount = toMinorUnits(values.amount);
    const priority = transitionProjectStatus(
      existing?.status,
      values.status,
      values.priority,
    );
    const payload = {
      ...values,
      name: values.name.trim(),
      normalizedName: values.name.trim().toLowerCase(),
      totalAmountMinor: amount,
      currency: existing?.currency || settings.currency,
      ...priority,
      startDate: values.startDate,
      expectedCompletionDate: values.expectedCompletionDate
        ? values.expectedCompletionDate
        : null,
      actualCompletionDate: values.actualCompletionDate
        ? values.actualCompletionDate
        : null,
      ...(existing ? {} : initializeFinancials(amount)),
    };
    delete payload.amount;
    try {
      const ref = existing
        ? await updateProject(user.uid, existing.id, payload)
        : await createProject(user.uid, payload);
      toast.success("Project saved.");
      navigate(existing ? `/projects/${existing.id}` : `/projects/${ref.id}`);
    } catch (error) {
      toast.error(error.message || "Project could not be saved.");
    }
  };
  return (
    <div className="page-view form-page">
      <PageHeader
        title={existing ? "Edit Project" : "Add Project"}
        description="Set up client work with clear schedule and financial foundations."
        icon={FolderKanban}
      />
      <Card>
        <form className="settings-form" onSubmit={form.handleSubmit(save)}>
          <h2>Project information</h2>
          <FormField label="Project name">
            <Input {...form.register("name")} />
          </FormField>
          <FormField label="Client">
            <SelectShell {...form.register("clientId")}>
              <option value="">Select a client</option>
              {clients
                .filter((item) => item.status !== "Archived")
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </SelectShell>
          </FormField>
          <FormField label="Project type">
            <CreatableSelect
              group="projectTypes"
              value={form.watch("projectTypeId")}
              onChange={(value) => form.setValue("projectTypeId", value)}
            />
          </FormField>
          <FormField label="Assignment type">
            <CreatableSelect
              group="workTypes"
              value={form.watch("assignmentTypeId")}
              onChange={(value) => form.setValue("assignmentTypeId", value)}
            />
          </FormField>
          <h2>Schedule and status</h2>
          <FormField label="Start date">
            <Input type="date" {...form.register("startDate")} />
          </FormField>
          <FormField label="Expected completion">
            <Input type="date" {...form.register("expectedCompletionDate")} />
          </FormField>
          <FormField label="Status">
            <SelectShell {...form.register("status")}>
              {PROJECT_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectShell>
          </FormField>
          <FormField label="Priority">
            <SelectShell
              disabled={["Completed", "Cancelled", "Archived"].includes(status)}
              {...form.register("priority")}
            >
              {PRIORITIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectShell>
          </FormField>
          {status === "Completed" && (
            <FormField label="Actual completion">
              <Input type="date" {...form.register("actualCompletionDate")} />
            </FormField>
          )}
          <h2>Financial foundation</h2>
          <FormField label="Total project amount">
            <Input inputMode="decimal" {...form.register("amount")} />
          </FormField>
          <FormField label="Description">
            <textarea
              className="input textarea"
              {...form.register("description")}
            />
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
              Save Project
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
export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [search, setSearch] = useSearchParams();
  const { items: projects } = useProjects();
  const { items: clients } = useClients();
  const { settings } = useSettings();
  const project = projects.find((item) => item.id === projectId);
  if (!project)
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="This project may not exist or may no longer be available."
      />
    );
  const client = clients.find((item) => item.id === project.clientId);
  const tab = [
    "overview",
    "payments",
    "expenses",
    "credentials",
    "documents",
    "activity",
  ].includes(search.get("tab"))
    ? search.get("tab")
    : "overview";
  const selectTab = (next) =>
    setSearch(next === "overview" ? {} : { tab: next });
  return (
    <div className="page-view">
      <PageHeader
        title={project.name}
        description={client?.name || "Client unavailable"}
        icon={FolderKanban}
      />
      <div className="settings-actions">
        <Badge tone="info">{project.status}</Badge>
        <Badge>{project.priority}</Badge>
        <Link className="button" to={`/projects/${project.id}/edit`}>
          Edit Project
        </Link>
      </div>
      <VersionHistory entityId={project.id} />
      <div className="summary-grid">
        <Card>
          Total Amount{" "}
          <strong>
            {formatCurrency(
              project.totalAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          Received{" "}
          <strong>
            {formatCurrency(
              project.receivedAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
        <Card>
          Remaining{" "}
          <strong>
            {formatCurrency(
              project.remainingAmountMinor,
              project.currency || settings.currency,
              settings.locale,
            )}
          </strong>
        </Card>
      </div>
      <div className="tabs" role="tablist">
        {[
          ["overview", "Overview"],
          ["payments", "Payments"],
          ["expenses", "Expenses"],
          ["credentials", "Credentials"],
          ["documents", "Documents & Bills"],
          ["activity", "Activity"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <Card>
          <h2>Overview</h2>
          <p>{project.description || "No description added."}</p>
          <p>
            Deadline:{" "}
            {deadlineState(project.expectedCompletionDate, project.status)}
          </p>
          <p>
            Expected completion:{" "}
            {dateText(project.expectedCompletionDate)}
          </p>
          <p>{project.notes || "No notes added."}</p>
        </Card>
      )}
      {tab === "payments" && <ProjectPayments project={project} />}
      {tab === "expenses" && <ProjectExpensesPanel project={project} />} 
      {tab === "documents" && <ProjectDocuments project={project} />} 
      {tab === "credentials" && <ProjectCredentialsPanel project={project} />}
      {["activity"].includes(tab) && (
        <EmptyState
          icon={FolderKanban}
          title={`${tab === "documents" ? "Documents & Bills" : tab[0].toUpperCase() + tab.slice(1)} is ready for its next implementation`}
          description="This project area is intentionally empty until its dedicated secure workflow is added."
        />
      )}
    </div>
  );
}




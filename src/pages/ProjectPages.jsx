/* eslint-disable react-hooks/incompatible-library */
import { useMemo, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
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
import { ProjectExpensesPanel } from "./ExpensesPages";
import { ProjectDocuments } from "../components/ProjectDocuments";
import { ProjectCredentialsPanel } from "./CredentialsPage";
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
  const { items: projects, loading, error } = useProjects();
  const { items: clients } = useClients();
  const { settings } = useSettings();
  const [term, setTerm] = useState("");
  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((item) => [item.id, item])),
    [clients],
  );
  const view = useMemo(
    () =>
      projects.filter((p) =>
        `${p.name} ${p.description || ""} ${clientMap[p.clientId]?.name || ""}`
          .toLowerCase()
          .includes(term.toLowerCase()),
      ),
    [projects, term, clientMap],
  );
  return (
    <div className="page-view">
      <PageHeader
        title="Projects"
        description="Manage project schedules, status and financial foundations."
        icon={FolderKanban}
      />
      <div className="list-toolbar">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search projects"
        />
        <Link className="button" to="/projects/new">
          <Plus size={16} />
          Add Project
        </Link>
      </div>
      {loading ? (
        <p>Loading projects</p>
      ) : error ? (
        <EmptyState
          icon={FolderKanban}
          title="Projects could not be loaded"
          description={error}
        />
      ) : !view.length ? (
        <EmptyState
          icon={FolderKanban}
          title={term ? "No matching projects" : "No projects yet"}
          description="Add a project when a client engagement begins."
        />
      ) : (
        <div className="data-list">
          {view.map((project) => (
            <Card className="client-card" key={project.id}>
              <div>
                <h2>{project.name}</h2>
                <p>
                  {clientMap[project.clientId]?.name || "Client unavailable"}
                </p>
              </div>
              <Badge tone="info">{project.status}</Badge>
              <p>
                {deadlineState(project.expectedCompletionDate, project.status)}{" "}
                {" "}
                {formatCurrency(
                  project.remainingAmountMinor,
                  project.currency || settings.currency,
                  settings.locale,
                )}{" "}
                remaining
              </p>
              <Link
                className="button button-secondary"
                to={`/projects/${project.id}`}
              >
                Open Project
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
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
            existing.startDate?.toDate?.().toISOString().slice(0, 10) || "",
          expectedCompletionDate:
            existing.expectedCompletionDate
              ?.toDate?.()
              .toISOString()
              .slice(0, 10) || "",
          actualCompletionDate:
            existing.actualCompletionDate
              ?.toDate?.()
              .toISOString()
              .slice(0, 10) || "",
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
      startDate: new Date(`${values.startDate}T00:00:00`),
      expectedCompletionDate: values.expectedCompletionDate
        ? new Date(`${values.expectedCompletionDate}T00:00:00`)
        : null,
      actualCompletionDate: values.actualCompletionDate
        ? new Date(`${values.actualCompletionDate}T00:00:00`)
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
    } catch {
      toast.error("Project could not be saved.");
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
            {project.expectedCompletionDate?.toDate?.().toLocaleDateString() ||
              "Not set"}
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

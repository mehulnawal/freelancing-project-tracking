import { focusItems } from "./dashboardLogic";

const safeText = (value) => String(value || "").replace(/(password|api key|secret|token|pin|recovery)/gi, "");
export const notificationId = (type, entityId, fingerprint) => `${type}:${entityId}:${fingerprint}`.replace(/[^a-zA-Z0-9:_-]/g, "-");

export function deriveNotifications({ projects = [], expenses = [], clients = [] }, now = new Date(), preferences = {}) {
  const reminderDays = Math.max(preferences.projectReminderDays || 7, preferences.paymentReminderDays || 7, preferences.expenseReminderDays || 7);
  return focusItems({ projects, expenses, clients }, now, reminderDays).flatMap((item) => {
    const isPayment = /payment/i.test(item.reason);
    const enabled = item.entityType === "Expense" ? preferences.expenseEnabled !== false : isPayment ? preferences.paymentEnabled !== false : preferences.projectEnabled !== false;
    if (!enabled) return [];
    const fingerprint = `${item.reason}:${item.dueDate?.toDate?.()?.toISOString?.().slice(0, 10) || String(item.dueDate || "state").slice(0, 10)}`;
    const id = notificationId(item.reason.toLowerCase().replace(/[^a-z0-9]+/g, "-"), item.entityId, fingerprint);
    return [{ ...item, type: isPayment ? "Payment" : item.entityType, notificationId: id, fingerprint: id, title: safeText(item.reason), body: safeText(`${item.title}${item.client ? ` · ${item.client}` : ""}`) }];
  });
}

export const isQuietHours = ({ quietHoursStart: start, quietHoursEnd: end } = {}, now = new Date()) => {
  if (!start || !end || start === end) return false;
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return start < end ? current >= start && current < end : current >= start || current < end;
};

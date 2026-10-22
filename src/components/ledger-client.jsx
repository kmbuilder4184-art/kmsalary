"use client";
import { CheckCircle2, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PageHeading } from "@/components/page-heading";
import { formatCurrency, formatDate } from "@/lib/utils";

const defaultForm = {
    employee: "",
    amount: "",
    entryDate: new Date().toISOString().slice(0, 10),
    notes: ""
};

export function LedgerClient() {
    const { notify } = useToast();
    const [employees, setEmployees] = useState([]);
    const [entries, setEntries] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
        fetch("/api/auth/me")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setCurrentUser(data?.user || null))
            .catch(() => setCurrentUser(null));
    }, []);

    function can(permission) {
        return currentUser?.role === "Admin" || currentUser?.permissions?.includes(permission);
    }

    async function loadData() {
        setLoading(true);
        const [employeeResponse, ledgerResponse] = await Promise.all([
            fetch("/api/employees?status=Active&fields=summary", { cache: "no-store" }),
            fetch("/api/ledger", { cache: "no-store" })
        ]);
        const [employeeData, ledgerData] = await Promise.all([
            employeeResponse.ok ? employeeResponse.json() : { employees: [] },
            ledgerResponse.ok ? ledgerResponse.json() : { entries: [] }
        ]);
        setEmployees(employeeData.employees || []);
        setEntries(ledgerData.entries || []);
        setLoading(false);
    }

    const totals = useMemo(() => entries.reduce((acc, entry) => {
        acc.amount += Number(entry.amount) || 0;
        acc.deducted += Number(entry.deductedAmount) || 0;
        acc.balance += Number(entry.balanceAmount) || 0;
        return acc;
    }, { amount: 0, deducted: 0, balance: 0 }), [entries]);

    async function submit(event) {
        event.preventDefault();
        if (!form.employee) {
            notify({ tone: "error", title: "Select an employee first" });
            return;
        }
        if (Number(form.amount) <= 0) {
            notify({ tone: "error", title: "Enter expense amount" });
            return;
        }
        setSaving(true);
        const response = await fetch("/api/ledger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee: form.employee,
                amount: Number(form.amount),
                entryDate: form.entryDate,
                notes: form.notes
            })
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Expense entry could not be saved" });
            return;
        }
        setForm(defaultForm);
        notify({ tone: "success", title: "Expense entry saved" });
        await loadData();
    }

    async function updateEntry(entry, status) {
        const response = await fetch(`/api/ledger/${entry._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Expense entry could not be updated" });
            return;
        }
        notify({ tone: "success", title: status === "Closed" ? "Expense closed" : "Expense reopened" });
        await loadData();
    }

    async function deleteEntry(entry) {
        const response = await fetch(`/api/ledger/${entry._id}`, { method: "DELETE" });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Expense entry could not be deleted" });
            return;
        }
        notify({ tone: "success", title: "Expense entry deleted" });
        await loadData();
    }

    return (<>
      <PageHeading title="Company Expense Entry" description="Maintain money or expense taken by employees from company. Open balance is automatically shown as read-only Company Expense deduction during salary creation." action={<Button variant="secondary" onClick={loadData}>
            <RefreshCw className="h-4 w-4"/>
            Refresh
          </Button>}/>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="New Expense Entry" description="Record company money or expense given to an employee."/>
          <form onSubmit={submit} className="grid gap-4 p-5">
            <Field label="Employee">
              <Select value={form.employee} onChange={(event) => setForm({ ...form, employee: event.target.value })} required>
                <option value="">Select employee</option>
                {employees.map((employee) => (<option value={employee._id} key={employee._id}>
                  {employee.name} ({employee.employeeId})
                </option>))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expense Amount">
                <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Enter amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.replace(/\D/g, "") })} required/>
              </Field>
              <Field label="Entry Date">
                <Input type="date" value={form.entryDate} onChange={(event) => setForm({ ...form, entryDate: event.target.value })} required/>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Reason or detail"/>
            </Field>
            <Button type="submit" disabled={saving || loading || !can("ledger.create")}>
              <Save className="h-4 w-4"/>
              {saving ? "Saving..." : "Save Expense Entry"}
            </Button>
          </form>
        </Card>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <LedgerMetric label="Total Expense Given" value={formatCurrency(totals.amount)}/>
            <LedgerMetric label="Salary Cut" value={formatCurrency(totals.deducted)}/>
            <LedgerMetric label="Open Balance" value={formatCurrency(totals.balance)} emphasis/>
          </div>
          <Card>
            <CardHeader title="Expense Records" description={`${entries.length} total entries`}/>
            {entries.length === 0 ? (<EmptyState title="No expense entries" description="Employee expense records will appear here after entry."/>) : (<div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Cut</th>
                    <th className="px-5 py-3 font-semibold">Balance</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Notes</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (<tr key={entry._id} className="hover:bg-muted/50">
                    <td className="px-5 py-4">
                      <p className="font-medium">{entry.employee?.name || entry.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{entry.employeeId}</p>
                    </td>
                    <td className="px-5 py-4">{formatDate(entry.entryDate)}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(entry.amount)}</td>
                    <td className="px-5 py-4">{formatCurrency(entry.deductedAmount)}</td>
                    <td className="px-5 py-4 font-semibold text-primary">{formatCurrency(entry.balanceAmount)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.status === "Open" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-muted-foreground">{entry.notes || "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {entry.status === "Open" && can("ledger.edit") ? (<Button variant="secondary" size="sm" onClick={() => updateEntry(entry, "Closed")}>
                          <CheckCircle2 className="h-4 w-4"/>
                          Close
                        </Button>) : null}
                        {can("ledger.delete") ? (<Button variant="danger" size="sm" onClick={() => deleteEntry(entry)}>
                          <Trash2 className="h-4 w-4"/>
                          Delete
                        </Button>) : null}
                      </div>
                    </td>
                  </tr>))}
                </tbody>
              </table>
            </div>)}
          </Card>
        </div>
      </div>
    </>);
}

function LedgerMetric({ label, value, emphasis }) {
    return (<div className={`rounded-xl border p-4 shadow-sm backdrop-blur ${emphasis ? "border-primary/25 bg-primary/10" : "border-white/50 bg-white/35 dark:border-white/10 dark:bg-white/10"}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
    </div>);
}

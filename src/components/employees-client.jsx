"use client";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, Edit3, Eye, EyeOff, FileText, ImagePlus, Plus, Search, Trash2, Upload, UserRoundX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ANNUAL_CL_ALLOWANCE, MAX_CL_PER_REQUEST, validateClRequest } from "@/lib/salary";
import { formatCurrency, formatDate, initials, monthName } from "@/lib/utils";
const blankEmployee = {
    name: "",
    fatherOrSpouseName: "",
    role: "Site Engineer",
    department: "Construction & Site",
    branch: "Branch 1",
    phone: "",
    email: "",
    address: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    photo: "",
    accountNumber: "",
    ifscCode: "",
    esslMachineId: "",
    baseSalary: "",
    status: "Active"
};
const blankSalaryEditForm = {
    baseSalary: "",
    workingDays: "",
    daysPresent: "",
    totalCL: String(ANNUAL_CL_ALLOWANCE),
    casualLeave: "",
    halfCLTaken: "",
    excessCL: "",
    emergencyLeave: "",
    bonus: "",
    advanceDeduction: "",
    pfAmount: "",
    status: "Pending",
    paymentDate: "",
    notes: ""
};
export function EmployeesClient() {
    const { notify } = useToast();
    const [employees, setEmployees] = useState([]);
    const [salaries, setSalaries] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("Active");
    const [branchFilter, setBranchFilter] = useState("All");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [salaryModalOpen, setSalaryModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [salaryEmployee, setSalaryEmployee] = useState(null);
    const [salaryFilters, setSalaryFilters] = useState({
        month: "All",
        year: String(new Date().getFullYear())
    });
    const [salaryEditOpen, setSalaryEditOpen] = useState(false);
    const [salaryDeleteOpen, setSalaryDeleteOpen] = useState(false);
    const [selectedSalary, setSelectedSalary] = useState(null);
    const [salaryEditForm, setSalaryEditForm] = useState(blankSalaryEditForm);
    const [salaryPassword, setSalaryPassword] = useState("");
    const [salaryPasswordVisible, setSalaryPasswordVisible] = useState(false);
    const [salarySaving, setSalarySaving] = useState(false);
    const [form, setForm] = useState(blankEmployee);
    const [deleteEmployee, setDeleteEmployee] = useState(null);
    const [deleteConfirmName, setDeleteConfirmName] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const importFileRef = useRef(null);
    const topEmployeeScrollRef = useRef(null);
    const tableEmployeeScrollRef = useRef(null);
    useEffect(() => {
        loadEmployees();
        fetch("/api/auth/me")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setCurrentUser(data?.user || null))
            .catch(() => setCurrentUser(null));
    }, []);
    useEffect(() => {
        loadEmployees();
    }, [status]);
    function can(permission) {
        return currentUser?.role === "Admin" || currentUser?.permissions?.includes(permission);
    }
    async function loadEmployees() {
        setLoading(true);
        const response = await fetch(`/api/employees?status=${status}`, { cache: "no-store" });
        const data = response.ok ? await response.json() : { employees: [] };
        setEmployees(data.employees || []);
        setLoading(false);
    }
    async function loadSalaries(employeeId = salaryEmployee?.employeeId) {
        const params = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
        const response = await fetch(`/api/salaries${params}`, { cache: "no-store" });
        const data = response.ok ? await response.json() : { salaries: [] };
        setSalaries(data.salaries || []);
    }
    function openCreate() {
        setEditing(null);
        setForm(blankEmployee);
        setModalOpen(true);
    }
    async function openSalaryHistory(employee) {
        setSalaryEmployee(employee);
        setSalaryFilters({ month: "All", year: String(new Date().getFullYear()) });
        await loadSalaries(employee.employeeId);
        setSalaryModalOpen(true);
    }
    async function openEdit(employee) {
        setEditing(employee);
        setForm({
            name: employee.name || "",
            fatherOrSpouseName: employee.fatherOrSpouseName || "",
            role: employee.role || "Site Engineer",
            department: employee.department || "Construction & Site",
            branch: employee.branch || "Branch 1",
            phone: employee.phone || "",
            email: employee.email || "",
            address: employee.address || "",
            joiningDate: (employee.joiningDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
            photo: employee.photo || "",
            accountNumber: employee.bankDetails?.accountNumber || "",
            ifscCode: employee.bankDetails?.ifscCode || "",
            esslMachineId: employee.bankDetails?.esslMachineId || "",
            baseSalary: String(employee.baseSalary || 0),
            status: employee.status || "Active"
        });
        setModalOpen(true);
        try {
            const response = await fetch(`/api/employees/${employee._id}`, { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                if (data?.employee) {
                    const detail = data.employee;
                    setForm({
                        name: detail.name || "",
                        fatherOrSpouseName: detail.fatherOrSpouseName || "",
                        role: detail.role || "Site Engineer",
                        department: detail.department || "Construction & Site",
                        branch: detail.branch || "Branch 1",
                        phone: detail.phone || "",
                        email: detail.email || "",
                        address: detail.address || "",
                        joiningDate: (detail.joiningDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
                        photo: detail.photo || "",
                        accountNumber: detail.bankDetails?.accountNumber || "",
                        ifscCode: detail.bankDetails?.ifscCode || "",
                        esslMachineId: detail.bankDetails?.esslMachineId || "",
                        baseSalary: String(detail.baseSalary || 0),
                        status: detail.status || "Active"
                    });
                }
            }
        } catch (_) {
            // keep form initialized from table data
        }
    }
    async function submit(event) {
        event.preventDefault();
        setSaving(true);
        const payload = {
            name: form.name,
            fatherOrSpouseName: form.fatherOrSpouseName,
            role: form.role,
            department: form.department,
            branch: form.branch || "Branch 1",
            phone: form.phone,
            email: form.email,
            address: form.address,
            joiningDate: form.joiningDate,
            photo: form.photo,
            bankDetails: {
                accountNumber: form.accountNumber,
                ifscCode: form.ifscCode,
                esslMachineId: form.esslMachineId
            },
            baseSalary: Number(form.baseSalary || 0),
            status: form.status
        };
        const response = await fetch(editing ? `/api/employees/${editing._id}` : "/api/employees", {
            method: editing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        setSaving(false);
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            notify({ tone: "error", title: data?.message || "Employee could not be saved" });
            return;
        }
        const data = await response.json().catch(() => null);
        const savedEmployee = data?.employee;
        notify({ tone: "success", title: editing ? "Employee updated" : "Employee created" });
        setModalOpen(false);
        if (savedEmployee) {
            setEmployees((prev) => {
                const exists = prev.some((e) => e._id === savedEmployee._id);
                if (exists) {
                    return prev.map((e) => (e._id === savedEmployee._id ? savedEmployee : e));
                }
                return [savedEmployee, ...prev];
            });
        }
        await loadEmployees();
    }
    function openDeleteEmployee(employee) {
        setDeleteEmployee(employee);
        setDeleteConfirmName("");
        setDeleteModalOpen(true);
    }
    async function markInactive(employee) {
        const response = await fetch(`/api/employees/${employee._id}`, { method: "DELETE" });
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            notify({ tone: "error", title: data?.message || "Unable to mark employee inactive" });
            return;
        }
        notify({ tone: "success", title: "Employee moved to inactive list" });
        await loadEmployees();
    }
    async function confirmDeleteEmployee(event) {
        event.preventDefault();
        if (!deleteEmployee || deleteConfirmName.trim() !== deleteEmployee.name.trim()) {
            notify({ tone: "error", title: "Type the employee name exactly to confirm deletion" });
            return;
        }
        setDeleting(true);
        const response = await fetch(`/api/employees/${deleteEmployee._id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmName: deleteConfirmName })
        });
        setDeleting(false);
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            notify({ tone: "error", title: data?.message || "Unable to delete employee" });
            return;
        }
        notify({ tone: "success", title: "Employee deleted" });
        setDeleteModalOpen(false);
        setDeleteEmployee(null);
        await loadEmployees();
    }
    const departmentOptions = useMemo(() => {
        const set = new Set([
            "Construction & Site",
            "Engineering & Design",
            "Accounts & Finance",
            "Sales & Marketing",
            "Administration / HR",
            "Security & Maintenance",
            "General"
        ]);
        employees.forEach((emp) => {
            if (emp.department) set.add(emp.department);
        });
        return Array.from(set);
    }, [employees]);
    const filteredEmployees = useMemo(() => {
        return employees.filter((employee) => {
            const target = `${employee.name} ${employee.employeeId} ${employee.department} ${employee.role} ${employee.branch || ""}`.toLowerCase();
            const matchesStatus = employee.status === status;
            const matchesSearch = target.includes(search.toLowerCase());
            const matchesDepartment = departmentFilter === "All" || (employee.department || "General").toLowerCase() === departmentFilter.toLowerCase();
            const matchesBranch = branchFilter === "All" || (employee.branch || "Branch 1") === branchFilter;
            return matchesStatus && matchesSearch && matchesDepartment && matchesBranch;
        }).sort(compareEmployeeNames);
    }, [employees, search, status, departmentFilter, branchFilter]);
    const employeeSalaryHistory = useMemo(() => {
        if (!salaryEmployee)
            return [];
        return salaries
            .filter((salary) => salary.employeeId === salaryEmployee.employeeId &&
            (!salaryFilters.year || salary.year === Number(salaryFilters.year)) &&
            (salaryFilters.month === "All" || salary.month === Number(salaryFilters.month)))
            .sort((a, b) => b.year - a.year || b.month - a.month);
    }, [salaries, salaryEmployee, salaryFilters]);
    const selectedSlip = salaryFilters.month === "All" ? null : employeeSalaryHistory[0];
    async function downloadEmployeeLedger() {
        if (!salaryEmployee)
            return;
        const { exportEmployeeLedgerExcel } = await import("@/lib/excel-export");
        exportEmployeeLedgerExcel({
            employee: salaryEmployee,
            salaries: employeeSalaryHistory,
            year: salaryFilters.year,
            fileName: `${salaryEmployee.employeeId}-ledger-${salaryFilters.year || "all"}.xls`
        });
    }
    async function downloadEmployeeTemplate(isBlank) {
        const { downloadSampleEmployeeExcel } = await import("@/lib/excel-import-template");
        downloadSampleEmployeeExcel(isBlank);
    }
    function openSalaryEdit(salary) {
        setSelectedSalary(salary);
        setSalaryEditForm(toSalaryEditForm(salary));
        setSalaryPassword("");
        setSalaryPasswordVisible(false);
        setSalaryEditOpen(true);
    }
    function openSalaryDelete(salary) {
        setSelectedSalary(salary);
        setSalaryPassword("");
        setSalaryPasswordVisible(false);
        setSalaryDeleteOpen(true);
    }
    async function submitSalaryEdit(event) {
        event.preventDefault();
        if (!selectedSalary)
            return;
        const clError = validateClRequest({
            annualClUsed: employeeSalaryHistory
                .filter((salary) => salary._id !== selectedSalary._id)
                .reduce((sum, salary) => sum + Number(salary.equivalentCLUsed || Number(salary.casualLeave || 0) + Number(salary.halfCLTaken || 0) / 2), 0),
            casualLeave: Number(salaryEditForm.casualLeave || 0),
            halfCLTaken: Number(salaryEditForm.halfCLTaken || 0),
            totalCL: Number(salaryEditForm.totalCL || ANNUAL_CL_ALLOWANCE)
        });
        if (clError) {
            notify({ tone: "error", title: clError });
            return;
        }
        setSalarySaving(true);
        const response = await fetch(`/api/salaries/${selectedSalary._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                baseSalary: Number(salaryEditForm.baseSalary || 0),
                workingDays: Number(salaryEditForm.workingDays || 1),
                daysPresent: Number(salaryEditForm.daysPresent || 0),
                totalCL: Number(salaryEditForm.totalCL || ANNUAL_CL_ALLOWANCE),
                casualLeave: Number(salaryEditForm.casualLeave || 0),
                halfCLTaken: Number(salaryEditForm.halfCLTaken || 0),
                excessCL: Number(salaryEditForm.excessCL || 0),
                emergencyLeave: Number(salaryEditForm.emergencyLeave || 0),
                bonus: Number(salaryEditForm.bonus || 0),
                advanceDeduction: Number(salaryEditForm.advanceDeduction || 0),
                pfAmount: Number(salaryEditForm.pfAmount || 0),
                status: salaryEditForm.status,
                paymentDate: salaryEditForm.paymentDate || null,
                notes: salaryEditForm.notes,
                password: salaryPassword
            })
        });
        setSalarySaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Salary could not be updated" });
            return;
        }
        notify({ tone: "success", title: "Salary updated" });
        setSalaryEditOpen(false);
        await loadSalaries();
    }
    async function confirmSalaryDelete() {
        if (!selectedSalary)
            return;
        setSalarySaving(true);
        const response = await fetch(`/api/salaries/${selectedSalary._id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: salaryPassword })
        });
        setSalarySaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Salary could not be deleted" });
            return;
        }
        notify({ tone: "success", title: "Salary deleted" });
        setSalaryDeleteOpen(false);
        await loadSalaries();
    }
    function openImportModal() {
        setImportFile(null);
        setImportResult(null);
        setImportModalOpen(true);
    }
    function syncEmployeeTableScroll(source) {
        const from = source === "top" ? topEmployeeScrollRef.current : tableEmployeeScrollRef.current;
        const to = source === "top" ? tableEmployeeScrollRef.current : topEmployeeScrollRef.current;
        if (from && to && to.scrollLeft !== from.scrollLeft) {
            to.scrollLeft = from.scrollLeft;
        }
    }
    async function handleImportUpload() {
        if (!importFile) return;
        setImporting(true);
        setImportResult(null);
        const formData = new FormData();
        formData.append("file", importFile);
        try {
            const response = await fetch("/api/employees/import", { method: "POST", body: formData });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                setImportResult({ success: false, message: data?.message || "Import failed." });
                notify({ tone: "error", title: data?.message || "Import failed" });
            } else {
                setImportResult({ success: true, message: data?.message || "Import successful", imported: data?.imported || 0, errorCount: data?.errorCount || 0, errors: data?.errors || [] });
                notify({ tone: "success", title: data?.message || "Employees imported" });
                await loadEmployees();
            }
        } catch {
            setImportResult({ success: false, message: "Network error during import." });
            notify({ tone: "error", title: "Network error during import" });
        }
        setImporting(false);
    }
    const canCreateEmployees = can("employees.create");
    const canEditEmployees = can("employees.edit");
    const canDeleteEmployees = can("employees.delete");
    const canViewSalary = can("salary.view");
    const canEditSalary = can("salary.edit");
    const canDeleteSalary = can("salary.delete");
    const showEmployeeActions = canEditEmployees || canDeleteEmployees || canViewSalary;
    const showSalaryActions = canEditSalary || canDeleteSalary;
    return (<>
      <div className="mb-5 rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">KM BUILDERS · Employee Management</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-50 sm:text-3xl">Employees</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">Manage employee records across Branch 1 and Branch 2 with designations, biometric machine mapping, and salary details.</p>
          </div>
          {canCreateEmployees ? <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={openImportModal}>
              <Upload className="h-4 w-4"/>
              Import Excel
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4"/>
              New Employee
            </Button>
          </div> : null}
        </div>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader title="Employee Directory" description={`${filteredEmployees.length} visible record${filteredEmployees.length === 1 ? "" : "s"}`} action={<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                <Input className="w-full pl-9 sm:w-56" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees"/>
              </div>
              <Select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="w-full sm:w-36">
                <option value="All">All Branches</option>
                <option value="Branch 1">Branch 1</option>
                <option value="Branch 2">Branch 2</option>
              </Select>
              <Select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="w-full sm:w-44">
                <option value="All">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </Select>
              <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-28">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>}/>

        {filteredEmployees.length === 0 ? (<EmptyState title={loading ? "Loading employees" : "No employees found"} description={loading ? "Please wait while records are loaded." : "Create an employee profile to begin payroll setup."} action={!loading && canCreateEmployees ? <Button variant="secondary" onClick={openCreate}>Add Employee</Button> : null}/>) : (<div>
            <div ref={topEmployeeScrollRef} className="emp-table-scroll emp-table-scroll-top" onScroll={() => syncEmployeeTableScroll("top")}>
              <div className="h-px min-w-[1240px]"/>
            </div>
            <div ref={tableEmployeeScrollRef} className="emp-table-scroll" onScroll={() => syncEmployeeTableScroll("bottom")}>
            <table className="w-full min-w-[1240px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[20%]"/>
                <col className="w-[12%]"/>
                <col className="w-[10%]"/>
                <col className="w-[10%]"/>
                <col className="w-[10%]"/>
                <col className="w-[10%]"/>
                <col className="w-[12%]"/>
                <col className="w-[8%]"/>
                {showEmployeeActions ? <col className="w-[14%]"/> : null}
              </colgroup>
              <thead className="border-y border-slate-200 bg-slate-100 text-xs uppercase text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Role & Dept</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Joining</th>
                  <th className="px-4 py-3 font-semibold">Salary</th>
                  <th className="px-4 py-3 font-semibold">Bank</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {showEmployeeActions ? <th className="px-4 py-3 text-right font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {filteredEmployees.map((employee) => (<tr key={employee._id} className="bg-white dark:bg-slate-900/40 hover:bg-blue-50/45 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {employee.photo ? (<img src={employee.photo} alt="" className="emp-photo"/>) : (<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                            {initials(employee.name)}
                          </div>)}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950 dark:text-slate-50">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {employee.employeeId}
                            {employee.bankDetails?.esslMachineId ? ` • Machine ID: ${employee.bankDetails.esslMachineId}` : ""}
                            {employee.email ? ` • ${employee.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate font-medium">{employee.role}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.department}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                        employee.branch === "Branch 2"
                          ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300"
                      )}>
                        {employee.branch || "Branch 1"}
                      </span>
                    </td>
                    <td className="truncate px-4 py-3">{employee.phone || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(employee.joiningDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatCurrency(employee.baseSalary)}</td>
                    <td className="px-4 py-3">
                      <p className="truncate font-medium">{employee.bankDetails.accountNumber || "-"}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.bankDetails.ifscCode || "-"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={employee.status === "Active" ? "success" : "neutral"}>{employee.status}</Badge>
                    </td>
                    {showEmployeeActions ? <td className="px-4 py-3">
                      <div className="flex min-w-[150px] items-center justify-end gap-2">
                        {canEditEmployees ? <Button variant="secondary" size="icon" title="Edit employee" aria-label={`Edit ${employee.name}`} onClick={() => openEdit(employee)}>
                          <Edit3 className="h-4 w-4"/>
                        </Button> : null}
                        {canViewSalary ? <Button variant="secondary" size="icon" title="Salary history" aria-label={`${employee.name} salary history`} onClick={() => openSalaryHistory(employee)}>
                          <FileText className="h-4 w-4"/>
                        </Button> : null}
                        {canDeleteEmployees && employee.status === "Active" ? (<Button variant="danger" size="icon" title="Mark inactive" aria-label={`Mark ${employee.name} inactive`} onClick={() => markInactive(employee)}>
                            <UserRoundX className="h-4 w-4"/>
                          </Button>) : null}
                        {canDeleteEmployees && employee.status === "Inactive" ? (<Button variant="danger" size="icon" title="Delete employee" aria-label={`Delete ${employee.name}`} onClick={() => openDeleteEmployee(employee)}>
                            <Trash2 className="h-4 w-4"/>
                          </Button>) : null}
                      </div>
                    </td> : null}
                  </tr>))}
              </tbody>
            </table>
            </div>
          </div>)}
      </Card>

      <Modal open={modalOpen} title={editing ? "Edit Employee" : "Create Employee"} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required/>
            </Field>
            <Field label="Father/Spouse Name">
              <Input value={form.fatherOrSpouseName || ""} onChange={(event) => setForm({ ...form, fatherOrSpouseName: event.target.value })}/>
            </Field>
            <Field label="Branch">
              <Select value={form.branch || "Branch 1"} onChange={(event) => setForm({ ...form, branch: event.target.value })}>
                <option value="Branch 1">Branch 1 (Head Office)</option>
                <option value="Branch 2">Branch 2 (Site Office)</option>
              </Select>
            </Field>
            <Field label="Role / Designation">
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="Site Engineer">Site Engineer</option>
                <option value="Project Manager">Project Manager</option>
                <option value="Site Supervisor">Site Supervisor</option>
                <option value="Civil Engineer">Civil Engineer</option>
                <option value="Architect">Architect</option>
                <option value="Accountant">Accountant</option>
                <option value="Office Staff">Office Staff</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Security Guard">Security Guard</option>
                <option value="Staff">Staff / Labor</option>
                {form.role && !["Site Engineer", "Project Manager", "Site Supervisor", "Civil Engineer", "Architect", "Accountant", "Office Staff", "Sales & Marketing", "Security Guard", "Staff"].includes(form.role) && (
                  <option value={form.role}>{form.role}</option>
                )}
              </Select>
            </Field>
            <Field label="Department">
              <Select value={form.department || "Construction & Site"} onChange={(event) => setForm({ ...form, department: event.target.value })}>
                <option value="Construction & Site">Construction & Site</option>
                <option value="Engineering & Design">Engineering & Design</option>
                <option value="Accounts & Finance">Accounts & Finance</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Administration / HR">Administration / HR</option>
                <option value="Security & Maintenance">Security & Maintenance</option>
                <option value="General">General</option>
                {form.department && !["Construction & Site", "Engineering & Design", "Accounts & Finance", "Sales & Marketing", "Administration / HR", "Security & Maintenance", "General"].includes(form.department) && (
                  <option value={form.department}>{form.department}</option>
                )}
              </Select>
            </Field>
            <Field label="Phone">
              <Input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })}/>
            </Field>
            <Field label="Email (Optional)">
              <Input type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="employee@example.com"/>
            </Field>
            <Field label="Joining Date">
              <Input type="date" value={form.joiningDate || ""} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}/>
            </Field>
            <Field label="Base Salary">
              <Input type="number" min="0" value={form.baseSalary || ""} onChange={(event) => setForm({ ...form, baseSalary: event.target.value })}/>
            </Field>
            <Field label="Account Number">
              <Input value={form.accountNumber || ""} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}/>
            </Field>
            <Field label="IFSC Code">
              <Input value={form.ifscCode || ""} onChange={(event) => setForm({ ...form, ifscCode: event.target.value.toUpperCase() })}/>
            </Field>
            <Field label="Biometric Machine ID">
              <Input value={form.esslMachineId || ""} onChange={(event) => setForm({ ...form, esslMachineId: event.target.value })} placeholder="e.g. 4, 36"/>
            </Field>
            <Field label="Employment Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </Field>
            <Field label="Profile Photo">
              <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <ImagePlus className="h-4 w-4"/>
                Upload Photo
                <input className="sr-only" type="file" accept="image/*" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = () => setForm((current) => ({ ...current, photo: String(reader.result) }));
            reader.readAsDataURL(file);
        }}/>
              </label>
            </Field>
          </div>
          <Field label="Address">
            <Textarea value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })}/>
          </Field>
          {form.photo ? (<div className="flex items-center gap-3 rounded-lg bg-muted p-3">
              <img src={form.photo} alt="" className="h-14 w-14 rounded-lg object-cover"/>
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, photo: "" })}>
                Remove Photo
              </Button>
            </div>) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Employee" : "Create Employee"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteModalOpen} title="Delete Employee" onClose={() => setDeleteModalOpen(false)} className="max-w-lg">
        {deleteEmployee ? (<form onSubmit={confirmDeleteEmployee} className="grid gap-5">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">This will permanently delete {deleteEmployee.name}.</p>
            <p className="mt-1">Type the employee name below as confirmation.</p>
          </div>
          <Field label="Employee Name Confirmation">
            <Input value={deleteConfirmName} onChange={(event) => setDeleteConfirmName(event.target.value)} placeholder={deleteEmployee.name} required/>
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={deleting || deleteConfirmName.trim() !== deleteEmployee.name.trim()}>
              {deleting ? "Deleting..." : "Delete Employee"}
            </Button>
          </div>
        </form>) : null}
      </Modal>

      <Modal open={salaryModalOpen} title="Employee Salary History" onClose={() => setSalaryModalOpen(false)} className="max-w-5xl">
        {salaryEmployee ? (<div className="grid gap-5">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold">{salaryEmployee.name}</p>
                <p className="text-sm text-muted-foreground">{salaryEmployee.employeeId} · {salaryEmployee.department}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={downloadEmployeeLedger} disabled={employeeSalaryHistory.length === 0}>
                  <Download className="h-4 w-4"/>
                  Download Ledger (Excel)
                </Button>
                {selectedSlip ? (<Link href={`/slips/${selectedSlip._id}`}>
                    <Button>
                      <FileText className="h-4 w-4"/>
                      Download Salary Slip
                    </Button>
                  </Link>) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Month Filter">
              <Select value={salaryFilters.month} onChange={(event) => setSalaryFilters({ ...salaryFilters, month: event.target.value })}>
                <option value="All">All Months</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (<option value={month} key={month}>
                    {monthName(month)}
                  </option>))}
              </Select>
            </Field>
            <Field label="Year Filter">
              <Input type="number" value={salaryFilters.year} onChange={(event) => setSalaryFilters({ ...salaryFilters, year: event.target.value })}/>
            </Field>
          </div>

          {employeeSalaryHistory.length === 0 ? (<EmptyState title="No salary records" description="No salary history matched the selected filters."/>) : salaryFilters.month === "All" ? (<div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-primary/10 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th className="px-4 py-3 font-semibold">Base</th>
                    <th className="px-4 py-3 font-semibold">Present</th>
                    <th className="px-4 py-3 font-semibold">Absent</th>
                    <th className="px-4 py-3 font-semibold">Leaves</th>
                    <th className="px-4 py-3 font-semibold">Bonus</th>
                    <th className="px-4 py-3 font-semibold">Deduction</th>
                    <th className="px-4 py-3 font-semibold">PF</th>
                    <th className="px-4 py-3 font-semibold">Net Salary</th>
                    <th className="px-4 py-3 font-semibold">Paid Date</th>
                    {showSalaryActions ? <th className="px-4 py-3 text-right font-semibold">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employeeSalaryHistory.map((salary) => (<tr key={salary._id} className="hover:bg-primary/5">
                      <td className="px-4 py-3">{monthName(salary.month)} {salary.year}</td>
                      <td className="px-4 py-3">{formatCurrency(salary.baseSalary)}</td>
                      <td className="px-4 py-3">{salary.daysPresent}/{salary.workingDays}</td>
                      <td className="px-4 py-3">{salary.absentDays}</td>
                      <td className="px-4 py-3">{Number(salary.equivalentCLUsed || 0) + Number(salary.excessCL || 0) + Number(salary.emergencyLeave || 0)}</td>
                      <td className="px-4 py-3">{formatCurrency(salary.bonus)}</td>
                      <td className="px-4 py-3">{formatCurrency(salary.totalDeduction)}</td>
                      <td className="px-4 py-3">{formatCurrency(salary.pfAmount)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(salary.netSalary)}</td>
                      <td className="px-4 py-3">{salary.paymentDate ? formatDate(salary.paymentDate) : "Unpaid"}</td>
                      {showSalaryActions ? <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canEditSalary ? <Button variant="danger" size="sm" onClick={() => openSalaryEdit(salary)}>
                            <Edit3 className="h-4 w-4"/>
                            Edit
                          </Button> : null}
                          {canDeleteSalary ? <Button variant="danger" size="sm" onClick={() => openSalaryDelete(salary)}>
                            <Trash2 className="h-4 w-4"/>
                            Delete
                          </Button> : null}
                          <Link className="font-medium text-primary hover:underline" href={`/slips/${salary._id}`}>View</Link>
                        </div>
                      </td> : null}
                    </tr>))}
                </tbody>
              </table>
            </div>) : (<div className="grid gap-4 rounded-xl border border-primary/15 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                  ["Month", `${monthName(employeeSalaryHistory[0].month)} ${employeeSalaryHistory[0].year}`],
                  ["Base Salary", formatCurrency(employeeSalaryHistory[0].baseSalary)],
                  ["Working Days", employeeSalaryHistory[0].workingDays],
                  ["Days Present", employeeSalaryHistory[0].daysPresent],
                  ["Absent Days", employeeSalaryHistory[0].absentDays],
                  ["Casual Leave", employeeSalaryHistory[0].casualLeave],
                  ["Half CL", `${employeeSalaryHistory[0].halfCLTaken || 0} Half Days`],
                  ["Equivalent CL", employeeSalaryHistory[0].equivalentCLUsed || employeeSalaryHistory[0].casualLeave],
                  ["Excess CL", employeeSalaryHistory[0].excessCL],
                  ["Emergency Leave", employeeSalaryHistory[0].emergencyLeave],
                  ["Bonus", formatCurrency(employeeSalaryHistory[0].bonus)],
                  ["Advance Deduction", formatCurrency(employeeSalaryHistory[0].advanceDeduction)],
                  ["School Expense", formatCurrency(employeeSalaryHistory[0].ledgerDeduction || 0)],
                  ["PF Amount", formatCurrency(employeeSalaryHistory[0].pfAmount)],
                  ["Net Salary", formatCurrency(employeeSalaryHistory[0].netSalary)]
                  ].map(([label, value]) => (<div key={label} className="rounded-lg border border-white/45 bg-white/55 p-3 dark:border-white/10 dark:bg-white/10">
                    <p className="text-xs uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>))}
              {showSalaryActions ? <div className="flex items-end gap-2 rounded-lg border border-white/45 bg-white/55 p-3 dark:border-white/10 dark:bg-white/10">
                {canEditSalary ? <Button variant="danger" size="sm" onClick={() => openSalaryEdit(employeeSalaryHistory[0])}>
                  <Edit3 className="h-4 w-4"/>
                  Edit Salary
                </Button> : null}
                {canDeleteSalary ? <Button variant="danger" size="sm" onClick={() => openSalaryDelete(employeeSalaryHistory[0])}>
                  <Trash2 className="h-4 w-4"/>
                  Delete
                </Button> : null}
              </div> : null}
            </div>)}
        </div>) : null}
      </Modal>

      <Modal open={salaryEditOpen} title="Edit Monthly Salary" onClose={() => setSalaryEditOpen(false)} className="max-w-3xl">
        {selectedSalary ? (<form onSubmit={submitSalaryEdit} className="grid gap-5">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <p className="font-semibold">{selectedSalary.employee?.name || salaryEmployee?.name}</p>
            <p className="text-sm text-muted-foreground">{monthName(selectedSalary.month)} {selectedSalary.year} · Password required to save changes</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Base Salary">
              <Input type="number" min="0" value={salaryEditForm.baseSalary} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, baseSalary: event.target.value })}/>
            </Field>
            <Field label="Working Days">
              <Input type="number" min="1" value={salaryEditForm.workingDays} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, workingDays: event.target.value })} required/>
            </Field>
            <Field label="Days Present">
              <Input type="number" min="0" step="any" value={salaryEditForm.daysPresent} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, daysPresent: event.target.value })} required/>
            </Field>
            <Field label="Casual Leave">
              <Input type="number" min="0" max={MAX_CL_PER_REQUEST} step="1" value={salaryEditForm.casualLeave} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, casualLeave: clampClInput(event.target.value) })}/>
            </Field>
            <Field label="1/2 CL">
              <Input type="number" min="0" step="1" value={salaryEditForm.halfCLTaken} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, halfCLTaken: event.target.value })}/>
            </Field>
            <Field label="Excess CL">
              <Input type="number" min="0" value={salaryEditForm.excessCL} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, excessCL: event.target.value })}/>
            </Field>
            <Field label="Emergency Leave">
              <Input type="number" min="0" value={salaryEditForm.emergencyLeave} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, emergencyLeave: event.target.value })}/>
            </Field>
            <Field label="Bonus">
              <Input type="number" min="0" value={salaryEditForm.bonus} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, bonus: event.target.value })}/>
            </Field>
            <Field label="Advance Deduction">
              <Input type="number" min="0" value={salaryEditForm.advanceDeduction} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, advanceDeduction: event.target.value })}/>
            </Field>
            <Field label="PF Amount">
              <Input type="number" min="0" value={salaryEditForm.pfAmount} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, pfAmount: event.target.value })}/>
            </Field>
            <Field label="Status">
              <Select value={salaryEditForm.status} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, status: event.target.value })}>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </Select>
            </Field>
            <Field label="Payment Date">
              <Input type="date" value={salaryEditForm.paymentDate} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, paymentDate: event.target.value })}/>
            </Field>
            <Field label="Login Password">
              <PasswordEntry value={salaryPassword} visible={salaryPasswordVisible} onVisibleChange={setSalaryPasswordVisible} onChange={setSalaryPassword}/>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={salaryEditForm.notes} onChange={(event) => setSalaryEditForm({ ...salaryEditForm, notes: event.target.value })}/>
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setSalaryEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={salarySaving}>{salarySaving ? "Updating..." : "Update Salary"}</Button>
          </div>
        </form>) : null}
      </Modal>

      <Modal open={salaryDeleteOpen} title="Delete Monthly Salary" onClose={() => setSalaryDeleteOpen(false)}>
        {selectedSalary ? (<div className="grid gap-5">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="font-semibold">Delete {monthName(selectedSalary.month)} {selectedSalary.year} salary?</p>
            <p className="mt-1 text-sm text-muted-foreground">This will permanently remove this salary record. Login password is required.</p>
          </div>
          <Field label="Login Password">
            <PasswordEntry value={salaryPassword} visible={salaryPasswordVisible} onVisibleChange={setSalaryPasswordVisible} onChange={setSalaryPassword}/>
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setSalaryDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmSalaryDelete} disabled={!salaryPassword || salarySaving}>
              <Trash2 className="h-4 w-4"/>
              {salarySaving ? "Deleting..." : "Delete Salary"}
            </Button>
          </div>
        </div>) : null}
      </Modal>

      {/* ── Import via Excel Modal ──────────────────── */}
      <Modal open={importModalOpen} title="Import Employees via Excel" onClose={() => setImportModalOpen(false)}>
        <div className="grid gap-5">
          {/* Step 1: Download sample */}
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-semibold mb-1">Step 1: Download Template</p>
            <p className="text-xs text-muted-foreground mb-3">Download the Excel file, fill in employee details, then upload it below.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => downloadEmployeeTemplate(true)}>
                <Download className="h-4 w-4"/>
                Download Blank Excel
              </Button>
              <Button variant="ghost" onClick={() => downloadEmployeeTemplate(false)}>
                <Download className="h-4 w-4"/>
                Download Sample Excel
              </Button>
            </div>
          </div>

          {/* Step 2: Upload file */}
          <div className="rounded-xl border border-border bg-white/30 p-4 dark:bg-white/5">
            <p className="text-sm font-semibold mb-1">Step 2: Upload Filled Excel</p>
            <p className="text-xs text-muted-foreground mb-3">Select a <strong>.xlsx</strong> file with employee data to import.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background text-sm text-muted-foreground hover:border-primary hover:text-primary transition">
                <Upload className="h-4 w-4"/>
                {importFile ? importFile.name : "Choose .xlsx file"}
                <input
                  ref={importFileRef}
                  className="sr-only"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                />
              </label>
              <Button onClick={handleImportUpload} disabled={!importFile || importing}>
                <Upload className="h-4 w-4"/>
                {importing ? "Importing..." : "Upload & Import"}
              </Button>
            </div>
          </div>

          {/* Result feedback */}
          {importResult ? (
            <div className={`rounded-xl border p-4 ${importResult.success ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30" : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {importResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600"/> : <AlertCircle className="h-5 w-5 text-red-600"/>}
                <p className="text-sm font-semibold">{importResult.message}</p>
              </div>
              {importResult.errors?.length > 0 ? (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-white/60 p-2 text-xs dark:bg-black/20">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-red-600 dark:text-red-400">Row {err.row}: {err.reason}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setImportModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </>);
}
function toSalaryEditForm(salary) {
    return {
        baseSalary: String(salary.baseSalary ?? 0),
        workingDays: String(salary.workingDays ?? 1),
        daysPresent: String(salary.daysPresent ?? 0),
        totalCL: String(salary.totalCL ?? ANNUAL_CL_ALLOWANCE),
        casualLeave: String(salary.casualLeave ?? 0),
        halfCLTaken: String(salary.halfCLTaken ?? 0),
        excessCL: String(salary.excessCL ?? 0),
        emergencyLeave: String(salary.emergencyLeave ?? 0),
        bonus: String(salary.bonus ?? 0),
        advanceDeduction: String(salary.advanceDeduction ?? 0),
        pfAmount: String(salary.pfAmount ?? 0),
        status: salary.status === "Paid" ? "Paid" : "Pending",
        paymentDate: salary.paymentDate ? String(salary.paymentDate).slice(0, 10) : "",
        notes: salary.notes || ""
    };
}
function clampClInput(value) {
    const cleaned = String(value).replace(/[^\d.]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? String(Math.min(Math.max(number, 0), MAX_CL_PER_REQUEST)) : "";
}
function PasswordEntry({ value, visible, onVisibleChange, onChange }) {
    return (<div className="relative">
      <Input className="pr-10" type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required/>
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" onClick={() => onVisibleChange(!visible)} aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
      </button>
    </div>);
}
function compareEmployeeNames(first, second) {
    const firstName = String(first?.name || "").trim();
    const secondName = String(second?.name || "").trim();
    const firstStartsWithLetter = /^[a-z]/i.test(firstName);
    const secondStartsWithLetter = /^[a-z]/i.test(secondName);
    if (firstStartsWithLetter !== secondStartsWithLetter)
        return firstStartsWithLetter ? -1 : 1;
    return firstName.localeCompare(secondName, "en", { sensitivity: "base" });
}

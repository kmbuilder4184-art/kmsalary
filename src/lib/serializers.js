export function serializeEmployee(doc, options = {}) {
    if (!doc) return null;
    const bankDetails = doc.bank_details || doc.bankDetails || {};
    return {
        _id: String(doc.id || doc._id),
        id: String(doc.id || doc._id),
        name: String(doc.name || ""),
        fatherOrSpouseName: String(doc.father_or_spouse_name || doc.fatherOrSpouseName || ""),
        employeeId: String(doc.employee_id || doc.employeeId || ""),
        role: String(doc.role || "Staff"),
        department: String(doc.department || ""),
        branch: String(doc.branch || "Branch 1"),
        phone: String(doc.phone || ""),
        email: String(doc.email || ""),
        address: String(doc.address || ""),
        joiningDate: String(doc.joining_date || doc.joiningDate || ""),
        ...(options.includePhoto ? { photo: typeof doc.photo === "string" ? doc.photo : undefined } : {}),
        bankDetails: {
            accountNumber: String(bankDetails.accountNumber || bankDetails.account_number || ""),
            ifscCode: String(bankDetails.ifscCode || bankDetails.ifsc_code || ""),
            esslMachineId: String(bankDetails.esslMachineId || bankDetails.essl_machine_id || "")
        },
        baseSalary: Number(doc.base_salary ?? doc.baseSalary ?? 0),
        status: doc.status === "Inactive" ? "Inactive" : "Active",
        createdAt: toIso(doc.created_at || doc.createdAt),
        updatedAt: toIso(doc.updated_at || doc.updatedAt)
    };
}

export function serializeSalary(doc, options = {}) {
    if (!doc) return null;
    const employeeRaw = doc.employee || doc.employees;
    const employee = employeeRaw && typeof employeeRaw === "object" && (employeeRaw.id || employeeRaw._id)
        ? serializeEmployee(employeeRaw, { includePhoto: options.includeEmployeePhoto })
        : undefined;

    const absenceDeduction = toAmount(doc.absence_deduction ?? doc.absenceDeduction);
    const excessCLDeduction = toAmount(doc.excess_cl_deduction ?? doc.excessCLDeduction);
    const advanceDeduction = toAmount(doc.advance_deduction ?? doc.advanceDeduction);
    const ledgerDeduction = toAmount(doc.ledger_deduction ?? doc.ledgerDeduction);
    const carriedOverAdvance = toAmount(doc.carried_over_advance ?? doc.carriedOverAdvance);
    const totalDeduction = toAmount(doc.total_deduction ?? doc.totalDeduction);
    const pfAmount = resolvePfAmount({
        explicitPfAmount: doc.pf_amount ?? doc.pfAmount,
        totalDeduction,
        absenceDeduction,
        excessCLDeduction,
        advanceDeduction,
        ledgerDeduction,
        carriedOverAdvance
    });

    const totalCL = Number(doc.total_cl ?? doc.totalCL ?? 14);
    const fullCLTaken = Number(doc.casual_leave ?? doc.casualLeave ?? 0);
    const halfCLTaken = Number(doc.half_cl_taken ?? doc.halfCLTaken ?? 0);
    const equivalentCLUsed = round(fullCLTaken + halfCLTaken / 2);

    return {
        _id: String(doc.id || doc._id),
        id: String(doc.id || doc._id),
        employee,
        employeeId: String(doc.employee_code || doc.employeeId || employee?.employeeId || ""),
        month: Number(doc.month || 1),
        year: Number(doc.year || new Date().getFullYear()),
        baseSalary: Number(doc.base_salary ?? doc.baseSalary ?? 0),
        workingDays: Number(doc.working_days ?? doc.workingDays ?? 0),
        daysPresent: Number(doc.days_present ?? doc.daysPresent ?? 0),
        absentDays: Number(doc.absent_days ?? doc.absentDays ?? 0),
        totalCL,
        casualLeave: fullCLTaken,
        fullCLTaken,
        halfCLTaken,
        equivalentCLUsed,
        remainingCL: (doc.remaining_cl ?? doc.remainingCL) != null
            ? round(Number(doc.remaining_cl ?? doc.remainingCL))
            : round(Math.max(totalCL - equivalentCLUsed, 0)),
        excessCL: Number(doc.excess_cl ?? doc.excessCL ?? 0),
        emergencyLeave: Number(doc.emergency_leave ?? doc.emergencyLeave ?? 0),
        bonus: Number(doc.bonus || 0),
        advanceGiven: Number(doc.advance_given ?? doc.advanceGiven ?? 0),
        previousPendingAdvance: Number(doc.previous_pending_advance ?? doc.previousPendingAdvance ?? 0),
        advanceDeduction,
        ledgerDeduction,
        actualLedgerDeduction: Number(doc.actual_ledger_deduction ?? doc.actualLedgerDeduction ?? 0),
        remainingLedgerDeduction: Number(doc.remaining_ledger_deduction ?? doc.remainingLedgerDeduction ?? 0),
        remainingAdvance: Number(doc.remaining_advance ?? doc.remainingAdvance ?? 0),
        carriedOverAdvance,
        unrecoveredAdvance: Number(doc.unrecovered_advance ?? doc.unrecoveredAdvance ?? 0),
        pfAmount,
        absenceDeduction,
        excessCLDeduction,
        totalDeduction,
        netSalary: Number(doc.net_salary ?? doc.netSalary ?? 0),
        perDaySalary: Number(doc.per_day_salary ?? doc.perDaySalary ?? 0),
        status: doc.status === "Paid" ? "Paid" : "Pending",
        paymentDate: doc.payment_date || doc.paymentDate || null,
        salaryEmailSentAt: doc.salary_email_sent_at || doc.salaryEmailSentAt || null,
        salaryEmailSentTo: doc.salary_email_sent_to || doc.salaryEmailSentTo || "",
        notes: doc.notes || "",
        createdAt: toIso(doc.created_at || doc.createdAt),
        updatedAt: toIso(doc.updated_at || doc.updatedAt)
    };
}

export function serializeLedgerEntry(doc, options = {}) {
    if (!doc) return null;
    const employeeRaw = doc.employee || doc.employees;
    const employee = employeeRaw && typeof employeeRaw === "object" && (employeeRaw.id || employeeRaw._id)
        ? serializeEmployee(employeeRaw, { includePhoto: options.includeEmployeePhoto })
        : undefined;

    return {
        _id: String(doc.id || doc._id),
        id: String(doc.id || doc._id),
        employee,
        employeeId: String(doc.employee_code || doc.employeeId || employee?.employeeId || ""),
        amount: Number(doc.amount || 0),
        deductedAmount: Number(doc.deducted_amount ?? doc.deductedAmount ?? 0),
        balanceAmount: Number(doc.balance_amount ?? doc.balanceAmount ?? 0),
        entryDate: String(doc.entry_date || doc.entryDate || ""),
        notes: typeof doc.notes === "string" ? doc.notes : "",
        status: doc.status === "Closed" ? "Closed" : "Open",
        closedAt: typeof (doc.closed_at || doc.closedAt) === "string" ? (doc.closed_at || doc.closedAt) : null,
        createdAt: toIso(doc.created_at || doc.createdAt),
        updatedAt: toIso(doc.updated_at || doc.updatedAt)
    };
}

function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resolvePfAmount({ explicitPfAmount, totalDeduction, absenceDeduction, excessCLDeduction, advanceDeduction, ledgerDeduction = 0, carriedOverAdvance = 0 }) {
    const pfAmount = toAmount(explicitPfAmount);
    if (pfAmount > 0)
        return pfAmount;
    return Math.max(totalDeduction - absenceDeduction - excessCLDeduction - advanceDeduction - ledgerDeduction - carriedOverAdvance, 0);
}

function toAmount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function toIso(value) {
    if (!value)
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

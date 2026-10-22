import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serializeEmployee } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const optionalEmailSchema = z.preprocess(
    (value) => String(value || "").trim(),
    z.string().email().or(z.literal(""))
);

const employeePatchSchema = z.object({
    name: z.string().trim().min(1).optional(),
    fatherOrSpouseName: z.string().optional().or(z.literal("")),
    role: z.string().trim().min(1).optional(),
    department: z.string().optional().or(z.literal("")),
    branch: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: optionalEmailSchema.optional(),
    address: z.string().optional().or(z.literal("")),
    joiningDate: z.string().optional().or(z.literal("")),
    photo: z.string().optional().or(z.literal("")),
    bankDetails: z
        .object({
            accountNumber: z.string().optional().or(z.literal("")).default(""),
            ifscCode: z.string().optional().or(z.literal("")).default(""),
            esslMachineId: z.string().optional().or(z.literal("")).default("")
        })
        .optional(),
    baseSalary: z.coerce.number().min(0).optional(),
    status: z.enum(["Active", "Inactive"]).optional()
});

async function findEmployeeById(supabase, id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabase.from("employees").select("*");
    if (isUuid) {
        query = query.eq("id", id);
    } else {
        query = query.or(`id.eq.${id},employee_id.eq.${id}`);
    }
    const { data } = await query.maybeSingle();
    return data;
}

export async function GET(_, context) {
    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const employee = await findEmployeeById(supabase, id);

    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }

    return NextResponse.json({
        employee: serializeEmployee(employee, { includePhoto: true })
    });
}

export async function PATCH(request, context) {
    const { response } = await requirePermission("employees.edit");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const parsed = employeePatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid employee details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const existing = await findEmployeeById(supabase, id);
    if (!existing) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }

    const data = parsed.data;
    const updatePayload = {};

    if ("name" in data && data.name !== undefined) updatePayload.name = data.name.trim();
    if ("fatherOrSpouseName" in data && data.fatherOrSpouseName !== undefined)
        updatePayload.father_or_spouse_name = data.fatherOrSpouseName?.trim() || "N/A";
    if ("role" in data && data.role !== undefined) updatePayload.role = data.role;
    if ("department" in data && data.department !== undefined)
        updatePayload.department = data.department?.trim() || "General";
    if ("branch" in data && data.branch !== undefined)
        updatePayload.branch = data.branch?.trim() || "Branch 1";
    if ("phone" in data && data.phone !== undefined) updatePayload.phone = data.phone?.trim() || "";
    if ("email" in data && data.email !== undefined) updatePayload.email = data.email?.trim().toLowerCase() || "";
    if ("address" in data && data.address !== undefined) updatePayload.address = data.address?.trim() || "";
    if ("joiningDate" in data && data.joiningDate !== undefined)
        updatePayload.joining_date = data.joiningDate || new Date().toISOString().slice(0, 10);
    if ("photo" in data) updatePayload.photo = data.photo || null;
    if ("baseSalary" in data && data.baseSalary !== undefined) updatePayload.base_salary = Number(data.baseSalary || 0);
    if ("status" in data && data.status !== undefined) updatePayload.status = data.status;

    if (data.bankDetails) {
        const existingBank = existing.bank_details || {};
        updatePayload.bank_details = {
            accountNumber: data.bankDetails.accountNumber !== undefined ? data.bankDetails.accountNumber : (existingBank.accountNumber || ""),
            ifscCode: (data.bankDetails.ifscCode !== undefined ? data.bankDetails.ifscCode : (existingBank.ifscCode || "")).toUpperCase(),
            esslMachineId: data.bankDetails.esslMachineId !== undefined ? data.bankDetails.esslMachineId : (existingBank.esslMachineId || "")
        };
    }

    const { data: updated, error } = await supabase
        .from("employees")
        .update(updatePayload)
        .eq("id", existing.id)
        .select()
        .single();

    if (error) {
        console.error("Error updating employee:", error);
        return NextResponse.json({ message: "Could not update employee", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employee: serializeEmployee(updated) });
}

export async function DELETE(request, context) {
    const { response } = await requirePermission("employees.delete");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const employee = await findEmployeeById(supabase, id);

    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body?.confirmName) {
        const { data: inactiveEmployee } = await supabase
            .from("employees")
            .update({ status: "Inactive" })
            .eq("id", employee.id)
            .select()
            .single();

        return NextResponse.json({
            employee: serializeEmployee(inactiveEmployee || { ...employee, status: "Inactive" }),
            inactive: true
        });
    }

    if (String(body?.confirmName || "").trim() !== String(employee.name || "").trim()) {
        return NextResponse.json({ message: "Employee name confirmation did not match." }, { status: 400 });
    }

    await supabase.from("employees").delete().eq("id", employee.id);
    return NextResponse.json({ employee: serializeEmployee(employee), deleted: true });
}

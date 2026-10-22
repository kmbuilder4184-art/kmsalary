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

const employeeSchema = z.object({
    name: z.string().trim().min(1),
    fatherOrSpouseName: z.string().optional().or(z.literal("")).default(""),
    role: z.string().trim().min(1).default("Staff"),
    department: z.string().optional().or(z.literal("")).default(""),
    branch: z.string().optional().or(z.literal("")).default("Branch 1"),
    phone: z.string().optional().or(z.literal("")),
    email: optionalEmailSchema.default(""),
    address: z.string().optional().or(z.literal("")).default(""),
    joiningDate: z.string().optional().or(z.literal("")).default(""),
    photo: z.string().optional().or(z.literal("")),
    bankDetails: z
        .object({
            accountNumber: z.string().optional().or(z.literal("")).default(""),
            ifscCode: z.string().optional().or(z.literal("")).default(""),
            esslMachineId: z.string().optional().or(z.literal("")).default("")
        })
        .default({ accountNumber: "", ifscCode: "" }),
    baseSalary: z.coerce.number().min(0).default(0),
    status: z.enum(["Active", "Inactive"]).default("Active")
});

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const branch = searchParams.get("branch");
    const includePhoto = searchParams.get("includePhoto") === "1";
    const fields = searchParams.get("fields");

    let query = supabase.from("employees").select("*");

    const targetStatus = status === "Inactive" ? "Inactive" : "Active";
    query = query.eq("status", targetStatus);

    if (branch && branch !== "All") {
        query = query.eq("branch", branch);
    }

    if (search) {
        query = query.or(
            `name.ilike.%${search}%,employee_id.ilike.%${search}%,department.ilike.%${search}%,branch.ilike.%${search}%`
        );
    }

    const { data: employees, error } = await query;

    if (error) {
        console.error("Supabase employee fetch error:", error);
        return NextResponse.json({ message: "Failed to fetch employees", error: error.message }, { status: 500 });
    }

    const sorted = [...(employees || [])].sort(compareEmployeeNames);
    return NextResponse.json({
        employees: sorted.map((emp) => serializeEmployee(emp, { includePhoto }))
    });
}

export async function POST(request) {
    const { response } = await requirePermission("employees.create");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const parsed = employeeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid employee details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const employeeId = await generateEmployeeId();
    const employeeData = withEmployeeDefaults(parsed.data);

    const insertPayload = {
        name: employeeData.name,
        father_or_spouse_name: employeeData.fatherOrSpouseName,
        employee_id: employeeId,
        role: employeeData.role,
        department: employeeData.department,
        branch: employeeData.branch || "Branch 1",
        phone: employeeData.phone,
        email: employeeData.email,
        address: employeeData.address,
        joining_date: employeeData.joiningDate,
        photo: employeeData.photo || null,
        bank_details: {
            accountNumber: employeeData.bankDetails.accountNumber || "",
            ifscCode: (employeeData.bankDetails.ifscCode || "").toUpperCase(),
            esslMachineId: employeeData.bankDetails.esslMachineId || ""
        },
        base_salary: employeeData.baseSalary,
        status: employeeData.status
    };

    const { data: employee, error } = await supabase
        .from("employees")
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        console.error("Error creating employee in Supabase:", error);
        return NextResponse.json({ message: "Could not create employee.", error: error.message }, { status: 500 });
    }

    return NextResponse.json(
        { employee: serializeEmployee(employee) },
        { status: 201 }
    );
}

async function generateEmployeeId() {
    const supabase = getSupabaseAdmin();
    const year = new Date().getFullYear();
    const prefix = `SBI-${year}-`;

    const { data: latest } = await supabase
        .from("employees")
        .select("employee_id")
        .ilike("employee_id", `${prefix}%`)
        .order("employee_id", { ascending: false })
        .limit(1)
        .maybeSingle();

    const lastSequence = latest?.employee_id ? Number(latest.employee_id.split("-").at(-1)) || 0 : 0;
    return `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
}

function withEmployeeDefaults(employee) {
    return {
        ...employee,
        fatherOrSpouseName: employee.fatherOrSpouseName?.trim() || "N/A",
        department: employee.department?.trim() || "General",
        phone: employee.phone?.trim() || "",
        email: employee.email?.trim().toLowerCase() || "",
        address: employee.address?.trim() || "",
        joiningDate: employee.joiningDate || new Date().toISOString().slice(0, 10),
        baseSalary: Number(employee.baseSalary || 0)
    };
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

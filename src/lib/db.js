import { getSupabaseAdmin, supabaseAdmin } from "./supabase";

export async function connectToDatabase() {
    return getSupabaseAdmin();
}

export { supabaseAdmin };
export default getSupabaseAdmin;

import { SalarySlipClient } from "@/components/salary-slip-client";
export default async function SalarySlipPage({ params }) {
    const { id } = await params;
    return <SalarySlipClient id={id}/>;
}

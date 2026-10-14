import { redirect } from "next/navigation";

// Old address; history now lives under /riwayat.
export default async function Pemakaian({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  redirect(date ? `/riwayat/${date}` : "/riwayat");
}

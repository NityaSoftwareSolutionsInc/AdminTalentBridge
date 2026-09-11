import { redirect } from "next/navigation";
import { getPlatformSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getPlatformSession();
  if (!session) redirect("/login");
  redirect("/tenants");
}

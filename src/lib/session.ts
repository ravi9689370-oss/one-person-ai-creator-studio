import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionServerSide(): Promise<unknown> {
  return getServerSession(authOptions);
}

export function getPublicNavTreeSafe(): string[] {
  // Exported for server components; nav tree itself lives in shell components.
  return [];
}

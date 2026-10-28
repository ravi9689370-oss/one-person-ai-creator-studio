import { redirect } from "next/navigation";

/** Alias route so link placeholders to /integrations/status land in one registry view. */
export default function IntegrationsStatusAlias() {
  redirect("/integrations");
}

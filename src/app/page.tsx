import { Workspace } from "@/components/workspace";
import { configured } from "@/lib/server/context";
import { headers } from "next/headers";
import { localStagingAllowed } from "@/lib/server/local-staging";
export const dynamic = "force-dynamic";
export default async function Page() {
  const localStaging = localStagingAllowed(await headers());
  return (
    <Workspace
      localStaging={localStaging}
      demo={
        process.env.DEMO_MODE === "true" &&
        process.env.NODE_ENV !== "production"
      }
      ready={configured()}
    />
  );
}

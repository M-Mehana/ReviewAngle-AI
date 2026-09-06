import { Workspace } from "@/components/workspace";
import { configured } from "@/lib/server/context";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Workspace
      demo={
        process.env.DEMO_MODE === "true" &&
        process.env.NODE_ENV !== "production"
      }
      ready={configured()}
    />
  );
}

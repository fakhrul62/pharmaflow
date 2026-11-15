import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setBusinessTimezone, type Snapshot, type Entity } from "./api";
const WorkspaceContext = createContext<{
  data: Snapshot;
  refresh: () => Promise<void>;
} | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const snapshot = await api<Snapshot>("/bootstrap");
      setBusinessTimezone(snapshot.settings.timezone);
      return snapshot;
    },
    staleTime: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const client = useQueryClient();
  if (query.isPending)
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <h2>Opening your workspace</h2>
        <p>Bringing your pharmacy up to date…</p>
      </div>
    );
  if (query.isError)
    return (
      <div className="loading-screen">
        <h2>We couldn’t load your workspace</h2>
        <p>{query.error.message}</p>
        <button className="btn primary" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        data: query.data,
        refresh: async () => {
          await client.invalidateQueries({ queryKey: ["workspace"] });
        },
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export const useWorkspace = () => {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace provider required");
  return value;
};
export const useResources = (name: string): Entity[] =>
  useWorkspace().data.resources[name] || [];

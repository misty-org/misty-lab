import { usePersonalAgentsStore } from "../personal/personal_agents_store";

export function agentTag(agentId: string): { id: string; name: string } {
  const profile = usePersonalAgentsStore.getState().agents.find((agent) => agent.id === agentId);
  return { id: agentId, name: profile?.name || "Agent" };
}

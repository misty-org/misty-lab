import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AgentProfile } from "@/shared/schemas";
import { useAgentAccountId } from "../personal/agentAccount";
import { homeSpaceOf } from "../personal/agentHomeSpace";
import { useMistyStore } from "../conversations/state/useMistyStore";

export function LabInSpace({ agent }: { agent: AgentProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const accountId = useAgentAccountId();
  const spaceId = homeSpaceOf(accountId, agent);
  useEffect(() => {
    if (!spaceId) return;
    useMistyStore.setState({ selectedAgentId: agent.id });
    const params = new URLSearchParams(location.search);
    const kept = new URLSearchParams();
    for (const key of ["item", "doc"]) {
      const value = params.get(key);
      if (value) kept.set(key, value);
    }
    const query = kept.toString();
    navigate(`/spaces/${encodeURIComponent(spaceId)}/lab${query ? `?${query}` : ""}`, {
      replace: true,
    });
  }, [spaceId, agent.id, location.search, navigate]);
  return null;
}

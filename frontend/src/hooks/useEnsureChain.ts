"use client";

import { useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { TARGET_CHAIN_ID } from "@/config/chains";

/**
 * Ensures the wallet is on the target chain before write operations.
 * Returns a function that switches chain if needed; resolves when ready.
 */
export function useEnsureChain() {
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const ensureChain = useCallback(async () => {
    if (chain?.id === TARGET_CHAIN_ID) return;
    await switchChainAsync({ chainId: TARGET_CHAIN_ID });
  }, [chain?.id, switchChainAsync]);

  return { ensureChain, isCorrectChain: chain?.id === TARGET_CHAIN_ID };
}

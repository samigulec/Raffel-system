"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function short(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="btn" onClick={() => disconnect()} title="Disconnect">
        {short(address)}
      </button>
    );
  }

  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <button
      className="btn btn-primary"
      onClick={() => injected && connect({ connector: injected })}
      disabled={isPending || !injected}
    >
      {isPending ? <span className="spinner mr-2" /> : null}
      Connect Wallet
    </button>
  );
}

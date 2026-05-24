"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ArrowRightOnRectangleIcon, WalletIcon } from "@heroicons/react/24/outline";

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
      <button
        className="btn font-mono tabular-nums"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        <span className="text-primary">{short(address)}</span>
        <ArrowRightOnRectangleIcon className="h-3.5 w-3.5 ml-2 text-tertiary" aria-hidden />
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
      {isPending ? (
        <span className="spinner mr-2" />
      ) : (
        <WalletIcon className="h-3.5 w-3.5 mr-2" aria-hidden />
      )}
      Connect Wallet
    </button>
  );
}

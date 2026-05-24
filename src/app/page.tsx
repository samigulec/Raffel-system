import { ConnectButton } from "@/components/ConnectButton";
import { StepsCard } from "@/components/StepsCard";

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-b from-cyan-400 to-sky-500" />
          <span className="text-lg font-semibold tracking-tight">Raffel</span>
        </div>
        <ConnectButton />
      </nav>

      <div className="flex-1 grid place-items-center px-4 py-8">
        <StepsCard />
      </div>

      <footer className="px-6 py-6 text-center text-xs text-slate-500">
        Built on Base · Faucet Badge verification
      </footer>
    </main>
  );
}

import { ConnectButton } from "@/components/ConnectButton";
import { StepsCard } from "@/components/StepsCard";

export default function Page() {
  return (
    <main className="min-h-screen bg-page bg-texture flex flex-col">
      <nav className="w-full px-6 py-4 flex items-center justify-end">
        <ConnectButton />
      </nav>

      <div className="flex-1 grid place-items-center px-4 py-8">
        <StepsCard />
      </div>
    </main>
  );
}

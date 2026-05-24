"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { CheckIcon, ExternalIcon } from "./ExternalIcon";
import { countCompleted, loadProgress, saveProgress, type Progress } from "@/lib/progress";
import { checkGm, GM_CONTRACT } from "@/lib/gm";

const X_URL = "https://x.com/intent/follow?screen_name=raffel";
const DISCORD_URL = "https://discord.gg/raffel";
const HEY_URL = "https://hey.xyz/u/raffel";
const GM_MINT_URL = "https://www.onchaingm.com/";

type StepKey = keyof Progress;

type LinkStep = {
  kind: "link";
  key: StepKey;
  label: string;
  url: string;
};

type CheckStep = {
  kind: "check";
  key: StepKey;
  label: string;
  subtitle: string;
  url: string;
};

type Step = LinkStep | CheckStep;

const STEPS: Step[] = [
  { kind: "link", key: "followX", label: "Follow on X", url: X_URL },
  { kind: "link", key: "joinDiscord", label: "Join Discord", url: DISCORD_URL },
  { kind: "link", key: "followHey", label: "Follow on Hey", url: HEY_URL },
  {
    kind: "check",
    key: "gm",
    label: "OnChainGM Faucet Badge (Base)",
    subtitle: "Mint the Faucet Badge on Base",
    url: GM_MINT_URL,
  },
];

export function StepsCard() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const [progress, setProgress] = useState<Progress>({
    followX: false,
    joinDiscord: false,
    followHey: false,
    gm: false,
  });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setProgress(loadProgress(address));
    setError(null);
    setInfo(null);
  }, [address]);

  const done = useMemo(() => countCompleted(progress), [progress]);
  const allDone = done === STEPS.length;

  function complete(key: StepKey) {
    setProgress((prev) => {
      const next = { ...prev, [key]: true };
      saveProgress(address, next);
      return next;
    });
  }

  function openLinkStep(step: LinkStep) {
    window.open(step.url, "_blank", "noopener,noreferrer");
    // auto-clear after a few seconds (matches Faucet Badge mint page UX)
    setTimeout(() => complete(step.key), 4000);
  }

  async function runCheck() {
    if (!client || !address) return;
    setChecking(true);
    setError(null);
    setInfo(null);
    try {
      const res = await checkGm(client, address);
      if (res.ok) {
        complete("gm");
        setInfo(`Verified via ${res.method}.`);
      } else {
        setError(
          res.method === "error"
            ? `Check failed: ${res.detail}`
            : "No gm found yet. Mint the Faucet Badge first, then press CHECK.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="w-full max-w-[640px] rounded-2xl card-glow bg-[rgba(13,22,48,0.78)] backdrop-blur p-6 sm:p-7">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-b from-cyan-400 to-sky-500 grid place-items-center text-[#001018] font-bold">
            1
          </div>
          <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight">
            Complete all 4 steps
          </h2>
        </div>
        <div className="text-sm text-slate-300/80 pt-2">
          Steps <span className="text-slate-100 font-semibold">{done}/{STEPS.length}</span>
        </div>
      </header>

      <p className="text-[14px] text-slate-300/85 leading-relaxed">
        Follow the steps in order. Progress is saved per wallet and matches the Faucet Badge mint page.
      </p>
      <p className="text-[13px] text-slate-400/85 mt-1 leading-relaxed">
        Opening a step launches a new tab; each step clears automatically after a few seconds.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {STEPS.map((step, idx) => {
          const completed = progress[step.key];
          return (
            <div
              key={step.key}
              className="step-row rounded-xl px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-4"
            >
              <div
                className={`step-num w-9 h-9 rounded-full grid place-items-center text-[13px] font-semibold text-slate-300 shrink-0 ${
                  completed ? "done" : ""
                }`}
              >
                {completed ? <CheckIcon /> : idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[15px] sm:text-[16px] font-medium text-slate-100 truncate">
                    {step.label}
                  </div>

                  {step.kind === "check" ? (
                    <button
                      className="btn"
                      onClick={runCheck}
                      disabled={!isConnected || checking || completed}
                    >
                      {checking ? <span className="spinner mr-2" /> : null}
                      {completed ? "Verified" : "Check"}
                    </button>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => openLinkStep(step)}
                      disabled={completed}
                      aria-label={`Open ${step.label} in a new tab`}
                      title="Open in new tab"
                    >
                      <ExternalIcon />
                    </button>
                  )}
                </div>

                {step.kind === "check" ? (
                  <a
                    className="inline-flex items-center gap-1 text-[13px] mt-1 text-cyan-300 hover:text-cyan-200"
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {step.subtitle}
                    <ExternalIcon className="opacity-80" />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 min-h-[20px] text-[13px]">
        {!isConnected ? (
          <span className="text-slate-400">Connect your wallet to enable the Faucet Badge check.</span>
        ) : error ? (
          <span className="text-rose-300">{error}</span>
        ) : info ? (
          <span className="text-emerald-300">{info}</span>
        ) : allDone ? (
          <span className="text-emerald-300">All steps done — you’re approved.</span>
        ) : (
          <span className="text-slate-400">
            Verifying against contract{" "}
            <code className="text-slate-300">{GM_CONTRACT.slice(0, 6)}…{GM_CONTRACT.slice(-4)}</code> on Base.
          </span>
        )}
      </div>
    </section>
  );
}

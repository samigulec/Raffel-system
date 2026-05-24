"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { CheckIcon, ExternalIcon } from "./ExternalIcon";
import {
  countCompleted,
  loadProgress,
  loadSubmission,
  saveProgress,
  saveSubmission,
  TOTAL_STEPS,
  type Progress,
} from "@/lib/progress";
import { checkGm, verifyByTxHash } from "@/lib/gm";
import { GM_CONTRACT, LINKS } from "@/lib/config";

type StepKey = keyof Progress;

type LinkStep = {
  kind: "link";
  key: StepKey;
  label: string;
  url: string;
  subtitle?: string;
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
  { kind: "link", key: "followOnchainGm", label: "Follow OnChainGM on X", url: LINKS.followOnchainGm },
  { kind: "link", key: "followBlobsters", label: "Follow Blobsters on X", url: LINKS.followBlobsters },
  { kind: "link", key: "likeTweet", label: "Like the tweet", url: LINKS.likeTweet },
  { kind: "link", key: "commentTweet", label: "Comment on the tweet", url: LINKS.commentTweet },
  {
    kind: "check",
    key: "gm",
    label: "Send gm on Ethereum",
    subtitle: "Send gm via the OnChainGM contract on ETH mainnet",
    url: LINKS.gmDapp,
  },
];

function isValidXHandle(value: string) {
  const trimmed = value.replace(/^@/, "").trim();
  return /^[A-Za-z0-9_]{1,15}$/.test(trimmed);
}

export function StepsCard() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const [progress, setProgress] = useState<Progress>({
    followOnchainGm: false,
    followBlobsters: false,
    likeTweet: false,
    commentTweet: false,
    gm: false,
  });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [txHash, setTxHash] = useState("");
  const [verifyingTx, setVerifyingTx] = useState(false);

  const [xUsername, setXUsername] = useState("");
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setProgress(loadProgress(address));
    const existing = loadSubmission(address);
    setXUsername(existing?.xUsername ?? "");
    setTxHash("");
    setError(null);
    setInfo(null);
    setSubmitInfo(null);
    setSubmitError(null);
  }, [address]);

  const done = useMemo(() => countCompleted(progress), [progress]);
  const allDone = done === TOTAL_STEPS;

  function complete(key: StepKey) {
    setProgress((prev) => {
      const next = { ...prev, [key]: true };
      saveProgress(address, next);
      return next;
    });
  }

  function openLinkStep(step: LinkStep) {
    window.open(step.url, "_blank", "noopener,noreferrer");
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
            : "Auto-check couldn't find a gm. If you just sent one, paste the tx hash below to verify.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function runVerifyByHash() {
    if (!client || !address) return;
    setVerifyingTx(true);
    setError(null);
    setInfo(null);
    try {
      const res = await verifyByTxHash(client, address, txHash.trim());
      if (res.ok) {
        complete("gm");
        setInfo(`Verified by tx ${res.detail?.slice(0, 10)}…`);
        setTxHash("");
      } else {
        setError(res.detail ?? "Tx hash verification failed.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifyingTx(false);
    }
  }

  function submitEntry() {
    setSubmitError(null);
    setSubmitInfo(null);
    if (!isConnected || !address) {
      setSubmitError("Connect your wallet first.");
      return;
    }
    if (!isValidXHandle(xUsername)) {
      setSubmitError("Enter a valid X username (letters, numbers, _, max 15).");
      return;
    }
    if (!allDone) {
      setSubmitError(`Finish all ${TOTAL_STEPS} steps before submitting.`);
      return;
    }
    const submission = {
      xUsername: xUsername.replace(/^@/, "").trim(),
      wallet: address,
      submittedAt: Date.now(),
    };
    saveSubmission(address, submission);
    setSubmitInfo(`Saved — @${submission.xUsername} · ${short(address)}`);
  }

  return (
    <section className="w-full max-w-[640px] rounded-2xl card-glow bg-[rgba(13,22,48,0.78)] backdrop-blur p-6 sm:p-7">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-b from-cyan-400 to-sky-500 grid place-items-center text-[#001018] font-bold">
            1
          </div>
          <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight">
            Complete all {TOTAL_STEPS} steps
          </h2>
        </div>
        <div className="text-sm text-slate-300/80 pt-2">
          Steps <span className="text-slate-100 font-semibold">{done}/{TOTAL_STEPS}</span>
        </div>
      </header>

      <p className="text-[14px] text-slate-300/85 leading-relaxed">
        Follow the steps in order. Progress is saved per wallet.
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
          <span className="text-slate-400">Connect your wallet to enable the gm check.</span>
        ) : error ? (
          <span className="text-rose-300">{error}</span>
        ) : info ? (
          <span className="text-emerald-300">{info}</span>
        ) : allDone ? (
          <span className="text-emerald-300">All steps done — fill in your X handle below to submit.</span>
        ) : (
          <span className="text-slate-400">
            Verifying against contract{" "}
            <code className="text-slate-300">{GM_CONTRACT.slice(0, 6)}…{GM_CONTRACT.slice(-4)}</code> on Ethereum.
          </span>
        )}
      </div>

      {isConnected && !progress.gm ? (
        <div className="mt-3 rounded-xl bg-[rgba(8,14,32,0.5)] border border-white/5 p-3 sm:p-4">
          <div className="text-[12px] uppercase tracking-wider text-slate-400 mb-2">
            Verify by tx hash (fallback)
          </div>
          <div className="flex items-center gap-2">
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x… your gm transaction hash on Ethereum"
              spellCheck={false}
              autoCapitalize="off"
              className="flex-1 bg-[rgba(8,14,32,0.7)] border border-white/10 rounded-md px-3 h-10 text-[13px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400/60"
            />
            <button
              className="btn"
              onClick={runVerifyByHash}
              disabled={!txHash.trim() || verifyingTx}
            >
              {verifyingTx ? <span className="spinner mr-2" /> : null}
              Verify
            </button>
          </div>
          <p className="text-[12px] text-slate-500 mt-2 leading-snug">
            Paste the hash of your gm tx — we’ll confirm it succeeded, was sent from this
            wallet, and targeted the gm contract.
          </p>
        </div>
      ) : null}

      <div className="mt-6 pt-5 border-t border-white/5">
        <h3 className="text-[15px] font-semibold text-slate-100 mb-3">Submit your entry</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] uppercase tracking-wider text-slate-400">X username</span>
            <div className="flex items-center bg-[rgba(8,14,32,0.7)] border border-white/10 rounded-md px-3 h-10 focus-within:border-cyan-400/60">
              <span className="text-slate-500 mr-1">@</span>
              <input
                value={xUsername}
                onChange={(e) => setXUsername(e.target.value)}
                placeholder="yourhandle"
                spellCheck={false}
                autoCapitalize="off"
                className="w-full bg-transparent outline-none text-[14px] text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] uppercase tracking-wider text-slate-400">Wallet address</span>
            <div className="flex items-center bg-[rgba(8,14,32,0.7)] border border-white/10 rounded-md px-3 h-10">
              <input
                value={address ?? ""}
                readOnly
                placeholder="Connect wallet…"
                className="w-full bg-transparent outline-none text-[14px] text-slate-300 placeholder:text-slate-500"
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[12px] min-h-[18px]">
            {submitError ? (
              <span className="text-rose-300">{submitError}</span>
            ) : submitInfo ? (
              <span className="text-emerald-300">{submitInfo}</span>
            ) : (
              <span className="text-slate-500">Stored locally per wallet.</span>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={submitEntry}
            disabled={!isConnected || !allDone}
          >
            Submit
          </button>
        </div>
      </div>
    </section>
  );
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

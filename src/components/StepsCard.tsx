"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  EllipsisHorizontalCircleIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
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
import { buildSubmissionMessage } from "@/lib/submission";

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
  { kind: "link", key: "followOnchainGm", label: "Follow OnChainGM on X", url: LINKS.followOnchainGm },
  { kind: "link", key: "followBlobsters", label: "Follow Blobsters on X", url: LINKS.followBlobsters },
  { kind: "link", key: "likeTweet", label: "Like the tweet", url: LINKS.likeTweet },
  { kind: "link", key: "commentTweet", label: "Comment on the tweet", url: LINKS.commentTweet },
  {
    kind: "check",
    key: "gm",
    label: "Send gm on Ethereum (today)",
    subtitle: "Send a fresh gm today",
    url: LINKS.gmDapp,
  },
];

const PANEL_CLASSES =
  "flex flex-col rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-4 dark:border-gray-700 dark:bg-gray-800 dark:shadow-[0_12px_36px_-20px_rgba(0,0,0,0.45)] dark:backdrop-blur-none";

function isValidXHandle(value: string) {
  const trimmed = value.replace(/^@/, "").trim();
  return /^[A-Za-z0-9_]{1,15}$/.test(trimmed);
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function StepsCard() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const { signMessageAsync } = useSignMessage();

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
  const [submitting, setSubmitting] = useState(false);

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
            : res.detail ??
                "No gm found from today (after 00:00 UTC). Send a fresh gm and retry, or paste the tx hash below.",
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

  async function submitEntry() {
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

    const handle = xUsername.replace(/^@/, "").trim();
    const issuedAt = Date.now();
    const message = buildSubmissionMessage({
      wallet: address,
      xUsername: handle,
      issuedAt,
    });

    setSubmitting(true);
    try {
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          xUsername: handle,
          issuedAt,
          signature,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? `Submit failed (${res.status}).`);
        return;
      }
      saveSubmission(address, {
        xUsername: handle,
        wallet: address,
        submittedAt: issuedAt,
      });
      setSubmitInfo(`Sent. @${handle} · ${short(address)}`);
    } catch (err) {
      const message = (err as Error).message ?? "Unknown error";
      if (/User (rejected|denied)/i.test(message)) {
        setSubmitError("Signature cancelled.");
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`w-full max-w-[560px] ${PANEL_CLASSES}`}>
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-heading text-base font-semibold tracking-tight text-primary">
          Complete all {TOTAL_STEPS} steps
        </h2>
        <div className="text-xs font-medium text-secondary">
          Steps{" "}
          <span className="font-mono tabular-nums text-primary">
            {done}/{TOTAL_STEPS}
          </span>
        </div>
      </header>

      <p className="text-xs text-secondary leading-relaxed">
        Follow the steps in order. Progress is saved per wallet.
      </p>
      <p className="text-[11px] text-tertiary mt-0.5 leading-relaxed">
        Opening a step launches a new tab; each step clears automatically after a few seconds.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {STEPS.map((step) => {
          const completed = progress[step.key];
          return (
            <div
              key={step.key}
              className={
                "rounded-lg border p-3 flex items-center gap-3 transition-colors " +
                (completed
                  ? "border-green-200 bg-green-50/80 dark:border-green-800/50 dark:bg-green-900/20"
                  : "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/95")
              }
            >
              <div
                className={
                  "h-5 w-5 rounded-full grid place-items-center shrink-0 " +
                  (completed
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-slate-200 dark:bg-slate-600")
                }
                aria-hidden
              >
                {completed ? (
                  <CheckCircleIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                ) : (
                  <EllipsisHorizontalCircleIcon className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={
                      "text-xs font-medium truncate " +
                      (completed
                        ? "text-emerald-700 dark:text-green-300"
                        : "text-primary")
                    }
                  >
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
                      className="btn btn-icon"
                      onClick={() => openLinkStep(step)}
                      disabled={completed}
                      aria-label={`Open ${step.label} in a new tab`}
                      title="Open in new tab"
                    >
                      <ArrowTopRightOnSquareIcon className="h-3 w-3 text-tertiary" />
                    </button>
                  )}
                </div>

                {step.kind === "check" ? (
                  <a
                    className="inline-flex items-center gap-1 text-[11px] mt-1 text-brand-primary hover:text-brand-primary-400"
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {step.subtitle}
                    <ArrowTopRightOnSquareIcon className="h-3 w-3 opacity-80" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 min-h-[18px] text-[11px]">
        {!isConnected ? (
          <span className="text-tertiary">Connect your wallet to enable the gm check.</span>
        ) : error ? (
          <span className="text-rose-400 dark:text-rose-300">{error}</span>
        ) : info ? (
          <span className="text-emerald-600 dark:text-emerald-400">{info}</span>
        ) : allDone ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            All steps done.
          </span>
        ) : (
          <span className="text-tertiary">
            Verifying against contract{" "}
            <code className="font-mono tabular-nums text-secondary">
              {GM_CONTRACT.slice(0, 6)}…{GM_CONTRACT.slice(-4)}
            </code>{" "}
            on Ethereum.
          </span>
        )}
      </div>

      {isConnected && !progress.gm ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="text-[10px] font-medium uppercase tracking-wider text-tertiary mb-2">
            Verify by tx hash (fallback)
          </div>
          <div className="flex items-center gap-2">
            <div className="input flex-1">
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x… your gm transaction hash on Ethereum"
                spellCheck={false}
                autoCapitalize="off"
                className="font-mono"
              />
            </div>
            <button
              className="btn"
              onClick={runVerifyByHash}
              disabled={!txHash.trim() || verifyingTx}
            >
              {verifyingTx ? <span className="spinner mr-2" /> : null}
              Verify
            </button>
          </div>
          <p className="text-[11px] text-tertiary mt-2 leading-snug">
            Paste the hash of your gm tx.
          </p>
        </div>
      ) : null}

      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/60">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-primary mb-3">
          Submit your entry
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-tertiary">
              X username
            </span>
            <div className="input">
              <span className="text-tertiary mr-1">@</span>
              <input
                value={xUsername}
                onChange={(e) => setXUsername(e.target.value)}
                placeholder="yourhandle"
                spellCheck={false}
                autoCapitalize="off"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-tertiary">
              Wallet address
            </span>
            <div className="input">
              <input
                value={address ?? ""}
                readOnly
                placeholder="Connect wallet…"
                className="font-mono tabular-nums"
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[11px] min-h-[16px]">
            {submitError ? (
              <span className="text-rose-400 dark:text-rose-300">{submitError}</span>
            ) : submitInfo ? (
              <span className="text-emerald-600 dark:text-emerald-400">{submitInfo}</span>
            ) : (
              <span className="text-tertiary">Sign a message to confirm ownership.</span>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={submitEntry}
            disabled={!isConnected || !allDone || submitting}
          >
            {submitting ? (
              <span className="spinner mr-2" />
            ) : (
              <TrophyIcon className="h-3.5 w-3.5 mr-2" aria-hidden />
            )}
            <span className="text-sm font-semibold">
              {submitting ? "Submitting…" : "Submit"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

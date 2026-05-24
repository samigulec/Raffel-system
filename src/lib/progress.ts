export type Progress = {
  followOnchainGm: boolean;
  followBlobsters: boolean;
  likeTweet: boolean;
  commentTweet: boolean;
  gm: boolean;
};

export type Submission = {
  xUsername: string;
  wallet: string;
  submittedAt: number;
};

const EMPTY: Progress = {
  followOnchainGm: false,
  followBlobsters: false,
  likeTweet: false,
  commentTweet: false,
  gm: false,
};

function progressKey(address: string) {
  return `raffel:progress:${address.toLowerCase()}`;
}

function submissionKey(address: string) {
  return `raffel:submission:${address.toLowerCase()}`;
}

export function loadProgress(address: string | undefined): Progress {
  if (!address || typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(progressKey(address));
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Progress) };
  } catch {
    return EMPTY;
  }
}

export function saveProgress(address: string | undefined, progress: Progress) {
  if (!address || typeof window === "undefined") return;
  try {
    localStorage.setItem(progressKey(address), JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function loadSubmission(address: string | undefined): Submission | null {
  if (!address || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(submissionKey(address));
    return raw ? (JSON.parse(raw) as Submission) : null;
  } catch {
    return null;
  }
}

export function saveSubmission(address: string | undefined, submission: Submission) {
  if (!address || typeof window === "undefined") return;
  try {
    localStorage.setItem(submissionKey(address), JSON.stringify(submission));
  } catch {
    // ignore
  }
}

export function countCompleted(p: Progress): number {
  return Object.values(p).filter(Boolean).length;
}

export const TOTAL_STEPS = 5;

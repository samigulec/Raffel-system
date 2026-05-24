export type Progress = {
  followX: boolean;
  joinDiscord: boolean;
  followHey: boolean;
  gm: boolean;
};

const EMPTY: Progress = {
  followX: false,
  joinDiscord: false,
  followHey: false,
  gm: false,
};

function key(address: string) {
  return `raffel:progress:${address.toLowerCase()}`;
}

export function loadProgress(address: string | undefined): Progress {
  if (!address || typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(key(address));
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Progress) };
  } catch {
    return EMPTY;
  }
}

export function saveProgress(address: string | undefined, progress: Progress) {
  if (!address || typeof window === "undefined") return;
  try {
    localStorage.setItem(key(address), JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function countCompleted(p: Progress): number {
  return (p.followX ? 1 : 0) + (p.joinDiscord ? 1 : 0) + (p.followHey ? 1 : 0) + (p.gm ? 1 : 0);
}

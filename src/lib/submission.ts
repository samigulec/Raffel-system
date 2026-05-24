export function buildSubmissionMessage(params: {
  wallet: string;
  xUsername: string;
  issuedAt: number;
}): string {
  return [
    "Raffel entry signature",
    `Wallet: ${params.wallet}`,
    `X: @${params.xUsername.replace(/^@/, "")}`,
    `Issued: ${new Date(params.issuedAt).toISOString()}`,
  ].join("\n");
}

export const SIGNATURE_TTL_MS = 10 * 60 * 1000;

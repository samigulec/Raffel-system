import { fallback, http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [mainnet.id]: fallback([
      http("https://eth.llamarpc.com"),
      http("https://ethereum-rpc.publicnode.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://cloudflare-eth.com"),
    ]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

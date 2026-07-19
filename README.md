# wq

Wrapped Q (WQ), the wrapped native coin of the QuantumCoin blockchain - equivalent of WETH on Ethereum.

Fork of WETH9, adapted for QuantumCoin: Solidity 0.7.6, 32-byte addresses, `withdraw` pays out via
`call` instead of `transfer`, and granular revert codes (`WQ:a1`..`WQ:a3`).

# Local Development

Requires `node@>=18`. The contract is compiled with the
[`@quantumcoin/solc`](https://www.npmjs.com/package/@quantumcoin/solc) npm package
(QuantumCoin's Solidity 0.7.6 with 32-byte address support).

## Install Dependencies

`npm install`

## Compile

`npm run compile`

## Run Tests

`npm test`

Tests run against a local QuantumCoin devnet using the `quantumcoin` SDK. The devnet is
downloaded, installed, and started automatically by `scripts/devnet.js` (Windows, macOS, and
Ubuntu). Overrides: `QC_RPC_URL`, `QC_DEVNET_DIR`, `QC_KEYSTORE`, `QC_KEY_PASSWORD`.

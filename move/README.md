# RiskPilot Strategy Receipt

Optional Sui mainnet receipt package for recording a user's RiskPilot strategy decision after the web app prepares or executes a strategy.

This package is intentionally not required for the web demo. The app remains fully usable without Sui CLI, a published package ID, or gas funds.

## Published Mainnet Package

The current hackathon demo package has been published to Sui mainnet:

```text
Package ID: 0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19
Publish tx: 8wM83UcqYzic71d84KsXpJLxGpMbZzCvqL7R9CEBwZi
UpgradeCap: 0x51f426600cde9474e5b096cb42b0df15c64a4de556b6cd3e1acfb963745b8df8
```

## Mainnet-Only Build And Publish

Install and configure Sui CLI before using this package:

```bash
sui --version
sui client envs
sui client switch --env mainnet
sui move build --path move
```

Publish only when the team is ready to spend mainnet gas:

```bash
sui client publish move --gas-budget 50000000
```

After publish, store the package ID as a future app env var such as:

```bash
NEXT_PUBLIC_RECEIPT_PACKAGE_ID=0x...
```

No testnet, devnet, or localnet path is part of the RiskPilot product flow.

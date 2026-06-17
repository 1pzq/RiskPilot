# RiskPilot On-Chain Authority

Optional Sui mainnet package for anchoring RiskPilot's bounded agent authority and recording a user's strategy decision after the web app archives a prepared strategy.

The package contains two modules:

- `strategy_receipt`: existing receipt mint for post-archive proof.
- `agent_policy`: new AgentPolicy object that carries the visible Sui authority boundary for Observe -> Plan -> Verify Policy -> Act -> Remember.

Minting a policy or receipt is an explicit wallet-signed action. It does not mean RiskPilot auto-executed a trade, and it does not change the app's default `prepare_mainnet` posture.

This package is intentionally not required for the no-wallet proof rail. The app remains usable without Sui CLI, a published package ID, or gas funds.

## Published Mainnet Package

The current hackathon package has been published to Sui mainnet with both `agent_policy` and `strategy_receipt` modules:

```text
Package ID: 0x24972ef5274a577127dc871687e4bfe4bb4d512d810c025cbe01d87ca621c2d7
Publish tx: sgoT9HA2bFSUmX3Smx7L4zkianb5UQbVJJE7eMcg5se
UpgradeCap: 0xd2b3e7db4b29ec48a23eedbe9854881d79afa9e9a6c871270efe70e0bfc8ec79
```

Policy object mint smoke passed on mainnet:

```text
AgentPolicy object: 0xf71d26a3f7f72bb0185e787d1857529765c1a59155195281f3b31ada1f923f87
Mint tx: 6tPgwgKnYjHSZV4n6dd4p7jucRGLdGySEdVFK2HD82LQ
Owner: 0x69bb839c43b5062487b00b5efa10c6d4914e2036a8c71cea8ce92002e12a8508
Allowed market: SUI/USDC
Allowed assets: SUI, USDC
Max budget: 5 USD
Manual approval: true
Revoked: false
```

## AgentPolicy Entry Points

```text
create_policy(allowed_markets, allowed_assets, max_budget_usd_micros, max_single_trade_usd_micros, expires_at_ms, requires_manual_approval, clock)
update_policy(policy, allowed_markets, allowed_assets, max_budget_usd_micros, max_single_trade_usd_micros, expires_at_ms, requires_manual_approval, clock)
revoke_policy(policy, clock)
record_strategy_receipt(policy, strategy_id, audit_blob_id, execution_digest, clock)
```

The web app keeps its app/server policy gate as a shadow check, but the judge-facing authority boundary is the selected `AgentPolicy` object.

## Mainnet-Only Build And Publish

Install and configure Sui CLI before using this package:

```bash
sui --version
sui client envs
sui client switch --env mainnet
sui move build --path move
```

`Move.toml` pins the Sui framework dependency by git revision so local builds do not depend on the CLI's implicit environment update path.

Publish only when the team is ready to spend mainnet gas:

```bash
sui client publish move --gas-budget 50000000
```

After publish, store the package ID as a future app env var such as:

```bash
NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID=0x24972ef5274a577127dc871687e4bfe4bb4d512d810c025cbe01d87ca621c2d7
NEXT_PUBLIC_RECEIPT_PACKAGE_ID=0x24972ef5274a577127dc871687e4bfe4bb4d512d810c025cbe01d87ca621c2d7
```

No testnet, devnet, or localnet path is part of the RiskPilot product flow.

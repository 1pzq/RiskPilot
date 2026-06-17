module riskpilot_receipt::agent_policy {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const E_NOT_OWNER: u64 = 1;
    const E_REVOKED: u64 = 2;

    public struct AgentPolicy has key, store {
        id: UID,
        owner: address,
        allowed_markets: vector<String>,
        allowed_assets: vector<String>,
        max_budget_usd_micros: u64,
        max_single_trade_usd_micros: u64,
        expires_at_ms: u64,
        requires_manual_approval: bool,
        revoked: bool,
        created_at_ms: u64,
        updated_at_ms: u64,
    }

    public struct PolicyReceipt has key, store {
        id: UID,
        owner: address,
        policy_id: address,
        strategy_id: String,
        audit_blob_id: String,
        execution_digest: String,
        created_at_ms: u64,
    }

    entry fun create_policy(
        allowed_markets: vector<String>,
        allowed_assets: vector<String>,
        max_budget_usd_micros: u64,
        max_single_trade_usd_micros: u64,
        expires_at_ms: u64,
        requires_manual_approval: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let owner = tx_context::sender(ctx);
        let policy = AgentPolicy {
            id: object::new(ctx),
            owner,
            allowed_markets,
            allowed_assets,
            max_budget_usd_micros,
            max_single_trade_usd_micros,
            expires_at_ms,
            requires_manual_approval,
            revoked: false,
            created_at_ms: now,
            updated_at_ms: now,
        };

        transfer::public_transfer(policy, owner);
    }

    entry fun update_policy(
        policy: &mut AgentPolicy,
        allowed_markets: vector<String>,
        allowed_assets: vector<String>,
        max_budget_usd_micros: u64,
        max_single_trade_usd_micros: u64,
        expires_at_ms: u64,
        requires_manual_approval: bool,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(policy.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(!policy.revoked, E_REVOKED);

        policy.allowed_markets = allowed_markets;
        policy.allowed_assets = allowed_assets;
        policy.max_budget_usd_micros = max_budget_usd_micros;
        policy.max_single_trade_usd_micros = max_single_trade_usd_micros;
        policy.expires_at_ms = expires_at_ms;
        policy.requires_manual_approval = requires_manual_approval;
        policy.updated_at_ms = clock::timestamp_ms(clock);
    }

    entry fun revoke_policy(policy: &mut AgentPolicy, clock: &Clock, ctx: &TxContext) {
        assert!(policy.owner == tx_context::sender(ctx), E_NOT_OWNER);

        policy.revoked = true;
        policy.updated_at_ms = clock::timestamp_ms(clock);
    }

    entry fun record_strategy_receipt(
        policy: &AgentPolicy,
        strategy_id: String,
        audit_blob_id: String,
        execution_digest: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(policy.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(!policy.revoked, E_REVOKED);

        let owner = tx_context::sender(ctx);
        let receipt = PolicyReceipt {
            id: object::new(ctx),
            owner,
            policy_id: object::uid_to_address(&policy.id),
            strategy_id,
            audit_blob_id,
            execution_digest,
            created_at_ms: clock::timestamp_ms(clock),
        };

        transfer::public_transfer(receipt, owner);
    }
}

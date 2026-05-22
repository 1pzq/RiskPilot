module riskpilot_receipt::strategy_receipt {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    public struct StrategyReceipt has key, store {
        id: UID,
        owner: address,
        strategy_id: String,
        audit_blob_id: String,
        created_at: u64,
        execution_digest: String,
    }

    entry fun mint(
        strategy_id: String,
        audit_blob_id: String,
        execution_digest: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let created_at = clock::timestamp_ms(clock);
        let receipt = StrategyReceipt {
            id: object::new(ctx),
            owner,
            strategy_id,
            audit_blob_id,
            created_at,
            execution_digest,
        };

        transfer::public_transfer(receipt, owner);
    }
}

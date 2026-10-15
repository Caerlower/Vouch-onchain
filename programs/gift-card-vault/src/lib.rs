pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT");

#[program]
pub mod gift_card_vault {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, seller_id: String) -> Result<()> {
        instructions::initialize_vault::handle_initialize_vault(ctx, seller_id)
    }

    pub fn fund(ctx: Context<Fund>, seller_id: String, amount: u64) -> Result<()> {
        instructions::fund::handle_fund(ctx, seller_id, amount)
    }

    pub fn mint_card(
        ctx: Context<MintCard>,
        seller_id: String,
        code_hash: [u8; 32],
        endpoint_hash: [u8; 32],
        face_value_atomic: u64,
        commission_atomic: u64,
    ) -> Result<()> {
        instructions::mint_card::handle_mint_card(
            ctx,
            seller_id,
            code_hash,
            endpoint_hash,
            face_value_atomic,
            commission_atomic,
        )
    }

    pub fn claim_card(
        ctx: Context<ClaimCard>,
        seller_id: String,
        code_hash: [u8; 32],
    ) -> Result<()> {
        instructions::claim_card::handle_claim_card(ctx, seller_id, code_hash)
    }

    pub fn redeem_card(
        ctx: Context<RedeemCard>,
        seller_id: String,
        code_hash: [u8; 32],
        settle_sig_hash: [u8; 32],
    ) -> Result<()> {
        instructions::redeem_card::handle_redeem_card(ctx, seller_id, code_hash, settle_sig_hash)
    }

    pub fn withdraw(ctx: Context<Withdraw>, seller_id: String, amount: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, seller_id, amount)
    }
}

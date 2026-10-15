use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::error::VaultError;
use crate::state::{Vault, VaultInitialized};

#[derive(Accounts)]
#[instruction(seller_id: String)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: recorded as vault owner (can withdraw unused funds).
    pub owner: UncheckedAccount<'info>,
    /// Operator that may fund / mint / redeem on behalf of Vouch.
    pub operator: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, seller_id.as_bytes()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handle_initialize_vault(
    ctx: Context<InitializeVault>,
    seller_id: String,
) -> Result<()> {
    require!(
        !seller_id.is_empty() && seller_id.len() <= MAX_SELLER_ID_LEN,
        VaultError::InvalidSellerId
    );

    let vault = &mut ctx.accounts.vault;
    let mut seller_bytes = [0u8; 32];
    seller_bytes[..seller_id.len()].copy_from_slice(seller_id.as_bytes());

    // Deterministic 32-byte id fingerprint (padded UTF-8; seller_id ≤ 32).
    vault.seller_id_hash = seller_bytes;
    vault.seller_id = seller_bytes;
    vault.seller_id_len = seller_id.len() as u8;
    vault.owner = ctx.accounts.owner.key();
    vault.operator = ctx.accounts.operator.key();
    vault.mint = ctx.accounts.mint.key();
    vault.balance_atomic = 0;
    vault.reserved_atomic = 0;
    vault.funded_atomic = 0;
    vault.remitted_atomic = 0;
    vault.cards_minted = 0;
    vault.cards_redeemed = 0;
    vault.bump = ctx.bumps.vault;
    vault.token_bump = 0;

    emit!(VaultInitialized {
        vault: vault.key(),
        seller_id_hash: seller_bytes,
        owner: vault.owner,
        operator: vault.operator,
        mint: vault.mint,
    });

    msg!(
        "vault initialized seller={} mint={}",
        seller_id,
        vault.mint
    );
    Ok(())
}

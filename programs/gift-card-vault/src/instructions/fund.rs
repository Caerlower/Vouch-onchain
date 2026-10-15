use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::error::VaultError;
use crate::state::{Vault, VaultFunded};

#[derive(Accounts)]
#[instruction(seller_id: String)]
pub struct Fund<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [VAULT_SEED, seller_id.as_bytes()],
        bump = vault.bump,
        has_one = mint @ VaultError::MintMismatch,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = funder,
    )]
    pub funder_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_fund(ctx: Context<Fund>, _seller_id: String, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::InvalidAmount);

    let cpi = CpiContext::new(
        token::ID,
        Transfer {
            from: ctx.accounts.funder_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        },
    );
    token::transfer(cpi, amount)?;

    let vault = &mut ctx.accounts.vault;
    vault.balance_atomic = vault
        .balance_atomic
        .checked_add(amount)
        .ok_or(VaultError::InvalidAmount)?;
    vault.funded_atomic = vault
        .funded_atomic
        .checked_add(amount)
        .ok_or(VaultError::InvalidAmount)?;

    emit!(VaultFunded {
        vault: vault.key(),
        amount,
        balance_atomic: vault.balance_atomic,
        from: ctx.accounts.funder.key(),
    });

    Ok(())
}

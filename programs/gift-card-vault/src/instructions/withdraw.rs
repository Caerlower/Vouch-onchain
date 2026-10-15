use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::error::VaultError;
use crate::state::{Vault, VaultWithdrawn};

#[derive(Accounts)]
#[instruction(seller_id: String)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [VAULT_SEED, seller_id.as_bytes()],
        bump = vault.bump,
        has_one = owner @ VaultError::UnauthorizedOwner,
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
        token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, seller_id: String, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::InvalidAmount);

    let vault = &ctx.accounts.vault;
    let available = vault
        .balance_atomic
        .checked_sub(vault.reserved_atomic)
        .ok_or(VaultError::InsufficientAvailable)?;
    require!(available >= amount, VaultError::InsufficientAvailable);

    let seller_bytes = seller_id.as_bytes();
    let seeds: &[&[u8]] = &[VAULT_SEED, seller_bytes, &[vault.bump]];
    let signer = &[seeds];

    let cpi = CpiContext::new_with_signer(
        token::ID,
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.owner_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi, amount)?;

    let vault = &mut ctx.accounts.vault;
    vault.balance_atomic = vault.balance_atomic.saturating_sub(amount);

    emit!(VaultWithdrawn {
        vault: vault.key(),
        amount,
        to: ctx.accounts.owner.key(),
    });

    Ok(())
}

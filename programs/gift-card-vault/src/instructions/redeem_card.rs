use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::error::VaultError;
use crate::state::{CardRedeemed, CardStatus, GiftCard, RemitReceipt, Vault};

#[derive(Accounts)]
#[instruction(seller_id: String, code_hash: [u8; 32], settle_sig_hash: [u8; 32])]
pub struct RedeemCard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub operator: Signer<'info>,
    /// CHECK: buyer pubkey (operator-mediated redeem in demo).
    pub buyer: UncheckedAccount<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds = [VAULT_SEED, seller_id.as_bytes()],
        bump = vault.bump,
        has_one = operator @ VaultError::UnauthorizedOperator,
        has_one = mint @ VaultError::MintMismatch,
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,
    /// Operator ATA receiving debit so MagicBlock can privately remit.
    /// Created client-side before redeem if missing.
    #[account(
        mut,
        token::mint = mint,
        token::authority = operator,
    )]
    pub operator_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [CARD_SEED, code_hash.as_ref()],
        bump = gift_card.bump,
        constraint = gift_card.seller_id_hash == vault.seller_id_hash @ VaultError::MintMismatch,
    )]
    pub gift_card: Box<Account<'info, GiftCard>>,
    #[account(
        init,
        payer = payer,
        space = 8 + RemitReceipt::INIT_SPACE,
        seeds = [REMIT_SEED, settle_sig_hash.as_ref()],
        bump
    )]
    pub remit_receipt: Box<Account<'info, RemitReceipt>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_redeem_card(
    ctx: Context<RedeemCard>,
    seller_id: String,
    _code_hash: [u8; 32],
    settle_sig_hash: [u8; 32],
) -> Result<()> {
    require!(settle_sig_hash != [0u8; 32], VaultError::InvalidSettleSig);

    let buyer = ctx.accounts.buyer.key();
    let card = &mut ctx.accounts.gift_card;

    require!(
        card.status != CardStatus::Redeemed
            && card.status != CardStatus::Exhausted
            && card.remaining_atomic > 0,
        VaultError::CardAlreadyUsed
    );
    require!(card.issuer != buyer, VaultError::SelfReferralBlocked);

    if !card.has_owner {
        card.owner = buyer;
        card.has_owner = true;
        card.status = CardStatus::Claimed;
    }
    require!(card.owner == buyer, VaultError::BuyerNotOwner);

    let rebate = card.remaining_atomic;
    let commission = card.commission_atomic;
    let total = rebate
        .checked_add(commission)
        .ok_or(VaultError::InvalidAmount)?;

    let seller_bytes = seller_id.as_bytes();
    let seeds: &[&[u8]] = &[VAULT_SEED, seller_bytes, &[ctx.accounts.vault.bump]];
    let signer = &[seeds];

    let cpi = CpiContext::new_with_signer(
        token::ID,
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.operator_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi, total)?;

    let vault = &mut ctx.accounts.vault;
    require!(vault.balance_atomic >= total, VaultError::InsufficientBalance);
    require!(vault.reserved_atomic >= total, VaultError::InsufficientAvailable);

    vault.balance_atomic = vault.balance_atomic.saturating_sub(total);
    vault.reserved_atomic = vault.reserved_atomic.saturating_sub(total);
    vault.remitted_atomic = vault
        .remitted_atomic
        .checked_add(total)
        .ok_or(VaultError::InvalidAmount)?;
    vault.cards_redeemed = vault
        .cards_redeemed
        .checked_add(1)
        .ok_or(VaultError::InvalidAmount)?;

    card.remaining_atomic = 0;
    card.status = CardStatus::Redeemed;
    card.settle_sig_hash = settle_sig_hash;
    card.has_settle_sig = true;

    let receipt = &mut ctx.accounts.remit_receipt;
    receipt.settle_sig_hash = settle_sig_hash;
    receipt.buyer = buyer;
    receipt.issuer = card.issuer;
    receipt.rebate_atomic = rebate;
    receipt.commission_atomic = commission;
    receipt.card = card.key();
    receipt.bump = ctx.bumps.remit_receipt;

    emit!(CardRedeemed {
        card: card.key(),
        vault: vault.key(),
        buyer,
        issuer: card.issuer,
        rebate_atomic: rebate,
        commission_atomic: commission,
        settle_sig_hash,
    });

    Ok(())
}

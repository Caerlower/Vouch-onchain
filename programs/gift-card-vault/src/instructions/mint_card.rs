use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VaultError;
use crate::state::{CardMinted, CardStatus, GiftCard, Vault};

#[derive(Accounts)]
#[instruction(seller_id: String, code_hash: [u8; 32])]
pub struct MintCard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub operator: Signer<'info>,
    /// CHECK: issuer pubkey recorded on the card.
    pub issuer: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, seller_id.as_bytes()],
        bump = vault.bump,
        has_one = operator @ VaultError::UnauthorizedOperator,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = payer,
        space = 8 + GiftCard::INIT_SPACE,
        seeds = [CARD_SEED, code_hash.as_ref()],
        bump
    )]
    pub gift_card: Account<'info, GiftCard>,
    pub system_program: Program<'info, System>,
}

pub fn handle_mint_card(
    ctx: Context<MintCard>,
    _seller_id: String,
    code_hash: [u8; 32],
    endpoint_hash: [u8; 32],
    face_value_atomic: u64,
    commission_atomic: u64,
) -> Result<()> {
    require!(face_value_atomic > 0, VaultError::InvalidAmount);

    let need = face_value_atomic
        .checked_add(commission_atomic)
        .ok_or(VaultError::InvalidAmount)?;

    let vault = &mut ctx.accounts.vault;
    let available = vault
        .balance_atomic
        .checked_sub(vault.reserved_atomic)
        .ok_or(VaultError::InsufficientAvailable)?;
    require!(available >= need, VaultError::InsufficientAvailable);

    vault.reserved_atomic = vault
        .reserved_atomic
        .checked_add(need)
        .ok_or(VaultError::InvalidAmount)?;
    vault.cards_minted = vault
        .cards_minted
        .checked_add(1)
        .ok_or(VaultError::InvalidAmount)?;

    let card = &mut ctx.accounts.gift_card;
    card.code_hash = code_hash;
    card.seller_id_hash = vault.seller_id_hash;
    card.endpoint_hash = endpoint_hash;
    card.issuer = ctx.accounts.issuer.key();
    card.owner = Pubkey::default();
    card.has_owner = false;
    card.face_value_atomic = face_value_atomic;
    card.remaining_atomic = face_value_atomic;
    card.commission_atomic = commission_atomic;
    card.status = CardStatus::Minted;
    card.settle_sig_hash = [0u8; 32];
    card.has_settle_sig = false;
    card.bump = ctx.bumps.gift_card;

    emit!(CardMinted {
        card: card.key(),
        vault: vault.key(),
        code_hash,
        issuer: card.issuer,
        face_value_atomic,
        commission_atomic,
    });

    Ok(())
}

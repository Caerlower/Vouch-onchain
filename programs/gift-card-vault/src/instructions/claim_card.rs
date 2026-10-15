use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::VaultError;
use crate::state::{CardClaimed, CardStatus, GiftCard, Vault};

#[derive(Accounts)]
#[instruction(seller_id: String, code_hash: [u8; 32])]
pub struct ClaimCard<'info> {
    pub operator: Signer<'info>,
    /// CHECK: new card owner (agent pubkey; operator-mediated in demo).
    pub owner: UncheckedAccount<'info>,
    #[account(
        seeds = [VAULT_SEED, seller_id.as_bytes()],
        bump = vault.bump,
        has_one = operator @ VaultError::UnauthorizedOperator,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [CARD_SEED, code_hash.as_ref()],
        bump = gift_card.bump,
        constraint = gift_card.seller_id_hash == vault.seller_id_hash @ VaultError::MintMismatch,
    )]
    pub gift_card: Account<'info, GiftCard>,
}

pub fn handle_claim_card(
    ctx: Context<ClaimCard>,
    _seller_id: String,
    _code_hash: [u8; 32],
) -> Result<()> {
    let card = &mut ctx.accounts.gift_card;
    let owner = ctx.accounts.owner.key();

    require!(
        card.status != CardStatus::Redeemed && card.status != CardStatus::Exhausted,
        VaultError::CardAlreadyUsed
    );
    require!(card.issuer != owner, VaultError::SelfReferralBlocked);

    if card.has_owner {
        require!(card.owner == owner, VaultError::CardOwnedByOther);
    } else {
        card.owner = owner;
        card.has_owner = true;
        card.status = CardStatus::Claimed;
    }

    emit!(CardClaimed {
        card: card.key(),
        owner,
    });

    Ok(())
}

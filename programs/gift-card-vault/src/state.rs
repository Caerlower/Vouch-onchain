use anchor_lang::prelude::*;

/// On-chain seller gift-card pool.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    /// SHA-256 of the UTF-8 seller id (also used in PDA seeds via raw bytes ≤32).
    pub seller_id_hash: [u8; 32],
    /// Raw seller id bytes (padded).
    pub seller_id: [u8; 32],
    pub seller_id_len: u8,
    pub owner: Pubkey,
    pub operator: Pubkey,
    pub mint: Pubkey,
    /// Tokens currently held in the vault ATA.
    pub balance_atomic: u64,
    /// Soft-locked for outstanding (minted/claimed) cards.
    pub reserved_atomic: u64,
    pub funded_atomic: u64,
    pub remitted_atomic: u64,
    pub cards_minted: u32,
    pub cards_redeemed: u32,
    pub bump: u8,
    pub token_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CardStatus {
    Minted,
    Claimed,
    Redeemed,
    Exhausted,
}

/// Endpoint-bound gift card PDA.
#[account]
#[derive(InitSpace)]
pub struct GiftCard {
    pub code_hash: [u8; 32],
    pub seller_id_hash: [u8; 32],
    pub endpoint_hash: [u8; 32],
    pub issuer: Pubkey,
    pub owner: Pubkey,
    pub has_owner: bool,
    pub face_value_atomic: u64,
    pub remaining_atomic: u64,
    pub commission_atomic: u64,
    pub status: CardStatus,
    pub settle_sig_hash: [u8; 32],
    pub has_settle_sig: bool,
    pub bump: u8,
}

/// Idempotency receipt for a MagicBlock remit after redeem.
#[account]
#[derive(InitSpace)]
pub struct RemitReceipt {
    pub settle_sig_hash: [u8; 32],
    pub buyer: Pubkey,
    pub issuer: Pubkey,
    pub rebate_atomic: u64,
    pub commission_atomic: u64,
    pub card: Pubkey,
    pub bump: u8,
}

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub seller_id_hash: [u8; 32],
    pub owner: Pubkey,
    pub operator: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct VaultFunded {
    pub vault: Pubkey,
    pub amount: u64,
    pub balance_atomic: u64,
    pub from: Pubkey,
}

#[event]
pub struct CardMinted {
    pub card: Pubkey,
    pub vault: Pubkey,
    pub code_hash: [u8; 32],
    pub issuer: Pubkey,
    pub face_value_atomic: u64,
    pub commission_atomic: u64,
}

#[event]
pub struct CardClaimed {
    pub card: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct CardRedeemed {
    pub card: Pubkey,
    pub vault: Pubkey,
    pub buyer: Pubkey,
    pub issuer: Pubkey,
    pub rebate_atomic: u64,
    pub commission_atomic: u64,
    pub settle_sig_hash: [u8; 32],
}

#[event]
pub struct VaultWithdrawn {
    pub vault: Pubkey,
    pub amount: u64,
    pub to: Pubkey,
}

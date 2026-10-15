use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("seller_id must be 1..=32 bytes")]
    InvalidSellerId,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Insufficient vault balance")]
    InsufficientBalance,
    #[msg("Insufficient unreserved balance to mint card")]
    InsufficientAvailable,
    #[msg("Only the vault operator may call this")]
    UnauthorizedOperator,
    #[msg("Only the vault owner may withdraw")]
    UnauthorizedOwner,
    #[msg("Card already claimed by someone else")]
    CardOwnedByOther,
    #[msg("Issuer cannot claim or redeem their own card")]
    SelfReferralBlocked,
    #[msg("Card already redeemed or exhausted")]
    CardAlreadyUsed,
    #[msg("Buyer is not the card owner")]
    BuyerNotOwner,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("settle_sig hash must be 32 bytes")]
    InvalidSettleSig,
}

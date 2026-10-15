/// PDA seed for a seller vault.
pub const VAULT_SEED: &[u8] = b"vault";
/// PDA seed for a gift-card account.
pub const CARD_SEED: &[u8] = b"card";
/// PDA seed for a remit receipt (idempotency).
pub const REMIT_SEED: &[u8] = b"remit";
/// Max bytes for seller_id string seed.
pub const MAX_SELLER_ID_LEN: usize = 32;

use anchor_lang::prelude::*;

declare_id!("G4sskGCCr4asC6Am8saezpvYJFhqR2aF79Q4625w3Pnd");

/// Maximum bytes stored for the crisis type label.
const MAX_CRISIS_TYPE_LEN: usize = 64;

#[program]
pub mod aether_contracts {
    use super::*;

    /// Records (or updates) a crisis report attributed to the signing
    /// authority. The PDA is derived from [b"crisis", authority] so each
    /// authority owns exactly one live crisis record that can be updated.
    pub fn report_crisis(
        ctx: Context<ReportCrisis>,
        crisis_type: String,
        severity: u8,
    ) -> Result<()> {
        require!(severity <= 100, AetherError::SeverityOutOfRange);
        require!(
            crisis_type.len() <= MAX_CRISIS_TYPE_LEN,
            AetherError::CrisisTypeTooLong
        );

        let crisis_account = &mut ctx.accounts.crisis_account;
        crisis_account.authority = ctx.accounts.authority.key();
        crisis_account.crisis_type = crisis_type;
        crisis_account.severity = severity;
        crisis_account.timestamp = Clock::get()?.unix_timestamp;

        msg!(
            "Crisis Recorded: {} with severity {}",
            crisis_account.crisis_type,
            crisis_account.severity
        );
        Ok(())
    }
}

#[error_code]
pub enum AetherError {
    #[msg("Severity must be between 0 and 100")]
    SeverityOutOfRange,
    #[msg("Crisis type label exceeds the maximum length")]
    CrisisTypeTooLong,
}

#[derive(Accounts)]
pub struct ReportCrisis<'info> {
    // Discriminator(8) + authority(32) + String(4 + 64) + severity(1) + timestamp(8)
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 32 + 4 + MAX_CRISIS_TYPE_LEN + 1 + 8,
        seeds = [b"crisis", authority.key().as_ref()],
        bump
    )]
    pub crisis_account: Account<'info, CrisisAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CrisisAccount {
    pub authority: Pubkey,
    pub crisis_type: String,
    pub severity: u8,
    pub timestamp: i64,
}

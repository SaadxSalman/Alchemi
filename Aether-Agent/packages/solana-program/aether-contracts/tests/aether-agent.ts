import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AetherContracts } from "../target/types/aether_contracts";
import { expect } from "chai";

describe("aether-contracts", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.AetherContracts as Program<AetherContracts>;
  const authority = (program.provider as anchor.AnchorProvider).wallet;

  const [crisisAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("crisis"), authority.publicKey.toBuffer()],
    program.programId
  );

  it("records a crisis report", async () => {
    await program.methods
      .reportCrisis("Flood", 90)
      .accounts({ authority: authority.publicKey })
      .rpc();

    const crisis = await program.account.crisisAccount.fetch(crisisAccount);
    expect(crisis.crisisType).to.equal("Flood");
    expect(crisis.severity).to.equal(90);
    expect(crisis.authority.toString()).to.equal(authority.publicKey.toString());
  });

  it("updates an existing crisis record", async () => {
    await program.methods
      .reportCrisis("Wildfire", 55)
      .accounts({ authority: authority.publicKey })
      .rpc();

    const crisis = await program.account.crisisAccount.fetch(crisisAccount);
    expect(crisis.crisisType).to.equal("Wildfire");
    expect(crisis.severity).to.equal(55);
  });

  it("rejects out-of-range severity", async () => {
    try {
      await program.methods
        .reportCrisis("Flood", 200)
        .accounts({ authority: authority.publicKey })
        .rpc();
      expect.fail("Expected SeverityOutOfRange error");
    } catch (err) {
      expect(String(err)).to.include("SeverityOutOfRange");
    }
  });
});
import { expect } from "chai";
import { ethers } from "ethers";
import {
  buildDomain,
  credentialTypes,
  DEFAULT_DOMAIN_NAME,
  DEFAULT_DOMAIN_VERSION,
  SEPOLIA_CHAIN_ID,
  CREDENTIAL_EIP712_TYPES,
} from "../../src/sdk";

describe("EIP-712 SDK — Domain & Type Builder (Tuần 3 Ngày 1)", function () {
  const SAMPLE_CONTRACT = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

  // ── buildDomain ─────────────────────────────────────────────

  describe("buildDomain", function () {
    it("should build default domain separator object correctly", function () {
      const domain = buildDomain(SAMPLE_CONTRACT);

      expect(domain.name).to.equal(DEFAULT_DOMAIN_NAME);
      expect(domain.version).to.equal(DEFAULT_DOMAIN_VERSION);
      expect(domain.chainId).to.equal(SEPOLIA_CHAIN_ID);
      expect(domain.verifyingContract).to.equal(
        ethers.getAddress(SAMPLE_CONTRACT)
      );
    });

    it("should allow custom chainId, name, and version", function () {
      const domain = buildDomain(
        SAMPLE_CONTRACT,
        31337,
        "CustomDomain",
        "3.1"
      );

      expect(domain.name).to.equal("CustomDomain");
      expect(domain.version).to.equal("3.1");
      expect(domain.chainId).to.equal(31337);
      expect(domain.verifyingContract).to.equal(
        ethers.getAddress(SAMPLE_CONTRACT)
      );
    });

    it("should throw error if verifyingContract address is invalid", function () {
      expect(() => buildDomain("0xinvalid")).to.throw(
        "Invalid verifyingContract address"
      );
    });
  });

  // ── credentialTypes ─────────────────────────────────────────

  describe("credentialTypes", function () {
    it("should return correct EIP-712 type definition matching SPEC.md", function () {
      const types = credentialTypes();

      expect(types).to.deep.equal(CREDENTIAL_EIP712_TYPES);
      expect(types.PublicClaims).to.be.an("array").with.lengthOf(4);
      expect(types.BkCredential).to.be.an("array").with.lengthOf(6);
    });

    it("should contain nested PublicClaims type reference in BkCredential", function () {
      const types = credentialTypes();
      const publicClaimsField = types.BkCredential.find(
        (f) => f.name === "publicClaims"
      );

      expect(publicClaimsField).to.not.be.undefined;
      expect(publicClaimsField?.type).to.equal("PublicClaims");
    });
  });
});

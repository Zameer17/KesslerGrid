const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KesslerGridCore Smart Contract - Edge Cases & Security Audit", function () {
  let contract;
  let admin, operator1, operator2;

  beforeEach(async function () {
    [admin, operator1, operator2] = await ethers.getSigners();
    const KesslerGridCore = await ethers.getContractFactory("KesslerGridCore");
    contract = await KesslerGridCore.deploy();
    await contract.waitForDeployment();
  });

  describe("1. Registration Edge Cases", function () {
    it("Should successfully register a satellite with valid ID and >= 0.5 ETH stake", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await expect(contract.connect(operator1).registerSatellite("SAT-001", { value: stakeAmount }))
        .to.emit(contract, "SatelliteRegistered")
        .withArgs("SAT-001", operator1.address, stakeAmount);

      const sat = await contract.getSatellite("SAT-001");
      expect(sat.isRegistered).to.be.true;
      expect(sat.owner).to.equal(operator1.address);
      expect(sat.stakedAmount).to.equal(stakeAmount);
    });

    it("Should REVERT if registration ID is empty", async function () {
      await expect(
        contract.connect(operator1).registerSatellite("", { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Empty satellite ID");
    });

    it("Should REVERT if satId is already registered (Duplicate Registration)", async function () {
      await contract.connect(operator1).registerSatellite("SAT-DUPLICATE", { value: ethers.parseEther("1.0") });

      await expect(
        contract.connect(operator2).registerSatellite("SAT-DUPLICATE", { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Satellite already registered");
    });

    it("Should REVERT if stake amount is below 0.5 ETH minimum threshold", async function () {
      await expect(
        contract.connect(operator1).registerSatellite("SAT-LOW-STAKE", { value: ethers.parseEther("0.2") })
      ).to.be.revertedWith("Stake below minimum threshold");
    });
  });

  describe("2. Staking & Collateral Edge Cases", function () {
    it("CRITICAL BUG FIX: Should REVERT when attempting to stake on an UNREGISTERED satellite", async function () {
      await expect(
        contract.connect(operator1).stake("ENVISAT-UNREGISTERED", { value: ethers.parseEther("2.0") })
      ).to.be.revertedWith("ERR_NOT_REGISTERED");
    });

    it("Should allow any node operator to add ETH collateral stake to a registered satellite", async function () {
      await contract.connect(operator1).registerSatellite("SAT-OWNED", { value: ethers.parseEther("1.0") });

      await contract.connect(operator2).stake("SAT-OWNED", { value: ethers.parseEther("1.0") });
      const sat = await contract.getSatellite("SAT-OWNED");
      expect(sat.stakedAmount).to.equal(ethers.parseEther("2.0"));
    });

    it("Should REVERT if stake transaction passes 0 ETH", async function () {
      await contract.connect(operator1).registerSatellite("SAT-ZERO", { value: ethers.parseEther("1.0") });

      await expect(
        contract.connect(operator1).stake("SAT-ZERO", { value: 0 })
      ).to.be.revertedWith("ERR_ZERO_STAKE");
    });

    it("Should allow the registered owner to add additional ETH stake", async function () {
      await contract.connect(operator1).registerSatellite("SAT-TOPUP", { value: ethers.parseEther("1.0") });
      await contract.connect(operator1).stake("SAT-TOPUP", { value: ethers.parseEther("0.5") });

      const sat = await contract.getSatellite("SAT-TOPUP");
      expect(sat.stakedAmount).to.equal(ethers.parseEther("1.5"));
    });
  });

  describe("3. Withdrawal, Threat Lock & Slashing Edge Cases", function () {
    beforeEach(async function () {
      await contract.connect(operator1).registerSatellite("SAT-SECURITY", { value: ethers.parseEther("2.0") });
    });

    it("Should REVERT withdrawal if non-owner attempts to withdraw", async function () {
      await expect(
        contract.connect(operator2).withdraw("SAT-SECURITY", ethers.parseEther("1.0"))
      ).to.be.revertedWith("Only satellite owner can withdraw");
    });

    it("Should REVERT over-withdrawal if requested amount > staked balance", async function () {
      await expect(
        contract.connect(operator1).withdraw("SAT-SECURITY", ethers.parseEther("3.0"))
      ).to.be.revertedWith("Insufficient staked amount");
    });

    it("Should REVERT withdrawal when an active collision threat is flagged", async function () {
      // Admin flags collision threat
      await contract.connect(admin).setThreatStatus("SAT-SECURITY", true);

      await expect(
        contract.connect(operator1).withdraw("SAT-SECURITY", ethers.parseEther("1.0"))
      ).to.be.revertedWith("Cannot withdraw during active collision threat");
    });

    it("Should allow withdrawal when threat is cleared", async function () {
      await contract.connect(admin).setThreatStatus("SAT-SECURITY", true);
      // Clear threat
      await contract.connect(admin).setThreatStatus("SAT-SECURITY", false);

      await contract.connect(operator1).withdraw("SAT-SECURITY", ethers.parseEther("1.0"));
      const sat = await contract.getSatellite("SAT-SECURITY");
      expect(sat.stakedAmount).to.equal(ethers.parseEther("1.0"));
    });

    it("Should allow admin to slash stake during un-evaded collision alert", async function () {
      await expect(contract.connect(admin).slash("SAT-SECURITY", "Collision Warning Ignored > 80% Risk"))
        .to.emit(contract, "Slashed")
        .withArgs("SAT-SECURITY", ethers.parseEther("2.0"), "Collision Warning Ignored > 80% Risk");

      const sat = await contract.getSatellite("SAT-SECURITY");
      expect(sat.stakedAmount).to.equal(0);
    });
  });
});

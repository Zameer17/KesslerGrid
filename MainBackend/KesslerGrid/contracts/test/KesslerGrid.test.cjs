const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("KesslerGrid Smart Contract Protocol (EVM Test Suite)", function () {
  let kesslerGrid;
  let admin, operatorA, operatorB, treasury;
  const STANDARD_BOND = ethers.parseEther("5.0"); // 5.00 ETH Bond
  const PARTIAL_BURN = ethers.parseEther("2.5");  // 2.50 ETH Partial Burn / Maneuver Allocation

  beforeEach(async function () {
    [admin, operatorA, operatorB, treasury] = await ethers.getSigners();

    const KesslerGridCore = await ethers.getContractFactory("KesslerGridCore");
    kesslerGrid = await KesslerGridCore.deploy();
    await kesslerGrid.waitForDeployment();

    // Configure dedicated Penalty Insurance Treasury
    await kesslerGrid.connect(admin).setPenaltyTreasury(treasury.address);
  });

  describe("1. Satellite Operator Registration & Bond Lock-Up", function () {
    it("should successfully lock 5.00 ETH collateral upon operator registration", async function () {
      const satId = "SAT-STARLINK-1092";

      // Execute on-chain registration with 5.00 ETH collateral
      const tx = await kesslerGrid.connect(operatorA).registerSatellite(satId, { value: STANDARD_BOND });
      await tx.wait();

      const sat = await kesslerGrid.getSatellite(satId);
      expect(sat.isRegistered).to.be.true;
      expect(sat.owner).to.equal(operatorA.address);
      expect(sat.stakedAmount).to.equal(STANDARD_BOND);
      expect(sat.hasActiveThreat).to.be.false;

      // Verify contract holds exactly the locked bond
      const contractBalance = await ethers.provider.getBalance(await kesslerGrid.getAddress());
      expect(contractBalance).to.equal(STANDARD_BOND);
    });

    it("should reject registration below the minimum staking threshold", async function () {
      const satId = "SAT-DEBRIS-001";
      const belowMinimum = ethers.parseEther("0.1");

      await expect(
        kesslerGrid.connect(operatorA).registerSatellite(satId, { value: belowMinimum })
      ).to.be.revertedWith("Stake below minimum threshold");
    });
  });

  describe("2. Scenario A: Mutual Avoidance & Threat Clearance (executeAvoidanceBurn)", function () {
    beforeEach(async function () {
      // Register operator satellite with 5.00 ETH
      await kesslerGrid.connect(operatorA).registerSatellite("SAT-ONEWEB-042", { value: STANDARD_BOND });
      // Oracle flags high-risk conjunction threat
      await kesslerGrid.connect(admin).setThreatStatus("SAT-ONEWEB-042", true);
    });

    it("should verify active conjunction threat blocks unauthorized withdrawals", async function () {
      await expect(
        kesslerGrid.connect(operatorA).withdraw("SAT-ONEWEB-042", PARTIAL_BURN)
      ).to.be.revertedWith("Cannot withdraw during active collision threat");
    });

    it("should execute mutual avoidance maneuver, resolve active threat, and allow partial collateral management", async function () {
      const satId = "SAT-ONEWEB-042";

      // Step 1: Operator signs and broadcasts avoidance burn transaction
      const burnTx = await kesslerGrid.connect(operatorA).executeAvoidanceBurn(satId);
      await expect(burnTx).to.emit(kesslerGrid, "AvoidanceBurnExecuted");

      // Step 2: Verify active threat is cleared
      const satAfterBurn = await kesslerGrid.getSatellite(satId);
      expect(satAfterBurn.hasActiveThreat).to.be.false;

      // Step 3: Cooperative risk mitigation allows partial burn / withdrawal of 2.50 ETH
      await expect(
        kesslerGrid.connect(operatorA).withdraw(satId, PARTIAL_BURN)
      ).to.changeEtherBalances([kesslerGrid, operatorA], [-PARTIAL_BURN, PARTIAL_BURN]);

      const remainingSat = await kesslerGrid.getSatellite(satId);
      expect(remainingSat.stakedAmount).to.equal(STANDARD_BOND - PARTIAL_BURN);
    });
  });

  describe("3. Scenario B: Time-Locked Slashing for Non-Compliance (evm_increaseTime & evm_mine)", function () {
    const satId = "SAT-COSMOS-2251";

    beforeEach(async function () {
      // Register negligent operator satellite with 5.00 ETH bond
      await kesslerGrid.connect(operatorB).registerSatellite(satId, { value: STANDARD_BOND });
      // Oracle issues critical conjunction alert
      await kesslerGrid.connect(admin).setThreatStatus(satId, true);
    });

    it("should advance EVM block time past TCA deadline and execute 5.00 ETH total collateral slash to Treasury", async function () {
      // Fast-forward EVM blockchain time by 7200 seconds (2 hours past TCA expiration)
      await network.provider.send("evm_increaseTime", [7200]);
      await network.provider.send("evm_mine");

      // Verify active threat state before slashing
      const satBefore = await kesslerGrid.getSatellite(satId);
      expect(satBefore.hasActiveThreat).to.be.true;
      expect(satBefore.stakedAmount).to.equal(STANDARD_BOND);

      // AI Oracle / Admin triggers automatic non-compliance slash
      const slashTx = await kesslerGrid.connect(admin).slash(
        satId, 
        "TCA_EXPIRED_UNEVADED_CRITICAL_CONJUNCTION"
      );

      await expect(slashTx)
        .to.emit(kesslerGrid, "CollateralSlashed")
        .withArgs(satId, operatorB.address, treasury.address, STANDARD_BOND, "TCA_EXPIRED_UNEVADED_CRITICAL_CONJUNCTION");

      // Assert 5.00 ETH was transferred to Penalty Treasury and internal state is zeroed
      await expect(slashTx).to.changeEtherBalances([kesslerGrid, treasury], [-STANDARD_BOND, STANDARD_BOND]);

      const satAfter = await kesslerGrid.getSatellite(satId);
      expect(satAfter.stakedAmount).to.equal(0);
      expect(satAfter.hasActiveThreat).to.be.false;
    });
  });
});

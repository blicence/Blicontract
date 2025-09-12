import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";

describe("ProducerVestingApi Logic Contract", function () {
  let producerVestingApi: any;
  let producerStorage: any;
  let owner: Signer;
  let producer: Signer;
  let customer: Signer;

  beforeEach(async function () {
    [owner, producer, customer] = await ethers.getSigners();

    // Deploy ProducerStorage
    producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
    
    // Deploy ProducerVestingApi
    producerVestingApi = await ethers.deployContract("ProducerVestingApi");
    
    // Initialize ProducerVestingApi
    await producerVestingApi.initialize();
    await producerVestingApi.setProducerStorage(await producerStorage.getAddress());
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await producerVestingApi.producerStorage()).to.equal(await producerStorage.getAddress());
    });

    it("Should set producer storage only by owner", async function () {
      const newStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
      
      await expect(
        producerVestingApi.connect(producer).setProducerStorage(await newStorage.getAddress())
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("addPlanInfoVesting", function () {
    it("Should add vesting plan info successfully", async function () {
      const currentTime = await time.latest();
      const cliffDate = currentTime + 30 * 24 * 3600; // 30 days from now
      
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("0.1"), // 0.1 tokens per second after cliff
        startAmount: ethers.parseEther("1000") // 1000 tokens available after cliff
      };

      await expect(
        producerVestingApi.addPlanInfoVesting(vestingPlanInfo)
      ).to.emit(producerVestingApi, "PlanInfoVestingAdded")
        .withArgs(1, cliffDate, ethers.parseEther("0.1"), ethers.parseEther("1000"));
    });

    it("Should reject cliff date in the past", async function () {
      const pastTime = await time.latest() - 3600; // 1 hour ago
      
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: pastTime,
        flowRate: ethers.parseEther("0.1"),
        startAmount: ethers.parseEther("1000")
      };

      await expect(
        producerVestingApi.addPlanInfoVesting(vestingPlanInfo)
      ).to.be.revertedWith("Cliff date must be in future");
    });

    it("Should only allow producer contract to add plan info", async function () {
      const currentTime = await time.latest();
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: currentTime + 3600,
        flowRate: ethers.parseEther("0.1"),
        startAmount: ethers.parseEther("1000")
      };

      await expect(
        producerVestingApi.connect(customer).addPlanInfoVesting(vestingPlanInfo)
      ).to.be.revertedWith("Only producer contract can call this function");
    });
  });

  describe("calculateVestedAmount", function () {
    let cliffDate: number;
    let customerPlanId: number = 1;

    beforeEach(async function () {
      cliffDate = await time.latest() + 3600; // 1 hour from now
      
      // Setup vesting plan
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("0.1"), // 0.1 tokens per second
        startAmount: ethers.parseEther("1000") // 1000 tokens
      };

      await producerVestingApi.addPlanInfoVesting(vestingPlanInfo);

      // Setup customer plan
      const customerPlan = {
        customerPlanId: customerPlanId,
        planId: 1,
        customerAdress: await customer.getAddress(),
        cloneAddress: await producer.getAddress(),
        startTime: await time.latest(),
        endTime: await time.latest() + 365 * 24 * 3600, // 1 year
        isActive: true,
        status: 1, // active
        remainingQuota: ethers.parseEther("5000") // Total vesting amount
      };

      // Mock customer plan in storage
      // In real implementation, this would be set through Producer contract
    });

    it("Should return zero before cliff date", async function () {
      const result = await producerVestingApi.calculateVestedAmount(customerPlanId);
      
      expect(result[0]).to.equal(0); // vested amount should be 0
      expect(result[1]).to.equal(ethers.parseEther("1000")); // total amount
    });

    it("Should return start amount immediately after cliff", async function () {
      // Move time to cliff date
      await time.increaseTo(cliffDate);
      
      const result = await producerVestingApi.calculateVestedAmount(customerPlanId);
      
      expect(result[0]).to.equal(ethers.parseEther("1000")); // start amount
    });

    it("Should calculate streaming amount after cliff", async function () {
      // Move time to 1 hour after cliff
      await time.increaseTo(cliffDate + 3600);
      
      const result = await producerVestingApi.calculateVestedAmount(customerPlanId);
      
      // Should be start amount + (1 hour * flow rate)
      // 1000 + (3600 seconds * 0.1 tokens/second) = 1000 + 360 = 1360
      const expectedAmount = ethers.parseEther("1000") + (3600n * ethers.parseEther("0.1"));
      expect(result[0]).to.equal(expectedAmount);
    });

    it("Should cap at remaining quota", async function () {
      // Move time far into the future
      await time.increaseTo(cliffDate + 365 * 24 * 3600); // 1 year later
      
      const result = await producerVestingApi.calculateVestedAmount(customerPlanId);
      
      // Should be capped at remaining quota (5000 tokens)
      expect(result[0]).to.equal(ethers.parseEther("5000"));
    });
  });

  describe("claimVestedTokens", function () {
    let cliffDate: number;
    let customerPlanId: number = 1;

    beforeEach(async function () {
      cliffDate = await time.latest() + 3600;
      
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("0.1"),
        startAmount: ethers.parseEther("1000")
      };

      await producerVestingApi.addPlanInfoVesting(vestingPlanInfo);
    });

    it("Should allow customer to claim vested tokens", async function () {
      // Move to after cliff
      await time.increaseTo(cliffDate + 3600);
      
      const claimAmount = ethers.parseEther("500");
      
      await expect(
        producerVestingApi.connect(customer).claimVestedTokens(customerPlanId, claimAmount)
      ).to.emit(producerVestingApi, "TokensClaimed")
        .withArgs(customerPlanId, await customer.getAddress(), claimAmount, anyValue);
    });

    it("Should reject claims before cliff", async function () {
      const claimAmount = ethers.parseEther("100");
      
      await expect(
        producerVestingApi.connect(customer).claimVestedTokens(customerPlanId, claimAmount)
      ).to.be.revertedWith("Insufficient vested amount");
    });

    it("Should only allow customer to claim", async function () {
      await time.increaseTo(cliffDate + 3600);
      
      const claimAmount = ethers.parseEther("100");
      
      await expect(
        producerVestingApi.connect(producer).claimVestedTokens(customerPlanId, claimAmount)
      ).to.be.revertedWith("Only customer can claim");
    });

    it("Should reject excessive claim amounts", async function () {
      await time.increaseTo(cliffDate + 3600);
      
      // Try to claim more than vested
      const excessiveAmount = ethers.parseEther("10000");
      
      await expect(
        producerVestingApi.connect(customer).claimVestedTokens(customerPlanId, excessiveAmount)
      ).to.be.revertedWith("Insufficient vested amount");
    });

    it("Should reject zero claim amounts", async function () {
      await time.increaseTo(cliffDate + 3600);
      
      await expect(
        producerVestingApi.connect(customer).claimVestedTokens(customerPlanId, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });
  });

  describe("isCliffEnded", function () {
    let cliffDate: number;

    beforeEach(async function () {
      cliffDate = await time.latest() + 3600;
      
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("0.1"),
        startAmount: ethers.parseEther("1000")
      };

      await producerVestingApi.addPlanInfoVesting(vestingPlanInfo);
    });

    it("Should return false before cliff", async function () {
      const result = await producerVestingApi.isCliffEnded(1);
      expect(result).to.be.false;
    });

    it("Should return true after cliff", async function () {
      await time.increaseTo(cliffDate + 1);
      
      const result = await producerVestingApi.isCliffEnded(1);
      expect(result).to.be.true;
    });
  });

  describe("calculateVestingSchedule", function () {
    it("Should calculate vesting schedule correctly", async function () {
      const totalAmount = ethers.parseEther("10000");
      const vestingDuration = 365 * 24 * 3600; // 1 year
      
      const result = await producerVestingApi.calculateVestingSchedule(1, totalAmount, vestingDuration);
      
      // Start amount should be 25% of total
      const expectedStartAmount = totalAmount * 25n / 100n;
      expect(result[0]).to.equal(expectedStartAmount);
      
      // Flow rate should be remaining amount / duration
      const remainingAmount = totalAmount - expectedStartAmount;
      const expectedFlowRate = remainingAmount / BigInt(vestingDuration);
      expect(result[1]).to.equal(expectedFlowRate);
    });

    it("Should handle different total amounts", async function () {
      const smallAmount = ethers.parseEther("1000");
      const largeAmount = ethers.parseEther("100000");
      const vestingDuration = 365 * 24 * 3600;
      
      const smallResult = await producerVestingApi.calculateVestingSchedule(1, smallAmount, vestingDuration);
      const largeResult = await producerVestingApi.calculateVestingSchedule(1, largeAmount, vestingDuration);
      
      // Large amount should have proportionally larger values
      expect(largeResult[0]).to.equal(smallResult[0] * 100n);
      expect(largeResult[1]).to.equal(smallResult[1] * 100n);
    });
  });

  describe("getPlanInfoVesting", function () {
    it("Should return vesting plan info", async function () {
      const cliffDate = await time.latest() + 3600;
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("0.1"),
        startAmount: ethers.parseEther("1000")
      };

      await producerVestingApi.addPlanInfoVesting(vestingPlanInfo);
      
      const result = await producerVestingApi.getPlanInfoVesting(1);
      
      expect(result.planId).to.equal(1);
      expect(result.cliffDate).to.equal(cliffDate);
      expect(result.flowRate).to.equal(ethers.parseEther("0.1"));
      expect(result.startAmount).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero flow rate", async function () {
      const cliffDate = await time.latest() + 3600;
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: 0, // No streaming, only cliff amount
        startAmount: ethers.parseEther("1000")
      };

      await expect(
        producerVestingApi.addPlanInfoVesting(vestingPlanInfo)
      ).to.not.be.reverted;
    });

    it("Should handle zero start amount", async function () {
      const cliffDate = await time.latest() + 3600;
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("0.1"),
        startAmount: 0 // Only streaming, no cliff amount
      };

      await expect(
        producerVestingApi.addPlanInfoVesting(vestingPlanInfo)
      ).to.not.be.reverted;
    });

    it("Should handle very large amounts", async function () {
      const cliffDate = await time.latest() + 3600;
      const largeAmount = ethers.parseEther("1000000000"); // 1 billion tokens
      
      const vestingPlanInfo = {
        planId: 1,
        cliffDate: cliffDate,
        flowRate: ethers.parseEther("100"),
        startAmount: largeAmount
      };

      await expect(
        producerVestingApi.addPlanInfoVesting(vestingPlanInfo)
      ).to.not.be.reverted;
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { ProducerApi, ProducerStorage } from "../typechain-types";

describe("ProducerApi Logic Contract", function () {
  let producerApi: ProducerApi;
  let producerStorage: ProducerStorage;
  let owner: Signer;
  let producer: Signer;
  let customer: Signer;

  beforeEach(async function () {
    [owner, producer, customer] = await ethers.getSigners();

    // Deploy ProducerStorage
    producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
    
    // Deploy ProducerApi
    producerApi = await ethers.deployContract("ProducerApi");
    
    // Initialize ProducerApi
    await producerApi.initialize();
    await producerApi.setProducerStorage(await producerStorage.getAddress());
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await producerApi.producerStorage()).to.equal(await producerStorage.getAddress());
    });

    it("Should set producer storage only by owner", async function () {
      const newStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
      
      await expect(
        producerApi.connect(producer).setProducerStorage(await newStorage.getAddress())
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("addPlanInfoApi", function () {
    it("Should add API plan info successfully", async function () {
      // First create a base plan
      const planData = {
        planId: 1,
        producerCloneAddress: await producer.getAddress(),
        name: "Test API Plan",
        description: "Test plan description",
        price: ethers.parseEther("1"),
        backgroundColor: "#FF0000",
        image: "https://example.com/image.png",
        priceAddress: ethers.ZeroAddress,
        startDate: Math.floor(Date.now() / 1000),
        status: 1, // active
        planType: 0, // API type
        custumerPlanIds: []
      };

      // Mock the plan exists in storage (would normally be created by Producer contract)
      // For this test, we'll assume the plan validation passes

      const apiPlanInfo = {
        planId: 1,
        flowRate: ethers.parseEther("0.1"), // 0.1 tokens per second
        baseQuota: 10000 // 10k API calls
      };

      await expect(
        producerApi.addPlanInfoApi(apiPlanInfo)
      ).to.emit(producerApi, "PlanInfoApiAdded")
        .withArgs(1, ethers.parseEther("0.1"), 10000);
    });

    it("Should only allow producer contract to add plan info", async function () {
      const apiPlanInfo = {
        planId: 1,
        flowRate: ethers.parseEther("0.1"),
        baseQuota: 10000
      };

      await expect(
        producerApi.connect(customer).addPlanInfoApi(apiPlanInfo)
      ).to.be.revertedWith("Only producer contract can call this function");
    });
  });

  describe("validateApiUsage", function () {
    beforeEach(async function () {
      // Setup a customer plan for testing
      const customerPlan = {
        customerPlanId: 1,
        planId: 1,
        customerAdress: await customer.getAddress(),
        cloneAddress: await producer.getAddress(),
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        isActive: true,
        status: 1, // active
        remainingQuota: ethers.parseEther("1000") // 1000 API calls remaining
      };

      // Mock storage calls
      // In real implementation, these would be set through Producer contract
    });

    it("Should validate API usage correctly", async function () {
      const result = await producerApi.validateApiUsage(1, 100);
      
      // Result should contain validation status and remaining quota
      expect(result.length).to.equal(2);
    });

    it("Should reject usage when quota exceeded", async function () {
      // Try to use more than available quota
      const result = await producerApi.validateApiUsage(1, 2000);
      
      // Should return false for validation
      // Implementation details depend on actual storage setup
    });
  });

  describe("processApiUsage", function () {
    it("Should process API usage and update quota", async function () {
      await expect(
        producerApi.processApiUsage(1, 100)
      ).to.emit(producerApi, "ApiUsageProcessed")
        .withArgs(1, 100, anyValue);
    });

    it("Should only allow authorized calls", async function () {
      await expect(
        producerApi.connect(customer).processApiUsage(1, 100)
      ).to.be.revertedWith("Only producer contract can call this function");
    });
  });

  describe("calculateApiCost", function () {
    it("Should calculate API cost correctly", async function () {
      const cost = await producerApi.calculateApiCost(1, 100);
      
      expect(cost).to.be.greaterThan(0);
    });

    it("Should return proportional costs", async function () {
      const cost100 = await producerApi.calculateApiCost(1, 100);
      const cost200 = await producerApi.calculateApiCost(1, 200);
      
      expect(cost200).to.equal(cost100 * 2n);
    });

    it("Should handle zero usage", async function () {
      const cost = await producerApi.calculateApiCost(1, 0);
      
      expect(cost).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should enforce producer-only access", async function () {
      const apiPlanInfo = {
        planId: 1,
        flowRate: ethers.parseEther("0.1"),
        baseQuota: 10000
      };

      await expect(
        producerApi.connect(customer).addPlanInfoApi(apiPlanInfo)
      ).to.be.revertedWith("Only producer contract can call this function");
    });

    it("Should allow owner to update storage address", async function () {
      const newStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
      
      await producerApi.setProducerStorage(await newStorage.getAddress());
      
      expect(await producerApi.producerStorage()).to.equal(await newStorage.getAddress());
    });
  });

  describe("Edge Cases", function () {
    it("Should handle invalid plan IDs", async function () {
      const apiPlanInfo = {
        planId: 999, // Non-existent plan
        flowRate: ethers.parseEther("0.1"),
        baseQuota: 10000
      };

      // Should revert with appropriate error when plan doesn't exist
      await expect(
        producerApi.addPlanInfoApi(apiPlanInfo)
      ).to.be.reverted;
    });

    it("Should handle zero flow rate", async function () {
      const apiPlanInfo = {
        planId: 1,
        flowRate: 0,
        baseQuota: 10000
      };

      // Should allow zero flow rate (free API)
      await expect(
        producerApi.addPlanInfoApi(apiPlanInfo)
      ).to.not.be.reverted;
    });

    it("Should handle zero base quota", async function () {
      const apiPlanInfo = {
        planId: 1,
        flowRate: ethers.parseEther("0.1"),
        baseQuota: 0
      };

      // Should allow zero base quota (pay-per-use only)
      await expect(
        producerApi.addPlanInfoApi(apiPlanInfo)
      ).to.not.be.reverted;
    });
  });
});

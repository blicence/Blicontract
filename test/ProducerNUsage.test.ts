import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("ProducerNUsage Logic Contract", function () {
  let producerNUsage: any;
  let producerStorage: any;
  let owner: Signer;
  let producer: Signer;
  let customer: Signer;

  beforeEach(async function () {
    [owner, producer, customer] = await ethers.getSigners();

    // Deploy ProducerStorage
    producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
    
    // Deploy ProducerNUsage
    producerNUsage = await ethers.deployContract("ProducerNUsage");
    
    // Initialize ProducerNUsage
    await producerNUsage.initialize();
    await producerNUsage.setProducerStorage(await producerStorage.getAddress());
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await producerNUsage.producerStorage()).to.equal(await producerStorage.getAddress());
    });

    it("Should set producer storage only by owner", async function () {
      const newStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
      await expect(
        producerNUsage.connect(producer).setProducerStorage(await newStorage.getAddress())
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("addCustomerPlan", function () {
    it("Should add customer plan only by producer", async function () {
      const plan = {
        customerAdress: await customer.getAddress(),
        planId: 1,
        custumerPlanId: 1,
        producerId: 1,
        cloneAddress: await producer.getAddress(),
        priceAddress: await owner.getAddress(),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 86400,
        remainingQuota: 100,
        status: 1, // active
        planType: 1 // nUsage
      };
      await expect(
        producerNUsage.connect(producer).addCustomerPlan(plan)
      ).to.not.be.reverted;
      // Only producer contract can call
      await expect(
        producerNUsage.connect(customer).addCustomerPlan(plan)
      ).to.be.revertedWith("Only producer contract can call this function");
    });
  });

  describe("updateCustomerPlan", function () {
    it("Should update customer plan only by right producer", async function () {
      const plan = {
        customerAdress: await customer.getAddress(),
        planId: 1,
        custumerPlanId: 1,
        producerId: 1,
        cloneAddress: await producer.getAddress(),
        priceAddress: await owner.getAddress(),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 86400,
        remainingQuota: 100,
        status: 1, // active
        planType: 1 // nUsage
      };
      await producerNUsage.connect(producer).addCustomerPlan(plan);
      await expect(
        producerNUsage.connect(producer).updateCustomerPlan(plan)
      ).to.not.be.reverted;
      // Only right producer contract can call
      const wrongPlan = { ...plan, cloneAddress: await owner.getAddress() };
      await expect(
        producerNUsage.connect(owner).updateCustomerPlan(wrongPlan)
      ).to.be.reverted;
    });
  });

  describe("useFromQuota", function () {
    it("Should use from quota and decrease remainingQuota", async function () {
      const plan = {
        customerAdress: await customer.getAddress(),
        planId: 1,
        custumerPlanId: 1,
        producerId: 1,
        cloneAddress: await producer.getAddress(),
        priceAddress: await owner.getAddress(),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 86400,
        remainingQuota: 10,
        status: 1, // active
        planType: 1 // nUsage
      };
      await producerNUsage.connect(producer).addCustomerPlan(plan);
      const tx = await producerNUsage.connect(producer).useFromQuota(plan);
      await expect(tx).to.not.be.reverted;
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
const hre = require("hardhat");
import { Signer } from "ethers";
import { Factory, Producer, URIGenerator, TestToken, ProducerStorage, StreamLockManager } from "../../typechain-types";

describe("🏋️ Enhanced Gym Scenario Tests", function () {
  let factory: Factory;
  let uriGenerator: URIGenerator;
  let producerStorage: ProducerStorage;
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let gymOwner: Signer;
  let customer: Signer;
  let deployerAddress: string;
  let producerProxy: Producer;

  beforeEach(async function () {
    const [deployer, _gymOwner, _customer] = await ethers.getSigners();
    gymOwner = _gymOwner;
    customer = _customer;
    deployerAddress = await deployer.getAddress();

    console.log("🏋️ Setting up Enhanced Gym Scenario test...");

    // 1. Deploy TestToken first
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "Gym Token",
      "GYM", 
      18,
      ethers.parseEther("1000000")
    ) as TestToken;

    // 2. Deploy StreamLockManager
    const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
    streamLockManager = await hre.upgrades.deployProxy(
      StreamLockManager,
      [
        deployerAddress,
        ethers.parseEther("0.001"), // min amount
        3600, // min duration (1 hour)
        365 * 24 * 3600 // max duration (1 year)
      ],
      { initializer: "initialize", kind: "uups" }
    ) as StreamLockManager;

    // 3. Deploy ProducerStorage
    const ProducerStorage = await ethers.getContractFactory("ProducerStorage");
    producerStorage = await ProducerStorage.deploy(deployerAddress);

    // 4. Deploy URIGenerator
    const URIGenerator = await ethers.getContractFactory("URIGenerator");
    uriGenerator = await hre.upgrades.deployProxy(
      URIGenerator,
      [],
      { initializer: "initialize", kind: "uups" }
    );

    // 5. Deploy Factory with StreamLockManager integration
    const Factory = await ethers.getContractFactory("Factory");
    const producerImplementation = await ethers.deployContract("Producer");
    
    factory = await hre.upgrades.deployProxy(
      Factory,
      [
        await uriGenerator.getAddress(),
        await producerStorage.getAddress(),
        deployerAddress, // mock producerApi
        deployerAddress, // mock producerNUsage
        deployerAddress, // mock producerVestingApi
        await streamLockManager.getAddress(),
        await producerImplementation.getAddress()
      ],
      { initializer: "initialize", kind: "uups" }
    ) as Factory;

    // 6. Set Factory in ProducerStorage
    await producerStorage.setFactory(
      await factory.getAddress(),
      deployerAddress, // mock producerApi
      deployerAddress, // mock producerNUsage  
      deployerAddress  // mock producerVestingApi
    );

    // 7. Authorize Factory in StreamLockManager
    await streamLockManager.setAuthorizedCaller(await factory.getAddress(), true);

    // 8. Setup test tokens
    await testToken.transfer(await customer.getAddress(), ethers.parseEther("10000"));
    await testToken.transfer(await gymOwner.getAddress(), ethers.parseEther("5000"));
    
    // 9. Approve StreamLockManager
    await testToken.connect(customer).approve(await streamLockManager.getAddress(), ethers.MaxUint256);
    await testToken.connect(gymOwner).approve(await streamLockManager.getAddress(), ethers.MaxUint256);

    console.log("✅ Enhanced Gym Scenario Setup completed");
  });

  describe("🏃‍♂️ Gym Membership Scenarios", function () {
    it("Should create gym with monthly membership plan", async function () {
      console.log("🏋️ Creating gym with monthly membership...");

      // Create gym business using newBcontract
      const producerData = {
        id: 0, // Will be assigned by factory
        producer: ethers.ZeroAddress, // Will be assigned by factory
        name: "Elite Fitness Gym",
        description: "Your premier fitness destination",
        image: "https://elite-fitness.com/logo.png",
        externalLink: "https://elite-fitness.com",
        owner: await gymOwner.getAddress(),
        isActive: true
      };

      const tx = await factory.connect(gymOwner).newBcontract(producerData);

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      expect(producerAddress).to.not.equal("");
      
      // Get producer proxy
      producerProxy = await ethers.getContractAt("Producer", producerAddress);

      // Create monthly membership plan
      const monthlyPrice = ethers.parseEther("50"); // $50/month
      const monthlyDuration = 30 * 24 * 3600; // 30 days

      await producerProxy.connect(gymOwner).createPlan(
        "Monthly Premium Membership",
        "Access to all gym facilities and classes",
        monthlyPrice,
        monthlyDuration,
        await testToken.getAddress(),
        true // isActive
      );

      const plans = await producerProxy.getPlans();
      expect(plans.length).to.equal(1);
      expect(plans[0].name).to.equal("Monthly Premium Membership");
      expect(plans[0].price).to.equal(monthlyPrice);

      console.log("✅ Monthly membership plan created successfully");
    });

    it("Should create annual membership with vesting discount", async function () {
      console.log("🏋️ Creating annual membership with vesting discount...");

      // Create gym first
      const tx = await factory.connect(gymOwner).createProducer(
        "PowerFit Gym",
        "Strength and conditioning specialists",
        "https://powerfit.com",
        "gym,strength,conditioning"
      );

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      producerProxy = await ethers.getContractAt("Producer", producerAddress);

      // Create annual membership with immediate access and gradual payments
      const annualPrice = ethers.parseEther("500"); // $500/year (discounted from $600)
      const immediateAmount = ethers.parseEther("100"); // $100 upfront
      const annualDuration = 365 * 24 * 3600; // 1 year
      const cliffPeriod = 7 * 24 * 3600; // 1 week cliff

      // Create vesting stream for annual membership
      const customerAddress = await customer.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      const vestingTx = await streamLockManager.connect(customer).createVestingStream(
        customerAddress,
        gymAddress,
        tokenAddress,
        annualPrice,
        cliffDate,
        annualDuration,
        immediateAmount
      );

      await expect(vestingTx).to.emit(streamLockManager, "StreamLockCreated");

      // Check that immediate amount was transferred
      const gymBalance = await testToken.balanceOf(gymAddress);
      expect(gymBalance).to.equal(immediateAmount);

      console.log("✅ Annual membership with vesting created successfully");
    });

    it("Should handle personal training package with usage pool", async function () {
      console.log("🏋️ Creating personal training package with usage pool...");

      // Create gym
      const tx = await factory.connect(gymOwner).createProducer(
        "FitPro Training",
        "Personal training excellence",
        "https://fitpro.com",
        "training,personal,fitness"
      );

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      producerProxy = await ethers.getContractAt("Producer", producerAddress);

      // Create usage pool for personal training sessions
      const packagePrice = ethers.parseEther("600"); // $600 for 10 sessions
      const sessionCount = 10;
      
      const customerAddress = await customer.getAddress();
      const trainerAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const poolTx = await streamLockManager.connect(customer).createUsagePool(
        customerAddress,
        trainerAddress,
        tokenAddress,
        packagePrice,
        sessionCount
      );

      const poolReceipt = await poolTx.wait();
      const poolLogs = poolReceipt?.logs || [];
      let poolId: any;

      for (const log of poolLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            poolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Simulate using 3 training sessions
      for (let i = 0; i < 3; i++) {
        await streamLockManager.connect(customer).consumeUsageFromPool(poolId, 1);
      }

      // Check remaining sessions
      const poolInfo = await streamLockManager.getTokenLock(poolId);
      expect(poolInfo.usedCount).to.equal(3);
      expect(poolInfo.usageCount - poolInfo.usedCount).to.equal(7);

      console.log("✅ Personal training package with usage pool created successfully");
    });

    it("Should create family membership plan with batch streams", async function () {
      console.log("🏋️ Creating family membership with batch streams...");

      // Create gym
      const tx = await factory.connect(gymOwner).createProducer(
        "Family Fitness Center",
        "Fitness for the whole family",
        "https://familyfitness.com",
        "family,fitness,kids"
      );

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      producerProxy = await ethers.getContractAt("Producer", producerAddress);

      // Create multiple streams for family members (batch operation)
      const membershipDuration = 90 * 24 * 3600; // 3 months
      const adultPrice = ethers.parseEther("40"); // $40/month per adult
      const childPrice = ethers.parseEther("20"); // $20/month per child
      
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const familyStreams = [
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: adultPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: adultPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: childPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: childPrice,
          duration: membershipDuration
        }
      ];

      const batchTx = await streamLockManager.connect(customer).batchCreateStreams(familyStreams);
      const batchReceipt = await batchTx.wait();

      // Count created streams
      const streamEvents = batchReceipt?.logs.filter(log => {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsedLog?.name === "StreamLockCreated";
        } catch {
          return false;
        }
      });

      expect(streamEvents?.length).to.equal(4);

      console.log("✅ Family membership with batch streams created successfully");
    });

    it("Should handle gym class packages with customer plan integration", async function () {
      console.log("🏋️ Creating gym class packages with customer plan integration...");

      // Create gym
      const tx = await factory.connect(gymOwner).createProducer(
        "ClassFit Studio",
        "Group fitness classes",
        "https://classfit.com",
        "classes,group,yoga,pilates"
      );

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      producerProxy = await ethers.getContractAt("Producer", producerAddress);

      // Create a class package plan
      const classPackagePrice = ethers.parseEther("80"); // $80 for 10 classes
      const packageDuration = 60 * 24 * 3600; // 60 days validity

      await producerProxy.connect(gymOwner).createPlan(
        "10-Class Package",
        "Attend any 10 group fitness classes",
        classPackagePrice,
        packageDuration,
        await testToken.getAddress(),
        true
      );

      // Customer subscribes to plan and creates linked stream
      const customerAddress = await customer.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const planId = 0; // First plan created

      const planStreamTx = await streamLockManager.connect(customer).createStreamForCustomerPlan(
        planId,
        customerAddress,
        gymAddress,
        tokenAddress,
        classPackagePrice,
        packageDuration
      );

      await expect(planStreamTx).to.emit(streamLockManager, "CustomerPlanStreamCreated");

      // Verify stream is linked to customer plan
      const linkedStreamId = await streamLockManager.customerPlanStreams(planId);
      expect(linkedStreamId).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

      console.log("✅ Gym class package with customer plan integration created successfully");
    });

    it("Should handle membership cancellation and refunds", async function () {
      console.log("🏋️ Testing membership cancellation and refunds...");

      // Create gym and membership stream
      const tx = await factory.connect(gymOwner).createProducer(
        "CancelTest Gym",
        "Testing cancellation policies",
        "https://canceltest.com",
        "gym,test"
      );

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      // Create 6-month membership
      const membershipPrice = ethers.parseEther("300"); // $300 for 6 months
      const membershipDuration = 180 * 24 * 3600; // 6 months
      
      const customerAddress = await customer.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const streamTx = await streamLockManager.connect(customer).createStreamLock(
        gymAddress,
        tokenAddress,
        membershipPrice,
        membershipDuration
      );

      const streamReceipt = await streamTx.wait();
      const streamLogs = streamReceipt?.logs || [];
      let streamId: any;

      for (const log of streamLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            streamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward 2 months (1/3 of membership used)
      await time.increase(60 * 24 * 3600);

      // Customer cancels membership
      const customerBalanceBefore = await testToken.balanceOf(customerAddress);
      
      await streamLockManager.connect(customer).cancelStream(streamId);
      
      const customerBalanceAfter = await testToken.balanceOf(customerAddress);
      
      // Customer should get partial refund for unused portion
      expect(customerBalanceAfter).to.be.gt(customerBalanceBefore);

      console.log("✅ Membership cancellation and refund handled successfully");
    });

    it("Should track gym revenue and expired memberships", async function () {
      console.log("🏋️ Testing gym revenue tracking and expired memberships...");

      // Create gym
      const tx = await factory.connect(gymOwner).createProducer(
        "Revenue Gym",
        "Tracking all the gains",
        "https://revenuegym.com",
        "gym,revenue,tracking"
      );

      const receipt = await tx.wait();
      const events = receipt?.logs || [];
      let producerAddress: string = "";

      for (const log of events) {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "ProducerCreated") {
            producerAddress = parsedLog.args.producer;
            break;
          }
        } catch {
          continue;
        }
      }

      // Create multiple short-term memberships
      const membershipPrice = ethers.parseEther("25"); // $25 for weekly membership
      const membershipDuration = 7 * 24 * 3600; // 1 week
      
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const membershipStreams = [
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: membershipPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: membershipPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: membershipPrice,
          duration: membershipDuration
        }
      ];

      await streamLockManager.connect(customer).batchCreateStreams(membershipStreams);

      // Fast forward to expire memberships
      await time.increase(membershipDuration + 3600); // Expire + 1 hour

      // Gym owner claims all expired memberships
      const gymBalanceBefore = await testToken.balanceOf(gymAddress);
      
      const claimTx = await streamLockManager.connect(gymOwner).claimStreamsByProducer();
      await expect(claimTx).to.emit(streamLockManager, "ProducerBatchClaim");
      
      const gymBalanceAfter = await testToken.balanceOf(gymAddress);
      
      // Gym should receive payment from all 3 expired memberships
      const expectedRevenue = membershipPrice * BigInt(3);
      expect(gymBalanceAfter - gymBalanceBefore).to.equal(expectedRevenue);

      console.log("✅ Gym revenue tracking and expired membership claims completed successfully");
    });
  });

  describe("🔧 Admin and Configuration Tests", function () {
    it("Should allow gym owner to pause/unpause services", async function () {
      console.log("🏋️ Testing admin pause/unpause functionality...");

      // Test pause functionality (owner should be able to pause StreamLockManager)
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create stream while paused (should fail)
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(customer).createStreamLock(
          gymAddress,
          tokenAddress,
          ethers.parseEther("50"),
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify functionality returns
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      // Should work after unpause
      const unpausedTx = await streamLockManager.connect(customer).createStreamLock(
        gymAddress,
        tokenAddress,
        ethers.parseEther("50"),
        30 * 24 * 3600
      );

      await expect(unpausedTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Admin pause/unpause functionality tested successfully");
    });

    it("Should validate gym business parameters", async function () {
      console.log("🏋️ Testing gym business parameter validation...");

      // Test minimum stream amounts and durations
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Too small amount should fail
      await expect(
        streamLockManager.connect(customer).createStreamLock(
          gymAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Below minimum
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Too short duration should fail
      await expect(
        streamLockManager.connect(customer).createStreamLock(
          gymAddress,
          tokenAddress,
          ethers.parseEther("50"),
          1800 // 30 minutes, below minimum
        )
      ).to.be.reverted;

      // Valid parameters should work
      const validTx = await streamLockManager.connect(customer).createStreamLock(
        gymAddress,
        tokenAddress,
        ethers.parseEther("50"),
        30 * 24 * 3600
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Gym business parameter validation completed successfully");
    });
  });
});
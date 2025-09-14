import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../../typechain-types";

describe("🏋️ Simplified Gym Scenario Tests", function () {
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let gymOwner: Signer;
  let customer1: Signer;
  let customer2: Signer;
  let customer3: Signer;
  
  const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
  const MIN_STREAM_DURATION = 3600; // 1 hour
  const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

  beforeEach(async function () {
    const [deployer, _gymOwner, _customer1, _customer2, _customer3] = await ethers.getSigners();
    gymOwner = _gymOwner;
    customer1 = _customer1;
    customer2 = _customer2;
    customer3 = _customer3;

    console.log("🏋️ Setting up Simplified Gym Scenario test...");

    // 1. Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "Gym Token",
      "GYM", 
      18,
      ethers.parseEther("1000000")
    );

    // 2. Deploy StreamLockManager
    const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
    streamLockManager = await hre.upgrades.deployProxy(
      StreamLockManager,
      [
        await deployer.getAddress(),
        MIN_STREAM_AMOUNT,
        MIN_STREAM_DURATION,
        MAX_STREAM_DURATION
      ],
      { initializer: "initialize" }
    ) as unknown as StreamLockManager;

    // 3. Setup tokens for customers and gym
    const transferAmount = ethers.parseEther("5000");
    await testToken.transfer(await customer1.getAddress(), transferAmount);
    await testToken.transfer(await customer2.getAddress(), transferAmount);
    await testToken.transfer(await customer3.getAddress(), transferAmount);
    await testToken.transfer(await gymOwner.getAddress(), transferAmount);
    
    // 4. Approve StreamLockManager for all parties
    const maxApproval = ethers.MaxUint256;
    await testToken.connect(customer1).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(customer2).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(customer3).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(gymOwner).approve(await streamLockManager.getAddress(), maxApproval);

    // 5. Set gym owner as authorized caller for advanced features
    await streamLockManager.setAuthorizedCaller(await gymOwner.getAddress(), true);

    console.log("✅ Simplified Gym Scenario Setup completed");
  });

  describe("💪 Basic Gym Memberships", function () {
    it("Should handle monthly gym membership", async function () {
      console.log("🏋️ Testing monthly gym membership...");

      const membershipPrice = ethers.parseEther("50"); // $50/month
      const membershipDuration = 30 * 24 * 3600; // 30 days
      
      const gymAddress = await gymOwner.getAddress();
      const customerAddress = await customer1.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Customer creates monthly membership stream
      const tx = await streamLockManager.connect(customer1).createStreamLock(
        gymAddress,
        tokenAddress,
        membershipPrice,
        membershipDuration
      );

      await expect(tx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify stream is active
      const receipt = await tx.wait();
      const logs = receipt?.logs || [];
      let streamId: any;
      
      for (const log of logs) {
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

      const streamStatus = await streamLockManager.getStreamStatus(streamId);
      expect(streamStatus.isActive).to.be.true;
      expect(streamStatus.isExpired).to.be.false;

      console.log("✅ Monthly gym membership created successfully");
    });

    it("Should handle multiple customer memberships", async function () {
      console.log("🏋️ Testing multiple customer memberships...");

      const membershipPrice = ethers.parseEther("40"); // $40/month
      const membershipDuration = 30 * 24 * 3600; // 30 days
      
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create batch membership streams for multiple customers
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

      // Customer1 creates memberships for family
      const batchTx = await streamLockManager.connect(customer1).batchCreateStreams(membershipStreams);
      const batchReceipt = await batchTx.wait();

      // Verify all streams were created
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

      expect(streamEvents?.length).to.equal(3);

      console.log("✅ Multiple customer memberships created successfully");
    });

    it("Should handle annual membership with immediate discount", async function () {
      console.log("🏋️ Testing annual membership with immediate discount...");

      const annualPrice = ethers.parseEther("480"); // $480/year (20% discount)
      const immediateDiscount = ethers.parseEther("80"); // $80 immediate discount
      const vestingDuration = 365 * 24 * 3600; // 1 year
      const cliffPeriod = 7 * 24 * 3600; // 1 week cliff

      const customerAddress = await customer2.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for annual membership
      const vestingTx = await streamLockManager.connect(gymOwner).createVestingStream(
        customerAddress,
        gymAddress,
        tokenAddress,
        annualPrice,
        cliffDate,
        vestingDuration,
        immediateDiscount
      );

      await expect(vestingTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate discount was transferred
      const gymBalance = await testToken.balanceOf(gymAddress);
      expect(gymBalance).to.be.gte(immediateDiscount);

      console.log("✅ Annual membership with immediate discount created successfully");
    });
  });

  describe("🎯 Personal Training Packages", function () {
    it("Should create personal training session package", async function () {
      console.log("🏋️ Testing personal training session package...");

      const packagePrice = ethers.parseEther("500"); // $500 for 8 sessions
      const sessionCount = 8;
      
      const customerAddress = await customer3.getAddress();
      const trainerAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for training sessions
      const poolTx = await streamLockManager.connect(gymOwner).createUsagePool(
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

      // Verify pool was created correctly
      const poolInfo = await streamLockManager.getTokenLock(poolId);
      expect(poolInfo.usageCount).to.equal(sessionCount);
      expect(poolInfo.usedCount).to.equal(0);
      expect(poolInfo.streamType).to.equal(2); // USAGE_POOL

      // Simulate using 3 training sessions - gym owner processes usage
      for (let i = 0; i < 3; i++) {
        await streamLockManager.connect(gymOwner).consumeUsageFromPool(poolId, 1);
      }

      // Check remaining sessions
      const updatedPoolInfo = await streamLockManager.getTokenLock(poolId);
      expect(updatedPoolInfo.usedCount).to.equal(3);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(5);

      console.log("✅ Personal training session package created and used successfully");
    });

    it("Should handle trainer payments for completed sessions", async function () {
      console.log("🏋️ Testing trainer payments for completed sessions...");

      const sessionPrice = ethers.parseEther("75"); // $75 per session
      const sessionDuration = 3600; // 1 hour session
      
      const customerAddress = await customer1.getAddress();
      const trainerAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create stream for individual training session
      const sessionTx = await streamLockManager.connect(customer1).createStreamLock(
        trainerAddress,
        tokenAddress,
        sessionPrice,
        sessionDuration
      );

      const sessionReceipt = await sessionTx.wait();
      const sessionLogs = sessionReceipt?.logs || [];
      let sessionStreamId: any;

      for (const log of sessionLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            sessionStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward time to complete session
      await time.increase(sessionDuration + 300); // Session + 5 minutes

      // Trainer claims payment for completed session
      const trainerBalanceBefore = await testToken.balanceOf(trainerAddress);
      
      await streamLockManager.connect(gymOwner).settleStream(sessionStreamId);
      
      const trainerBalanceAfter = await testToken.balanceOf(trainerAddress);
      
      // Trainer should receive close to full payment for completed session (allowing for minor precision loss)
      const balanceDiff = trainerBalanceAfter - trainerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(sessionPrice, ethers.parseEther("0.001"));

      console.log("✅ Trainer payment for completed session processed successfully");
    });
  });

  describe("👨‍👩‍👧‍👦 Family and Group Memberships", function () {
    it("Should create family membership plan with different rates", async function () {
      console.log("🏋️ Testing family membership with different rates...");

      const adultMembershipPrice = ethers.parseEther("45"); // $45/month per adult
      const childMembershipPrice = ethers.parseEther("25"); // $25/month per child
      const membershipDuration = 90 * 24 * 3600; // 3 months
      
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create family package with different rates
      const familyStreams = [
        // 2 Adults
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: adultMembershipPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: adultMembershipPrice,
          duration: membershipDuration
        },
        // 2 Children
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: childMembershipPrice,
          duration: membershipDuration
        },
        {
          recipient: gymAddress,
          token: tokenAddress,
          totalAmount: childMembershipPrice,
          duration: membershipDuration
        }
      ];

      const familyTx = await streamLockManager.connect(customer2).batchCreateStreams(familyStreams);
      const familyReceipt = await familyTx.wait();

      // Verify all family memberships were created
      const familyEvents = familyReceipt?.logs.filter(log => {
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

      expect(familyEvents?.length).to.equal(4);

      // Calculate total family cost
      const totalFamilyCost = (adultMembershipPrice * BigInt(2)) + (childMembershipPrice * BigInt(2));
      const expectedMonthlyCost = ethers.parseEther("140"); // $45*2 + $25*2 = $140
      
      expect(totalFamilyCost).to.equal(expectedMonthlyCost);

      console.log("✅ Family membership with different rates created successfully");
    });

    it("Should handle group class package bookings", async function () {
      console.log("🏋️ Testing group class package bookings...");

      const classPackagePrice = ethers.parseEther("120"); // $120 for 10 classes
      const classCount = 10;
      
      const customerAddress = await customer3.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for group classes
      const classTx = await streamLockManager.connect(gymOwner).createUsagePool(
        customerAddress,
        gymAddress,
        tokenAddress,
        classPackagePrice,
        classCount
      );

      const classReceipt = await classTx.wait();
      const classLogs = classReceipt?.logs || [];
      let classPoolId: any;

      for (const log of classLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            classPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Customer attends 6 classes over time - gym owner processes attendance
      for (let i = 0; i < 6; i++) {
        await streamLockManager.connect(gymOwner).consumeUsageFromPool(classPoolId, 1);
        // Simulate time between classes
        if (i < 5) await time.increase(2 * 24 * 3600); // 2 days between classes
      }

      // Check remaining classes
      const updatedClassInfo = await streamLockManager.getTokenLock(classPoolId);
      expect(updatedClassInfo.usedCount).to.equal(6);
      expect(updatedClassInfo.usageCount - updatedClassInfo.usedCount).to.equal(4);

      console.log("✅ Group class package bookings handled successfully");
    });
  });

  describe("💼 Gym Business Operations", function () {
    it("Should track total gym revenue from expired memberships", async function () {
      console.log("🏋️ Testing gym revenue tracking...");

      const membershipPrice = ethers.parseEther("30"); // $30/month
      const shortDuration = 7 * 24 * 3600; // 1 week for testing
      
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Get initial gym balance
      const gymBalanceBefore = await testToken.balanceOf(gymAddress);

      // Create 1 simple short-term membership
      const membershipTx = await streamLockManager.connect(customer1).createStreamLock(
        gymAddress,
        tokenAddress,
        membershipPrice,
        shortDuration
      );

      const membershipReceipt = await membershipTx.wait();
      const membershipLogs = membershipReceipt?.logs || [];
      let streamId: any;

      for (const log of membershipLogs) {
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

      // Fast forward to expire membership
      await time.increase(shortDuration + 3600); // Expire + 1 hour

      // Gym owner claims expired membership
      await streamLockManager.connect(gymOwner).settleStream(streamId);
      
      const gymBalanceAfter = await testToken.balanceOf(gymAddress);
      
      // Calculate expected revenue (allowing for streaming precision loss)
      const balanceDiff = gymBalanceAfter - gymBalanceBefore;
      expect(balanceDiff).to.be.closeTo(membershipPrice, ethers.parseEther("0.01")); // 1% tolerance

      console.log("✅ Gym revenue tracking completed successfully");
    });

    it("Should handle membership cancellations with partial refunds", async function () {
      console.log("🏋️ Testing membership cancellations with partial refunds...");

      const membershipPrice = ethers.parseEther("60"); // $60 for 2 months
      const membershipDuration = 60 * 24 * 3600; // 2 months
      
      const customerAddress = await customer1.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Customer creates 2-month membership
      const membershipTx = await streamLockManager.connect(customer1).createStreamLock(
        gymAddress,
        tokenAddress,
        membershipPrice,
        membershipDuration
      );

      const membershipReceipt = await membershipTx.wait();
      const membershipLogs = membershipReceipt?.logs || [];
      let membershipId: any;

      for (const log of membershipLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            membershipId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check locked balance after membership creation
      const lockedBalanceBefore = await streamLockManager.getLockedBalance(customerAddress, tokenAddress);
      expect(lockedBalanceBefore).to.equal(membershipPrice);

      // Customer uses gym for 3 weeks (half the membership period)
      await time.increase(21 * 24 * 3600); // 3 weeks

      // Customer cancels membership
      const cancelTx = await streamLockManager.connect(customer1).cancelStream(membershipId);
      await expect(cancelTx).to.emit(streamLockManager, "StreamSettled");
      
      // Check locked balance after cancellation - should be released
      const lockedBalanceAfter = await streamLockManager.getLockedBalance(customerAddress, tokenAddress);
      expect(lockedBalanceAfter).to.be.lt(lockedBalanceBefore);

      console.log("✅ Membership cancellation with partial refund processed successfully");
    });

    it("Should validate gym operational constraints", async function () {
      console.log("🏋️ Testing gym operational constraints...");

      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Test minimum membership duration
      await expect(
        streamLockManager.connect(customer1).createStreamLock(
          gymAddress,
          tokenAddress,
          ethers.parseEther("50"),
          1800 // 30 minutes - too short
        )
      ).to.be.reverted;

      // Test minimum membership amount
      await expect(
        streamLockManager.connect(customer1).createStreamLock(
          gymAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Too small
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Test valid membership should work
      const validTx = await streamLockManager.connect(customer1).createStreamLock(
        gymAddress,
        tokenAddress,
        ethers.parseEther("35"), // Valid amount
        15 * 24 * 3600 // Valid duration
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Gym operational constraints validated successfully");
    });
  });

  describe("🔧 Admin and Emergency Features", function () {
    it("Should allow gym emergency pause of services", async function () {
      console.log("🏋️ Testing emergency pause functionality...");

      // Test pause functionality
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create membership while paused
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(customer1).createStreamLock(
          gymAddress,
          tokenAddress,
          ethers.parseEther("40"),
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify services resume
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      const resumeTx = await streamLockManager.connect(customer1).createStreamLock(
        gymAddress,
        tokenAddress,
        ethers.parseEther("40"),
        30 * 24 * 3600
      );

      await expect(resumeTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Emergency pause functionality tested successfully");
    });

    it("Should track customer and gym balance states", async function () {
      console.log("🏋️ Testing balance state tracking...");

      const membershipPrice = ethers.parseEther("55");
      const membershipDuration = 45 * 24 * 3600; // 45 days
      
      const customerAddress = await customer2.getAddress();
      const gymAddress = await gymOwner.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Check initial balances
      const customerInitialBalance = await streamLockManager.getTotalBalance(customerAddress, tokenAddress);
      const gymInitialBalance = await streamLockManager.getTotalBalance(gymAddress, tokenAddress);

      // Create membership
      await streamLockManager.connect(customer2).createStreamLock(
        gymAddress,
        tokenAddress,
        membershipPrice,
        membershipDuration
      );

      // Check balances after membership creation
      const customerBalanceAfter = await streamLockManager.getTotalBalance(customerAddress, tokenAddress);
      const customerLockedBalance = await streamLockManager.getLockedBalance(customerAddress, tokenAddress);

      expect(customerBalanceAfter - customerInitialBalance).to.equal(membershipPrice);
      expect(customerLockedBalance).to.equal(membershipPrice);

      console.log("✅ Balance state tracking completed successfully");
    });
  });
});
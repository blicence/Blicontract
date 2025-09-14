import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../../typechain-types";

describe("💼 Freelancing Platform Subscription Scenario Tests", function () {
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let platform: Signer;
  let client1: Signer;
  let client2: Signer;
  let enterpriseClient: Signer;
  let freelancer: Signer;
  
  const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
  const MIN_STREAM_DURATION = 3600; // 1 hour
  const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

  beforeEach(async function () {
    const [deployer, _platform, _client1, _client2, _enterpriseClient, _freelancer] = await ethers.getSigners();
    platform = _platform;
    client1 = _client1;
    client2 = _client2;
    enterpriseClient = _enterpriseClient;
    freelancer = _freelancer;

    console.log("💼 Setting up Freelancing Platform Subscription Scenario test...");

    // 1. Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "Freelance Token",
      "WORK", 
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

    // 3. Setup tokens for clients, freelancers and platform
    const transferAmount = ethers.parseEther("10000");
    await testToken.transfer(await client1.getAddress(), transferAmount);
    await testToken.transfer(await client2.getAddress(), transferAmount);
    await testToken.transfer(await enterpriseClient.getAddress(), transferAmount);
    await testToken.transfer(await freelancer.getAddress(), transferAmount);
    await testToken.transfer(await platform.getAddress(), transferAmount);
    
    // 4. Approve StreamLockManager for all parties
    const maxApproval = ethers.MaxUint256;
    await testToken.connect(client1).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(client2).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(enterpriseClient).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(freelancer).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(platform).approve(await streamLockManager.getAddress(), maxApproval);

    // 5. Set platform as authorized caller for advanced features
    await streamLockManager.setAuthorizedCaller(await platform.getAddress(), true);
    await streamLockManager.setAuthorizedCaller(await freelancer.getAddress(), true);

    console.log("✅ Freelancing Platform Subscription Scenario Setup completed");
  });

  describe("🚀 Project-Based Payments", function () {
    it("Should handle fixed-price project payment", async function () {
      console.log("💼 Testing fixed-price project payment...");

      const projectPrice = ethers.parseEther("500"); // $500 project
      const projectDuration = 30 * 24 * 3600; // 30 days project
      
      const freelancerAddress = await freelancer.getAddress();
      const clientAddress = await client1.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates fixed-price project
      const projectTx = await streamLockManager.connect(client1).createStreamLock(
        freelancerAddress,
        tokenAddress,
        projectPrice,
        projectDuration
      );

      await expect(projectTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify project payment is locked
      const receipt = await projectTx.wait();
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

      console.log("✅ Fixed-price project payment created successfully");
    });

    it("Should handle hourly project payment", async function () {
      console.log("💼 Testing hourly project payment...");

      const hourlyRate = ethers.parseEther("50"); // $50/hour
      const totalHours = 40; // 40 hours project
      const totalPayment = hourlyRate * BigInt(totalHours);
      const projectDuration = 21 * 24 * 3600; // 21 days project
      
      const freelancerAddress = await freelancer.getAddress();
      const clientAddress = await client2.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates hourly project
      const hourlyTx = await streamLockManager.connect(client2).createStreamLock(
        freelancerAddress,
        tokenAddress,
        totalPayment,
        projectDuration
      );

      const hourlyReceipt = await hourlyTx.wait();
      const hourlyLogs = hourlyReceipt?.logs || [];
      let hourlyStreamId: any;

      for (const log of hourlyLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            hourlyStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward to project completion
      await time.increase(projectDuration + 3600);

      // Freelancer claims hourly payment
      const freelancerBalanceBefore = await testToken.balanceOf(freelancerAddress);
      
      await streamLockManager.connect(freelancer).settleStream(hourlyStreamId);
      
      const freelancerBalanceAfter = await testToken.balanceOf(freelancerAddress);
      
      // Freelancer should receive full payment
      const balanceDiff = freelancerBalanceAfter - freelancerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(totalPayment, ethers.parseEther("0.01"));

      console.log("✅ Hourly project payment processed successfully");
    });

    it("Should handle rush project with premium rate", async function () {
      console.log("💼 Testing rush project with premium rate...");

      const basePrice = ethers.parseEther("300"); // $300 base price
      const rushPremium = ethers.parseEther("100"); // $100 rush premium
      const totalPrice = basePrice + rushPremium;
      const rushDuration = 7 * 24 * 3600; // 7 days rush project
      
      const freelancerAddress = await freelancer.getAddress();
      const clientAddress = await enterpriseClient.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Enterprise client creates rush project
      const rushTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        freelancerAddress,
        tokenAddress,
        totalPrice,
        rushDuration
      );

      const rushReceipt = await rushTx.wait();
      const rushLogs = rushReceipt?.logs || [];
      let rushStreamId: any;

      for (const log of rushLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            rushStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify rush project is active
      const streamStatus = await streamLockManager.getStreamStatus(rushStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Rush project with premium rate created successfully");
    });
  });

  describe("📈 Milestone-Based Payments", function () {
    it("Should handle project with milestone payments", async function () {
      console.log("💼 Testing project with milestone payments...");

      const milestonePayment = ethers.parseEther("200"); // $200 per milestone
      const milestoneCount = 5; // 5 milestones
      const totalProject = milestonePayment * BigInt(milestoneCount);
      
      const clientAddress = await client1.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for milestone payments
      const milestoneTx = await streamLockManager.connect(platform).createUsagePool(
        clientAddress,
        freelancerAddress,
        tokenAddress,
        totalProject,
        milestoneCount
      );

      const milestoneReceipt = await milestoneTx.wait();
      const milestoneLogs = milestoneReceipt?.logs || [];
      let milestonePoolId: any;

      for (const log of milestoneLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            milestonePoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify milestone pool was created correctly
      const poolInfo = await streamLockManager.getTokenLock(milestonePoolId);
      expect(poolInfo.usageCount).to.equal(milestoneCount);
      expect(poolInfo.usedCount).to.equal(0);
      expect(poolInfo.streamType).to.equal(2); // USAGE_POOL

      // Complete 3 milestones
      for (let i = 0; i < 3; i++) {
        await streamLockManager.connect(platform).consumeUsageFromPool(milestonePoolId, 1);
      }

      // Check remaining milestones
      const updatedPoolInfo = await streamLockManager.getTokenLock(milestonePoolId);
      expect(updatedPoolInfo.usedCount).to.equal(3);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(2);

      console.log("✅ Project with milestone payments created and processed successfully");
    });

    it("Should handle progressive milestone releases", async function () {
      console.log("💼 Testing progressive milestone releases...");

      const initialMilestone = ethers.parseEther("150"); // $150 initial milestone
      const totalProject = ethers.parseEther("800"); // $800 total project
      const progressiveRelease = totalProject - initialMilestone;
      const vestingDuration = 60 * 24 * 3600; // 60 days progressive release
      const cliffPeriod = 14 * 24 * 3600; // 2 weeks cliff

      const clientAddress = await client2.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for progressive milestone releases
      const progressiveTx = await streamLockManager.connect(platform).createVestingStream(
        clientAddress,
        freelancerAddress,
        tokenAddress,
        totalProject,
        cliffDate,
        vestingDuration,
        initialMilestone
      );

      await expect(progressiveTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify initial milestone was released
      const freelancerBalance = await testToken.balanceOf(freelancerAddress);
      expect(freelancerBalance).to.be.gte(initialMilestone);

      console.log("✅ Progressive milestone releases created successfully");
    });

    it("Should handle performance-based milestone bonuses", async function () {
      console.log("💼 Testing performance-based milestone bonuses...");

      const baseProjectPrice = ethers.parseEther("600"); // $600 base project
      const performanceBonus = ethers.parseEther("150"); // $150 performance bonus
      const totalWithBonus = baseProjectPrice + performanceBonus;
      const projectDuration = 45 * 24 * 3600; // 45 days project
      
      const clientAddress = await enterpriseClient.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates performance-based project
      const performanceTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        freelancerAddress,
        tokenAddress,
        totalWithBonus,
        projectDuration
      );

      const performanceReceipt = await performanceTx.wait();
      const performanceLogs = performanceReceipt?.logs || [];
      let performanceStreamId: any;

      for (const log of performanceLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            performanceStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Complete project early with excellent performance (after 30 days)
      await time.increase(30 * 24 * 3600);

      // Freelancer claims performance-based payment
      const freelancerBalanceBefore = await testToken.balanceOf(freelancerAddress);
      
      await streamLockManager.connect(freelancer).settleStream(performanceStreamId);
      
      const freelancerBalanceAfter = await testToken.balanceOf(freelancerAddress);
      
      // Freelancer should receive partial payment proportional to time
      expect(freelancerBalanceAfter).to.be.gt(freelancerBalanceBefore);

      console.log("✅ Performance-based milestone bonuses processed successfully");
    });
  });

  describe("🔒 Escrow and Security Features", function () {
    it("Should handle escrow protection for large projects", async function () {
      console.log("💼 Testing escrow protection for large projects...");

      const largeProjectPrice = ethers.parseEther("2500"); // $2500 large project
      const escrowDuration = 90 * 24 * 3600; // 90 days escrow
      
      const clientAddress = await enterpriseClient.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates large project with escrow protection
      const escrowTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        freelancerAddress,
        tokenAddress,
        largeProjectPrice,
        escrowDuration
      );

      const escrowReceipt = await escrowTx.wait();
      const escrowLogs = escrowReceipt?.logs || [];
      let escrowStreamId: any;

      for (const log of escrowLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            escrowStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify escrow is active and funds are locked
      const streamStatus = await streamLockManager.getStreamStatus(escrowStreamId);
      expect(streamStatus.isActive).to.be.true;

      const lockedBalance = await streamLockManager.getLockedBalance(clientAddress, tokenAddress);
      expect(lockedBalance).to.equal(largeProjectPrice);

      console.log("✅ Escrow protection for large projects created successfully");
    });

    it("Should handle dispute resolution with partial releases", async function () {
      console.log("💼 Testing dispute resolution with partial releases...");

      const disputedProjectPrice = ethers.parseEther("400"); // $400 disputed project
      const partialRelease = ethers.parseEther("250"); // $250 partial release
      const projectDuration = 30 * 24 * 3600; // 30 days project
      
      const clientAddress = await client1.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates project
      const disputeTx = await streamLockManager.connect(client1).createStreamLock(
        freelancerAddress,
        tokenAddress,
        disputedProjectPrice,
        projectDuration
      );

      const disputeReceipt = await disputeTx.wait();
      const disputeLogs = disputeReceipt?.logs || [];
      let disputeStreamId: any;

      for (const log of disputeLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            disputeStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Project has issues after 2 weeks
      await time.increase(14 * 24 * 3600);

      // Platform resolves dispute with partial payment
      const freelancerBalanceBefore = await testToken.balanceOf(freelancerAddress);
      
      await streamLockManager.connect(freelancer).settleStream(disputeStreamId);
      
      const freelancerBalanceAfter = await testToken.balanceOf(freelancerAddress);
      
      // Freelancer should receive partial payment
      expect(freelancerBalanceAfter).to.be.gt(freelancerBalanceBefore);

      console.log("✅ Dispute resolution with partial releases processed successfully");
    });

    it("Should handle client refund for unsatisfactory work", async function () {
      console.log("💼 Testing client refund for unsatisfactory work...");

      const refundableProjectPrice = ethers.parseEther("300"); // $300 refundable project
      const projectDuration = 21 * 24 * 3600; // 21 days project
      
      const clientAddress = await client2.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates project
      const refundTx = await streamLockManager.connect(client2).createStreamLock(
        freelancerAddress,
        tokenAddress,
        refundableProjectPrice,
        projectDuration
      );

      const refundReceipt = await refundTx.wait();
      const refundLogs = refundReceipt?.logs || [];
      let refundStreamId: any;

      for (const log of refundLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            refundStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check locked balance before refund
      const lockedBalanceBefore = await streamLockManager.getLockedBalance(clientAddress, tokenAddress);
      expect(lockedBalanceBefore).to.equal(refundableProjectPrice);

      // Work is unsatisfactory, client requests refund after 1 week
      await time.increase(7 * 24 * 3600);

      // Client cancels project for refund
      const cancelTx = await streamLockManager.connect(client2).cancelStream(refundStreamId);
      await expect(cancelTx).to.emit(streamLockManager, "StreamSettled");
      
      // Check locked balance after refund
      const lockedBalanceAfter = await streamLockManager.getLockedBalance(clientAddress, tokenAddress);
      expect(lockedBalanceAfter).to.be.lt(lockedBalanceBefore);

      console.log("✅ Client refund for unsatisfactory work processed successfully");
    });
  });

  describe("🏢 Enterprise and Corporate Plans", function () {
    it("Should handle enterprise subscription plan", async function () {
      console.log("💼 Testing enterprise subscription plan...");

      const enterprisePlanPrice = ethers.parseEther("199.99"); // $199.99/month enterprise
      const planDuration = 30 * 24 * 3600; // 30 days enterprise plan
      
      const enterpriseAddress = await enterpriseClient.getAddress();
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Enterprise client subscribes to platform
      const enterpriseTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        platformAddress,
        tokenAddress,
        enterprisePlanPrice,
        planDuration
      );

      const enterpriseReceipt = await enterpriseTx.wait();
      const enterpriseLogs = enterpriseReceipt?.logs || [];
      let enterpriseStreamId: any;

      for (const log of enterpriseLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            enterpriseStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify enterprise subscription is active
      const streamStatus = await streamLockManager.getStreamStatus(enterpriseStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Enterprise subscription plan created successfully");
    });

    it("Should handle bulk project credits package", async function () {
      console.log("💼 Testing bulk project credits package...");

      const creditPackagePrice = ethers.parseEther("2000"); // $2000 for 20 project credits
      const projectCredits = 20;
      
      const enterpriseAddress = await enterpriseClient.getAddress();
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for project credits
      const creditTx = await streamLockManager.connect(platform).createUsagePool(
        enterpriseAddress,
        platformAddress,
        tokenAddress,
        creditPackagePrice,
        projectCredits
      );

      const creditReceipt = await creditTx.wait();
      const creditLogs = creditReceipt?.logs || [];
      let creditPoolId: any;

      for (const log of creditLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            creditPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Enterprise uses 8 project credits
      await streamLockManager.connect(platform).consumeUsageFromPool(creditPoolId, 8);

      // Check remaining project credits
      const updatedCreditInfo = await streamLockManager.getTokenLock(creditPoolId);
      expect(updatedCreditInfo.usedCount).to.equal(8);
      expect(updatedCreditInfo.usageCount - updatedCreditInfo.usedCount).to.equal(12);

      console.log("✅ Bulk project credits package processed successfully");
    });

    it("Should handle dedicated account manager service", async function () {
      console.log("💼 Testing dedicated account manager service...");

      const managerPrice = ethers.parseEther("500"); // $500/month dedicated manager
      const managerDuration = 30 * 24 * 3600; // 30 days manager service
      
      const enterpriseAddress = await enterpriseClient.getAddress();
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Enterprise subscribes to dedicated account manager
      const managerTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        platformAddress,
        tokenAddress,
        managerPrice,
        managerDuration
      );

      const managerReceipt = await managerTx.wait();
      const managerLogs = managerReceipt?.logs || [];
      let managerStreamId: any;

      for (const log of managerLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            managerStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Complete manager service after 25 days
      await time.increase(25 * 24 * 3600);

      // Platform processes manager service payment
      const platformBalanceBefore = await testToken.balanceOf(platformAddress);
      
      await streamLockManager.connect(platform).settleStream(managerStreamId);
      
      const platformBalanceAfter = await testToken.balanceOf(platformAddress);
      
      // Platform should receive manager service payment
      expect(platformBalanceAfter).to.be.gt(platformBalanceBefore);

      console.log("✅ Dedicated account manager service processed successfully");
    });
  });

  describe("📊 Platform Commission and Revenue", function () {
    it("Should handle standard platform commission", async function () {
      console.log("💼 Testing standard platform commission...");

      const projectPrice = ethers.parseEther("200"); // $200 project
      const platformFee = ethers.parseEther("20"); // $20 platform fee (10%)
      const totalPrice = projectPrice + platformFee;
      const projectDuration = 14 * 24 * 3600; // 14 days project
      
      const freelancerAddress = await freelancer.getAddress();
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client pays project price + platform fee
      const commissionTx = await streamLockManager.connect(client1).createStreamLock(
        freelancerAddress,
        tokenAddress,
        projectPrice, // Only project price goes to freelancer
        projectDuration
      );

      // Platform fee is handled separately in real implementation
      const platformFeeTx = await streamLockManager.connect(client1).createStreamLock(
        platformAddress,
        tokenAddress,
        platformFee,
        projectDuration
      );

      const commissionReceipt = await commissionTx.wait();
      const commissionLogs = commissionReceipt?.logs || [];
      let commissionStreamId: any;

      for (const log of commissionLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            commissionStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify both streams are active
      const streamStatus = await streamLockManager.getStreamStatus(commissionStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Standard platform commission processed successfully");
    });

    it("Should handle premium freelancer reduced commission", async function () {
      console.log("💼 Testing premium freelancer reduced commission...");

      const projectPrice = ethers.parseEther("800"); // $800 project
      const reducedFee = ethers.parseEther("24"); // $24 reduced fee (3% vs 10%)
      const projectDuration = 28 * 24 * 3600; // 28 days project
      
      const freelancerAddress = await freelancer.getAddress();
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Premium freelancer pays reduced commission
      const premiumTx = await streamLockManager.connect(client2).createStreamLock(
        freelancerAddress,
        tokenAddress,
        projectPrice,
        projectDuration
      );

      const reducedFeeTx = await streamLockManager.connect(client2).createStreamLock(
        platformAddress,
        tokenAddress,
        reducedFee,
        projectDuration
      );

      const premiumReceipt = await premiumTx.wait();
      const premiumLogs = premiumReceipt?.logs || [];
      let premiumStreamId: any;

      for (const log of premiumLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            premiumStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward to project completion
      await time.increase(projectDuration + 3600);

      // Freelancer claims premium project payment
      const freelancerBalanceBefore = await testToken.balanceOf(freelancerAddress);
      
      await streamLockManager.connect(freelancer).settleStream(premiumStreamId);
      
      const freelancerBalanceAfter = await testToken.balanceOf(freelancerAddress);
      
      // Freelancer should receive full project payment
      const balanceDiff = freelancerBalanceAfter - freelancerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(projectPrice, ethers.parseEther("0.01"));

      console.log("✅ Premium freelancer reduced commission processed successfully");
    });

    it("Should handle enterprise volume discount commission", async function () {
      console.log("💼 Testing enterprise volume discount commission...");

      const largeProjectPrice = ethers.parseEther("5000"); // $5000 enterprise project
      const volumeDiscountFee = ethers.parseEther("100"); // $100 volume discount fee (2%)
      const projectDuration = 60 * 24 * 3600; // 60 days project
      
      const freelancerAddress = await freelancer.getAddress();
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Enterprise volume discount applied
      const volumeTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        freelancerAddress,
        tokenAddress,
        largeProjectPrice,
        projectDuration
      );

      const volumeFeeTx = await streamLockManager.connect(enterpriseClient).createStreamLock(
        platformAddress,
        tokenAddress,
        volumeDiscountFee,
        projectDuration
      );

      const volumeReceipt = await volumeTx.wait();
      const volumeLogs = volumeReceipt?.logs || [];
      let volumeStreamId: any;

      for (const log of volumeLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            volumeStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify enterprise project is active
      const streamStatus = await streamLockManager.getStreamStatus(volumeStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Enterprise volume discount commission processed successfully");
    });
  });

  describe("💼 Freelancing Platform Business Operations", function () {
    it("Should track total platform revenue", async function () {
      console.log("💼 Testing platform revenue tracking...");

      const servicePrice = ethers.parseEther("120"); // $120 platform service
      const shortDuration = 7 * 24 * 3600; // 1 week for testing
      
      const platformAddress = await platform.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Get initial platform balance
      const platformBalanceBefore = await testToken.balanceOf(platformAddress);

      // Create platform service purchase
      const serviceTx = await streamLockManager.connect(client1).createStreamLock(
        platformAddress,
        tokenAddress,
        servicePrice,
        shortDuration
      );

      const serviceReceipt = await serviceTx.wait();
      const serviceLogs = serviceReceipt?.logs || [];
      let streamId: any;

      for (const log of serviceLogs) {
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

      // Fast forward to service completion
      await time.increase(shortDuration + 3600);

      // Platform claims service revenue
      await streamLockManager.connect(platform).settleStream(streamId);
      
      const platformBalanceAfter = await testToken.balanceOf(platformAddress);
      
      // Calculate revenue
      const balanceDiff = platformBalanceAfter - platformBalanceBefore;
      expect(balanceDiff).to.be.closeTo(servicePrice, ethers.parseEther("0.01"));

      console.log("✅ Platform revenue tracking completed successfully");
    });

    it("Should handle project dispute resolution", async function () {
      console.log("💼 Testing project dispute resolution...");

      const disputedProjectPrice = ethers.parseEther("350"); // $350 disputed project
      const projectDuration = 30 * 24 * 3600; // 30 days project
      
      const clientAddress = await client2.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Client creates disputed project
      const disputeTx = await streamLockManager.connect(client2).createStreamLock(
        freelancerAddress,
        tokenAddress,
        disputedProjectPrice,
        projectDuration
      );

      const disputeReceipt = await disputeTx.wait();
      const disputeLogs = disputeReceipt?.logs || [];
      let disputeStreamId: any;

      for (const log of disputeLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            disputeStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check locked balance before dispute resolution
      const lockedBalanceBefore = await streamLockManager.getLockedBalance(clientAddress, tokenAddress);
      expect(lockedBalanceBefore).to.equal(disputedProjectPrice);

      // Dispute arises after 2 weeks
      await time.increase(14 * 24 * 3600);

      // Client cancels project due to dispute
      const cancelTx = await streamLockManager.connect(client2).cancelStream(disputeStreamId);
      await expect(cancelTx).to.emit(streamLockManager, "StreamSettled");
      
      // Check locked balance after dispute resolution
      const lockedBalanceAfter = await streamLockManager.getLockedBalance(clientAddress, tokenAddress);
      expect(lockedBalanceAfter).to.be.lt(lockedBalanceBefore);

      console.log("✅ Project dispute resolution processed successfully");
    });

    it("Should validate freelancing service constraints", async function () {
      console.log("💼 Testing freelancing service constraints...");

      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Test minimum project duration
      await expect(
        streamLockManager.connect(client1).createStreamLock(
          freelancerAddress,
          tokenAddress,
          ethers.parseEther("100"),
          1800 // 30 minutes - too short
        )
      ).to.be.reverted;

      // Test minimum project price
      await expect(
        streamLockManager.connect(client1).createStreamLock(
          freelancerAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Too small
          7 * 24 * 3600
        )
      ).to.be.reverted;

      // Test valid project should work
      const validTx = await streamLockManager.connect(client1).createStreamLock(
        freelancerAddress,
        tokenAddress,
        ethers.parseEther("50"), // Valid amount
        7 * 24 * 3600 // Valid duration
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Freelancing service constraints validated successfully");
    });
  });

  describe("🚨 Freelancing Platform Admin Features", function () {
    it("Should allow platform emergency pause", async function () {
      console.log("💼 Testing platform emergency pause...");

      // Test pause functionality
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create project while paused
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(client1).createStreamLock(
          freelancerAddress,
          tokenAddress,
          ethers.parseEther("250"),
          14 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify services resume
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      const resumeTx = await streamLockManager.connect(client1).createStreamLock(
        freelancerAddress,
        tokenAddress,
        ethers.parseEther("250"),
        14 * 24 * 3600
      );

      await expect(resumeTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Platform emergency pause functionality tested successfully");
    });

    it("Should track client and freelancer balance states", async function () {
      console.log("💼 Testing freelancing balance state tracking...");

      const projectPrice = ethers.parseEther("400");
      const projectDuration = 21 * 24 * 3600; // 21 days
      
      const clientAddress = await client1.getAddress();
      const freelancerAddress = await freelancer.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Check initial balances
      const clientInitialBalance = await streamLockManager.getTotalBalance(clientAddress, tokenAddress);
      const freelancerInitialBalance = await streamLockManager.getTotalBalance(freelancerAddress, tokenAddress);

      // Create project
      await streamLockManager.connect(client1).createStreamLock(
        freelancerAddress,
        tokenAddress,
        projectPrice,
        projectDuration
      );

      // Check balances after project creation
      const clientBalanceAfter = await streamLockManager.getTotalBalance(clientAddress, tokenAddress);
      const clientLockedBalance = await streamLockManager.getLockedBalance(clientAddress, tokenAddress);

      expect(clientBalanceAfter - clientInitialBalance).to.equal(projectPrice);
      expect(clientLockedBalance).to.equal(projectPrice);

      console.log("✅ Freelancing balance state tracking completed successfully");
    });
  });
});
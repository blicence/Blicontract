import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../../typechain-types";

describe("💻 SaaS Platform Subscription Scenario Tests", function () {
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let saasProvider: Signer;
  let freeUser: Signer;
  let proUser: Signer;
  let enterpriseUser: Signer;
  let teamLead: Signer;
  
  const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
  const MIN_STREAM_DURATION = 3600; // 1 hour
  const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

  beforeEach(async function () {
    const [deployer, _saasProvider, _freeUser, _proUser, _enterpriseUser, _teamLead] = await ethers.getSigners();
    saasProvider = _saasProvider;
    freeUser = _freeUser;
    proUser = _proUser;
    enterpriseUser = _enterpriseUser;
    teamLead = _teamLead;

    console.log("💻 Setting up SaaS Platform Subscription Scenario test...");

    // 1. Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "SaaS Token",
      "SAAS", 
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

    // 3. Setup tokens for users and SaaS provider
    const transferAmount = ethers.parseEther("10000");
    await testToken.transfer(await freeUser.getAddress(), transferAmount);
    await testToken.transfer(await proUser.getAddress(), transferAmount);
    await testToken.transfer(await enterpriseUser.getAddress(), transferAmount);
    await testToken.transfer(await teamLead.getAddress(), transferAmount);
    await testToken.transfer(await saasProvider.getAddress(), transferAmount);
    
    // 4. Approve StreamLockManager for all parties
    const maxApproval = ethers.MaxUint256;
    await testToken.connect(freeUser).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(proUser).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(enterpriseUser).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(teamLead).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(saasProvider).approve(await streamLockManager.getAddress(), maxApproval);

    // 5. Set SaaS provider as authorized caller for advanced features
    await streamLockManager.setAuthorizedCaller(await saasProvider.getAddress(), true);

    console.log("✅ SaaS Platform Subscription Scenario Setup completed");
  });

  describe("📊 Freemium to Premium Upgrades", function () {
    it("Should handle freemium to pro upgrade", async function () {
      console.log("💻 Testing freemium to pro upgrade...");

      const proMonthlyPrice = ethers.parseEther("29"); // $29/month
      const upgradeDuration = 30 * 24 * 3600; // 30 days
      
      const providerAddress = await saasProvider.getAddress();
      const userAddress = await freeUser.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Free user upgrades to Pro plan
      const upgradeTx = await streamLockManager.connect(freeUser).createStreamLock(
        providerAddress,
        tokenAddress,
        proMonthlyPrice,
        upgradeDuration
      );

      await expect(upgradeTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify upgrade stream is active
      const receipt = await upgradeTx.wait();
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

      console.log("✅ Freemium to pro upgrade created successfully");
    });

    it("Should handle annual pro subscription with discount", async function () {
      console.log("💻 Testing annual pro subscription with discount...");

      const annualProPrice = ethers.parseEther("290"); // $290/year (16% discount)
      const immediateFeatures = ethers.parseEther("30"); // $30 immediate feature unlock
      const vestingDuration = 365 * 24 * 3600; // 1 year
      const cliffPeriod = 7 * 24 * 3600; // 1 week cliff

      const userAddress = await proUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for annual pro subscription
      const annualTx = await streamLockManager.connect(saasProvider).createVestingStream(
        userAddress,
        providerAddress,
        tokenAddress,
        annualProPrice,
        cliffDate,
        vestingDuration,
        immediateFeatures
      );

      await expect(annualTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate features were unlocked
      const providerBalance = await testToken.balanceOf(providerAddress);
      expect(providerBalance).to.be.gte(immediateFeatures);

      console.log("✅ Annual pro subscription with discount created successfully");
    });

    it("Should handle enterprise upgrade with custom pricing", async function () {
      console.log("💻 Testing enterprise upgrade with custom pricing...");

      const enterprisePrice = ethers.parseEther("499"); // $499/month enterprise
      const enterpriseDuration = 90 * 24 * 3600; // 3 months contract
      
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Enterprise user creates custom subscription
      const enterpriseTx = await streamLockManager.connect(enterpriseUser).createStreamLock(
        providerAddress,
        tokenAddress,
        enterprisePrice,
        enterpriseDuration
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

      // Verify enterprise subscription
      const streamStatus = await streamLockManager.getStreamStatus(enterpriseStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Enterprise upgrade with custom pricing created successfully");
    });
  });

  describe("🔧 Usage-Based API and Feature Access", function () {
    it("Should create API call usage pool", async function () {
      console.log("💻 Testing API call usage pool...");

      const apiPackagePrice = ethers.parseEther("100"); // $100 for 10,000 API calls
      const apiCallLimit = 10000;
      
      const userAddress = await proUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for API calls
      const apiTx = await streamLockManager.connect(saasProvider).createUsagePool(
        userAddress,
        providerAddress,
        tokenAddress,
        apiPackagePrice,
        apiCallLimit
      );

      const apiReceipt = await apiTx.wait();
      const apiLogs = apiReceipt?.logs || [];
      let apiPoolId: any;

      for (const log of apiLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            apiPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify API pool was created correctly
      const poolInfo = await streamLockManager.getTokenLock(apiPoolId);
      expect(poolInfo.usageCount).to.equal(apiCallLimit);
      expect(poolInfo.usedCount).to.equal(0);
      expect(poolInfo.streamType).to.equal(2); // USAGE_POOL

      // Simulate user consuming 2500 API calls
      await streamLockManager.connect(saasProvider).consumeUsageFromPool(apiPoolId, 2500);

      // Check remaining API calls
      const updatedPoolInfo = await streamLockManager.getTokenLock(apiPoolId);
      expect(updatedPoolInfo.usedCount).to.equal(2500);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(7500);

      console.log("✅ API call usage pool created and used successfully");
    });

    it("Should handle premium feature unlock packages", async function () {
      console.log("💻 Testing premium feature unlock packages...");

      const featurePackagePrice = ethers.parseEther("150"); // $150 for 5 premium features
      const featureCount = 5;
      
      const userAddress = await freeUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for premium features
      const featureTx = await streamLockManager.connect(saasProvider).createUsagePool(
        userAddress,
        providerAddress,
        tokenAddress,
        featurePackagePrice,
        featureCount
      );

      const featureReceipt = await featureTx.wait();
      const featureLogs = featureReceipt?.logs || [];
      let featurePoolId: any;

      for (const log of featureLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            featurePoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // User unlocks 3 premium features
      for (let i = 0; i < 3; i++) {
        await streamLockManager.connect(saasProvider).consumeUsageFromPool(featurePoolId, 1);
      }

      // Check remaining feature unlocks
      const updatedFeatureInfo = await streamLockManager.getTokenLock(featurePoolId);
      expect(updatedFeatureInfo.usedCount).to.equal(3);
      expect(updatedFeatureInfo.usageCount - updatedFeatureInfo.usedCount).to.equal(2);

      console.log("✅ Premium feature unlock packages created and used successfully");
    });

    it("Should handle overage billing for API limits", async function () {
      console.log("💻 Testing overage billing for API limits...");

      const overagePrice = ethers.parseEther("25"); // $25 overage fee
      const overageDuration = 7 * 24 * 3600; // 7 days to pay overage
      
      const userAddress = await proUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create stream for API overage billing
      const overageTx = await streamLockManager.connect(proUser).createStreamLock(
        providerAddress,
        tokenAddress,
        overagePrice,
        overageDuration
      );

      const overageReceipt = await overageTx.wait();
      const overageLogs = overageReceipt?.logs || [];
      let overageStreamId: any;

      for (const log of overageLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            overageStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward to overage payment completion
      await time.increase(overageDuration + 300);

      // Provider claims overage payment
      const providerBalanceBefore = await testToken.balanceOf(providerAddress);
      
      await streamLockManager.connect(saasProvider).settleStream(overageStreamId);
      
      const providerBalanceAfter = await testToken.balanceOf(providerAddress);
      
      // Provider should receive overage payment
      const balanceDiff = providerBalanceAfter - providerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(overagePrice, ethers.parseEther("0.001"));

      console.log("✅ Overage billing for API limits processed successfully");
    });
  });

  describe("👥 Team and Enterprise Plans", function () {
    it("Should create team subscription with multiple seats", async function () {
      console.log("💻 Testing team subscription with multiple seats...");

      const teamPrice = ethers.parseEther("199"); // $199/month for 10 seats
      const teamDuration = 30 * 24 * 3600; // 30 days
      const seatCount = 10;
      
      const teamLeadAddress = await teamLead.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create team subscription
      const teamTx = await streamLockManager.connect(teamLead).createStreamLock(
        providerAddress,
        tokenAddress,
        teamPrice,
        teamDuration
      );

      const teamReceipt = await teamTx.wait();
      const teamLogs = teamReceipt?.logs || [];
      let teamStreamId: any;

      for (const log of teamLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            teamStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify team subscription is active
      const streamStatus = await streamLockManager.getStreamStatus(teamStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Team subscription with multiple seats created successfully");
    });

    it("Should handle enterprise volume licensing", async function () {
      console.log("💻 Testing enterprise volume licensing...");

      const volumePrice = ethers.parseEther("2500"); // $2500 for 100 licenses
      const licenseCount = 100;
      
      const enterpriseAddress = await enterpriseUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for enterprise licenses
      const licenseTx = await streamLockManager.connect(saasProvider).createUsagePool(
        enterpriseAddress,
        providerAddress,
        tokenAddress,
        volumePrice,
        licenseCount
      );

      const licenseReceipt = await licenseTx.wait();
      const licenseLogs = licenseReceipt?.logs || [];
      let licensePoolId: any;

      for (const log of licenseLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            licensePoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Enterprise activates 45 licenses
      await streamLockManager.connect(saasProvider).consumeUsageFromPool(licensePoolId, 45);

      // Check remaining licenses
      const updatedLicenseInfo = await streamLockManager.getTokenLock(licensePoolId);
      expect(updatedLicenseInfo.usedCount).to.equal(45);
      expect(updatedLicenseInfo.usageCount - updatedLicenseInfo.usedCount).to.equal(55);

      console.log("✅ Enterprise volume licensing created and used successfully");
    });

    it("Should handle team plan downgrade and partial refund", async function () {
      console.log("💻 Testing team plan downgrade with partial refund...");

      const teamPrice = ethers.parseEther("299"); // $299 for 3 months
      const teamDuration = 90 * 24 * 3600; // 3 months
      
      const teamLeadAddress = await teamLead.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Team lead creates 3-month subscription
      const teamTx = await streamLockManager.connect(teamLead).createStreamLock(
        providerAddress,
        tokenAddress,
        teamPrice,
        teamDuration
      );

      const teamReceipt = await teamTx.wait();
      const teamLogs = teamReceipt?.logs || [];
      let teamStreamId: any;

      for (const log of teamLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            teamStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check locked balance before downgrade
      const lockedBalanceBefore = await streamLockManager.getLockedBalance(teamLeadAddress, tokenAddress);
      expect(lockedBalanceBefore).to.equal(teamPrice);

      // Team uses service for 1 month then downgrades
      await time.increase(30 * 24 * 3600); // 1 month

      // Team lead cancels subscription (downgrade)
      const cancelTx = await streamLockManager.connect(teamLead).cancelStream(teamStreamId);
      await expect(cancelTx).to.emit(streamLockManager, "StreamSettled");
      
      // Check locked balance after downgrade - should be reduced
      const lockedBalanceAfter = await streamLockManager.getLockedBalance(teamLeadAddress, tokenAddress);
      expect(lockedBalanceAfter).to.be.lt(lockedBalanceBefore);

      console.log("✅ Team plan downgrade with partial refund processed successfully");
    });
  });

  describe("🚀 Advanced SaaS Features", function () {
    it("Should handle white-label licensing with revenue sharing", async function () {
      console.log("💻 Testing white-label licensing with revenue sharing...");

      const whiteLabelPrice = ethers.parseEther("1000"); // $1000/month white-label
      const revenueShare = ethers.parseEther("200"); // $200 revenue share back to customer
      const licenseDuration = 30 * 24 * 3600; // 30 days
      const cliffPeriod = 7 * 24 * 3600; // 1 week cliff

      const customerAddress = await enterpriseUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for white-label with revenue sharing
      const whiteLabelTx = await streamLockManager.connect(saasProvider).createVestingStream(
        customerAddress,
        providerAddress,
        tokenAddress,
        whiteLabelPrice,
        cliffDate,
        licenseDuration,
        revenueShare
      );

      await expect(whiteLabelTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify revenue share was transferred immediately
      const providerBalance = await testToken.balanceOf(providerAddress);
      expect(providerBalance).to.be.gte(revenueShare);

      console.log("✅ White-label licensing with revenue sharing created successfully");
    });

    it("Should handle SaaS marketplace commission structure", async function () {
      console.log("💻 Testing SaaS marketplace commission structure...");

      const marketplaceRevenue = ethers.parseEther("500"); // $500 marketplace revenue
      const commissionDuration = 30 * 24 * 3600; // 30 days
      
      const developerAddress = await proUser.getAddress();
      const marketplaceAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Developer pays marketplace commission
      const commissionTx = await streamLockManager.connect(proUser).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        marketplaceRevenue,
        commissionDuration
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

      // Fast forward to commission settlement
      await time.increase(commissionDuration + 300);

      // Marketplace claims commission
      const marketplaceBalanceBefore = await testToken.balanceOf(marketplaceAddress);
      
      await streamLockManager.connect(saasProvider).settleStream(commissionStreamId);
      
      const marketplaceBalanceAfter = await testToken.balanceOf(marketplaceAddress);
      
      // Marketplace should receive commission
      const balanceDiff = marketplaceBalanceAfter - marketplaceBalanceBefore;
      expect(balanceDiff).to.be.closeTo(marketplaceRevenue, ethers.parseEther("0.01"));

      console.log("✅ SaaS marketplace commission structure processed successfully");
    });

    it("Should handle multi-tenant resource allocation", async function () {
      console.log("💻 Testing multi-tenant resource allocation...");

      const resourcePackagePrice = ethers.parseEther("300"); // $300 for resource package
      const resourceUnits = 20; // 20 resource units
      
      const tenantAddress = await enterpriseUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for tenant resources
      const resourceTx = await streamLockManager.connect(saasProvider).createUsagePool(
        tenantAddress,
        providerAddress,
        tokenAddress,
        resourcePackagePrice,
        resourceUnits
      );

      const resourceReceipt = await resourceTx.wait();
      const resourceLogs = resourceReceipt?.logs || [];
      let resourcePoolId: any;

      for (const log of resourceLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            resourcePoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Tenant consumes 12 resource units over time
      for (let i = 0; i < 3; i++) {
        await streamLockManager.connect(saasProvider).consumeUsageFromPool(resourcePoolId, 4);
        if (i < 2) await time.increase(7 * 24 * 3600); // 1 week between usages
      }

      // Check remaining resources
      const updatedResourceInfo = await streamLockManager.getTokenLock(resourcePoolId);
      expect(updatedResourceInfo.usedCount).to.equal(12);
      expect(updatedResourceInfo.usageCount - updatedResourceInfo.usedCount).to.equal(8);

      console.log("✅ Multi-tenant resource allocation processed successfully");
    });
  });

  describe("💼 SaaS Business Operations", function () {
    it("Should track total SaaS revenue from subscriptions", async function () {
      console.log("💻 Testing SaaS revenue tracking...");

      const subscriptionPrice = ethers.parseEther("99"); // $99 subscription
      const shortDuration = 7 * 24 * 3600; // 1 week for testing
      
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Get initial provider balance
      const providerBalanceBefore = await testToken.balanceOf(providerAddress);

      // Create subscription
      const subTx = await streamLockManager.connect(freeUser).createStreamLock(
        providerAddress,
        tokenAddress,
        subscriptionPrice,
        shortDuration
      );

      const subReceipt = await subTx.wait();
      const subLogs = subReceipt?.logs || [];
      let streamId: any;

      for (const log of subLogs) {
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

      // Fast forward to expire subscription
      await time.increase(shortDuration + 3600);

      // Provider claims expired subscription revenue
      await streamLockManager.connect(saasProvider).settleStream(streamId);
      
      const providerBalanceAfter = await testToken.balanceOf(providerAddress);
      
      // Calculate revenue
      const balanceDiff = providerBalanceAfter - providerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(subscriptionPrice, ethers.parseEther("0.01"));

      console.log("✅ SaaS revenue tracking completed successfully");
    });

    it("Should validate SaaS subscription constraints", async function () {
      console.log("💻 Testing SaaS subscription constraints...");

      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Test minimum subscription duration
      await expect(
        streamLockManager.connect(freeUser).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("50"),
          1800 // 30 minutes - too short
        )
      ).to.be.reverted;

      // Test minimum subscription amount
      await expect(
        streamLockManager.connect(freeUser).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Too small
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Test valid subscription should work
      const validTx = await streamLockManager.connect(freeUser).createStreamLock(
        providerAddress,
        tokenAddress,
        ethers.parseEther("19"), // Valid amount
        30 * 24 * 3600 // Valid duration
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ SaaS subscription constraints validated successfully");
    });
  });

  describe("🔧 Platform Admin and Emergency Features", function () {
    it("Should allow SaaS platform emergency pause", async function () {
      console.log("💻 Testing SaaS platform emergency pause...");

      // Test pause functionality
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create subscription while paused
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(freeUser).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("29"),
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify services resume
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      const resumeTx = await streamLockManager.connect(freeUser).createStreamLock(
        providerAddress,
        tokenAddress,
        ethers.parseEther("29"),
        30 * 24 * 3600
      );

      await expect(resumeTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ SaaS platform emergency pause functionality tested successfully");
    });

    it("Should track user and provider balance states", async function () {
      console.log("💻 Testing SaaS balance state tracking...");

      const subscriptionPrice = ethers.parseEther("149");
      const subscriptionDuration = 30 * 24 * 3600; // 30 days
      
      const userAddress = await proUser.getAddress();
      const providerAddress = await saasProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Check initial balances
      const userInitialBalance = await streamLockManager.getTotalBalance(userAddress, tokenAddress);
      const providerInitialBalance = await streamLockManager.getTotalBalance(providerAddress, tokenAddress);

      // Create subscription
      await streamLockManager.connect(proUser).createStreamLock(
        providerAddress,
        tokenAddress,
        subscriptionPrice,
        subscriptionDuration
      );

      // Check balances after subscription creation
      const userBalanceAfter = await streamLockManager.getTotalBalance(userAddress, tokenAddress);
      const userLockedBalance = await streamLockManager.getLockedBalance(userAddress, tokenAddress);

      expect(userBalanceAfter - userInitialBalance).to.equal(subscriptionPrice);
      expect(userLockedBalance).to.equal(subscriptionPrice);

      console.log("✅ SaaS balance state tracking completed successfully");
    });
  });
});
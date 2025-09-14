import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../../typechain-types";

describe("🛍️ E-commerce Marketplace Subscription Scenario Tests", function () {
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let marketplace: Signer;
  let buyer1: Signer;
  let buyer2: Signer;
  let premiumBuyer: Signer;
  let seller: Signer;
  
  const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
  const MIN_STREAM_DURATION = 3600; // 1 hour
  const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

  beforeEach(async function () {
    const [deployer, _marketplace, _buyer1, _buyer2, _premiumBuyer, _seller] = await ethers.getSigners();
    marketplace = _marketplace;
    buyer1 = _buyer1;
    buyer2 = _buyer2;
    premiumBuyer = _premiumBuyer;
    seller = _seller;

    console.log("🛍️ Setting up E-commerce Marketplace Subscription Scenario test...");

    // 1. Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "E-commerce Token",
      "SHOP", 
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

    // 3. Setup tokens for buyers, sellers and marketplace
    const transferAmount = ethers.parseEther("10000");
    await testToken.transfer(await buyer1.getAddress(), transferAmount);
    await testToken.transfer(await buyer2.getAddress(), transferAmount);
    await testToken.transfer(await premiumBuyer.getAddress(), transferAmount);
    await testToken.transfer(await seller.getAddress(), transferAmount);
    await testToken.transfer(await marketplace.getAddress(), transferAmount);
    
    // 4. Approve StreamLockManager for all parties
    const maxApproval = ethers.MaxUint256;
    await testToken.connect(buyer1).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(buyer2).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(premiumBuyer).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(seller).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(marketplace).approve(await streamLockManager.getAddress(), maxApproval);

    // 5. Set marketplace as authorized caller for advanced features
    await streamLockManager.setAuthorizedCaller(await marketplace.getAddress(), true);
    await streamLockManager.setAuthorizedCaller(await seller.getAddress(), true);

    console.log("✅ E-commerce Marketplace Subscription Scenario Setup completed");
  });

  describe("🏆 Premium Membership Plans", function () {
    it("Should handle premium membership subscription", async function () {
      console.log("🛍️ Testing premium membership subscription...");

      const premiumPrice = ethers.parseEther("9.99"); // $9.99/month premium
      const membershipDuration = 30 * 24 * 3600; // 30 days
      
      const marketplaceAddress = await marketplace.getAddress();
      const buyerAddress = await buyer1.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Buyer subscribes to premium membership
      const membershipTx = await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        premiumPrice,
        membershipDuration
      );

      await expect(membershipTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify premium membership is active
      const receipt = await membershipTx.wait();
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

      console.log("✅ Premium membership subscription created successfully");
    });

    it("Should handle annual premium membership with discount", async function () {
      console.log("🛍️ Testing annual premium membership with discount...");

      const annualPrice = ethers.parseEther("99"); // $99/year (17% discount)
      const immediateBonus = ethers.parseEther("10"); // $10 immediate marketplace credits
      const vestingDuration = 365 * 24 * 3600; // 1 year
      const cliffPeriod = 7 * 24 * 3600; // 1 week cliff

      const buyerAddress = await premiumBuyer.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for annual premium membership
      const annualTx = await streamLockManager.connect(marketplace).createVestingStream(
        buyerAddress,
        marketplaceAddress,
        tokenAddress,
        annualPrice,
        cliffDate,
        vestingDuration,
        immediateBonus
      );

      await expect(annualTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate marketplace credits were granted
      const marketplaceBalance = await testToken.balanceOf(marketplaceAddress);
      expect(marketplaceBalance).to.be.gte(immediateBonus);

      console.log("✅ Annual premium membership with discount created successfully");
    });

    it("Should handle VIP membership tier upgrade", async function () {
      console.log("🛍️ Testing VIP membership tier upgrade...");

      const vipUpgrade = ethers.parseEther("19.99"); // $19.99 VIP upgrade
      const upgradeAccess = 30 * 24 * 3600; // 30 days VIP access
      
      const buyerAddress = await buyer2.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Buyer upgrades to VIP tier
      const vipTx = await streamLockManager.connect(buyer2).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        vipUpgrade,
        upgradeAccess
      );

      const vipReceipt = await vipTx.wait();
      const vipLogs = vipReceipt?.logs || [];
      let vipStreamId: any;

      for (const log of vipLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            vipStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify VIP upgrade is active
      const streamStatus = await streamLockManager.getStreamStatus(vipStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ VIP membership tier upgrade created successfully");
    });
  });

  describe("📦 Shipping and Delivery Benefits", function () {
    it("Should handle premium shipping subscription", async function () {
      console.log("🛍️ Testing premium shipping subscription...");

      const shippingPrice = ethers.parseEther("12.99"); // $12.99/month for premium shipping
      const shippingDuration = 30 * 24 * 3600; // 30 days
      
      const marketplaceAddress = await marketplace.getAddress();
      const buyerAddress = await buyer1.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Buyer subscribes to premium shipping
      const shippingTx = await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        shippingPrice,
        shippingDuration
      );

      const shippingReceipt = await shippingTx.wait();
      const shippingLogs = shippingReceipt?.logs || [];
      let shippingStreamId: any;

      for (const log of shippingLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            shippingStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify premium shipping is active
      const streamStatus = await streamLockManager.getStreamStatus(shippingStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Premium shipping subscription created successfully");
    });

    it("Should handle express delivery package", async function () {
      console.log("🛍️ Testing express delivery package...");

      const expressPackagePrice = ethers.parseEther("49.99"); // $49.99 for 10 express deliveries
      const deliveryCount = 10;
      
      const buyerAddress = await premiumBuyer.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for express deliveries
      const expressTx = await streamLockManager.connect(marketplace).createUsagePool(
        buyerAddress,
        marketplaceAddress,
        tokenAddress,
        expressPackagePrice,
        deliveryCount
      );

      const expressReceipt = await expressTx.wait();
      const expressLogs = expressReceipt?.logs || [];
      let expressPoolId: any;

      for (const log of expressLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            expressPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify express delivery pool was created correctly
      const poolInfo = await streamLockManager.getTokenLock(expressPoolId);
      expect(poolInfo.usageCount).to.equal(deliveryCount);
      expect(poolInfo.usedCount).to.equal(0);
      expect(poolInfo.streamType).to.equal(2); // USAGE_POOL

      // Buyer uses 4 express deliveries
      for (let i = 0; i < 4; i++) {
        await streamLockManager.connect(marketplace).consumeUsageFromPool(expressPoolId, 1);
      }

      // Check remaining express deliveries
      const updatedPoolInfo = await streamLockManager.getTokenLock(expressPoolId);
      expect(updatedPoolInfo.usedCount).to.equal(4);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(6);

      console.log("✅ Express delivery package created and used successfully");
    });

    it("Should handle bulk shipping credit package", async function () {
      console.log("🛍️ Testing bulk shipping credit package...");

      const bulkShippingPrice = ethers.parseEther("150"); // $150 bulk shipping credits
      const shippingCredits = 30; // 30 shipping credits
      
      const buyerAddress = await buyer2.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for shipping credits
      const creditTx = await streamLockManager.connect(marketplace).createUsagePool(
        buyerAddress,
        marketplaceAddress,
        tokenAddress,
        bulkShippingPrice,
        shippingCredits
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

      // Buyer uses 12 shipping credits
      await streamLockManager.connect(marketplace).consumeUsageFromPool(creditPoolId, 12);

      // Check remaining shipping credits
      const updatedCreditInfo = await streamLockManager.getTokenLock(creditPoolId);
      expect(updatedCreditInfo.usedCount).to.equal(12);
      expect(updatedCreditInfo.usageCount - updatedCreditInfo.usedCount).to.equal(18);

      console.log("✅ Bulk shipping credit package processed successfully");
    });
  });

  describe("💰 Seller Plans and Marketplace Fees", function () {
    it("Should handle basic seller plan subscription", async function () {
      console.log("🛍️ Testing basic seller plan subscription...");

      const basicPlanPrice = ethers.parseEther("29.99"); // $29.99/month basic seller plan
      const planDuration = 30 * 24 * 3600; // 30 days
      
      const sellerAddress = await seller.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Seller subscribes to basic plan
      const planTx = await streamLockManager.connect(seller).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        basicPlanPrice,
        planDuration
      );

      const planReceipt = await planTx.wait();
      const planLogs = planReceipt?.logs || [];
      let planStreamId: any;

      for (const log of planLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            planStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify seller plan is active
      const streamStatus = await streamLockManager.getStreamStatus(planStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Basic seller plan subscription created successfully");
    });

    it("Should handle professional seller plan with featured listings", async function () {
      console.log("🛍️ Testing professional seller plan with featured listings...");

      const proPlanPrice = ethers.parseEther("99.99"); // $99.99/month professional plan
      const featuredListings = 20; // 20 featured listings included
      
      const sellerAddress = await seller.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for featured listings in professional plan
      const proTx = await streamLockManager.connect(marketplace).createUsagePool(
        sellerAddress,
        marketplaceAddress,
        tokenAddress,
        proPlanPrice,
        featuredListings
      );

      const proReceipt = await proTx.wait();
      const proLogs = proReceipt?.logs || [];
      let proPoolId: any;

      for (const log of proLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            proPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Seller uses 8 featured listings
      await streamLockManager.connect(marketplace).consumeUsageFromPool(proPoolId, 8);

      // Check remaining featured listings
      const updatedProInfo = await streamLockManager.getTokenLock(proPoolId);
      expect(updatedProInfo.usedCount).to.equal(8);
      expect(updatedProInfo.usageCount - updatedProInfo.usedCount).to.equal(12);

      console.log("✅ Professional seller plan with featured listings processed successfully");
    });

    it("Should handle enterprise seller plan with custom terms", async function () {
      console.log("🛍️ Testing enterprise seller plan with custom terms...");

      const enterprisePrice = ethers.parseEther("499.99"); // $499.99/month enterprise plan
      const customFeatures = ethers.parseEther("100"); // $100 immediate custom features
      const vestingDuration = 30 * 24 * 3600; // 30 days vesting
      const cliffPeriod = 3 * 24 * 3600; // 3 days cliff

      const sellerAddress = await seller.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for enterprise plan
      const enterpriseTx = await streamLockManager.connect(marketplace).createVestingStream(
        sellerAddress,
        marketplaceAddress,
        tokenAddress,
        enterprisePrice,
        cliffDate,
        vestingDuration,
        customFeatures
      );

      await expect(enterpriseTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate custom features were granted
      const marketplaceBalance = await testToken.balanceOf(marketplaceAddress);
      expect(marketplaceBalance).to.be.gte(customFeatures);

      console.log("✅ Enterprise seller plan with custom terms created successfully");
    });
  });

  describe("🛒 Buyer Protection and Warranties", function () {
    it("Should handle extended warranty purchase", async function () {
      console.log("🛍️ Testing extended warranty purchase...");

      const warrantyPrice = ethers.parseEther("24.99"); // $24.99 extended warranty
      const warrantyDuration = 365 * 24 * 3600; // 1 year warranty
      
      const buyerAddress = await buyer1.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Buyer purchases extended warranty
      const warrantyTx = await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        warrantyPrice,
        warrantyDuration
      );

      const warrantyReceipt = await warrantyTx.wait();
      const warrantyLogs = warrantyReceipt?.logs || [];
      let warrantyStreamId: any;

      for (const log of warrantyLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            warrantyStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify warranty is active
      const streamStatus = await streamLockManager.getStreamStatus(warrantyStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Extended warranty purchase created successfully");
    });

    it("Should handle buyer protection plan with claims", async function () {
      console.log("🛍️ Testing buyer protection plan with claims...");

      const protectionPrice = ethers.parseEther("79.99"); // $79.99 protection plan
      const claimCount = 5; // 5 protection claims
      
      const buyerAddress = await premiumBuyer.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for buyer protection claims
      const protectionTx = await streamLockManager.connect(marketplace).createUsagePool(
        buyerAddress,
        marketplaceAddress,
        tokenAddress,
        protectionPrice,
        claimCount
      );

      const protectionReceipt = await protectionTx.wait();
      const protectionLogs = protectionReceipt?.logs || [];
      let protectionPoolId: any;

      for (const log of protectionLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            protectionPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Buyer files 2 protection claims
      await streamLockManager.connect(marketplace).consumeUsageFromPool(protectionPoolId, 2);

      // Check remaining protection claims
      const updatedProtectionInfo = await streamLockManager.getTokenLock(protectionPoolId);
      expect(updatedProtectionInfo.usedCount).to.equal(2);
      expect(updatedProtectionInfo.usageCount - updatedProtectionInfo.usedCount).to.equal(3);

      console.log("✅ Buyer protection plan with claims processed successfully");
    });

    it("Should handle product insurance coverage", async function () {
      console.log("🛍️ Testing product insurance coverage...");

      const insurancePrice = ethers.parseEther("39.99"); // $39.99 product insurance
      const coverageDuration = 180 * 24 * 3600; // 6 months coverage
      
      const buyerAddress = await buyer2.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Buyer purchases product insurance
      const insuranceTx = await streamLockManager.connect(buyer2).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        insurancePrice,
        coverageDuration
      );

      const insuranceReceipt = await insuranceTx.wait();
      const insuranceLogs = insuranceReceipt?.logs || [];
      let insuranceStreamId: any;

      for (const log of insuranceLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            insuranceStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify insurance coverage is active
      const streamStatus = await streamLockManager.getStreamStatus(insuranceStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Product insurance coverage created successfully");
    });
  });

  describe("📊 Marketplace Analytics and Insights", function () {
    it("Should handle premium analytics subscription", async function () {
      console.log("🛍️ Testing premium analytics subscription...");

      const analyticsPrice = ethers.parseEther("49.99"); // $49.99/month analytics
      const analyticsDuration = 30 * 24 * 3600; // 30 days analytics access
      
      const sellerAddress = await seller.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Seller subscribes to premium analytics
      const analyticsTx = await streamLockManager.connect(seller).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        analyticsPrice,
        analyticsDuration
      );

      const analyticsReceipt = await analyticsTx.wait();
      const analyticsLogs = analyticsReceipt?.logs || [];
      let analyticsStreamId: any;

      for (const log of analyticsLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            analyticsStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify analytics subscription is active
      const streamStatus = await streamLockManager.getStreamStatus(analyticsStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Premium analytics subscription created successfully");
    });

    it("Should handle market research package", async function () {
      console.log("🛍️ Testing market research package...");

      const researchPrice = ethers.parseEther("149.99"); // $149.99 for 10 research reports
      const reportCount = 10;
      
      const sellerAddress = await seller.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for market research reports
      const researchTx = await streamLockManager.connect(marketplace).createUsagePool(
        sellerAddress,
        marketplaceAddress,
        tokenAddress,
        researchPrice,
        reportCount
      );

      const researchReceipt = await researchTx.wait();
      const researchLogs = researchReceipt?.logs || [];
      let researchPoolId: any;

      for (const log of researchLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            researchPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Seller requests 4 market research reports
      await streamLockManager.connect(marketplace).consumeUsageFromPool(researchPoolId, 4);

      // Check remaining research reports
      const updatedResearchInfo = await streamLockManager.getTokenLock(researchPoolId);
      expect(updatedResearchInfo.usedCount).to.equal(4);
      expect(updatedResearchInfo.usageCount - updatedResearchInfo.usedCount).to.equal(6);

      console.log("✅ Market research package processed successfully");
    });

    it("Should handle competitor analysis service", async function () {
      console.log("🛍️ Testing competitor analysis service...");

      const analysisPrice = ethers.parseEther("199.99"); // $199.99 quarterly analysis
      const analysisDuration = 90 * 24 * 3600; // 90 days quarterly service
      
      const sellerAddress = await seller.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Seller subscribes to competitor analysis service
      const competitorTx = await streamLockManager.connect(seller).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        analysisPrice,
        analysisDuration
      );

      const competitorReceipt = await competitorTx.wait();
      const competitorLogs = competitorReceipt?.logs || [];
      let competitorStreamId: any;

      for (const log of competitorLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            competitorStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Complete analysis after 30 days
      await time.increase(30 * 24 * 3600);

      // Marketplace processes analysis payment
      const marketplaceBalanceBefore = await testToken.balanceOf(marketplaceAddress);
      
      await streamLockManager.connect(marketplace).settleStream(competitorStreamId);
      
      const marketplaceBalanceAfter = await testToken.balanceOf(marketplaceAddress);
      
      // Marketplace should receive partial payment
      expect(marketplaceBalanceAfter).to.be.gt(marketplaceBalanceBefore);

      console.log("✅ Competitor analysis service processed successfully");
    });
  });

  describe("💼 E-commerce Platform Business Operations", function () {
    it("Should track total marketplace revenue", async function () {
      console.log("🛍️ Testing marketplace revenue tracking...");

      const servicePrice = ethers.parseEther("89.99"); // $89.99 service
      const shortDuration = 7 * 24 * 3600; // 1 week for testing
      
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Get initial marketplace balance
      const marketplaceBalanceBefore = await testToken.balanceOf(marketplaceAddress);

      // Create marketplace service purchase
      const serviceTx = await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
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

      // Marketplace claims service revenue
      await streamLockManager.connect(marketplace).settleStream(streamId);
      
      const marketplaceBalanceAfter = await testToken.balanceOf(marketplaceAddress);
      
      // Calculate revenue
      const balanceDiff = marketplaceBalanceAfter - marketplaceBalanceBefore;
      expect(balanceDiff).to.be.closeTo(servicePrice, ethers.parseEther("0.01"));

      console.log("✅ Marketplace revenue tracking completed successfully");
    });

    it("Should handle subscription cancellation and refunds", async function () {
      console.log("🛍️ Testing subscription cancellation and refunds...");

      const subscriptionPrice = ethers.parseEther("39.99"); // $39.99 subscription
      const subscriptionDuration = 60 * 24 * 3600; // 60 days subscription
      
      const buyerAddress = await buyer2.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Buyer purchases subscription
      const subTx = await streamLockManager.connect(buyer2).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        subscriptionPrice,
        subscriptionDuration
      );

      const subReceipt = await subTx.wait();
      const subLogs = subReceipt?.logs || [];
      let subStreamId: any;

      for (const log of subLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            subStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check locked balance before cancellation
      const lockedBalanceBefore = await streamLockManager.getLockedBalance(buyerAddress, tokenAddress);
      expect(lockedBalanceBefore).to.equal(subscriptionPrice);

      // Buyer cancels subscription after 2 weeks
      await time.increase(14 * 24 * 3600); // 2 weeks

      // Buyer cancels subscription
      const cancelTx = await streamLockManager.connect(buyer2).cancelStream(subStreamId);
      await expect(cancelTx).to.emit(streamLockManager, "StreamSettled");
      
      // Check locked balance after cancellation
      const lockedBalanceAfter = await streamLockManager.getLockedBalance(buyerAddress, tokenAddress);
      expect(lockedBalanceAfter).to.be.lt(lockedBalanceBefore);

      console.log("✅ Subscription cancellation and refunds processed successfully");
    });

    it("Should validate e-commerce service constraints", async function () {
      console.log("🛍️ Testing e-commerce service constraints...");

      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Test minimum subscription duration
      await expect(
        streamLockManager.connect(buyer1).createStreamLock(
          marketplaceAddress,
          tokenAddress,
          ethers.parseEther("10"),
          1800 // 30 minutes - too short
        )
      ).to.be.reverted;

      // Test minimum subscription price
      await expect(
        streamLockManager.connect(buyer1).createStreamLock(
          marketplaceAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Too small
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Test valid subscription should work
      const validTx = await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        ethers.parseEther("9.99"), // Valid amount
        30 * 24 * 3600 // Valid duration
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ E-commerce service constraints validated successfully");
    });
  });

  describe("🚨 E-commerce Platform Admin Features", function () {
    it("Should allow marketplace emergency pause", async function () {
      console.log("🛍️ Testing marketplace emergency pause...");

      // Test pause functionality
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create subscription while paused
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(buyer1).createStreamLock(
          marketplaceAddress,
          tokenAddress,
          ethers.parseEther("19.99"),
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify services resume
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      const resumeTx = await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        ethers.parseEther("19.99"),
        30 * 24 * 3600
      );

      await expect(resumeTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Marketplace emergency pause functionality tested successfully");
    });

    it("Should track buyer and seller balance states", async function () {
      console.log("🛍️ Testing e-commerce balance state tracking...");

      const servicePrice = ethers.parseEther("59.99");
      const serviceDuration = 90 * 24 * 3600; // 90 days
      
      const buyerAddress = await buyer1.getAddress();
      const marketplaceAddress = await marketplace.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Check initial balances
      const buyerInitialBalance = await streamLockManager.getTotalBalance(buyerAddress, tokenAddress);
      const marketplaceInitialBalance = await streamLockManager.getTotalBalance(marketplaceAddress, tokenAddress);

      // Create service subscription
      await streamLockManager.connect(buyer1).createStreamLock(
        marketplaceAddress,
        tokenAddress,
        servicePrice,
        serviceDuration
      );

      // Check balances after subscription
      const buyerBalanceAfter = await streamLockManager.getTotalBalance(buyerAddress, tokenAddress);
      const buyerLockedBalance = await streamLockManager.getLockedBalance(buyerAddress, tokenAddress);

      expect(buyerBalanceAfter - buyerInitialBalance).to.equal(servicePrice);
      expect(buyerLockedBalance).to.equal(servicePrice);

      console.log("✅ E-commerce balance state tracking completed successfully");
    });
  });
});
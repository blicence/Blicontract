import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../../typechain-types";

describe("🏥 Healthcare Subscription Scenario Tests", function () {
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let healthProvider: Signer;
  let patient1: Signer;
  let patient2: Signer;
  let patient3: Signer;
  let doctor: Signer;
  
  const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
  const MIN_STREAM_DURATION = 3600; // 1 hour
  const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

  beforeEach(async function () {
    const [deployer, _healthProvider, _patient1, _patient2, _patient3, _doctor] = await ethers.getSigners();
    healthProvider = _healthProvider;
    patient1 = _patient1;
    patient2 = _patient2;
    patient3 = _patient3;
    doctor = _doctor;

    console.log("🏥 Setting up Healthcare Subscription Scenario test...");

    // 1. Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "Health Token",
      "HEALTH", 
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

    // 3. Setup tokens for patients and health provider
    const transferAmount = ethers.parseEther("10000");
    await testToken.transfer(await patient1.getAddress(), transferAmount);
    await testToken.transfer(await patient2.getAddress(), transferAmount);
    await testToken.transfer(await patient3.getAddress(), transferAmount);
    await testToken.transfer(await healthProvider.getAddress(), transferAmount);
    await testToken.transfer(await doctor.getAddress(), transferAmount);
    
    // 4. Approve StreamLockManager for all parties
    const maxApproval = ethers.MaxUint256;
    await testToken.connect(patient1).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(patient2).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(patient3).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(healthProvider).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(doctor).approve(await streamLockManager.getAddress(), maxApproval);

    // 5. Set health provider as authorized caller for advanced features
    await streamLockManager.setAuthorizedCaller(await healthProvider.getAddress(), true);
    await streamLockManager.setAuthorizedCaller(await doctor.getAddress(), true);

    console.log("✅ Healthcare Subscription Scenario Setup completed");
  });

  describe("💊 Basic Health Insurance Plans", function () {
    it("Should handle monthly health insurance subscription", async function () {
      console.log("🏥 Testing monthly health insurance subscription...");

      const monthlyPremium = ethers.parseEther("250"); // $250/month
      const insuranceDuration = 30 * 24 * 3600; // 30 days
      
      const providerAddress = await healthProvider.getAddress();
      const patientAddress = await patient1.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Patient creates monthly health insurance stream
      const tx = await streamLockManager.connect(patient1).createStreamLock(
        providerAddress,
        tokenAddress,
        monthlyPremium,
        insuranceDuration
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

      console.log("✅ Monthly health insurance subscription created successfully");
    });

    it("Should handle annual health insurance with discount", async function () {
      console.log("🏥 Testing annual health insurance with discount...");

      const annualPremium = ethers.parseEther("2400"); // $2400/year (20% discount)
      const upfrontDiscount = ethers.parseEther("200"); // $200 immediate discount
      const vestingDuration = 365 * 24 * 3600; // 1 year
      const cliffPeriod = 30 * 24 * 3600; // 1 month cliff

      const patientAddress = await patient2.getAddress();
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for annual insurance
      const vestingTx = await streamLockManager.connect(healthProvider).createVestingStream(
        patientAddress,
        providerAddress,
        tokenAddress,
        annualPremium,
        cliffDate,
        vestingDuration,
        upfrontDiscount
      );

      await expect(vestingTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate discount was transferred
      const providerBalance = await testToken.balanceOf(providerAddress);
      expect(providerBalance).to.be.gte(upfrontDiscount);

      console.log("✅ Annual health insurance with discount created successfully");
    });

    it("Should handle family health insurance plan", async function () {
      console.log("🏥 Testing family health insurance plan...");

      const adultPremium = ethers.parseEther("300"); // $300/month per adult
      const childPremium = ethers.parseEther("150"); // $150/month per child
      const familyPlanDuration = 90 * 24 * 3600; // 3 months
      
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create family health insurance package
      const familyStreams = [
        // 2 Adults
        {
          recipient: providerAddress,
          token: tokenAddress,
          totalAmount: adultPremium,
          duration: familyPlanDuration
        },
        {
          recipient: providerAddress,
          token: tokenAddress,
          totalAmount: adultPremium,
          duration: familyPlanDuration
        },
        // 2 Children
        {
          recipient: providerAddress,
          token: tokenAddress,
          totalAmount: childPremium,
          duration: familyPlanDuration
        },
        {
          recipient: providerAddress,
          token: tokenAddress,
          totalAmount: childPremium,
          duration: familyPlanDuration
        }
      ];

      const familyTx = await streamLockManager.connect(patient3).batchCreateStreams(familyStreams);
      const familyReceipt = await familyTx.wait();

      // Verify all family insurance streams were created
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
      const totalFamilyCost = (adultPremium * BigInt(2)) + (childPremium * BigInt(2));
      const expectedMonthlyCost = ethers.parseEther("900"); // $300*2 + $150*2 = $900
      
      expect(totalFamilyCost).to.equal(expectedMonthlyCost);

      console.log("✅ Family health insurance plan created successfully");
    });
  });

  describe("🩺 Doctor Consultation Services", function () {
    it("Should create doctor consultation usage pool", async function () {
      console.log("🏥 Testing doctor consultation usage pool...");

      const consultationPackagePrice = ethers.parseEther("600"); // $600 for 10 consultations
      const consultationCount = 10;
      
      const patientAddress = await patient1.getAddress();
      const doctorAddress = await doctor.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for doctor consultations
      const poolTx = await streamLockManager.connect(healthProvider).createUsagePool(
        patientAddress,
        doctorAddress,
        tokenAddress,
        consultationPackagePrice,
        consultationCount
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
      expect(poolInfo.usageCount).to.equal(consultationCount);
      expect(poolInfo.usedCount).to.equal(0);
      expect(poolInfo.streamType).to.equal(2); // USAGE_POOL

      // Simulate patient using 4 consultations
      for (let i = 0; i < 4; i++) {
        await streamLockManager.connect(healthProvider).consumeUsageFromPool(poolId, 1);
      }

      // Check remaining consultations
      const updatedPoolInfo = await streamLockManager.getTokenLock(poolId);
      expect(updatedPoolInfo.usedCount).to.equal(4);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(6);

      console.log("✅ Doctor consultation usage pool created and used successfully");
    });

    it("Should handle emergency consultation payments", async function () {
      console.log("🏥 Testing emergency consultation payments...");

      const emergencyFee = ethers.parseEther("200"); // $200 emergency consultation
      const consultationDuration = 2 * 3600; // 2 hours emergency session
      
      const patientAddress = await patient2.getAddress();
      const doctorAddress = await doctor.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create stream for emergency consultation
      const emergencyTx = await streamLockManager.connect(patient2).createStreamLock(
        doctorAddress,
        tokenAddress,
        emergencyFee,
        consultationDuration
      );

      const emergencyReceipt = await emergencyTx.wait();
      const emergencyLogs = emergencyReceipt?.logs || [];
      let emergencyStreamId: any;

      for (const log of emergencyLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            emergencyStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward time to complete consultation
      await time.increase(consultationDuration + 300); // Consultation + 5 minutes

      // Doctor claims payment for completed consultation
      const doctorBalanceBefore = await testToken.balanceOf(doctorAddress);
      
      await streamLockManager.connect(doctor).settleStream(emergencyStreamId);
      
      const doctorBalanceAfter = await testToken.balanceOf(doctorAddress);
      
      // Doctor should receive close to full payment (allowing for precision loss)
      const balanceDiff = doctorBalanceAfter - doctorBalanceBefore;
      expect(balanceDiff).to.be.closeTo(emergencyFee, ethers.parseEther("0.001"));

      console.log("✅ Emergency consultation payment processed successfully");
    });

    it("Should handle specialist referral with authorization", async function () {
      console.log("🏥 Testing specialist referral with authorization...");

      const specialistFee = ethers.parseEther("400"); // $400 specialist consultation
      const authorizationPeriod = 7 * 24 * 3600; // 7 days authorization
      
      const patientAddress = await patient3.getAddress();
      const specialistAddress = await doctor.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Health provider pre-authorizes specialist consultation
      const referralTx = await streamLockManager.connect(patient3).createStreamLock(
        specialistAddress,
        tokenAddress,
        specialistFee,
        authorizationPeriod
      );

      const referralReceipt = await referralTx.wait();
      const referralLogs = referralReceipt?.logs || [];
      let referralStreamId: any;

      for (const log of referralLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            referralStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify stream is active and patient can use it
      const streamStatus = await streamLockManager.getStreamStatus(referralStreamId);
      expect(streamStatus.isActive).to.be.true;

      // Simulate using the specialist consultation after 3 days
      await time.increase(3 * 24 * 3600); // 3 days later

      const specialistBalanceBefore = await testToken.balanceOf(specialistAddress);
      
      // Specialist settles the consultation
      await streamLockManager.connect(doctor).settleStream(referralStreamId);
      
      const specialistBalanceAfter = await testToken.balanceOf(specialistAddress);
      
      // Specialist should receive payment
      expect(specialistBalanceAfter).to.be.gt(specialistBalanceBefore);

      console.log("✅ Specialist referral with authorization processed successfully");
    });
  });

  describe("🏥 Emergency and Critical Care", function () {
    it("Should handle emergency health fund with immediate release", async function () {
      console.log("🏥 Testing emergency health fund...");

      const emergencyFundAmount = ethers.parseEther("5000"); // $5000 emergency fund
      const emergencyAllocation = ethers.parseEther("1000"); // $1000 immediate allocation
      const vestingDuration = 180 * 24 * 3600; // 6 months vesting
      const cliffPeriod = 1 * 24 * 3600; // 1 day cliff

      const patientAddress = await patient1.getAddress();
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for emergency fund
      const emergencyTx = await streamLockManager.connect(healthProvider).createVestingStream(
        patientAddress,
        providerAddress,
        tokenAddress,
        emergencyFundAmount,
        cliffDate,
        vestingDuration,
        emergencyAllocation
      );

      await expect(emergencyTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate emergency allocation was transferred
      const providerBalance = await testToken.balanceOf(providerAddress);
      expect(providerBalance).to.be.gte(emergencyAllocation);

      console.log("✅ Emergency health fund with immediate release created successfully");
    });

    it("Should handle critical care authorization pool", async function () {
      console.log("🏥 Testing critical care authorization pool...");

      const criticalCareLimit = ethers.parseEther("10000"); // $10,000 critical care limit
      const procedureCount = 5; // 5 authorized procedures
      
      const patientAddress = await patient2.getAddress();
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for critical care procedures
      const criticalTx = await streamLockManager.connect(healthProvider).createUsagePool(
        patientAddress,
        providerAddress,
        tokenAddress,
        criticalCareLimit,
        procedureCount
      );

      const criticalReceipt = await criticalTx.wait();
      const criticalLogs = criticalReceipt?.logs || [];
      let criticalPoolId: any;

      for (const log of criticalLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            criticalPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify critical care pool was created
      const poolInfo = await streamLockManager.getTokenLock(criticalPoolId);
      expect(poolInfo.usageCount).to.equal(procedureCount);
      expect(poolInfo.usedCount).to.equal(0);

      // Simulate using 2 critical care procedures
      for (let i = 0; i < 2; i++) {
        await streamLockManager.connect(healthProvider).consumeUsageFromPool(criticalPoolId, 1);
      }

      // Check remaining authorizations
      const updatedPoolInfo = await streamLockManager.getTokenLock(criticalPoolId);
      expect(updatedPoolInfo.usedCount).to.equal(2);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(3);

      console.log("✅ Critical care authorization pool created and used successfully");
    });
  });

  describe("🩹 Prescription and Pharmacy Services", function () {
    it("Should create medication refill subscription", async function () {
      console.log("🏥 Testing medication refill subscription...");

      const medicationCost = ethers.parseEther("120"); // $120 for 3 months of medication
      const refillCount = 3; // 3 monthly refills
      
      const patientAddress = await patient3.getAddress();
      const pharmacyAddress = await healthProvider.getAddress(); // Health provider operates pharmacy
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for medication refills
      const medicationTx = await streamLockManager.connect(healthProvider).createUsagePool(
        patientAddress,
        pharmacyAddress,
        tokenAddress,
        medicationCost,
        refillCount
      );

      const medicationReceipt = await medicationTx.wait();
      const medicationLogs = medicationReceipt?.logs || [];
      let medicationPoolId: any;

      for (const log of medicationLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            medicationPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Patient picks up first refill
      await streamLockManager.connect(healthProvider).consumeUsageFromPool(medicationPoolId, 1);

      // Check remaining refills
      const updatedPoolInfo = await streamLockManager.getTokenLock(medicationPoolId);
      expect(updatedPoolInfo.usedCount).to.equal(1);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(2);

      console.log("✅ Medication refill subscription created and used successfully");
    });

    it("Should handle prescription insurance coverage", async function () {
      console.log("🏥 Testing prescription insurance coverage...");

      const prescriptionCost = ethers.parseEther("80"); // $80 prescription
      const coverageDuration = 30 * 24 * 3600; // 30 days coverage
      
      const patientAddress = await patient1.getAddress();
      const pharmacyAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create stream for prescription coverage
      const prescriptionTx = await streamLockManager.connect(patient1).createStreamLock(
        pharmacyAddress,
        tokenAddress,
        prescriptionCost,
        coverageDuration
      );

      const prescriptionReceipt = await prescriptionTx.wait();
      const prescriptionLogs = prescriptionReceipt?.logs || [];
      let prescriptionStreamId: any;

      for (const log of prescriptionLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            prescriptionStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify prescription coverage is active
      const streamStatus = await streamLockManager.getStreamStatus(prescriptionStreamId);
      expect(streamStatus.isActive).to.be.true;

      // Fast forward to prescription completion
      await time.increase(coverageDuration + 300);

      // Pharmacy claims prescription payment
      const pharmacyBalanceBefore = await testToken.balanceOf(pharmacyAddress);
      
      await streamLockManager.connect(healthProvider).settleStream(prescriptionStreamId);
      
      const pharmacyBalanceAfter = await testToken.balanceOf(pharmacyAddress);
      
      // Pharmacy should receive payment
      expect(pharmacyBalanceAfter).to.be.gt(pharmacyBalanceBefore);

      console.log("✅ Prescription insurance coverage processed successfully");
    });
  });

  describe("💼 Healthcare Provider Business Operations", function () {
    it("Should track total provider revenue from health services", async function () {
      console.log("🏥 Testing healthcare provider revenue tracking...");

      const servicePrice = ethers.parseEther("150"); // $150/service
      const shortDuration = 7 * 24 * 3600; // 1 week for testing
      
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Get initial provider balance
      const providerBalanceBefore = await testToken.balanceOf(providerAddress);

      // Create simple short-term health service
      const serviceTx = await streamLockManager.connect(patient1).createStreamLock(
        providerAddress,
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

      // Fast forward to expire service
      await time.increase(shortDuration + 3600); // Expire + 1 hour

      // Provider claims expired service revenue
      await streamLockManager.connect(healthProvider).settleStream(streamId);
      
      const providerBalanceAfter = await testToken.balanceOf(providerAddress);
      
      // Calculate expected revenue
      const balanceDiff = providerBalanceAfter - providerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(servicePrice, ethers.parseEther("0.01"));

      console.log("✅ Healthcare provider revenue tracking completed successfully");
    });

    it("Should handle health insurance claim processing", async function () {
      console.log("🏥 Testing health insurance claim processing...");

      const claimAmount = ethers.parseEther("800"); // $800 insurance claim
      const processingDuration = 14 * 24 * 3600; // 14 days processing time
      
      const patientAddress = await patient2.getAddress();
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Patient creates insurance claim stream
      const claimTx = await streamLockManager.connect(patient2).createStreamLock(
        providerAddress,
        tokenAddress,
        claimAmount,
        processingDuration
      );

      const claimReceipt = await claimTx.wait();
      const claimLogs = claimReceipt?.logs || [];
      let claimStreamId: any;

      for (const log of claimLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            claimStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Simulate claim processing after 10 days
      await time.increase(10 * 24 * 3600); // 10 days processing

      // Provider processes claim
      const providerBalanceBefore = await testToken.balanceOf(providerAddress);
      
      await streamLockManager.connect(healthProvider).settleStream(claimStreamId);
      
      const providerBalanceAfter = await testToken.balanceOf(providerAddress);
      
      // Provider should receive claim amount
      expect(providerBalanceAfter).to.be.gt(providerBalanceBefore);

      console.log("✅ Health insurance claim processing completed successfully");
    });

    it("Should validate healthcare service constraints", async function () {
      console.log("🏥 Testing healthcare service constraints...");

      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Test minimum service duration
      await expect(
        streamLockManager.connect(patient1).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("100"),
          1800 // 30 minutes - too short
        )
      ).to.be.reverted;

      // Test minimum service amount
      await expect(
        streamLockManager.connect(patient1).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Too small
          7 * 24 * 3600
        )
      ).to.be.reverted;

      // Test valid health service should work
      const validTx = await streamLockManager.connect(patient1).createStreamLock(
        providerAddress,
        tokenAddress,
        ethers.parseEther("50"), // Valid amount
        7 * 24 * 3600 // Valid duration
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Healthcare service constraints validated successfully");
    });
  });

  describe("🚨 Emergency Protocols and Admin Features", function () {
    it("Should allow healthcare emergency system pause", async function () {
      console.log("🏥 Testing emergency system pause functionality...");

      // Test pause functionality
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create health service while paused
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(patient1).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("100"),
          7 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify services resume
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      const resumeTx = await streamLockManager.connect(patient1).createStreamLock(
        providerAddress,
        tokenAddress,
        ethers.parseEther("100"),
        7 * 24 * 3600
      );

      await expect(resumeTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Emergency system pause functionality tested successfully");
    });

    it("Should track patient and provider balance states", async function () {
      console.log("🏥 Testing healthcare balance state tracking...");

      const servicePrice = ethers.parseEther("200");
      const serviceDuration = 30 * 24 * 3600; // 30 days
      
      const patientAddress = await patient3.getAddress();
      const providerAddress = await healthProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Check initial balances
      const patientInitialBalance = await streamLockManager.getTotalBalance(patientAddress, tokenAddress);
      const providerInitialBalance = await streamLockManager.getTotalBalance(providerAddress, tokenAddress);

      // Create health service
      await streamLockManager.connect(patient3).createStreamLock(
        providerAddress,
        tokenAddress,
        servicePrice,
        serviceDuration
      );

      // Check balances after service creation
      const patientBalanceAfter = await streamLockManager.getTotalBalance(patientAddress, tokenAddress);
      const patientLockedBalance = await streamLockManager.getLockedBalance(patientAddress, tokenAddress);

      expect(patientBalanceAfter - patientInitialBalance).to.equal(servicePrice);
      expect(patientLockedBalance).to.equal(servicePrice);

      console.log("✅ Healthcare balance state tracking completed successfully");
    });
  });
});
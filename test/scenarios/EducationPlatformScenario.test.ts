import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../../typechain-types";

describe("📚 Education Platform Subscription Scenario Tests", function () {
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let eduProvider: Signer;
  let student1: Signer;
  let student2: Signer;
  let corporateStudent: Signer;
  let instructor: Signer;
  
  const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
  const MIN_STREAM_DURATION = 3600; // 1 hour
  const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

  beforeEach(async function () {
    const [deployer, _eduProvider, _student1, _student2, _corporateStudent, _instructor] = await ethers.getSigners();
    eduProvider = _eduProvider;
    student1 = _student1;
    student2 = _student2;
    corporateStudent = _corporateStudent;
    instructor = _instructor;

    console.log("📚 Setting up Education Platform Subscription Scenario test...");

    // 1. Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "Education Token",
      "EDU", 
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

    // 3. Setup tokens for students and education provider
    const transferAmount = ethers.parseEther("10000");
    await testToken.transfer(await student1.getAddress(), transferAmount);
    await testToken.transfer(await student2.getAddress(), transferAmount);
    await testToken.transfer(await corporateStudent.getAddress(), transferAmount);
    await testToken.transfer(await instructor.getAddress(), transferAmount);
    await testToken.transfer(await eduProvider.getAddress(), transferAmount);
    
    // 4. Approve StreamLockManager for all parties
    const maxApproval = ethers.MaxUint256;
    await testToken.connect(student1).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(student2).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(corporateStudent).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(instructor).approve(await streamLockManager.getAddress(), maxApproval);
    await testToken.connect(eduProvider).approve(await streamLockManager.getAddress(), maxApproval);

    // 5. Set education provider as authorized caller for advanced features
    await streamLockManager.setAuthorizedCaller(await eduProvider.getAddress(), true);
    await streamLockManager.setAuthorizedCaller(await instructor.getAddress(), true);

    console.log("✅ Education Platform Subscription Scenario Setup completed");
  });

  describe("🎓 Course Purchases and Enrollments", function () {
    it("Should handle individual course purchase", async function () {
      console.log("📚 Testing individual course purchase...");

      const coursePrice = ethers.parseEther("99"); // $99 course
      const courseAccess = 180 * 24 * 3600; // 6 months access
      
      const providerAddress = await eduProvider.getAddress();
      const studentAddress = await student1.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Student purchases individual course
      const courseTx = await streamLockManager.connect(student1).createStreamLock(
        providerAddress,
        tokenAddress,
        coursePrice,
        courseAccess
      );

      await expect(courseTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify course access is active
      const receipt = await courseTx.wait();
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

      console.log("✅ Individual course purchase created successfully");
    });

    it("Should handle course bundle with discount", async function () {
      console.log("📚 Testing course bundle with discount...");

      const bundlePrice = ethers.parseEther("249"); // $249 for 5-course bundle
      const immediateAccess = ethers.parseEther("49"); // $49 immediate access to first course
      const vestingDuration = 30 * 24 * 3600; // 30 days to unlock all courses
      const cliffPeriod = 7 * 24 * 3600; // 1 week cliff

      const studentAddress = await student2.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for course bundle
      const bundleTx = await streamLockManager.connect(eduProvider).createVestingStream(
        studentAddress,
        providerAddress,
        tokenAddress,
        bundlePrice,
        cliffDate,
        vestingDuration,
        immediateAccess
      );

      await expect(bundleTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate course access was granted
      const providerBalance = await testToken.balanceOf(providerAddress);
      expect(providerBalance).to.be.gte(immediateAccess);

      console.log("✅ Course bundle with discount created successfully");
    });

    it("Should handle pay-per-lesson model", async function () {
      console.log("📚 Testing pay-per-lesson model...");

      const lessonPackagePrice = ethers.parseEther("120"); // $120 for 10 lessons
      const lessonCount = 10;
      
      const studentAddress = await student1.getAddress();
      const instructorAddress = await instructor.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for individual lessons
      const lessonTx = await streamLockManager.connect(eduProvider).createUsagePool(
        studentAddress,
        instructorAddress,
        tokenAddress,
        lessonPackagePrice,
        lessonCount
      );

      const lessonReceipt = await lessonTx.wait();
      const lessonLogs = lessonReceipt?.logs || [];
      let lessonPoolId: any;

      for (const log of lessonLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            lessonPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify lesson pool was created correctly
      const poolInfo = await streamLockManager.getTokenLock(lessonPoolId);
      expect(poolInfo.usageCount).to.equal(lessonCount);
      expect(poolInfo.usedCount).to.equal(0);
      expect(poolInfo.streamType).to.equal(2); // USAGE_POOL

      // Student attends 4 lessons
      for (let i = 0; i < 4; i++) {
        await streamLockManager.connect(eduProvider).consumeUsageFromPool(lessonPoolId, 1);
      }

      // Check remaining lessons
      const updatedPoolInfo = await streamLockManager.getTokenLock(lessonPoolId);
      expect(updatedPoolInfo.usedCount).to.equal(4);
      expect(updatedPoolInfo.usageCount - updatedPoolInfo.usedCount).to.equal(6);

      console.log("✅ Pay-per-lesson model created and used successfully");
    });
  });

  describe("🎯 Subscription-Based Learning", function () {
    it("Should handle monthly learning subscription", async function () {
      console.log("📚 Testing monthly learning subscription...");

      const monthlyPrice = ethers.parseEther("39"); // $39/month
      const subscriptionDuration = 30 * 24 * 3600; // 30 days
      
      const providerAddress = await eduProvider.getAddress();
      const studentAddress = await student2.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Student creates monthly subscription
      const subTx = await streamLockManager.connect(student2).createStreamLock(
        providerAddress,
        tokenAddress,
        monthlyPrice,
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

      // Verify subscription is active
      const streamStatus = await streamLockManager.getStreamStatus(subStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Monthly learning subscription created successfully");
    });

    it("Should handle annual subscription with student discount", async function () {
      console.log("📚 Testing annual subscription with student discount...");

      const annualPrice = ethers.parseEther("350"); // $350/year (25% student discount)
      const immediateBonus = ethers.parseEther("50"); // $50 immediate bonus content
      const vestingDuration = 365 * 24 * 3600; // 1 year
      const cliffPeriod = 14 * 24 * 3600; // 2 weeks cliff

      const studentAddress = await student1.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      const currentTime = await time.latest();
      const cliffDate = currentTime + cliffPeriod;

      // Create vesting stream for annual student subscription
      const annualTx = await streamLockManager.connect(eduProvider).createVestingStream(
        studentAddress,
        providerAddress,
        tokenAddress,
        annualPrice,
        cliffDate,
        vestingDuration,
        immediateBonus
      );

      await expect(annualTx).to.emit(streamLockManager, "StreamLockCreated");

      // Verify immediate bonus content was granted
      const providerBalance = await testToken.balanceOf(providerAddress);
      expect(providerBalance).to.be.gte(immediateBonus);

      console.log("✅ Annual subscription with student discount created successfully");
    });

    it("Should handle premium learning tier upgrade", async function () {
      console.log("📚 Testing premium learning tier upgrade...");

      const premiumUpgrade = ethers.parseEther("79"); // $79 premium upgrade
      const upgradeAccess = 60 * 24 * 3600; // 60 days premium access
      
      const studentAddress = await student2.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Student upgrades to premium tier
      const upgradeTx = await streamLockManager.connect(student2).createStreamLock(
        providerAddress,
        tokenAddress,
        premiumUpgrade,
        upgradeAccess
      );

      const upgradeReceipt = await upgradeTx.wait();
      const upgradeLogs = upgradeReceipt?.logs || [];
      let upgradeStreamId: any;

      for (const log of upgradeLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            upgradeStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify premium upgrade is active
      const streamStatus = await streamLockManager.getStreamStatus(upgradeStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Premium learning tier upgrade created successfully");
    });
  });

  describe("🏢 Corporate Training Programs", function () {
    it("Should handle corporate training package", async function () {
      console.log("📚 Testing corporate training package...");

      const corporatePrice = ethers.parseEther("2500"); // $2500 for 50 employee seats
      const trainingDuration = 90 * 24 * 3600; // 3 months training program
      
      const corporateAddress = await corporateStudent.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Corporate client purchases training package
      const corporateTx = await streamLockManager.connect(corporateStudent).createStreamLock(
        providerAddress,
        tokenAddress,
        corporatePrice,
        trainingDuration
      );

      const corporateReceipt = await corporateTx.wait();
      const corporateLogs = corporateReceipt?.logs || [];
      let corporateStreamId: any;

      for (const log of corporateLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            corporateStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify corporate training is active
      const streamStatus = await streamLockManager.getStreamStatus(corporateStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Corporate training package created successfully");
    });

    it("Should handle employee training seat allocation", async function () {
      console.log("📚 Testing employee training seat allocation...");

      const seatPackagePrice = ethers.parseEther("1200"); // $1200 for 20 training seats
      const seatCount = 20;
      
      const corporateAddress = await corporateStudent.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for training seats
      const seatTx = await streamLockManager.connect(eduProvider).createUsagePool(
        corporateAddress,
        providerAddress,
        tokenAddress,
        seatPackagePrice,
        seatCount
      );

      const seatReceipt = await seatTx.wait();
      const seatLogs = seatReceipt?.logs || [];
      let seatPoolId: any;

      for (const log of seatLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            seatPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Corporate allocates 12 training seats to employees
      await streamLockManager.connect(eduProvider).consumeUsageFromPool(seatPoolId, 12);

      // Check remaining seats
      const updatedSeatInfo = await streamLockManager.getTokenLock(seatPoolId);
      expect(updatedSeatInfo.usedCount).to.equal(12);
      expect(updatedSeatInfo.usageCount - updatedSeatInfo.usedCount).to.equal(8);

      console.log("✅ Employee training seat allocation processed successfully");
    });

    it("Should handle custom corporate curriculum development", async function () {
      console.log("📚 Testing custom corporate curriculum development...");

      const curriculumPrice = ethers.parseEther("5000"); // $5000 custom curriculum
      const developmentTime = 60 * 24 * 3600; // 60 days development
      
      const corporateAddress = await corporateStudent.getAddress();
      const instructorAddress = await instructor.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Corporate orders custom curriculum development
      const curriculumTx = await streamLockManager.connect(corporateStudent).createStreamLock(
        instructorAddress,
        tokenAddress,
        curriculumPrice,
        developmentTime
      );

      const curriculumReceipt = await curriculumTx.wait();
      const curriculumLogs = curriculumReceipt?.logs || [];
      let curriculumStreamId: any;

      for (const log of curriculumLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            curriculumStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Fast forward to curriculum completion
      await time.increase(developmentTime + 300);

      // Instructor claims payment for completed curriculum
      const instructorBalanceBefore = await testToken.balanceOf(instructorAddress);
      
      await streamLockManager.connect(instructor).settleStream(curriculumStreamId);
      
      const instructorBalanceAfter = await testToken.balanceOf(instructorAddress);
      
      // Instructor should receive payment
      const balanceDiff = instructorBalanceAfter - instructorBalanceBefore;
      expect(balanceDiff).to.be.closeTo(curriculumPrice, ethers.parseEther("0.01"));

      console.log("✅ Custom corporate curriculum development processed successfully");
    });
  });

  describe("🏆 Certification and Assessment Programs", function () {
    it("Should handle certification program enrollment", async function () {
      console.log("📚 Testing certification program enrollment...");

      const certPrice = ethers.parseEther("299"); // $299 certification program
      const certDuration = 120 * 24 * 3600; // 4 months program
      
      const studentAddress = await student1.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Student enrolls in certification program
      const certTx = await streamLockManager.connect(student1).createStreamLock(
        providerAddress,
        tokenAddress,
        certPrice,
        certDuration
      );

      const certReceipt = await certTx.wait();
      const certLogs = certReceipt?.logs || [];
      let certStreamId: any;

      for (const log of certLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            certStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Verify certification enrollment is active
      const streamStatus = await streamLockManager.getStreamStatus(certStreamId);
      expect(streamStatus.isActive).to.be.true;

      console.log("✅ Certification program enrollment created successfully");
    });

    it("Should handle professional exam preparation package", async function () {
      console.log("📚 Testing professional exam preparation package...");

      const examPrepPrice = ethers.parseEther("450"); // $450 for exam prep package
      const practiceExams = 15; // 15 practice exams
      
      const studentAddress = await student2.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Create usage pool for practice exams
      const examTx = await streamLockManager.connect(eduProvider).createUsagePool(
        studentAddress,
        providerAddress,
        tokenAddress,
        examPrepPrice,
        practiceExams
      );

      const examReceipt = await examTx.wait();
      const examLogs = examReceipt?.logs || [];
      let examPoolId: any;

      for (const log of examLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            examPoolId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Student takes 8 practice exams
      for (let i = 0; i < 8; i++) {
        await streamLockManager.connect(eduProvider).consumeUsageFromPool(examPoolId, 1);
      }

      // Check remaining practice exams
      const updatedExamInfo = await streamLockManager.getTokenLock(examPoolId);
      expect(updatedExamInfo.usedCount).to.equal(8);
      expect(updatedExamInfo.usageCount - updatedExamInfo.usedCount).to.equal(7);

      console.log("✅ Professional exam preparation package processed successfully");
    });

    it("Should handle industry-specific skill assessment", async function () {
      console.log("📚 Testing industry-specific skill assessment...");

      const assessmentPrice = ethers.parseEther("149"); // $149 skill assessment
      const assessmentDuration = 14 * 24 * 3600; // 14 days assessment period
      
      const studentAddress = await corporateStudent.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Student purchases skill assessment
      const assessmentTx = await streamLockManager.connect(corporateStudent).createStreamLock(
        providerAddress,
        tokenAddress,
        assessmentPrice,
        assessmentDuration
      );

      const assessmentReceipt = await assessmentTx.wait();
      const assessmentLogs = assessmentReceipt?.logs || [];
      let assessmentStreamId: any;

      for (const log of assessmentLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            assessmentStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Complete assessment after 10 days
      await time.increase(10 * 24 * 3600);

      // Provider processes assessment completion
      const providerBalanceBefore = await testToken.balanceOf(providerAddress);
      
      await streamLockManager.connect(eduProvider).settleStream(assessmentStreamId);
      
      const providerBalanceAfter = await testToken.balanceOf(providerAddress);
      
      // Provider should receive assessment payment
      expect(providerBalanceAfter).to.be.gt(providerBalanceBefore);

      console.log("✅ Industry-specific skill assessment processed successfully");
    });
  });

  describe("💼 Education Provider Business Operations", function () {
    it("Should track total education revenue", async function () {
      console.log("📚 Testing education revenue tracking...");

      const coursePrice = ethers.parseEther("129"); // $129 course
      const shortDuration = 7 * 24 * 3600; // 1 week for testing
      
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Get initial provider balance
      const providerBalanceBefore = await testToken.balanceOf(providerAddress);

      // Create course purchase
      const courseTx = await streamLockManager.connect(student1).createStreamLock(
        providerAddress,
        tokenAddress,
        coursePrice,
        shortDuration
      );

      const courseReceipt = await courseTx.wait();
      const courseLogs = courseReceipt?.logs || [];
      let streamId: any;

      for (const log of courseLogs) {
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

      // Fast forward to course completion
      await time.increase(shortDuration + 3600);

      // Provider claims course revenue
      await streamLockManager.connect(eduProvider).settleStream(streamId);
      
      const providerBalanceAfter = await testToken.balanceOf(providerAddress);
      
      // Calculate revenue
      const balanceDiff = providerBalanceAfter - providerBalanceBefore;
      expect(balanceDiff).to.be.closeTo(coursePrice, ethers.parseEther("0.01"));

      console.log("✅ Education revenue tracking completed successfully");
    });

    it("Should handle course refund policy", async function () {
      console.log("📚 Testing course refund policy...");

      const coursePrice = ethers.parseEther("199"); // $199 course
      const courseDuration = 60 * 24 * 3600; // 60 days course access
      
      const studentAddress = await student2.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Student purchases course
      const courseTx = await streamLockManager.connect(student2).createStreamLock(
        providerAddress,
        tokenAddress,
        coursePrice,
        courseDuration
      );

      const courseReceipt = await courseTx.wait();
      const courseLogs = courseReceipt?.logs || [];
      let courseStreamId: any;

      for (const log of courseLogs) {
        try {
          const parsedLog = streamLockManager.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog?.name === "StreamLockCreated") {
            courseStreamId = parsedLog.args.lockId;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check locked balance before refund
      const lockedBalanceBefore = await streamLockManager.getLockedBalance(studentAddress, tokenAddress);
      expect(lockedBalanceBefore).to.equal(coursePrice);

      // Student requests refund after 1 week (within refund policy)
      await time.increase(7 * 24 * 3600); // 1 week

      // Student cancels course for refund
      const cancelTx = await streamLockManager.connect(student2).cancelStream(courseStreamId);
      await expect(cancelTx).to.emit(streamLockManager, "StreamSettled");
      
      // Check locked balance after refund - should be released
      const lockedBalanceAfter = await streamLockManager.getLockedBalance(studentAddress, tokenAddress);
      expect(lockedBalanceAfter).to.be.lt(lockedBalanceBefore);

      console.log("✅ Course refund policy processed successfully");
    });

    it("Should validate education service constraints", async function () {
      console.log("📚 Testing education service constraints...");

      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Test minimum course duration
      await expect(
        streamLockManager.connect(student1).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("50"),
          1800 // 30 minutes - too short
        )
      ).to.be.reverted;

      // Test minimum course price
      await expect(
        streamLockManager.connect(student1).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("0.0001"), // Too small
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Test valid course should work
      const validTx = await streamLockManager.connect(student1).createStreamLock(
        providerAddress,
        tokenAddress,
        ethers.parseEther("29"), // Valid amount
        30 * 24 * 3600 // Valid duration
      );

      await expect(validTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Education service constraints validated successfully");
    });
  });

  describe("🚨 Educational Platform Admin Features", function () {
    it("Should allow education platform emergency pause", async function () {
      console.log("📚 Testing education platform emergency pause...");

      // Test pause functionality
      await streamLockManager.pause();
      expect(await streamLockManager.paused()).to.be.true;

      // Try to create course enrollment while paused
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      await expect(
        streamLockManager.connect(student1).createStreamLock(
          providerAddress,
          tokenAddress,
          ethers.parseEther("99"),
          30 * 24 * 3600
        )
      ).to.be.reverted;

      // Unpause and verify services resume
      await streamLockManager.unpause();
      expect(await streamLockManager.paused()).to.be.false;

      const resumeTx = await streamLockManager.connect(student1).createStreamLock(
        providerAddress,
        tokenAddress,
        ethers.parseEther("99"),
        30 * 24 * 3600
      );

      await expect(resumeTx).to.emit(streamLockManager, "StreamLockCreated");

      console.log("✅ Education platform emergency pause functionality tested successfully");
    });

    it("Should track student and provider balance states", async function () {
      console.log("📚 Testing education balance state tracking...");

      const coursePrice = ethers.parseEther("179");
      const courseDuration = 90 * 24 * 3600; // 90 days
      
      const studentAddress = await student1.getAddress();
      const providerAddress = await eduProvider.getAddress();
      const tokenAddress = await testToken.getAddress();

      // Check initial balances
      const studentInitialBalance = await streamLockManager.getTotalBalance(studentAddress, tokenAddress);
      const providerInitialBalance = await streamLockManager.getTotalBalance(providerAddress, tokenAddress);

      // Create course enrollment
      await streamLockManager.connect(student1).createStreamLock(
        providerAddress,
        tokenAddress,
        coursePrice,
        courseDuration
      );

      // Check balances after enrollment
      const studentBalanceAfter = await streamLockManager.getTotalBalance(studentAddress, tokenAddress);
      const studentLockedBalance = await streamLockManager.getLockedBalance(studentAddress, tokenAddress);

      expect(studentBalanceAfter - studentInitialBalance).to.equal(coursePrice);
      expect(studentLockedBalance).to.equal(coursePrice);

      console.log("✅ Education balance state tracking completed successfully");
    });
  });
});
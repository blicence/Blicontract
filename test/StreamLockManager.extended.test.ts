import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StreamLockManager, TestToken } from "../typechain-types";

describe("StreamLockManager - Extended Integration Tests", function () {
    let streamLockManager: StreamLockManager;
    let testToken: TestToken;
    let owner: Signer;
    let user: Signer;
    let producer: Signer;
    let recipient: Signer;

    const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
    const MIN_STREAM_DURATION = 3600; // 1 hour
    const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year
    const TEST_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        [owner, user, producer, recipient] = await ethers.getSigners();

        // Deploy test token
        const TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy(
            "Test Token",
            "TEST",
            18,
            ethers.parseEther("1000000")
        );

        // Deploy StreamLockManager
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await StreamLockManager.deploy();

        // Initialize StreamLockManager
        await streamLockManager.initialize(
            await owner.getAddress(),
            MIN_STREAM_AMOUNT,
            MIN_STREAM_DURATION, 
            MAX_STREAM_DURATION
        );

        // Transfer test tokens to users
        await testToken.transfer(await user.getAddress(), ethers.parseEther("10000"));
        await testToken.transfer(await producer.getAddress(), ethers.parseEther("10000"));
        
        // Approve StreamLockManager to spend tokens
        await testToken.connect(user).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
        await testToken.connect(producer).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
    });

    describe("Vesting Stream Tests", function () {
        const VESTING_AMOUNT = ethers.parseEther("100");
        const CLIFF_DURATION = 3600; // 1 hour cliff
        const VESTING_DURATION = 86400; // 24 hour total vesting
        const IMMEDIATE_AMOUNT = ethers.parseEther("10"); // 10% immediate

        beforeEach(async function () {
            // Set user as authorized caller for vesting stream creation
            await streamLockManager.connect(owner).setAuthorizedCaller(await user.getAddress(), true);
        });

        it("Should create vesting stream with cliff", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const currentTime = await time.latest();
            const cliffDate = currentTime + CLIFF_DURATION;

            const tx = await streamLockManager.connect(user).createVestingStream(
                userAddress,
                recipientAddress,
                tokenAddress,
                VESTING_AMOUNT,
                cliffDate,
                VESTING_DURATION,
                IMMEDIATE_AMOUNT
            );

            await expect(tx).to.emit(streamLockManager, "StreamLockCreated");
        });

        it("Should get vesting info correctly", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const currentTime = await time.latest();
            const cliffDate = currentTime + CLIFF_DURATION;

            const tx = await streamLockManager.connect(user).createVestingStream(
                userAddress,
                recipientAddress,
                tokenAddress,
                VESTING_AMOUNT,
                cliffDate,
                VESTING_DURATION,
                IMMEDIATE_AMOUNT
            );

            const receipt = await tx.wait();
            // Parse event to get stream ID
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

            if (streamId) {
                const lockInfo = await streamLockManager.getTokenLock(streamId);
                expect(lockInfo.cliffDate).to.equal(cliffDate);
                expect(lockInfo.streamType).to.equal(1); // VESTING = 1
                expect(lockInfo.immediateAmount).to.equal(IMMEDIATE_AMOUNT);
            }
        });
    });

    describe("Usage Pool Tests", function () {
        const POOL_AMOUNT = ethers.parseEther("50");
        const USAGE_COUNT = 100;

        beforeEach(async function () {
            // Set user as authorized caller for usage pool creation
            await streamLockManager.connect(owner).setAuthorizedCaller(await user.getAddress(), true);
        });

        it("Should create usage pool", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createUsagePool(
                userAddress,
                recipientAddress,
                tokenAddress,
                POOL_AMOUNT,
                USAGE_COUNT
            );

            await expect(tx).to.emit(streamLockManager, "StreamLockCreated");
        });

        it("Should get usage pool info correctly", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createUsagePool(
                userAddress,
                recipientAddress,
                tokenAddress,
                POOL_AMOUNT,
                USAGE_COUNT
            );

            const receipt = await tx.wait();
            // Parse event to get pool ID
            const logs = receipt?.logs || [];
            let poolId: any;
            
            for (const log of logs) {
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

            if (poolId) {
                const lockInfo = await streamLockManager.getTokenLock(poolId);
                expect(lockInfo.usageCount).to.equal(USAGE_COUNT);
                expect(lockInfo.usedCount).to.equal(0);
                expect(lockInfo.streamType).to.equal(2); // USAGE_POOL = 2
            }
        });

        it("Should consume usage from pool", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createUsagePool(
                userAddress,
                recipientAddress,
                tokenAddress,
                POOL_AMOUNT,
                USAGE_COUNT
            );

            const receipt = await tx.wait();
            // Parse event to get pool ID
            const logs = receipt?.logs || [];
            let poolId: any;
            
            for (const log of logs) {
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

            if (poolId) {
                // Check usage access
                const canUse = await streamLockManager.checkAndSettleOnUsage(userAddress, poolId);
                expect(canUse).to.be.true;
                
                // Check updated counts
                const lockInfo = await streamLockManager.getTokenLock(poolId);
                expect(lockInfo.usedCount).to.equal(1);
            }
        });
    });

    describe("Stream-Customer Plan Integration Tests", function () {
        const PLAN_ID = 123;

        beforeEach(async function () {
            // Set user as authorized caller for customer plan streams
            await streamLockManager.connect(owner).setAuthorizedCaller(await user.getAddress(), true);
        });

        it("Should create stream for customer plan", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamForCustomerPlan(
                PLAN_ID,
                userAddress,
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await expect(tx).to.emit(streamLockManager, "CustomerPlanStreamCreated");
        });

        it("Should link stream to customer plan correctly", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamForCustomerPlan(
                PLAN_ID,
                userAddress,
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const receipt = await tx.wait();
            // Parse event to get stream ID
            const logs = receipt?.logs || [];
            let streamId: any;
            
            for (const log of logs) {
                try {
                    const parsedLog = streamLockManager.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    if (parsedLog?.name === "CustomerPlanStreamCreated") {
                        streamId = parsedLog.args.lockId;
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (streamId) {
                // Check if stream is linked to customer plan
                const planStreamId = await streamLockManager.customerPlanStreams(PLAN_ID);
                expect(planStreamId).to.equal(streamId);
            }
        });
    });

    describe("Basic Functionality Tests", function () {
        it("Should create regular stream lock", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await expect(tx).to.emit(streamLockManager, "StreamLockCreated");
        });

        it("Should get token lock info", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
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

            if (event) {
                const parsedEvent = streamLockManager.interface.parseLog({
                    topics: event.topics,
                    data: event.data
                });
                const lockId = parsedEvent?.args?.lockId;
                
                const tokenLock = await streamLockManager.getTokenLock(lockId);
                expect(tokenLock.totalAmount).to.equal(TEST_AMOUNT);
                expect(tokenLock.isActive).to.be.true;
            }
        });
    });
});
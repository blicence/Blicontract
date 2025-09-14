import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StreamLockManager, TestToken } from "../typechain-types";

describe("StreamLockManager - Comprehensive Updated Tests", function () {
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

        // Deploy StreamLockManager with upgrades plugin (like existing tests)
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await hre.upgrades.deployProxy(
            StreamLockManager,
            [
                await owner.getAddress(),
                MIN_STREAM_AMOUNT,
                MIN_STREAM_DURATION,
                MAX_STREAM_DURATION
            ],
            { initializer: "initialize" }
        ) as unknown as StreamLockManager;

        // Transfer test tokens to users
        await testToken.transfer(await user.getAddress(), ethers.parseEther("10000"));
        await testToken.transfer(await producer.getAddress(), ethers.parseEther("10000"));
        
        // Approve StreamLockManager to spend tokens
        await testToken.connect(user).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
        await testToken.connect(producer).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
    });

    describe("Regular Stream Operations", function () {
        it("Should create regular stream successfully", async function () {
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

        it("Should calculate stream status correctly", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

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

            if (streamId) {
                const status = await streamLockManager.getStreamStatus(streamId);
                expect(status.isActive).to.be.true;
                expect(status.isExpired).to.be.false;
            }
        });
    });

    describe("Batch Operations", function () {
        it("Should create multiple streams in batch", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const streamParams = [
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: ethers.parseEther("50"),
                    duration: MIN_STREAM_DURATION
                },
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: ethers.parseEther("75"),
                    duration: MIN_STREAM_DURATION * 2
                },
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: ethers.parseEther("100"),
                    duration: MIN_STREAM_DURATION * 3
                }
            ];

            const tx = await streamLockManager.connect(user).batchCreateStreams(streamParams);
            const receipt = await tx.wait();

            // Should emit multiple StreamLockCreated events
            const events = receipt?.logs.filter(log => {
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

            expect(events?.length).to.equal(3);
        });

        it("Should allow producer to claim multiple expired streams", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            // Create multiple streams that will expire
            const streamParams = [
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: ethers.parseEther("50"),
                    duration: MIN_STREAM_DURATION
                },
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: ethers.parseEther("75"),
                    duration: MIN_STREAM_DURATION
                }
            ];

            await streamLockManager.connect(user).batchCreateStreams(streamParams);

            // Fast forward time to expire streams
            await time.increase(MIN_STREAM_DURATION + 1);

            // Claim all expired streams
            const tx = await streamLockManager.connect(recipient).claimStreamsByProducer();
            await expect(tx).to.emit(streamLockManager, "ProducerBatchClaim");
        });
    });

    describe("Vesting Streams", function () {
        const VESTING_AMOUNT = ethers.parseEther("100");
        const VESTING_DURATION = 86400; // 24 hours
        const IMMEDIATE_AMOUNT = ethers.parseEther("10");

        beforeEach(async function () {
            // Set user as authorized caller
            await streamLockManager.connect(owner).setAuthorizedCaller(await user.getAddress(), true);
        });

        it("Should create vesting stream with cliff", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const currentTime = await time.latest();
            const cliffDate = currentTime + 3600; // 1 hour cliff

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

        it("Should release immediate amount on vesting creation", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const recipientBalanceBefore = await testToken.balanceOf(recipientAddress);
            
            const currentTime = await time.latest();
            const cliffDate = currentTime + 3600;

            await streamLockManager.connect(user).createVestingStream(
                userAddress,
                recipientAddress,
                tokenAddress,
                VESTING_AMOUNT,
                cliffDate,
                VESTING_DURATION,
                IMMEDIATE_AMOUNT
            );

            const recipientBalanceAfter = await testToken.balanceOf(recipientAddress);
            expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(IMMEDIATE_AMOUNT);
        });
    });

    describe("Usage Pools", function () {
        const POOL_AMOUNT = ethers.parseEther("50");
        const USAGE_COUNT = 100;

        beforeEach(async function () {
            // Set user as authorized caller
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

        it("Should allow usage consumption", async function () {
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
                // Test usage consumption (consume 1 usage)
                const consumeResult = await streamLockManager.connect(user).consumeUsageFromPool(poolId, 1);
                expect(consumeResult).to.not.be.reverted;

                // Check usage was consumed
                const lockInfo = await streamLockManager.getTokenLock(poolId);
                expect(lockInfo.usedCount).to.equal(1);
            }
        });
    });

    describe("Customer Plan Integration", function () {
        const PLAN_ID = 123;

        beforeEach(async function () {
            // Set user as authorized caller
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

        it("Should link stream to customer plan", async function () {
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
                const planStreamId = await streamLockManager.customerPlanStreams(PLAN_ID);
                expect(planStreamId).to.equal(streamId);
            }
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set authorized callers", async function () {
            const testAddress = await user.getAddress();
            
            await streamLockManager.connect(owner).setAuthorizedCaller(testAddress, true);
            expect(await streamLockManager.authorizedCallers(testAddress)).to.be.true;
            
            await streamLockManager.connect(owner).setAuthorizedCaller(testAddress, false);
            expect(await streamLockManager.authorizedCallers(testAddress)).to.be.false;
        });

        it("Should allow owner to update stream parameters", async function () {
            const newMinAmount = ethers.parseEther("0.01");
            const newMinDuration = 7200; // 2 hours
            const newMaxDuration = 730 * 24 * 3600; // 2 years

            await streamLockManager.connect(owner).updateStreamParams(
                newMinAmount,
                newMinDuration,
                newMaxDuration
            );

            expect(await streamLockManager.minStreamAmount()).to.equal(newMinAmount);
            expect(await streamLockManager.minStreamDuration()).to.equal(newMinDuration);
            expect(await streamLockManager.maxStreamDuration()).to.equal(newMaxDuration);
        });

        it("Should allow owner to pause/unpause", async function () {
            await streamLockManager.connect(owner).pause();
            expect(await streamLockManager.paused()).to.be.true;

            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            // Should fail when paused
            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    TEST_AMOUNT,
                    MIN_STREAM_DURATION
                )
            ).to.be.reverted;

            await streamLockManager.connect(owner).unpause();
            expect(await streamLockManager.paused()).to.be.false;

            // Should work when unpaused
            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await expect(tx).to.emit(streamLockManager, "StreamLockCreated");
        });

        it("Should prevent non-owner from admin functions", async function () {
            await expect(
                streamLockManager.connect(user).setAuthorizedCaller(await user.getAddress(), true)
            ).to.be.reverted;

            await expect(
                streamLockManager.connect(user).pause()
            ).to.be.reverted;

            await expect(
                streamLockManager.connect(user).updateStreamParams(
                    ethers.parseEther("1"),
                    3600,
                    86400
                )
            ).to.be.reverted;
        });
    });

    describe("Error Handling", function () {
        it("Should reject invalid stream parameters", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            // Too small amount
            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    ethers.parseEther("0.0001"),
                    MIN_STREAM_DURATION
                )
            ).to.be.reverted;

            // Too short duration
            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    TEST_AMOUNT,
                    1800 // 30 minutes
                )
            ).to.be.reverted;

            // Too long duration
            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    TEST_AMOUNT,
                    366 * 24 * 3600 // More than max
                )
            ).to.be.reverted;
        });

        it("Should prevent unauthorized settlement", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

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

            if (streamId) {
                // Producer (non-recipient) should not be able to settle
                await expect(
                    streamLockManager.connect(producer).settleStream(streamId)
                ).to.be.reverted;
            }
        });

        it("Should prevent unauthorized vesting stream creation", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const currentTime = await time.latest();
            const cliffDate = currentTime + 3600;

            // Non-authorized caller should fail
            await expect(
                streamLockManager.connect(producer).createVestingStream(
                    userAddress,
                    recipientAddress,
                    tokenAddress,
                    ethers.parseEther("100"),
                    cliffDate,
                    86400,
                    ethers.parseEther("10")
                )
            ).to.be.reverted;
        });
    });

    describe("Balance Management", function () {
        it("Should track balances correctly", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const userBalanceBefore = await streamLockManager.getTotalBalance(userAddress, tokenAddress);

            await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const userBalanceAfter = await streamLockManager.getTotalBalance(userAddress, tokenAddress);
            const lockedBalance = await streamLockManager.getLockedBalance(userAddress, tokenAddress);

            expect(userBalanceAfter - userBalanceBefore).to.equal(TEST_AMOUNT);
            expect(lockedBalance).to.equal(TEST_AMOUNT);
        });

        it("Should update balances on stream settlement", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

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

            if (streamId) {
                // Fast forward time and settle
                await time.increase(MIN_STREAM_DURATION + 1);
                
                const lockedBalanceBefore = await streamLockManager.getLockedBalance(userAddress, tokenAddress);
                
                await streamLockManager.connect(recipient).settleStream(streamId);
                
                const lockedBalanceAfter = await streamLockManager.getLockedBalance(userAddress, tokenAddress);
                
                expect(lockedBalanceBefore - lockedBalanceAfter).to.equal(TEST_AMOUNT);
            }
        });
    });
});
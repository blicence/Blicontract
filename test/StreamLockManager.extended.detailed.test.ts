import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StreamLockManager, TestToken } from "../typechain-types";

// Helper function to parse events in Ethers.js v6
function parseEventFromReceipt(receipt: any, contractInterface: any, eventName: string): any {
    const logs = receipt?.logs || [];
    
    for (const log of logs) {
        try {
            const parsedLog = contractInterface.parseLog({
                topics: log.topics,
                data: log.data
            });
            if (parsedLog?.name === eventName) {
                return parsedLog.args;
            }
        } catch (e) {
            // Skip logs that can't be parsed by this interface
            continue;
        }
    }
    return null;
}

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

        // Deploy StreamLockManager using proxy pattern like existing tests
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        // @ts-ignore
        streamLockManager = await hre.upgrades.deployProxy(
            StreamLockManager,
            [
                await owner.getAddress(),
                MIN_STREAM_AMOUNT,
                MIN_STREAM_DURATION,
                MAX_STREAM_DURATION
            ],
            { initializer: "initialize" }
        );
        await streamLockManager;

        // Transfer test tokens to users (owner receives all tokens from TestToken constructor)
        await testToken.transfer(await user.getAddress(), ethers.parseEther("10000"));
        await testToken.transfer(await producer.getAddress(), ethers.parseEther("10000"));
        
        // Approve StreamLockManager to spend tokens
        await testToken.connect(user).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
        await testToken.connect(producer).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
    });

    describe("Basic Stream Creation", function () {
        it("Should create regular stream lock successfully", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await expect(tx).to.emit(streamLockManager, "StreamLockCreated");
            
            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamLockCreated");
            
            expect(event).to.not.be.null;
            expect(event.user).to.equal(await user.getAddress());
            expect(event.recipient).to.equal(recipientAddress);
            expect(event.totalAmount).to.equal(TEST_AMOUNT);
        });

        it("Should get token lock info correctly", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamLockCreated");
            const lockId = event.lockId;
            
            const tokenLock = await streamLockManager.getTokenLock(lockId);
            expect(tokenLock.totalAmount).to.equal(TEST_AMOUNT);
            expect(tokenLock.isActive).to.be.true;
            expect(tokenLock.user).to.equal(await user.getAddress());
            expect(tokenLock.recipient).to.equal(recipientAddress);
        });

        it("Should calculate stream amounts correctly", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamLockCreated");
            const lockId = event.lockId;

            // Check initial state
            const initialAccrued = await streamLockManager.calculateAccruedAmount(lockId);
            expect(initialAccrued).to.equal(0);

            const initialRemaining = await streamLockManager.calculateRemainingAmount(lockId);
            expect(initialRemaining).to.equal(TEST_AMOUNT);

            // Advance time and check again
            await time.increase(1800); // 30 minutes
            
            const midAccrued = await streamLockManager.calculateAccruedAmount(lockId);
            expect(midAccrued).to.be.gt(0);
            expect(midAccrued).to.be.lt(TEST_AMOUNT);

            const midRemaining = await streamLockManager.calculateRemainingAmount(lockId);
            expect(midRemaining).to.be.lt(TEST_AMOUNT);
            expect(midRemaining).to.be.gt(0);
        });
    });

    describe("Stream Status and Lifecycle", function () {
        let lockId: string;

        beforeEach(async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamLockCreated");
            lockId = event.lockId;
        });

        it("Should show correct stream status", async function () {
            const status = await streamLockManager.getStreamStatus(lockId);
            
            expect(status.isActive).to.be.true;
            expect(status.isExpired).to.be.false;
            expect(status.accruedAmount).to.equal(0);
            expect(status.remainingAmount).to.equal(TEST_AMOUNT);
            expect(status.remainingTime).to.be.closeTo(BigInt(MIN_STREAM_DURATION), BigInt(10));
        });

        it("Should show expired status after duration", async function () {
            // Fast forward past stream duration
            await time.increase(MIN_STREAM_DURATION + 1);
            
            const status = await streamLockManager.getStreamStatus(lockId);
            
            expect(status.isExpired).to.be.true;
            expect(status.remainingTime).to.equal(0);
            // Allow some precision tolerance for accrued amount
            expect(status.accruedAmount).to.be.closeTo(TEST_AMOUNT, ethers.parseEther("0.001"));
        });

        it("Should allow stream cancellation by user", async function () {
            const tx = await streamLockManager.connect(user).cancelStream(lockId);
            
            await expect(tx).to.emit(streamLockManager, "StreamSettled");
            
            const tokenLock = await streamLockManager.getTokenLock(lockId);
            expect(tokenLock.isActive).to.be.false;
        });

        it("Should allow stream settlement by producer", async function () {
            // Advance time to allow some accrual
            await time.increase(1800); // 30 minutes
            
            const tx = await streamLockManager.connect(recipient).settleStream(lockId);
            
            await expect(tx).to.emit(streamLockManager, "StreamSettled");
            
            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamSettled");
            
            expect(event.settledAmount).to.be.gt(0);
            expect(event.returnedAmount).to.be.gt(0);
        });
    });

    describe("User and Producer Stream Management", function () {
        it("Should track user's active streams", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();
            const userAddress = await user.getAddress();

            // Create multiple streams
            await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const activeStreams = await streamLockManager.getUserActiveStreams(userAddress);
            expect(activeStreams.length).to.equal(2);
        });

        it("Should track producer's incoming streams", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            // Create streams from different users to same producer
            await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await streamLockManager.connect(producer).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const incomingStreams = await streamLockManager.getProducerIncomingStreams(recipientAddress);
            expect(incomingStreams.length).to.equal(2);
        });
    });

    describe("Batch Operations", function () {
        it("Should create multiple streams in batch", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const params = [
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: TEST_AMOUNT,
                    duration: MIN_STREAM_DURATION
                },
                {
                    recipient: recipientAddress,
                    token: tokenAddress,
                    totalAmount: TEST_AMOUNT,
                    duration: MIN_STREAM_DURATION
                }
            ];

            const tx = await streamLockManager.connect(user).batchCreateStreams(params);
            await expect(tx).to.emit(streamLockManager, "StreamLockCreated");

            const receipt = await tx.wait();
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

            expect(events?.length).to.equal(2);
        });

        it("Should allow producer to claim multiple expired streams", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            // Create multiple streams
            await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await streamLockManager.connect(producer).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            // Fast forward to expiration
            await time.increase(MIN_STREAM_DURATION + 1);

            const tx = await streamLockManager.connect(recipient).claimStreamsByProducer();
            await expect(tx).to.emit(streamLockManager, "ProducerBatchClaim");

            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "ProducerBatchClaim");
            
            expect(event.totalClaimed).to.be.gt(0);
            expect(event.streamCount).to.equal(2);
        });
    });

    describe("Integration Functions", function () {
        let lockId: string;

        beforeEach(async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamLockCreated");
            lockId = event.lockId;
        });

        it("Should validate stream access correctly", async function () {
            const userAddress = await user.getAddress();
            
            const access = await streamLockManager.validateStreamAccess(userAddress, lockId);
            expect(access.hasAccess).to.be.true;
            expect(access.accruedAmount).to.equal(0);

            // Advance time and check again
            await time.increase(1800); // 30 minutes
            
            const accessAfterTime = await streamLockManager.validateStreamAccess(userAddress, lockId);
            expect(accessAfterTime.hasAccess).to.be.true;
            expect(accessAfterTime.accruedAmount).to.be.gt(0);
        });

        it("Should check usage permissions", async function () {
            const userAddress = await user.getAddress();
            
            // First advance some time to allow usage
            await time.increase(1800); // 30 minutes
            
            const canUse = await streamLockManager.checkAndSettleOnUsage(userAddress, lockId);
            expect(canUse).to.be.true;
        });

        it("Should create stream for customer plan", async function () {
            const customerPlanId = 12345;
            const customerAddress = await user.getAddress();
            const producerAddress = await producer.getAddress();
            const tokenAddress = await testToken.getAddress();

            const tx = await streamLockManager.connect(owner).createStreamForCustomerPlan(
                customerPlanId,
                customerAddress,
                producerAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            await expect(tx).to.emit(streamLockManager, "CustomerPlanStreamCreated");

            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "CustomerPlanStreamCreated");
            
            expect(event.customerPlanId).to.equal(customerPlanId);
            expect(event.customer).to.equal(customerAddress);
            expect(event.producer).to.equal(producerAddress);
        });
    });

    describe("Balance Management", function () {
        it("Should track user balances correctly", async function () {
            const userAddress = await user.getAddress();
            const tokenAddress = await testToken.getAddress();

            // Check initial balance
            const initialTotal = await streamLockManager.getTotalBalance(userAddress, tokenAddress);
            expect(initialTotal).to.equal(0);

            // Create a stream (which deposits and locks tokens)
            const recipientAddress = await recipient.getAddress();
            
            await streamLockManager.connect(user).createStreamLock(
                recipientAddress,
                tokenAddress,
                TEST_AMOUNT,
                MIN_STREAM_DURATION
            );

            // Check balances after stream creation
            const totalBalance = await streamLockManager.getTotalBalance(userAddress, tokenAddress);
            const lockedBalance = await streamLockManager.getLockedBalance(userAddress, tokenAddress);
            const unlockedBalance = await streamLockManager.getUnlockedBalance(userAddress, tokenAddress);

            expect(totalBalance).to.equal(TEST_AMOUNT);
            expect(lockedBalance).to.equal(TEST_AMOUNT);
            expect(unlockedBalance).to.equal(0);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set authorized callers", async function () {
            const newCallerAddress = await producer.getAddress();
            
            await streamLockManager.connect(owner).setAuthorizedCaller(newCallerAddress, true);
            
            // Note: In current implementation, we don't have a public getter for authorized callers
            // This test verifies the function can be called without error
        });

        it("Should allow owner to update stream parameters", async function () {
            const newMinAmount = ethers.parseEther("0.002");
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
            // Pause the contract
            await streamLockManager.connect(owner).pause();
            expect(await streamLockManager.paused()).to.be.true;

            // Try to create stream while paused (should fail)
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    TEST_AMOUNT,
                    MIN_STREAM_DURATION
                )
            ).to.be.reverted; // Use generic reverted check for custom errors

            // Unpause and verify functionality returns
            await streamLockManager.connect(owner).unpause();
            expect(await streamLockManager.paused()).to.be.false;

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
            ).to.be.reverted; // Use generic reverted check for custom errors

            await expect(
                streamLockManager.connect(user).pause()
            ).to.be.reverted; // Use generic reverted check for custom errors
        });
    });

    describe("Error Handling", function () {
        it("Should reject streams with insufficient amount", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();
            const tooSmallAmount = ethers.parseEther("0.0001"); // Less than MIN_STREAM_AMOUNT

            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    tooSmallAmount,
                    MIN_STREAM_DURATION
                )
            ).to.be.reverted; // Use generic reverted check for custom errors
        });

        it("Should reject streams with invalid duration", async function () {
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();
            const tooShortDuration = 1800; // Less than MIN_STREAM_DURATION

            await expect(
                streamLockManager.connect(user).createStreamLock(
                    recipientAddress,
                    tokenAddress,
                    TEST_AMOUNT,
                    tooShortDuration
                )
            ).to.be.reverted; // Use generic reverted check for custom errors
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
            const event = parseEventFromReceipt(receipt, streamLockManager.interface, "StreamLockCreated");
            const lockId = event.lockId;

            // Try to settle from unauthorized account
            await expect(
                streamLockManager.connect(producer).settleStream(lockId)
            ).to.be.reverted; // Use generic reverted check for custom errors
        });
    });
});
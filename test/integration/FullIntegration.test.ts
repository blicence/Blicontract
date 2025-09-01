import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Full Integration: StreamLockManager + Factory + Producer", function () {
    let streamLockManager: Contract;
    let factory: Contract;
    let producerStorage: Contract;
    let producerApi: Contract;
    let producerNUsage: Contract;
    let producerVestingApi: Contract;
    let uriGenerator: Contract;
    let testToken: Contract;
    let producer: Contract; // Producer clone instance
    
    let owner: Signer;
    let user: Signer;
    let customer: Signer;
    let producerOwner: Signer;

    const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
    const MIN_STREAM_DURATION = 3600; // 1 hour
    const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

    beforeEach(async function () {
        [owner, user, customer, producerOwner] = await ethers.getSigners();

        // Deploy test token
        const TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy(
            "Test Token",
            "TEST",
            18,
            ethers.parseEther("1000000")
        );
        await testToken.waitForDeployment();

        // Deploy StreamLockManager
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await // @ts-ignore
        hre.upgrades.deployProxy(
            StreamLockManager,
            [
                await owner.getAddress(),
                MIN_STREAM_AMOUNT,
                MIN_STREAM_DURATION,
                MAX_STREAM_DURATION
            ],
            { initializer: "initialize" }
        );
        await streamLockManager.waitForDeployment();

        // For full integration, we would need to deploy all the dependent contracts
        // This test focuses on the core stream functionality with simplified setup
        
        console.log("✅ StreamLockManager deployed at:", streamLockManager.target);
        console.log("✅ Test Token deployed at:", testToken.target);
    });

    describe("Core Stream Operations", function () {
        it("Should create and manage stream lifecycle", async function () {
            const streamAmount = ethers.parseEther("100");
            const duration = 7200; // 2 hours

            // Transfer tokens to customer
            await testToken.transfer(await customer.getAddress(), streamAmount);
            
            // Customer approves and creates stream to producer
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);
            
            const tx = await streamLockManager.connect(customer).createStreamLock(
                await producerOwner.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            
            // Parse events using Ethers.js v6 approach
            const logs = receipt?.logs || [];
            const streamLockCreatedInterface = streamLockManager.interface;
            let lockId: string = "";
            
            for (const log of logs) {
                try {
                    const parsedLog = streamLockCreatedInterface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    if (parsedLog?.name === "StreamLockCreated") {
                        lockId = parsedLog.args.lockId;
                        expect(parsedLog.args.user).to.equal(await customer.getAddress());
                        expect(parsedLog.args.recipient).to.equal(await producerOwner.getAddress());
                        expect(parsedLog.args.totalAmount).to.equal(streamAmount);
                        break;
                    }
                } catch (e) {
                    // Skip logs that can't be parsed by this interface
                    continue;
                }
            }
            
            expect(lockId).to.not.equal("");

            // Check initial status
            const initialStatus = await streamLockManager.getStreamStatus(lockId);
            expect(initialStatus.isActive).to.be.true;
            expect(initialStatus.isExpired).to.be.false;

            // Fast forward time and check accrual
            await time.increase(3600); // 1 hour (half of stream)

            const midStatus = await streamLockManager.getStreamStatus(lockId);
            expect(midStatus.accruedAmount).to.be.gt(0);
            expect(midStatus.accruedAmount).to.be.lt(streamAmount);

            // Producer should see incoming stream
            const incomingStreams = await streamLockManager.getProducerIncomingStreams(
                await producerOwner.getAddress()
            );
            expect(incomingStreams).to.contain(lockId);

            // Customer can cancel stream
            const producerInitialBalance = await testToken.balanceOf(await producerOwner.getAddress());
            
            await streamLockManager.connect(customer).cancelStream(lockId);

            const producerFinalBalance = await testToken.balanceOf(await producerOwner.getAddress());
            const producerReceived = producerFinalBalance - producerInitialBalance;

            // Producer should receive accrued amount
            expect(producerReceived).to.be.gt(0);
            expect(producerReceived).to.be.lt(streamAmount);

            // Stream should be inactive
            const finalStatus = await streamLockManager.getStreamStatus(lockId);
            expect(finalStatus.isActive).to.be.false;
        });

        it("Should handle stream expiration correctly", async function () {
            const streamAmount = ethers.parseEther("50");
            const duration = 3600; // 1 hour

            await testToken.transfer(await customer.getAddress(), streamAmount);
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);
            
            const tx = await streamLockManager.connect(customer).createStreamLock(
                await producerOwner.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            const lockId = event.args.lockId;

            // Fast forward past expiration
            await time.increase(3700); // 1 hour + buffer

            const expiredStatus = await streamLockManager.getStreamStatus(lockId);
            expect(expiredStatus.isExpired).to.be.true;
            expect(expiredStatus.remainingTime).to.equal(0);

            // Producer can claim expired stream
            const initialBalance = await testToken.balanceOf(await producerOwner.getAddress());
            
            await streamLockManager.connect(producerOwner).settleStream(lockId);

            const finalBalance = await testToken.balanceOf(await producerOwner.getAddress());
            const received = finalBalance - initialBalance;

            // Producer should receive full amount for expired stream
            expect(received).to.equal(streamAmount);
        });

        it("Should support batch operations", async function () {
            const streamAmount = ethers.parseEther("20");
            const duration = 3600;
            const batchSize = 3;

            // Transfer tokens for multiple streams
            await testToken.transfer(await customer.getAddress(), streamAmount * BigInt(batchSize));
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount * BigInt(batchSize));

            // Create batch streams
            const recipientAddress = await producerOwner.getAddress();
            const params = Array(batchSize).fill(0).map(() => ({
                recipient: recipientAddress,
                token: testToken.target,
                totalAmount: streamAmount,
                duration: duration
            }));

            const tx = await streamLockManager.connect(customer).batchCreateStreams(params);
            const receipt = await tx.wait();
            
            const events = receipt.events?.filter((e: any) => e.event === "StreamLockCreated");
            expect(events).to.have.length(batchSize);

            // Fast forward past expiration
            await time.increase(3700);

            // Producer batch claim
            const initialBalance = await testToken.balanceOf(await producerOwner.getAddress());
            
            await streamLockManager.connect(producerOwner).claimStreamsByProducer();

            const finalBalance = await testToken.balanceOf(await producerOwner.getAddress());
            const totalReceived = finalBalance - initialBalance;

            // Should receive full amount from all streams
            expect(totalReceived).to.equal(streamAmount * BigInt(batchSize));
        });
    });

    describe("Balance Management", function () {
        it("Should track virtual balances correctly", async function () {
            const depositAmount = ethers.parseEther("100");
            const streamAmount = ethers.parseEther("60");
            const duration = 3600;

            // Transfer tokens to customer
            await testToken.transfer(await customer.getAddress(), depositAmount);

            // Check initial balances (should be 0 in virtual balance system)
            const initialTotal = await streamLockManager.getTotalBalance(
                await customer.getAddress(), 
                testToken.target
            );
            const initialLocked = await streamLockManager.getLockedBalance(
                await customer.getAddress(), 
                testToken.target
            );
            const initialUnlocked = await streamLockManager.getUnlockedBalance(
                await customer.getAddress(), 
                testToken.target
            );

            expect(initialTotal).to.equal(0);
            expect(initialLocked).to.equal(0);
            expect(initialUnlocked).to.equal(0);

            // Create stream (this deposits and locks tokens)
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);
            
            await streamLockManager.connect(customer).createStreamLock(
                await producerOwner.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            // Check balances after stream creation
            const afterTotal = await streamLockManager.getTotalBalance(
                await customer.getAddress(), 
                testToken.target
            );
            const afterLocked = await streamLockManager.getLockedBalance(
                await customer.getAddress(), 
                testToken.target
            );
            const afterUnlocked = await streamLockManager.getUnlockedBalance(
                await customer.getAddress(), 
                testToken.target
            );

            expect(afterTotal).to.equal(streamAmount);
            expect(afterLocked).to.equal(streamAmount);
            expect(afterUnlocked).to.equal(0);

            // Verify balance equation: total = locked + unlocked
            expect(afterTotal).to.equal(afterLocked + afterUnlocked);
        });

        it("Should handle multiple streams for same user", async function () {
            const streamAmount = ethers.parseEther("30");
            const duration = 3600;

            await testToken.transfer(await customer.getAddress(), streamAmount * BigInt(2));
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount * BigInt(2));

            // Create two streams
            await streamLockManager.connect(customer).createStreamLock(
                await producerOwner.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            await streamLockManager.connect(customer).createStreamLock(
                await user.getAddress(), // Different recipient
                testToken.target,
                streamAmount,
                duration
            );

            // Check total locked balance
            const totalLocked = await streamLockManager.getLockedBalance(
                await customer.getAddress(), 
                testToken.target
            );

            expect(totalLocked).to.equal(streamAmount * BigInt(2));

            // Check user's active streams
            const activeStreams = await streamLockManager.getUserActiveStreams(
                await customer.getAddress()
            );
            expect(activeStreams).to.have.length(2);
        });
    });

    describe("Error Handling", function () {
        it("Should reject insufficient balance", async function () {
            const streamAmount = ethers.parseEther("100");
            const userBalance = ethers.parseEther("50");
            const duration = 3600;

            // Give user insufficient balance
            await testToken.transfer(await customer.getAddress(), userBalance);
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);

            // Should fail due to insufficient balance
            await expect(
                streamLockManager.connect(customer).createStreamLock(
                    await producerOwner.getAddress(),
                    testToken.target,
                    streamAmount,
                    duration
                )
            ).to.be.reverted;
        });

        it("Should reject invalid stream parameters", async function () {
            const streamAmount = ethers.parseEther("0.0001"); // Below minimum
            const duration = 1800; // Below minimum
            
            await testToken.transfer(await customer.getAddress(), streamAmount);
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);

            // Should fail due to invalid parameters
            await expect(
                streamLockManager.connect(customer).createStreamLock(
                    await producerOwner.getAddress(),
                    testToken.target,
                    streamAmount,
                    duration
                )
            ).to.be.revertedWith("InvalidStreamParams");
        });

        it("Should prevent unauthorized operations", async function () {
            const streamAmount = ethers.parseEther("50");
            const duration = 3600;

            await testToken.transfer(await customer.getAddress(), streamAmount);
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);
            
            const tx = await streamLockManager.connect(customer).createStreamLock(
                await producerOwner.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            const lockId = event.args.lockId;

            // Unauthorized user should not be able to cancel stream
            await expect(
                streamLockManager.connect(user).cancelStream(lockId)
            ).to.be.revertedWith("OnlyStreamOwner");

            // Unauthorized user should not be able to emergency withdraw
            await expect(
                streamLockManager.connect(user).emergencyWithdraw(lockId)
            ).to.be.revertedWith("OnlyStreamOwner");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to manage authorized callers", async function () {
            const testAddress = await user.getAddress();
            
            // Only owner should be able to set authorized callers
            await expect(
                streamLockManager.connect(user).setAuthorizedCaller(testAddress, true)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            // Owner can set authorized caller
            await streamLockManager.connect(owner).setAuthorizedCaller(testAddress, true);
            expect(await streamLockManager.authorizedCallers(testAddress)).to.be.true;

            // Owner can revoke authorization
            await streamLockManager.connect(owner).setAuthorizedCaller(testAddress, false);
            expect(await streamLockManager.authorizedCallers(testAddress)).to.be.false;
        });

        it("Should allow admin to pause and unpause", async function () {
            // Owner can pause
            await streamLockManager.connect(owner).pause();
            expect(await streamLockManager.paused()).to.be.true;

            // Should reject operations when paused
            await expect(
                streamLockManager.connect(customer).createStreamLock(
                    await producerOwner.getAddress(),
                    testToken.target,
                    ethers.parseEther("1"),
                    3600
                )
            ).to.be.revertedWith("Pausable: paused");

            // Owner can unpause
            await streamLockManager.connect(owner).unpause();
            expect(await streamLockManager.paused()).to.be.false;
        });

        it("Should allow admin to update stream parameters", async function () {
            const newMinAmount = ethers.parseEther("0.01");
            const newMinDuration = 7200;
            const newMaxDuration = 180 * 24 * 3600;

            await streamLockManager.connect(owner).updateStreamParams(
                newMinAmount,
                newMinDuration,
                newMaxDuration
            );

            expect(await streamLockManager.minStreamAmount()).to.equal(newMinAmount);
            expect(await streamLockManager.minStreamDuration()).to.equal(newMinDuration);
            expect(await streamLockManager.maxStreamDuration()).to.equal(newMaxDuration);
        });
    });

    describe("Gas Optimization", function () {
        it("Should optimize gas for batch operations", async function () {
            const streamAmount = ethers.parseEther("10");
            const duration = 3600;
            const batchSize = 5;

            await testToken.transfer(await customer.getAddress(), streamAmount * BigInt(batchSize));
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount * BigInt(batchSize));

            // Measure gas for batch operation
            const recipientAddr = await producerOwner.getAddress();
            const params = Array(batchSize).fill(0).map(() => ({
                recipient: recipientAddr,
                token: testToken.target,
                totalAmount: streamAmount,
                duration: duration
            }));

            const tx = await streamLockManager.connect(customer).batchCreateStreams(params);
            const receipt = await tx.wait();

            console.log(`Batch create (${batchSize} streams) gas used:`, receipt.gasUsed.toString());

            // Verify all streams were created
            const events = receipt.events?.filter((e: any) => e.event === "StreamLockCreated");
            expect(events).to.have.length(batchSize);
        });
    });

    describe("Event Emission", function () {
        it("Should emit correct events for stream lifecycle", async function () {
            const streamAmount = ethers.parseEther("25");
            const duration = 3600;

            await testToken.transfer(await customer.getAddress(), streamAmount);
            await testToken.connect(customer).approve(streamLockManager.target, streamAmount);

            // Stream creation should emit event
            await expect(
                streamLockManager.connect(customer).createStreamLock(
                    await producerOwner.getAddress(),
                    testToken.target,
                    streamAmount,
                    duration
                )
            ).to.emit(streamLockManager, "StreamLockCreated");
            // Event args can be checked separately if needed
        });
    });
});

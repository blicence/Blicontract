import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StreamLockManager, TestToken } from "../typechain-types";

describe("StreamLockManager", function () {
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
        streamLockManager = await upgrades.deployProxy(
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

        // Transfer tokens to user for testing
        await testToken.transfer(await user.getAddress(), TEST_AMOUNT);
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await streamLockManager.owner()).to.equal(await owner.getAddress());
        });

        it("Should set correct stream parameters", async function () {
            expect(await streamLockManager.minStreamAmount()).to.equal(MIN_STREAM_AMOUNT);
            expect(await streamLockManager.minStreamDuration()).to.equal(MIN_STREAM_DURATION);
            expect(await streamLockManager.maxStreamDuration()).to.equal(MAX_STREAM_DURATION);
        });

        it("Should have correct version", async function () {
            expect(await streamLockManager.getVersion()).to.equal(1);
        });
    });

    describe("Stream Creation", function () {
        it("Should create a stream lock successfully", async function () {
            const streamAmount = ethers.parseEther("10");
            const duration = 7200; // 2 hours

            // Approve tokens
            await testToken.connect(user).approve(streamLockManager.target, streamAmount);

            // Create stream
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.user).to.equal(await user.getAddress());
            expect(event.args.recipient).to.equal(await producer.getAddress());
            expect(event.args.totalAmount).to.equal(streamAmount);

            // Check balances
            const lockedBalance = await streamLockManager.getLockedBalance(
                await user.getAddress(),
                testToken.target
            );
            expect(lockedBalance).to.equal(streamAmount);
        });

        it("Should reject streams with insufficient amount", async function () {
            const streamAmount = ethers.parseEther("0.0001"); // Below minimum
            const duration = 7200;

            await testToken.connect(user).approve(streamLockManager.target, streamAmount);

            await expect(
                streamLockManager.connect(user).createStreamLock(
                    await producer.getAddress(),
                    testToken.target,
                    streamAmount,
                    duration
                )
            ).to.be.revertedWith("InvalidStreamParams");
        });

        it("Should reject streams with invalid duration", async function () {
            const streamAmount = ethers.parseEther("10");
            const duration = 1800; // 30 minutes (below minimum)

            await testToken.connect(user).approve(streamLockManager.target, streamAmount);

            await expect(
                streamLockManager.connect(user).createStreamLock(
                    await producer.getAddress(),
                    testToken.target,
                    streamAmount,
                    duration
                )
            ).to.be.revertedWith("InvalidStreamParams");
        });

        it("Should create multiple streams in batch", async function () {
            const streamAmount = ethers.parseEther("5");
            const duration = 7200;

            // Approve tokens for batch
            await testToken.connect(user).approve(streamLockManager.target, streamAmount * 2n);

            const params = [
                {
                    recipient: await producer.getAddress(),
                    token: testToken.target,
                    totalAmount: streamAmount,
                    duration: duration
                },
                {
                    recipient: await recipient.getAddress(),
                    token: testToken.target,
                    totalAmount: streamAmount,
                    duration: duration
                }
            ];

            const tx = await streamLockManager.connect(user).batchCreateStreams(params);
            const receipt = await tx.wait();
            
            const events = receipt.events?.filter((e: any) => e.event === "StreamLockCreated");
            expect(events).to.have.length(2);
        });
    });

    describe("Stream Calculation", function () {
        let lockId: string;

        beforeEach(async function () {
            const streamAmount = ethers.parseEther("10");
            const duration = 7200; // 2 hours

            await testToken.connect(user).approve(streamLockManager.target, streamAmount);
            
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            lockId = event.args.lockId;
        });

        it("Should calculate accrued amount correctly", async function () {
            // Fast forward 1 hour (half of the stream)
            await time.increase(3600);

            const accruedAmount = await streamLockManager.calculateAccruedAmount(lockId);
            const expectedAmount = ethers.parseEther("5"); // Half of 10 ETH

            // Allow for small precision differences
            expect(accruedAmount).to.be.closeTo(expectedAmount, ethers.parseEther("0.001"));
        });

        it("Should calculate remaining amount correctly", async function () {
            // Fast forward 1 hour
            await time.increase(3600);

            const remainingAmount = await streamLockManager.calculateRemainingAmount(lockId);
            const expectedAmount = ethers.parseEther("5"); // Half remaining

            expect(remainingAmount).to.be.closeTo(expectedAmount, ethers.parseEther("0.001"));
        });

        it("Should show correct stream status", async function () {
            const status = await streamLockManager.getStreamStatus(lockId);
            
            expect(status.isActive).to.be.true;
            expect(status.isExpired).to.be.false;
            expect(status.remainingTime).to.be.gt(0);
        });

        it("Should show expired status after duration", async function () {
            // Fast forward past stream end
            await time.increase(7300); // 2 hours + buffer

            const status = await streamLockManager.getStreamStatus(lockId);
            
            expect(status.isExpired).to.be.true;
            expect(status.remainingTime).to.equal(0);
        });
    });

    describe("Stream Settlement", function () {
        let lockId: string;
        const streamAmount = ethers.parseEther("10");
        const duration = 7200; // 2 hours

        beforeEach(async function () {
            await testToken.connect(user).approve(streamLockManager.target, streamAmount);
            
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            lockId = event.args.lockId;
        });

        it("Should allow user to cancel stream", async function () {
            // Fast forward 1 hour
            await time.increase(3600);

            const initialProducerBalance = await testToken.balanceOf(await producer.getAddress());
            
            await streamLockManager.connect(user).cancelStream(lockId);

            const finalProducerBalance = await testToken.balanceOf(await producer.getAddress());
            const producerReceived = finalProducerBalance - initialProducerBalance;

            // Producer should receive approximately half the amount
            expect(producerReceived).to.be.closeTo(
                ethers.parseEther("5"), 
                ethers.parseEther("0.001")
            );

            // Stream should be inactive
            const status = await streamLockManager.getStreamStatus(lockId);
            expect(status.isActive).to.be.false;
        });

        it("Should allow producer to settle expired stream", async function () {
            // Fast forward past expiration
            await time.increase(7300);

            const initialProducerBalance = await testToken.balanceOf(await producer.getAddress());
            
            await streamLockManager.connect(producer).settleStream(lockId);

            const finalProducerBalance = await testToken.balanceOf(await producer.getAddress());
            const producerReceived = finalProducerBalance - initialProducerBalance;

            // Producer should receive the full amount
            expect(producerReceived).to.equal(streamAmount);
        });

        it("Should allow emergency withdraw by stream owner", async function () {
            const initialUserBalance = await testToken.balanceOf(await user.getAddress());
            
            await streamLockManager.connect(user).emergencyWithdraw(lockId);

            const finalUserBalance = await testToken.balanceOf(await user.getAddress());
            const userReceived = finalUserBalance - initialUserBalance;

            // User should get back the full amount
            expect(userReceived).to.equal(streamAmount);

            // Stream should be inactive
            const status = await streamLockManager.getStreamStatus(lockId);
            expect(status.isActive).to.be.false;
        });

        it("Should prevent unauthorized settlement", async function () {
            await expect(
                streamLockManager.connect(recipient).cancelStream(lockId)
            ).to.be.revertedWith("OnlyStreamOwner");
        });
    });

    describe("Multi-Stream Management", function () {
        it("Should track user's active streams", async function () {
            const streamAmount = ethers.parseEther("5");
            const duration = 7200;

            // Approve tokens for multiple streams
            await testToken.connect(user).approve(streamLockManager.target, streamAmount * 3n);

            // Create multiple streams
            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            await streamLockManager.connect(user).createStreamLock(
                await recipient.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const activeStreams = await streamLockManager.getUserActiveStreams(await user.getAddress());
            expect(activeStreams).to.have.length(2);
        });

        it("Should track producer's incoming streams", async function () {
            const streamAmount = ethers.parseEther("5");
            const duration = 7200;

            await testToken.connect(user).approve(streamLockManager.target, streamAmount);

            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const incomingStreams = await streamLockManager.getProducerIncomingStreams(
                await producer.getAddress()
            );
            expect(incomingStreams).to.have.length(1);
        });
    });

    describe("Producer Batch Claims", function () {
        it("Should allow producer to claim multiple expired streams", async function () {
            const streamAmount = ethers.parseEther("5");
            const duration = 3600; // 1 hour

            // Create multiple streams to the same producer
            await testToken.connect(user).approve(streamLockManager.target, streamAmount * 2n);

            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            // Fast forward past expiration
            await time.increase(3700);

            const initialBalance = await testToken.balanceOf(await producer.getAddress());
            
            await streamLockManager.connect(producer).claimStreamsByProducer();

            const finalBalance = await testToken.balanceOf(await producer.getAddress());
            const totalClaimed = finalBalance - initialBalance;

            // Should receive both stream amounts
            expect(totalClaimed).to.equal(streamAmount * 2n);
        });
    });

    describe("Integration Functions", function () {
        let lockId: string;

        beforeEach(async function () {
            // Set streamLockManager as authorized caller
            await streamLockManager.connect(owner).setAuthorizedCaller(
                await owner.getAddress(),
                true
            );

            const streamAmount = ethers.parseEther("10");
            const duration = 7200;

            await testToken.connect(user).approve(streamLockManager.target, streamAmount);
            
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            lockId = event.args.lockId;
        });

        it("Should validate stream access correctly", async function () {
            const [hasAccess, accruedAmount] = await streamLockManager.validateStreamAccess(
                await user.getAddress(),
                lockId
            );

            expect(hasAccess).to.be.true;
            expect(accruedAmount).to.be.gte(0);
        });

        it("Should check usage permissions", async function () {
            // Fast forward to accrue some amount
            await time.increase(1800); // 30 minutes

            const canUse = await streamLockManager.connect(owner).checkAndSettleOnUsage(
                await user.getAddress(),
                lockId
            );

            expect(canUse).to.be.true;
        });

        it("Should create stream for customer plan", async function () {
            const customerPlanId = 123;
            const streamAmount = ethers.parseEther("5");
            const duration = 3600;

            await testToken.connect(user).approve(streamLockManager.target, streamAmount);

            const tx = await streamLockManager.connect(owner).createStreamForCustomerPlan(
                customerPlanId,
                await user.getAddress(),
                await producer.getAddress(),
                testToken.target,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "CustomerPlanStreamCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.customerPlanId).to.equal(customerPlanId);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set authorized callers", async function () {
            await streamLockManager.connect(owner).setAuthorizedCaller(
                await producer.getAddress(),
                true
            );

            expect(await streamLockManager.authorizedCallers(await producer.getAddress())).to.be.true;
        });

        it("Should allow owner to update stream parameters", async function () {
            const newMinAmount = ethers.parseEther("0.01");
            const newMinDuration = 7200;
            const newMaxDuration = 30 * 24 * 3600;

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

            await streamLockManager.connect(owner).unpause();
            expect(await streamLockManager.paused()).to.be.false;
        });

        it("Should prevent non-owner from admin functions", async function () {
            await expect(
                streamLockManager.connect(user).setAuthorizedCaller(
                    await producer.getAddress(),
                    true
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});

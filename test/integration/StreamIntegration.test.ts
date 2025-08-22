import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Integration Tests: StreamLockManager + Factory + Producer", function () {
    let streamLockManager: Contract;
    let factory: Contract;
    let producerStorage: Contract;
    let uriGenerator: Contract;
    let producerApi: Contract;
    let producerNUsage: Contract;
    let producerVestingApi: Contract;
    let testToken: Contract;
    
    let owner: Signer;
    let user: Signer;
    let producer: Signer;

    const MIN_STREAM_AMOUNT = ethers.utils.parseEther("0.001");
    const MIN_STREAM_DURATION = 3600; // 1 hour
    const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

    beforeEach(async function () {
        [owner, user, producer] = await ethers.getSigners();

        // Deploy test token
        const TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy(
            "Test Token",
            "TEST",
            18,
            ethers.utils.parseEther("1000000")
        );
        await testToken.deployed();

        // Deploy StreamLockManager first
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
        await streamLockManager.deployed();

        // Note: Full integration would require deploying all dependent contracts
        // (ProducerStorage, URIGenerator, ProducerApi, etc.)
        // For now, this serves as a template for complete integration tests
        
        console.log("StreamLockManager deployed at:", streamLockManager.address);
    });

    describe("StreamLockManager Standalone", function () {
        it("Should deploy successfully", async function () {
            expect(await streamLockManager.getVersion()).to.equal(1);
            expect(await streamLockManager.owner()).to.equal(await owner.getAddress());
        });

        it("Should create stream locks", async function () {
            const streamAmount = ethers.utils.parseEther("10");
            const duration = 7200; // 2 hours

            // Transfer tokens to user
            await testToken.transfer(await user.getAddress(), streamAmount);
            
            // Approve and create stream
            await testToken.connect(user).approve(streamLockManager.address, streamAmount);
            
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.address,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.user).to.equal(await user.getAddress());
            expect(event.args.recipient).to.equal(await producer.getAddress());
        });

        it("Should set authorized callers", async function () {
            const testAddress = await producer.getAddress();
            
            await streamLockManager.connect(owner).setAuthorizedCaller(testAddress, true);
            
            expect(await streamLockManager.authorizedCallers(testAddress)).to.be.true;
        });
    });

    describe("Balance Management", function () {
        it("Should track locked and unlocked balances correctly", async function () {
            const streamAmount = ethers.utils.parseEther("10");
            const duration = 7200;

            // Transfer tokens to user
            await testToken.transfer(await user.getAddress(), streamAmount);
            
            // Check initial balances
            const initialUnlocked = await streamLockManager.getUnlockedBalance(
                await user.getAddress(), 
                testToken.address
            );
            expect(initialUnlocked).to.equal(0);

            // Create stream lock
            await testToken.connect(user).approve(streamLockManager.address, streamAmount);
            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.address,
                streamAmount,
                duration
            );

            // Check balances after lock creation
            const totalBalance = await streamLockManager.getTotalBalance(
                await user.getAddress(), 
                testToken.address
            );
            const lockedBalance = await streamLockManager.getLockedBalance(
                await user.getAddress(), 
                testToken.address
            );
            const unlockedBalance = await streamLockManager.getUnlockedBalance(
                await user.getAddress(), 
                testToken.address
            );

            expect(totalBalance).to.equal(streamAmount);
            expect(lockedBalance).to.equal(streamAmount);
            expect(unlockedBalance).to.equal(0);
        });
    });

    describe("Stream Lifecycle", function () {
        let lockId: string;

        beforeEach(async function () {
            const streamAmount = ethers.utils.parseEther("10");
            const duration = 7200;

            await testToken.transfer(await user.getAddress(), streamAmount);
            await testToken.connect(user).approve(streamLockManager.address, streamAmount);
            
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.address,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            lockId = event.args.lockId;
        });

        it("Should calculate accrued amounts over time", async function () {
            // Initially, accrued amount should be 0 or very small
            const initialAccrued = await streamLockManager.calculateAccruedAmount(lockId);
            expect(initialAccrued).to.be.lt(ethers.utils.parseEther("0.1"));

            // Fast forward time and check accrued amount increases
            await ethers.provider.send("evm_increaseTime", [1800]); // 30 minutes
            await ethers.provider.send("evm_mine", []);

            const accruedAfterTime = await streamLockManager.calculateAccruedAmount(lockId);
            expect(accruedAfterTime).to.be.gt(initialAccrued);
            expect(accruedAfterTime).to.be.lt(ethers.utils.parseEther("10")); // Less than total
        });

        it("Should allow stream cancellation by owner", async function () {
            const initialProducerBalance = await testToken.balanceOf(await producer.getAddress());
            
            await streamLockManager.connect(user).cancelStream(lockId);

            const finalProducerBalance = await testToken.balanceOf(await producer.getAddress());
            expect(finalProducerBalance).to.be.gt(initialProducerBalance);

            // Stream should be inactive
            const status = await streamLockManager.getStreamStatus(lockId);
            expect(status.isActive).to.be.false;
        });

        it("Should prevent unauthorized stream cancellation", async function () {
            await expect(
                streamLockManager.connect(producer).cancelStream(lockId)
            ).to.be.revertedWith("OnlyStreamOwner");
        });
    });

    describe("Producer Integration", function () {
        it("Should track incoming streams for producers", async function () {
            const streamAmount = ethers.utils.parseEther("5");
            const duration = 3600;

            await testToken.transfer(await user.getAddress(), streamAmount);
            await testToken.connect(user).approve(streamLockManager.address, streamAmount);
            
            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.address,
                streamAmount,
                duration
            );

            const incomingStreams = await streamLockManager.getProducerIncomingStreams(
                await producer.getAddress()
            );
            
            expect(incomingStreams).to.have.length(1);
        });

        it("Should allow batch claiming by producers", async function () {
            const streamAmount = ethers.utils.parseEther("5");
            const duration = 3600; // 1 hour

            // Create stream
            await testToken.transfer(await user.getAddress(), streamAmount);
            await testToken.connect(user).approve(streamLockManager.address, streamAmount);
            
            await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.address,
                streamAmount,
                duration
            );

            // Fast forward past expiration
            await ethers.provider.send("evm_increaseTime", [3700]);
            await ethers.provider.send("evm_mine", []);

            const initialBalance = await testToken.balanceOf(await producer.getAddress());
            
            await streamLockManager.connect(producer).claimStreamsByProducer();

            const finalBalance = await testToken.balanceOf(await producer.getAddress());
            expect(finalBalance).to.be.gt(initialBalance);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to pause contract", async function () {
            await streamLockManager.connect(owner).pause();
            expect(await streamLockManager.paused()).to.be.true;

            // Should reject stream creation when paused
            await expect(
                streamLockManager.connect(user).createStreamLock(
                    await producer.getAddress(),
                    testToken.address,
                    ethers.utils.parseEther("1"),
                    3600
                )
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should allow owner to update stream parameters", async function () {
            const newMinAmount = ethers.utils.parseEther("0.01");
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

        it("Should prevent non-owner from admin functions", async function () {
            await expect(
                streamLockManager.connect(user).pause()
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                streamLockManager.connect(user).setAuthorizedCaller(
                    await producer.getAddress(),
                    true
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Emergency Functions", function () {
        let lockId: string;

        beforeEach(async function () {
            const streamAmount = ethers.utils.parseEther("10");
            const duration = 7200;

            await testToken.transfer(await user.getAddress(), streamAmount);
            await testToken.connect(user).approve(streamLockManager.address, streamAmount);
            
            const tx = await streamLockManager.connect(user).createStreamLock(
                await producer.getAddress(),
                testToken.address,
                streamAmount,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === "StreamLockCreated");
            lockId = event.args.lockId;
        });

        it("Should allow emergency withdrawal by stream owner", async function () {
            const initialUserBalance = await testToken.balanceOf(await user.getAddress());
            
            await streamLockManager.connect(user).emergencyWithdraw(lockId);

            const finalUserBalance = await testToken.balanceOf(await user.getAddress());
            const userReceived = finalUserBalance.sub(initialUserBalance);

            // User should get back the full amount
            expect(userReceived).to.equal(ethers.utils.parseEther("10"));

            // Stream should be inactive
            const status = await streamLockManager.getStreamStatus(lockId);
            expect(status.isActive).to.be.false;
        });

        it("Should prevent unauthorized emergency withdrawal", async function () {
            await expect(
                streamLockManager.connect(producer).emergencyWithdraw(lockId)
            ).to.be.revertedWith("OnlyStreamOwner");
        });
    });
});

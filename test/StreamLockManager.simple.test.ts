import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { StreamLockManager, TestToken } from "../typechain-types";

describe("StreamLockManager - Simple Integration Test", function () {
    let streamLockManager: StreamLockManager;
    let testToken: TestToken;
    let owner: Signer;
    let user: Signer;
    let recipient: Signer;

    const MIN_STREAM_AMOUNT = ethers.parseEther("0.001");
    const MIN_STREAM_DURATION = 3600; // 1 hour
    const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year
    const TEST_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        [owner, user, recipient] = await ethers.getSigners();

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

        // Transfer test tokens to users (owner receives all tokens from TestToken constructor)
        await testToken.connect(owner).transfer(await user.getAddress(), ethers.parseEther("10000"));
        
        // Approve StreamLockManager to spend tokens
        await testToken.connect(user).approve(await streamLockManager.getAddress(), ethers.parseEther("10000"));
    });

    describe("Basic Functionality", function () {
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
                expect(tokenLock.streamType).to.equal(0); // REGULAR
            }
        });
    });

    describe("Extended Stream Types", function () {
        it("Should create vesting stream", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const vestingAmount = ethers.parseEther("100");
            const cliffDuration = 3600; // 1 hour
            const vestingDuration = 86400; // 24 hours
            const immediateAmount = ethers.parseEther("10");

            const tx = await streamLockManager.connect(user).createVestingStream(
                userAddress,
                recipientAddress,
                tokenAddress,
                vestingAmount,
                cliffDuration,
                vestingDuration,
                immediateAmount
            );

            await expect(tx).to.emit(streamLockManager, "VestingStreamCreated");
        });

        it("Should create usage pool", async function () {
            const userAddress = await user.getAddress();
            const recipientAddress = await recipient.getAddress();
            const tokenAddress = await testToken.getAddress();

            const poolAmount = ethers.parseEther("50");
            const usageCount = 100;

            const tx = await streamLockManager.connect(user).createUsagePool(
                userAddress,
                recipientAddress,
                tokenAddress,
                poolAmount,
                usageCount
            );

            await expect(tx).to.emit(streamLockManager, "UsagePoolCreated");
        });
    });
});
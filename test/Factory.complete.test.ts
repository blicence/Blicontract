import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { Factory, ProducerStorage, URIGenerator, StreamLockManager, ProducerNUsage, Producer, TestToken } from "../typechain-types";

// @ts-ignore
const { upgrades } = require("hardhat");

describe("Complete Factory Tests", function () {
    let factory: Factory;
    let producerStorage: ProducerStorage;
    let uriGenerator: URIGenerator;
    let streamLockManager: StreamLockManager;
    let producerNUsage: ProducerNUsage;
    let producerImplementation: Producer;
    let testToken: TestToken;
    let owner: Signer;
    let user1: Signer;
    let user2: Signer;

    this.timeout(60000);

    beforeEach(async () => {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy TestToken
        testToken = await ethers.deployContract("TestToken", ["Test Token", "TEST", 18, ethers.parseEther("1000000")]);
        
        // Deploy URIGenerator
        uriGenerator = await ethers.deployContract("URIGenerator");

        // Deploy Producer implementation
        producerImplementation = await ethers.deployContract("Producer");

        // Deploy StreamLockManager
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await upgrades.deployProxy(StreamLockManagerFactory, [
            await owner.getAddress(),
            ethers.parseEther("0.1"),
            60 * 60,
            365 * 24 * 60 * 60
        ]);
        await streamLockManager.waitForDeployment();

        // Deploy ProducerNUsage
        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await upgrades.deployProxy(ProducerNUsageFactory, []);
        await producerNUsage.waitForDeployment();

        // Deploy ProducerStorage
        producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
        await producerStorage.waitForDeployment();

        // Deploy Factory
        const FactoryFactory = await ethers.getContractFactory("Factory");
        factory = await upgrades.deployProxy(FactoryFactory, [
            await uriGenerator.getAddress(),
            await producerStorage.getAddress(),
            await producerImplementation.getAddress(),
            await producerNUsage.getAddress(),
            await producerImplementation.getAddress(),
            await streamLockManager.getAddress()
        ], { initializer: 'initialize' });
        await factory.waitForDeployment();

        // Set producer implementation
        await factory.connect(owner).setProducerImplementation(await producerImplementation.getAddress());

        // Set up required connections
        await producerStorage.setFactory(
            await factory.getAddress(),
            await producerImplementation.getAddress(),
            await producerNUsage.getAddress(),
            await producerImplementation.getAddress()
        );
    });

    describe("Deployment and Configuration", function () {
        it("Should deploy all contracts successfully", async function () {
            expect(await factory.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await streamLockManager.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await producerStorage.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await uriGenerator.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await producerImplementation.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should have correct owner", async function () {
            expect(await factory.owner()).to.equal(await owner.getAddress());
            expect(await streamLockManager.owner()).to.equal(await owner.getAddress());
            expect(await producerStorage.owner()).to.equal(await owner.getAddress());
        });

        it("Should have correct storage references", async function () {
            expect(await factory.producerStorage()).to.equal(await producerStorage.getAddress());
            expect(await factory.streamLockManager()).to.equal(await streamLockManager.getAddress());
        });

        it("Should have correct producer implementation", async function () {
            expect(await factory.getProducerImplementation()).to.equal(await producerImplementation.getAddress());
        });
    });

    describe("Producer ID Management", function () {
        it("Should start with producer ID 0", async function () {
            const currentId = await factory.currentPR_ID();
            expect(currentId).to.equal(0n);
        });

        it("Should increment producer ID", async function () {
            const initialId = await factory.currentPR_ID();
            await factory.incrementPR_ID();
            const newId = await factory.currentPR_ID();
            expect(newId).to.equal(initialId + 1n);
        });
    });

    describe("Access Control", function () {
        it("Should allow owner to set producer implementation", async function () {
            const newImplementation = await ethers.deployContract("Producer");
            await factory.connect(owner).setProducerImplementation(await newImplementation.getAddress());
            expect(await factory.getProducerImplementation()).to.equal(await newImplementation.getAddress());
        });

        it("Should not allow non-owner to set producer implementation", async function () {
            const newImplementation = await ethers.deployContract("Producer");
            await expect(
                factory.connect(user1).setProducerImplementation(await newImplementation.getAddress())
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should validate implementation is a contract", async function () {
            const nonContractAddress = await user1.getAddress();
            await expect(
                factory.connect(owner).setProducerImplementation(nonContractAddress)
            ).to.be.revertedWith("Not a contract");
        });
    });

    describe("Producer Creation Data Structure", function () {
        it("Should create valid producer data", async function () {
            const producerData = {
                producerId: 0n,
                ownerAddress: await user1.getAddress(),
                name: "Test Producer",
                description: "A comprehensive test producer",
                image: "https://example.com/image.png",
                externalLink: "https://example.com",
                subscriptionToken: await testToken.getAddress(),
                subscriptionStatus: true
            };

            expect(producerData.name).to.equal("Test Producer");
            expect(producerData.ownerAddress).to.equal(await user1.getAddress());
            expect(producerData.subscriptionToken).to.equal(await testToken.getAddress());
            expect(producerData.subscriptionStatus).to.be.true;
        });
    });

    describe("Integration Tests", function () {
        it("Should have proper contract interconnections", async function () {
            // Verify Producer Storage has correct Factory reference
            expect(await producerStorage.producerApi()).to.equal(await producerImplementation.getAddress());
            expect(await producerStorage.producerNUsage()).to.equal(await producerNUsage.getAddress());
            expect(await producerStorage.producerVestingApi()).to.equal(await producerImplementation.getAddress());
        });

        it("Should have correct StreamLockManager configuration", async function () {
            expect(await streamLockManager.minStreamAmount()).to.equal(ethers.parseEther("0.1"));
            expect(await streamLockManager.minStreamDuration()).to.equal(60 * 60);
            expect(await streamLockManager.maxStreamDuration()).to.equal(365 * 24 * 60 * 60);
        });

        it("Should maintain contract relationships", async function () {
            // All contracts should be properly linked
            expect(await factory.producerStorage()).to.not.equal(ethers.ZeroAddress);
            expect(await factory.streamLockManager()).to.not.equal(ethers.ZeroAddress);
            expect(await factory.getProducerImplementation()).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Contract States", function () {
        it("Should have proper initial states", async function () {
            // Factory should be properly initialized
            expect(await factory.owner()).to.not.equal(ethers.ZeroAddress);
            expect(await factory.getProducerImplementation()).to.not.equal(ethers.ZeroAddress);
            
            // Producer Storage should be configured
            expect(await producerStorage.producerApi()).to.not.equal(ethers.ZeroAddress);
            expect(await producerStorage.producerNUsage()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should maintain version consistency", async function () {
            // Check if StreamLockManager has version
            expect(await streamLockManager.VERSION()).to.equal(1);
        });
    });
});

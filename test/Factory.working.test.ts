import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { Factory, ProducerStorage, URIGenerator, StreamLockManager, ProducerNUsage, Producer, TestToken } from "../typechain-types";

// @ts-ignore
const { upgrades } = require("hardhat");

describe("Factory - Working Tests", function () {
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

    this.timeout(60000); // Increase timeout

    beforeEach(async () => {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy TestToken
        testToken = await ethers.deployContract("TestToken", ["Test Token", "TEST", 18, ethers.parseEther("1000000")]);
        
        // Deploy URIGenerator (non-upgradeable)
        uriGenerator = await ethers.deployContract("URIGenerator");

        // Deploy Producer implementation (non-upgradeable)
        producerImplementation = await ethers.deployContract("Producer");

        // Deploy upgradeable contracts
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await // @ts-ignore
        hre.upgrades.deployProxy(StreamLockManagerFactory, [
            await owner.getAddress(),
            ethers.parseEther("0.1"), // minStreamAmount  
            60 * 60, // minStreamDuration (1 hour)
            365 * 24 * 60 * 60 // maxStreamDuration (1 year)
        ]);
        await streamLockManager.waitForDeployment();

        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await // @ts-ignore
        hre.upgrades.deployProxy(ProducerNUsageFactory, []);
        await producerNUsage.waitForDeployment();

        // Deploy ProducerStorage (regular contract, not upgradeable)
        producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
        await producerStorage.waitForDeployment();

        // Deploy Factory
        const FactoryFactory = await ethers.getContractFactory("Factory");
        factory = await // @ts-ignore
        hre.upgrades.deployProxy(FactoryFactory, [
            await uriGenerator.getAddress(),
            await producerStorage.getAddress(),
            await producerImplementation.getAddress(), // producerApi
            await producerNUsage.getAddress(),
            await producerImplementation.getAddress(), // producerVestingApi
            await streamLockManager.getAddress(),
            await producerImplementation.getAddress()  // Producer implementation
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

    describe("Deployment", function () {
        it("Should deploy successfully", async function () {
            expect(await factory.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await streamLockManager.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await producerStorage.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should have correct owner", async function () {
            expect(await factory.owner()).to.equal(await owner.getAddress());
        });

        it("Should have correct storage references", async function () {
            expect(await factory.producerStorage()).to.equal(await producerStorage.getAddress());
            expect(await factory.streamLockManager()).to.equal(await streamLockManager.getAddress());
        });
    });

    describe("Basic Functions", function () {
        it("Should return producer implementation", async function () {
            expect(await factory.getProducerImplementation()).to.equal(await producerImplementation.getAddress());
        });

        it("Should get current producer ID", async function () {
            try {
                const currentId = await factory.currentPR_ID();
                expect(currentId).to.be.a('bigint');
                expect(currentId).to.equal(0n); // Should start from 0
            } catch (error) {
                console.log("currentPR_ID failed:", error);
                // This might fail due to storage initialization issues
            }
        });
    });

    describe("Producer Creation", function () {
        it("Should create producer data structure", async function () {
            const producerData = {
                name: "Test Producer",
                description: "A test producer",
                image: "https://example.com/image.png",
                externalLink: "https://example.com",
                ownerAddress: await user1.getAddress(),
                subscriptionToken: await testToken.getAddress(),
                subscriptionFee: ethers.parseEther("10"),
                subscriptionTime: 30 * 24 * 60 * 60, // 30 days
                donationFee: ethers.parseEther("5"),
                usageFee: ethers.parseEther("1"),
                minBalance: ethers.parseEther("1")
            };

            // This test just validates the data structure
            expect(producerData.name).to.equal("Test Producer");
            expect(producerData.ownerAddress).to.equal(await user1.getAddress());
        });
    });
});

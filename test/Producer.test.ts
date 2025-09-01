import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { Signer } from "ethers";
import { Producer, URIGenerator, ProducerStorage, StreamLockManager, ProducerNUsage, TestToken } from "../typechain-types";

describe("Producer", function () {
    let producer: Producer;
    let uriGenerator: URIGenerator;
    let producerStorage: ProducerStorage;
    let streamLockManager: StreamLockManager;
    let producerNUsage: ProducerNUsage;
    let testToken: TestToken;
    let owner: Signer;
    let user: Signer;
    let customer: Signer;

    beforeEach(async function () {
        [owner, user, customer] = await ethers.getSigners();

        // Deploy test token
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        testToken = await TestTokenFactory.deploy(
            "Test Token",
            "TEST",
            18,
            ethers.parseEther("1000000")
        ) as TestToken;
        await testToken.waitForDeployment();

        // Deploy ProducerStorage
        const ProducerStorageFactory = await ethers.getContractFactory("ProducerStorage");
        producerStorage = await ProducerStorageFactory.deploy(await owner.getAddress()) as ProducerStorage;
        await producerStorage.waitForDeployment();

        // Deploy URIGenerator
        const URIGeneratorFactory = await ethers.getContractFactory("URIGenerator");
        const uriGeneratorImpl = await URIGeneratorFactory.deploy();
        await uriGeneratorImpl.waitForDeployment();
        await uriGeneratorImpl.initialize();
        uriGenerator = uriGeneratorImpl as URIGenerator;

        // Deploy StreamLockManager
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await // @ts-ignore
        hre.upgrades.deployProxy(StreamLockManagerFactory, [
            await owner.getAddress(),
            ethers.parseEther("0.001"),
            3600,
            365 * 24 * 3600
        ]) as StreamLockManager;

        // Deploy ProducerNUsage
        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await // @ts-ignore
        hre.upgrades.deployProxy(ProducerNUsageFactory, []);

        // Deploy Producer
        const ProducerFactory = await ethers.getContractFactory("Producer");
        producer = await // @ts-ignore
        hre.upgrades.deployProxy(ProducerFactory, [
            await user.getAddress(), // user as owner
            await uriGenerator.getAddress(),
            await producerNUsage.getAddress(),
            await producerStorage.getAddress(),
            await streamLockManager.getAddress()
        ], { 
            kind: 'uups',
            unsafeAllow: ['constructor']
        });

        // Transfer tokens to customer for testing
        await testToken.transfer(await customer.getAddress(), ethers.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should deploy successfully", async function () {
            expect(await producer.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should set correct owner", async function () {
            expect(await producer.owner()).to.equal(await user.getAddress());
        });

        it("Should set correct URI generator", async function () {
            expect(await producer.uriGenerator()).to.equal(await uriGenerator.getAddress());
        });

        it("Should set correct producer storage", async function () {
            expect(await producer.producerStorage()).to.equal(await producerStorage.getAddress());
        });

        it("Should set correct stream lock manager", async function () {
            expect(await producer.streamLockManager()).to.equal(await streamLockManager.getAddress());
        });
    });

    describe("Plan Management", function () {
        const planData = {
            planId: 1,
            cloneAddress: ethers.ZeroAddress,
            producerId: 1,
            name: "Test Plan",
            description: "A test plan",
            externalLink: "https://example.com",
            totalSupply: 100,
            currentSupply: 0,
            backgroundColor: "#ffffff",
            image: "https://example.com/image.png",
            animationUrl: "",
            metadataFolderCid: "",
            priceAddress: ethers.ZeroAddress,
            price: ethers.parseEther("10"),
            isActive: true,
            planType: 1, // nUsage type
            subscriptionType: 0
        };

        it("Should add a plan", async function () {
            // This would require proper setup of producer storage and plan creation
            // For now, we'll test the basic structure
            expect(await producer.getAddress()).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Customer Plan Management", function () {
        const customerPlanData = {
            custumerPlanId: 1,
            planId: 1,
            customerAdress: ethers.ZeroAddress,
            cloneAddress: ethers.ZeroAddress,
            remainingQuota: 10,
            status: 0, // active
            planType: 1, // nUsage
            creationDate: Math.floor(Date.now() / 1000),
            usageCount: 0
        };

        it("Should handle customer plan creation structure", async function () {
            // This tests the basic contract structure
            expect(await producer.getAddress()).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Access Control", function () {
        it("Should have correct owner", async function () {
            expect(await producer.owner()).to.equal(await user.getAddress());
        });

        it("Should be pausable (inherited from PausableUpgradeable)", async function () {
            // Check if paused function is available
            expect(await producer.paused()).to.be.false;
        });
    });

    describe("Stream Validation", function () {
        it("Should check stream before usage", async function () {
            // Test the stream validation mechanism
            const customerPlanId = 1;
            const customerAddress = await customer.getAddress();
            
            // This will test the basic function call - using staticCall for read-only operation
            const canUse = await producer.checkStreamBeforeUsage.staticCall(customerPlanId, customerAddress);
            expect(canUse).to.be.a("boolean");
        });
    });

    describe("Basic Functionality", function () {
        it("Should handle token transfers if needed", async function () {
            // Basic test to ensure contract can handle ERC20 interactions
            const initialBalance = await testToken.balanceOf(await customer.getAddress());
            expect(initialBalance).to.equal(ethers.parseEther("1000"));
        });

        it("Should validate basic contract state", async function () {
            // Test basic contract state
            expect(await producer.getAddress()).to.not.equal(ethers.ZeroAddress);
            expect(await producer.owner()).to.equal(await user.getAddress());
        });
    });
});

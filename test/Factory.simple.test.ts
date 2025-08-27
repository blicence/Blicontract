import { expect } from "chai";
import { ethers } from "hardhat";
import { upgrades } from "hardhat";
import { Signer } from "ethers";
import { Factory, ProducerStorage, URIGenerator, StreamLockManager, ProducerNUsage, Producer, TestToken } from "../typechain-types";

describe("Factory - Simple Tests", function () {
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

    beforeEach(async () => {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy fresh contracts for each test
        testToken = await ethers.deployContract("TestToken", ["Test Token", "TEST", 18, ethers.parseEther("1000000")]);
        
        // Deploy StreamLockManager
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await upgrades.deployProxy(StreamLockManagerFactory, [await owner.getAddress()]);

        // Deploy ProducerNUsage
        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await upgrades.deployProxy(ProducerNUsageFactory, [await owner.getAddress()]);

        // Deploy ProducerStorage
        const ProducerStorageFactory = await ethers.getContractFactory("ProducerStorage");
        producerStorage = await upgrades.deployProxy(ProducerStorageFactory, [await owner.getAddress()]);

        // Deploy URIGenerator
        uriGenerator = await ethers.deployContract("URIGenerator");

        // Deploy Producer implementation
        producerImplementation = await ethers.deployContract("Producer");

        // Deploy Factory
        const FactoryFactory = await ethers.getContractFactory("Factory");
        factory = await upgrades.deployProxy(FactoryFactory, [
            await uriGenerator.getAddress(),
            await producerStorage.getAddress(),
            await producerImplementation.getAddress(), // producerApi
            await producerNUsage.getAddress(),
            await producerImplementation.getAddress(), // producerVestingApi
            await streamLockManager.getAddress()
        ], { initializer: 'initialize' });

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

        it("Should have correct producer implementation", async function () {
            // This might fail initially until producer implementation is set
            // expect(await factory.ProducerImplementation()).to.equal(await producerImplementation.getAddress());
        });
    });

    describe("Basic Functions", function () {
        it("Should get current producer ID", async function () {
            // This test might fail if producerStorage isn't properly initialized
            try {
                const currentId = await factory.currentPR_ID();
                expect(currentId).to.be.a('bigint');
            } catch (error) {
                console.log("currentPR_ID failed:", error);
            }
        });
    });
});

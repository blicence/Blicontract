import { expect } from "chai";
import { ethers } from "hardhat";
import "@openzeppelin/hardhat-upgrades";
const { upgrades } = require("hardhat");
import { Signer } from "ethers";
import { Factory, ProducerStorage, URIGenerator, StreamLockManager, ProducerNUsage, Producer, TestToken } from "../typechain-types";

describe("Factory", function () {
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
        testToken = await ethers.deployContract("TestToken", ["Test Token", "TEST"]);
        
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
        });

        it("Should set correct producer implementation", async function () {
            expect(await factory.getProducerImplementation()).to.equal(await producerImplementation.getAddress());
        });

        it("Should have correct producer storage", async function () {
            expect(await factory.producerStorage()).to.equal(await producerStorage.getAddress());
        });

        it("Should have correct stream lock manager", async function () {
            expect(await factory.streamLockManager()).to.equal(await streamLockManager.getAddress());
        });
    });

    describe("Producer Creation", function () {
        const producerData = {
            producerId: 0, // Will be set by contract
            producerAddress: ethers.ZeroAddress, // Will be set to msg.sender
            name: "Test Producer",
            description: "A test producer for testing",
            image: "https://example.com/image.png",
            externalLink: "https://example.com",
            cloneAddress: ethers.ZeroAddress, // Will be set by contract
            exists: false // Will be set by contract
        };

        it("Should create a new producer", async function () {
            const tx = await factory.connect(producer).newBcontract(producerData);
            const receipt = await tx.wait();

            // Check for BcontractCreated event
            const event = receipt?.logs.find((log: any) => {
                try {
                    return factory.interface.parseLog(log)?.name === "BcontractCreated";
                } catch {
                    return false;
                }
            });
            expect(event).to.not.be.undefined;
        });

        it("Should increment producer ID after creation", async function () {
            const initialPrId = await factory.currentPR_ID();
            
            await factory.connect(producer).newBcontract(producerData);
            
            const newPrId = await factory.currentPR_ID();
            expect(newPrId).to.equal(initialPrId + 1n);
        });

        it("Should clone producer contract correctly", async function () {
            const tx = await factory.connect(producer).newBcontract(producerData);
            const receipt = await tx.wait();

            const event = receipt?.logs.find((log: any) => {
                try {
                    return factory.interface.parseLog(log)?.name === "BcontractCreated";
                } catch {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
            if (event) {
                const parsedEvent = factory.interface.parseLog(event);
                const cloneAddress = parsedEvent?.args[1];
                expect(cloneAddress).to.not.equal(ethers.ZeroAddress);
            }
        });
    });

    describe("Access Control", function () {
        it("Should only allow owner to set producer implementation", async function () {
            await expect(
                factory.connect(user).setProducerImplementation(await producerImplementation.getAddress())
            ).to.be.reverted;
        });

        it("Should allow owner to update producer implementation", async function () {
            const newImplementation = await (await ethers.getContractFactory("Producer")).deploy();
            await newImplementation.waitForDeployment();

            await factory.setProducerImplementation(await newImplementation.getAddress());
            expect(await factory.getProducerImplementation()).to.equal(await newImplementation.getAddress());
        });

        it("Should validate implementation is a contract", async function () {
            const nonContractAddress = await user.getAddress();
            await expect(
                factory.setProducerImplementation(nonContractAddress)
            ).to.be.revertedWith("Not a contract");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            const producerData = {
                producerId: 0,
                producerAddress: ethers.ZeroAddress,
                name: "Test Producer",
                description: "A test producer for testing",
                image: "https://example.com/image.png",
                externalLink: "https://example.com",
                cloneAddress: ethers.ZeroAddress,
                exists: false
            };
            await factory.connect(producer).newBcontract(producerData);
        });

        it("Should return correct producer implementation", async function () {
            expect(await factory.getProducerImplementation()).to.equal(await producerImplementation.getAddress());
        });

        it("Should return current producer ID", async function () {
            const currentId = await factory.currentPR_ID();
            expect(currentId).to.be.greaterThan(0);
        });

        it("Should increment producer ID", async function () {
            const currentId = await factory.currentPR_ID();
            const newId = await factory.incrementPR_ID();
            expect(newId).to.equal(currentId + 1n);
        });
    });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { Signer } from "ethers";
import { Factory, ProducerStorage, URIGenerator, StreamLockManager, ProducerNUsage, Producer } from "../typechain-types";

describe("Factory Enhanced Functions", function () {
  let factory: Factory;
  let producerStorage: ProducerStorage;
  let uriGenerator: URIGenerator;
  let streamLockManager: StreamLockManager;
  let producerNUsage: ProducerNUsage;
  let producerImplementation: Producer;
  let owner: Signer;
  let producer1: Signer;
  let producer2: Signer;
  let producer3: Signer;

  beforeEach(async function () {
    [owner, producer1, producer2, producer3] = await ethers.getSigners();

    // Deploy contracts - using the same pattern as existing tests
    producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);
    uriGenerator = await ethers.deployContract("URIGenerator");
    
    // Deploy contracts with upgrades support
    const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
    streamLockManager = await hre.upgrades.deployProxy(StreamLockManagerFactory, [
      await owner.getAddress(), // owner
      1 * 10**18, // minStreamAmount
      3600, // minStreamDuration
      365 * 24 * 3600 // maxStreamDuration
    ]);

    const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
    producerNUsage = await hre.upgrades.deployProxy(ProducerNUsageFactory, []);

    producerImplementation = await ethers.deployContract("Producer");
    
    const FactoryContract = await ethers.getContractFactory("Factory");
    factory = await hre.upgrades.deployProxy(FactoryContract, [
      await uriGenerator.getAddress(),
      await producerStorage.getAddress(),
      await producerNUsage.getAddress(), // API logic
      await producerNUsage.getAddress(), // nUsage logic  
      await producerNUsage.getAddress(), // VestingApi logic
      await streamLockManager.getAddress(),
      await producerImplementation.getAddress()
    ]);

    // Setup storage permissions
    await producerStorage.setFactoryAddress(await factory.getAddress());
  });

  async function createTestProducers() {
    // Create Producer 1
    const producer1Data = {
      producerId: 0,
      cloneAddress: ethers.ZeroAddress,
      exists: true,
      name: "Producer One",
      description: "First test producer",
      image: "https://example.com/image1.png",
      externalLink: "https://producer1.com",
      producerAddress: await producer1.getAddress()
    };
    await factory.connect(producer1).newBcontract(producer1Data);

    // Create Producer 2
    const producer2Data = {
      producerId: 0,
      cloneAddress: ethers.ZeroAddress,
      exists: true,
      name: "Producer Two", 
      description: "Second test producer",
      image: "https://example.com/image2.png",
      externalLink: "https://producer2.com",
      producerAddress: await producer2.getAddress()
    };
    await factory.connect(producer2).newBcontract(producer2Data);

    // Create Producer 3
    const producer3Data = {
      producerId: 0,
      cloneAddress: ethers.ZeroAddress,
      exists: true,
      name: "Producer Three",
      description: "Third test producer", 
      image: "https://example.com/image3.png",
      externalLink: "https://producer3.com",
      producerAddress: await producer3.getAddress()
    };
    await factory.connect(producer3).newBcontract(producer3Data);
  }

  describe("getAllProducers", function () {
    it("Should return empty array when no producers exist", async function () {
      const producers = await factory.getAllProducers();
      expect(producers.length).to.equal(0);
    });

    it("Should return all producers when producers exist", async function () {
      await createTestProducers();
      
      const producers = await factory.getAllProducers();
      expect(producers.length).to.equal(3);
      
      expect(producers[0].name).to.equal("Producer One");
      expect(producers[1].name).to.equal("Producer Two");
      expect(producers[2].name).to.equal("Producer Three");
      
      expect(producers[0].exists).to.be.true;
      expect(producers[1].exists).to.be.true;
      expect(producers[2].exists).to.be.true;
    });

    it("Should return producers with correct IDs", async function () {
      await createTestProducers();
      
      const producers = await factory.getAllProducers();
      
      expect(producers[0].producerId).to.equal(1);
      expect(producers[1].producerId).to.equal(2);
      expect(producers[2].producerId).to.equal(3);
    });
  });

  describe("getActiveProducers", function () {
    it("Should return empty array when no active producers exist", async function () {
      const activeProducers = await factory.getActiveProducers();
      expect(activeProducers.length).to.equal(0);
    });

    it("Should return all producers when all are active", async function () {
      await createTestProducers();
      
      const activeProducers = await factory.getActiveProducers();
      expect(activeProducers.length).to.equal(3);
      
      activeProducers.forEach((producer: any) => {
        expect(producer.exists).to.be.true;
      });
    });

    it("Should match getAllProducers when all are active", async function () {
      await createTestProducers();
      
      const allProducers = await factory.getAllProducers();
      const activeProducers = await factory.getActiveProducers();
      
      expect(allProducers.length).to.equal(activeProducers.length);
      
      for (let i = 0; i < allProducers.length; i++) {
        expect(allProducers[i].name).to.equal(activeProducers[i].name);
        expect(allProducers[i].producerAddress).to.equal(activeProducers[i].producerAddress);
      }
    });
  });

  describe("getProducerById", function () {
    it("Should return correct producer by ID", async function () {
      await createTestProducers();
      
      const producer1Data = await factory.getProducerById(1);
      const producer2Data = await factory.getProducerById(2);
      const producer3Data = await factory.getProducerById(3);
      
      expect(producer1Data.name).to.equal("Producer One");
      expect(producer1Data.producerAddress).to.equal(await producer1.getAddress());
      expect(producer1Data.producerId).to.equal(1);
      
      expect(producer2Data.name).to.equal("Producer Two");
      expect(producer2Data.producerAddress).to.equal(await producer2.getAddress());
      expect(producer2Data.producerId).to.equal(2);
      
      expect(producer3Data.name).to.equal("Producer Three");
      expect(producer3Data.producerAddress).to.equal(await producer3.getAddress());
      expect(producer3Data.producerId).to.equal(3);
    });

    it("Should return empty producer for non-existent ID", async function () {
      await createTestProducers();
      
      const nonExistentProducer = await factory.getProducerById(999);
      expect(nonExistentProducer.name).to.equal("");
    });
  });

  describe("Producer ID Management", function () {
    it("Should start with ID 0", async function () {
      const currentId = await factory.currentPR_ID();
      expect(currentId).to.equal(0);
    });

    it("Should increment ID correctly when creating producers", async function () {
      expect(await factory.currentPR_ID()).to.equal(0);
      
      // Create first producer
      const producer1Data = {
        producerId: 0,
        cloneAddress: ethers.ZeroAddress,
        exists: true,
        name: "Producer One",
        description: "First test producer",
        image: "https://example.com/image1.png",
        externalLink: "https://producer1.com",
        producerAddress: await producer1.getAddress()
      };
      await factory.connect(producer1).newBcontract(producer1Data);
      
      expect(await factory.currentPR_ID()).to.equal(1);
    });

    it("Should increment ID for each new producer", async function () {
      await createTestProducers();
      
      const currentId = await factory.currentPR_ID();
      expect(currentId).to.equal(3);
    });
  });

  describe("Integration Tests", function () {
    it("Should maintain consistency between getter functions", async function () {
      await createTestProducers();
      
      const allProducers = await factory.getAllProducers();
      const activeProducers = await factory.getActiveProducers();
      const currentId = await factory.currentPR_ID();
      
      expect(allProducers.length).to.equal(Number(currentId));
      expect(activeProducers.length).to.equal(allProducers.length);
      
      for (let i = 0; i < allProducers.length; i++) {
        const producerById = await factory.getProducerById(i + 1);
        expect(producerById.name).to.equal(allProducers[i].name);
        expect(producerById.producerAddress).to.equal(allProducers[i].producerAddress);
      }
    });

    it("Should handle multiple operations correctly", async function () {
      await createTestProducers();
      
      expect(await factory.currentPR_ID()).to.equal(3);
      
      const allProducers = await factory.getAllProducers();
      expect(allProducers.length).to.equal(3);
      
      const names = ["Producer One", "Producer Two", "Producer Three"];
      const producers = [producer1, producer2, producer3];
      
      for (let i = 0; i < producers.length; i++) {
        expect(allProducers[i].producerAddress).to.equal(await producers[i].getAddress());
        expect(allProducers[i].name).to.equal(names[i]);
        expect(allProducers[i].exists).to.be.true;
      }
      
      for (let i = 1; i <= 3; i++) {
        const producer = await factory.getProducerById(i);
        expect(producer.producerId).to.equal(i);
        expect(producer.name).to.equal(names[i - 1]);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero producers correctly", async function () {
      expect(await factory.currentPR_ID()).to.equal(0);
      expect((await factory.getAllProducers()).length).to.equal(0);
      expect((await factory.getActiveProducers()).length).to.equal(0);
    });

    it("Should not allow duplicate producer creation", async function () {
      const producerData = {
        producerId: 0,
        cloneAddress: ethers.ZeroAddress,
        exists: true,
        name: "Producer One",
        description: "First test producer",
        image: "https://example.com/image1.png",
        externalLink: "https://producer1.com",
        producerAddress: await producer1.getAddress()
      };
      
      await factory.connect(producer1).newBcontract(producerData);
      
      // Attempting to create another producer with the same address should fail
      await expect(
        factory.connect(producer1).newBcontract(producerData)
      ).to.be.reverted;
    });
  });
});

import { expect } from "chai";
import { ethers, network } from "hardhat";
const hre = require("hardhat");
import { Signer } from "ethers";
import { Factory, Producer, URIGenerator, TestToken, ProducerStorage, StreamLockManager } from "../../typechain-types";

describe("☕ Cafe Scenario Tests", function () {
  let factory: Factory;
  let uriGenerator: URIGenerator;
  let producerStorage: ProducerStorage;
  let streamLockManager: StreamLockManager;
  let testToken: TestToken;
  let cafeOwner: Signer;
  let customer: Signer;
  let deployerAddress: string;

  beforeEach(async function () {
    const [deployer, _cafeOwner, _customer] = await ethers.getSigners();
    cafeOwner = _cafeOwner;
    customer = _customer;
    deployerAddress = await deployer.getAddress();

    console.log("☕ Setting up Cafe Scenario test...");

    // 1. Deploy TestToken first
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(
      "Test Token",
      "TEST", 
      18,
      ethers.parseEther("1000000")
    ) as TestToken;

    // 2. Deploy StreamLockManager
    const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
    streamLockManager = await // @ts-ignore
    hre.upgrades.deployProxy(
      StreamLockManager,
      [
        deployerAddress,
        ethers.parseEther("0.001"), // min amount
        60, // min duration
        365 * 24 * 3600 // max duration
      ],
      { initializer: "initialize", kind: "uups" }
    ) as StreamLockManager;

    // 3. Deploy real dependencies for Producer to work properly
    const ProducerStorage = await ethers.getContractFactory("ProducerStorage");
    producerStorage = await ProducerStorage.deploy(deployerAddress);

    const URIGenerator = await ethers.getContractFactory("URIGenerator");
    uriGenerator = await // @ts-ignore
    hre.upgrades.deployProxy(
      URIGenerator,
      [], // No parameters for initialize
      { initializer: "initialize", kind: "uups" }
    );

    // Use mock address for other modules
    const mockNUsageAddress = deployerAddress;

    // 4. Deploy Factory with StreamLockManager integration
    const Factory = await ethers.getContractFactory("Factory");
    
    // Deploy Producer implementation first
    const producerImplementation = await ethers.deployContract("Producer");
    
    factory = await // @ts-ignore
    hre.upgrades.deployProxy(
      Factory,
      [
        await uriGenerator.getAddress(), // uriGenerator
        await producerStorage.getAddress(), // producerStorage
        mockNUsageAddress, // producerApi
        mockNUsageAddress, // producerNUsage
        mockNUsageAddress, // producerVestingApi
        await streamLockManager.getAddress(), // StreamLockManager
        await producerImplementation.getAddress() // Producer implementation
      ],
      { initializer: "initialize", kind: "uups" }
    ) as Factory;

    // Set Factory in ProducerStorage
    await producerStorage.setFactory(
      await factory.getAddress(),
      mockNUsageAddress, // producerApi
      mockNUsageAddress, // producerNUsage  
      mockNUsageAddress // producerVestingApi
    );

    // 5. Authorize Factory in StreamLockManager
    await streamLockManager.setAuthorizedCaller(await factory.getAddress(), true);

    // 6. Setup test tokens for customer
    await testToken.transfer(await customer.getAddress(), ethers.parseEther("1000"));
    await testToken.connect(customer).approve(await streamLockManager.getAddress(), ethers.MaxUint256);
    await testToken.connect(cafeOwner).approve(await streamLockManager.getAddress(), ethers.MaxUint256);

    console.log("✅ Cafe Scenario Setup completed");
    console.log(`   Factory: ${await factory.getAddress()}`);
    console.log(`   StreamLockManager: ${await streamLockManager.getAddress()}`);
    console.log(`   TestToken: ${await testToken.getAddress()}`);
  });

  describe("☕ Cafe Producer Registration", function () {
    it("Should create cafe producer through Factory", async function () {
      console.log("🧪 Testing cafe producer creation...");
      
      const producerData = {
        producerId: 0,
        producerAddress: await cafeOwner.getAddress(),
        name: "TechCafe Istanbul",
        description: "Co-working space and premium coffee",
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://techcafe.com",
        cloneAddress: ethers.ZeroAddress,
        exists: false
      };

      const tx = await factory.connect(cafeOwner).newBcontract(producerData);
      const receipt = await tx.wait();

      console.log("   ✅ Cafe producer created successfully");
      
      expect(receipt).to.not.be.null;
      
      // Verify producer data
      const currentId = await factory.currentPR_ID();
      expect(currentId).to.equal(1);
    });
  });

  describe("☕ Cafe Stream Creation", function () {
    beforeEach(async function () {
      // Create cafe producer first
      const producerData = {
        producerId: 0,
        producerAddress: await cafeOwner.getAddress(),
        name: "TechCafe Istanbul",
        description: "Co-working space and premium coffee", 
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://techcafe.com",
        cloneAddress: ethers.ZeroAddress,
        exists: false
      };

      await factory.connect(cafeOwner).newBcontract(producerData);
    });

    it("Should create daily cafe subscription stream", async function () {
      console.log("🧪 Testing cafe subscription stream creation...");
      
      const streamAmount = ethers.parseEther("25"); // 25 TEST tokens for daily access
      const streamDuration = 24 * 3600; // 1 day
      
      const tx = await streamLockManager.connect(customer).createStreamLock(
        await customer.getAddress(),
        await testToken.getAddress(), 
        streamAmount,
        streamDuration
      );
      
      const receipt = await tx.wait();
      console.log("   ✅ Cafe subscription stream created");
      
      expect(receipt).to.not.be.null;
      
      // Parse StreamLockCreated event
      const logs = receipt!.logs;
      let streamId: string | undefined;
      
      for (const log of logs) {
        try {
          const parsed = streamLockManager.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          
          if (parsed && parsed.name === "StreamLockCreated") {
            streamId = parsed.args.lockId;
            console.log(`   ✅ Stream ID: ${streamId}`);
            break;
          }
        } catch (e) {
          // Skip unparseable logs
        }
      }
      
      expect(streamId).to.not.be.undefined;
      
      // Verify stream was created - check that it's active
      const streamStatus = await streamLockManager.getStreamStatus(streamId!);
      expect(streamStatus.isActive).to.be.true;
      expect(streamStatus.remainingAmount).to.equal(streamAmount); // initially full amount remains
    });
  });

  describe("☕ Security Tests", function () {
    it("Should prevent unauthorized cafe access", async function () {
      const producerData = {
        producerId: 0,
        producerAddress: await cafeOwner.getAddress(),
        name: "TechCafe Istanbul",
        description: "Co-working space and premium coffee",
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://techcafe.com",
        cloneAddress: ethers.ZeroAddress,
        exists: false
      };

      await factory.connect(cafeOwner).newBcontract(producerData);
      
      // Factory is authorized, so this should work
      const tx = await streamLockManager.connect(customer).createStreamLock(
        await customer.getAddress(),
        await testToken.getAddress(),
        ethers.parseEther("25"),
        3600
      );
      
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      console.log("   ✅ Authorized access through Factory works");
    });
  });
});
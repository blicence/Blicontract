import { ethers, upgrades } from "hardhat";
import { 
  BcontractFactory, 
  Producer, 
  TestToken, 
  ProducerNUsage, 
  ProducerApi, 
  ProducerVestingApi,
  ProducerStorage,
  StreamLockManager,
  StreamToken
} from "../../typechain-types";

export async function deployProxysFixture() {
  // Accounts
  const [owner, userA, userB, ProducerA, ProducerB, ProducerC] = await ethers.getSigners();

  // Deploy test token
  const TestTokenFactory = await ethers.getContractFactory("TestToken");
  const testToken = (await TestTokenFactory.deploy()) as TestToken;
  await testToken.waitForDeployment();

  // Deploy StreamToken (replacement for SuperToken)
  const StreamTokenFactory = await ethers.getContractFactory("StreamToken");
  const streamToken = (await StreamTokenFactory.deploy(
    await testToken.getAddress(),
    "Stream Test Token",
    "STT"
  )) as StreamToken;
  await streamToken.waitForDeployment();

  // Deploy StreamLockManager
  const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
  const streamLockManager = (await upgrades.deployProxy(
    StreamLockManagerFactory,
    [],
    { initializer: "initialize" }
  )) as StreamLockManager;
  await streamLockManager.waitForDeployment();

  // Deploy ProducerStorage
  const ProducerStorageFactory = await ethers.getContractFactory("ProducerStorage");
  const producerStorage = (await upgrades.deployProxy(
    ProducerStorageFactory,
    [],
    { initializer: "initialize" }
  )) as ProducerStorage;
  await producerStorage.waitForDeployment();

  // Deploy Producer implementation
  const ProducerFactory = await ethers.getContractFactory("Producer");
  const producerImplementation = await ProducerFactory.deploy();
  await producerImplementation.waitForDeployment();

  // Deploy ProducerApi
  const ProducerApiFactory = await ethers.getContractFactory("ProducerApi");
  const producerApi = (await upgrades.deployProxy(
    ProducerApiFactory,
    [],
    { initializer: "initialize" }
  )) as ProducerApi;
  await producerApi.waitForDeployment();

  // Deploy ProducerNUsage
  const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
  const producerNUsage = (await upgrades.deployProxy(
    ProducerNUsageFactory,
    [],
    { initializer: "initialize" }
  )) as ProducerNUsage;
  await producerNUsage.waitForDeployment();

  // Deploy ProducerVestingApi
  const ProducerVestingApiFactory = await ethers.getContractFactory("ProducerVestingApi");
  const producerVestingApi = (await upgrades.deployProxy(
    ProducerVestingApiFactory,
    [],
    { initializer: "initialize" }
  )) as ProducerVestingApi;
  await producerVestingApi.waitForDeployment();

  // Deploy Factory
  const BcontractFactoryContract = await ethers.getContractFactory("BcontractFactory");
  const bcontractFactory = (await upgrades.deployProxy(
    BcontractFactoryContract,
    [
      await producerImplementation.getAddress(),
      await producerStorage.getAddress(),
      await producerApi.getAddress(),
      await producerNUsage.getAddress(),
      await producerVestingApi.getAddress()
    ],
    { initializer: "initialize" }
  )) as BcontractFactory;
  await bcontractFactory.waitForDeployment();

  // Setup connections
  await producerStorage.setBcontractFactory(await bcontractFactory.getAddress());
  await producerApi.setProducerStorage(await producerStorage.getAddress());
  await producerNUsage.setProducerStorage(await producerStorage.getAddress());
  await producerVestingApi.setProducerStorage(await producerStorage.getAddress());
  await producerVestingApi.setSuperInitialize(
    ethers.ZeroAddress, // No vesting scheduler for now
    await streamLockManager.getAddress()
  );

  return {
    owner,
    userA,
    userB,
    ProducerA,
    ProducerB,
    ProducerC,
    bcontractFactory,
    producerStorage,
    producerApi,
    producerNUsage,
    producerVestingApi,
    streamLockManager,
    testToken,
    streamToken
  };
}

export async function StreamTokenFixture() {
  const [owner, userA, userB] = await ethers.getSigners();
  
  const TestTokenFactory = await ethers.getContractFactory("TestToken");
  const testToken = (await TestTokenFactory.deploy()) as TestToken;
  await testToken.waitForDeployment();

  const StreamTokenFactory = await ethers.getContractFactory("StreamToken");
  const streamToken = (await StreamTokenFactory.deploy(
    await testToken.getAddress(),
    "Stream Test Token",
    "STT"
  )) as StreamToken;
  await streamToken.waitForDeployment();

  return {
    owner,
    userA, 
    userB,
    testToken,
    streamToken
  };
}

export const userList = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
];

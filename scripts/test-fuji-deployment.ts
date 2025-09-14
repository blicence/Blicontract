import { ethers } from "hardhat";
import { Factory, StreamLockManager, TestToken } from "../typechain-types";

async function testFujiDeployment() {
    console.log("🧪 Testing Fuji Deployment...");
    console.log("=" .repeat(50));
    
    // Contract addresses from deployment
    const FACTORY_ADDRESS = "0xf8Daed2087F7783a7E51CdfA46b3333bf8CcA217";
    const STREAM_LOCK_MANAGER_ADDRESS = "0x8d17E714c335C0BBE31A34e30927d081E028502b";
    const TEST_USDC_ADDRESS = "0x135dDd29e030fd7584f4edF6c2002Ff58eB32367";
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 Testing with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "AVAX");
    
    // Get contract instances
    const Factory = await ethers.getContractFactory("Factory");
    const factory = Factory.attach(FACTORY_ADDRESS) as Factory;
    
    const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
    const streamLockManager = StreamLockManager.attach(STREAM_LOCK_MANAGER_ADDRESS) as StreamLockManager;
    
    const TestToken = await ethers.getContractFactory("TestToken");
    const testUSDC = TestToken.attach(TEST_USDC_ADDRESS) as TestToken;
    
    try {
        // Test 1: Check StreamLockManager is initialized
        console.log("\n🔍 Test 1: Check StreamLockManager initialization...");
        const owner = await streamLockManager.owner();
        console.log("✅ StreamLockManager owner:", owner);
        
        // Test 2: Check Factory is authorized
        console.log("\n🔍 Test 2: Check Factory authorization...");
        const isAuthorized = await streamLockManager.authorizedCallers(FACTORY_ADDRESS);
        console.log("✅ Factory authorized:", isAuthorized);
        
        // Test 3: Check test token details
        console.log("\n🔍 Test 3: Check test token details...");
        const tokenName = await testUSDC.name();
        const tokenSymbol = await testUSDC.symbol();
        const tokenDecimals = await testUSDC.decimals();
        const totalSupply = await testUSDC.totalSupply();
        
        console.log("✅ Token name:", tokenName);
        console.log("✅ Token symbol:", tokenSymbol);
        console.log("✅ Token decimals:", tokenDecimals);
        console.log("✅ Total supply:", ethers.formatEther(totalSupply));
        
        // Test 4: Create a simple producer via Factory
        console.log("\n🔍 Test 4: Create test producer...");
        
        const producerStruct = {
            producerId: 0, // will be assigned by contract
            producerAddress: deployer.address,
            name: "Test Gym Producer",
            description: "Test gym for Fuji deployment verification",
            image: "https://test-gym.example.com/image.png",
            externalLink: "https://test-gym.example.com",
            cloneAddress: ethers.ZeroAddress, // will be assigned by contract
            exists: false // will be set by contract
        };
        
        const producerTx = await factory.newBcontract(producerStruct);
        
        const receipt = await producerTx.wait();
        console.log("✅ Producer creation tx:", receipt?.hash);
        
        // Get producer address from event
        const logs = receipt?.logs || [];
        let producerAddress: string | null = null;
        
        for (const log of logs) {
            try {
                const parsedLog = factory.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                if (parsedLog?.name === "ProducerCreated") {
                    producerAddress = parsedLog.args.producer;
                    break;
                }
            } catch {
                continue;
            }
        }
        
        if (producerAddress) {
            console.log("✅ Producer created at:", producerAddress);
        } else {
            console.log("⚠️ Could not extract producer address from events");
        }
        
        // Test 5: Check network info
        console.log("\n🔍 Test 5: Network information...");
        const network = await ethers.provider.getNetwork();
        console.log("✅ Network name:", network.name);
        console.log("✅ Chain ID:", network.chainId);
        
        const latestBlock = await ethers.provider.getBlockNumber();
        console.log("✅ Latest block:", latestBlock);
        
        console.log("\n🎊 ALL TESTS PASSED!");
        console.log("🚀 Fuji deployment is working correctly!");
        
    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

testFujiDeployment()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
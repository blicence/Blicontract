import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";

/**
 * Deploy script for StreamLockManager system
 * This deploys the new token locking and streaming system
 */
async function deployStreamSystem() {
    console.log("🚀 Starting StreamLockManager deployment...");
    
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", (await deployer.getBalance()).toString());

    // Deployment parameters
    const MIN_STREAM_AMOUNT = ethers.utils.parseEther("0.001"); // 0.001 ETH minimum
    const MIN_STREAM_DURATION = 3600; // 1 hour
    const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year

    try {
        // 1. Deploy StreamLockManager
        console.log("\n📦 Deploying StreamLockManager...");
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        
        const streamLockManager = await upgrades.deployProxy(
            StreamLockManager,
            [
                deployer.address, // owner
                MIN_STREAM_AMOUNT,
                MIN_STREAM_DURATION,
                MAX_STREAM_DURATION
            ],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );

        await streamLockManager.deployed();
        console.log("✅ StreamLockManager deployed to:", streamLockManager.address);

        // 2. Verify deployment
        console.log("\n🔍 Verifying deployment...");
        const version = await streamLockManager.getVersion();
        const owner = await streamLockManager.owner();
        const minAmount = await streamLockManager.minStreamAmount();
        
        console.log(`📋 Contract Version: ${version}`);
        console.log(`👤 Owner: ${owner}`);
        console.log(`💎 Min Stream Amount: ${ethers.utils.formatEther(minAmount)} ETH`);

        // 3. Save deployment info
        const deploymentInfo = {
            network: await ethers.provider.getNetwork(),
            streamLockManager: {
                address: streamLockManager.address,
                deployer: deployer.address,
                deploymentTime: new Date().toISOString(),
                parameters: {
                    minStreamAmount: MIN_STREAM_AMOUNT.toString(),
                    minStreamDuration: MIN_STREAM_DURATION,
                    maxStreamDuration: MAX_STREAM_DURATION
                }
            }
        };

        console.log("\n📄 Deployment Summary:");
        console.log(JSON.stringify(deploymentInfo, null, 2));

        // 4. Return addresses for integration
        return {
            streamLockManager: streamLockManager.address,
            deployer: deployer.address
        };

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

/**
 * Update existing Producer contracts to use StreamLockManager
 */
async function updateExistingProducers(streamManagerAddress: string) {
    console.log("\n🔄 Updating existing Producer contracts...");
    
    // This function would be used to update existing Producer contracts
    // to authorize the new StreamLockManager
    
    // Get existing Factory contract (you'll need to provide the address)
    // const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS);
    
    // Update Producer implementation or add stream manager reference
    // This will be implemented in Phase 2
    
    console.log("📝 Note: Producer contract updates will be implemented in Phase 2");
    console.log(`🔗 StreamLockManager address to integrate: ${streamManagerAddress}`);
}

/**
 * Deploy test tokens for testing
 */
async function deployTestTokens() {
    console.log("\n🪙 Deploying test tokens...");
    
    const TestToken = await ethers.getContractFactory("TestToken");
    
    // Deploy USDC mock
    const mockUSDC = await TestToken.deploy(
        "USD Coin",
        "USDC",
        6, // 6 decimals like real USDC
        ethers.utils.parseUnits("1000000", 6) // 1M USDC
    );
    await mockUSDC.deployed();
    
    // Deploy DAI mock
    const mockDAI = await TestToken.deploy(
        "Dai Stablecoin",
        "DAI",
        18, // 18 decimals like real DAI
        ethers.utils.parseUnits("1000000", 18) // 1M DAI
    );
    await mockDAI.deployed();

    console.log("✅ Test USDC deployed to:", mockUSDC.address);
    console.log("✅ Test DAI deployed to:", mockDAI.address);

    return {
        usdc: mockUSDC.address,
        dai: mockDAI.address
    };
}

/**
 * Main deployment function
 */
async function main() {
    try {
        console.log("🌟 Starting Phase 1: Core Stream Contracts Deployment");
        console.log("=" .repeat(60));

        // Deploy core system
        const addresses = await deployStreamSystem();

        // Deploy test tokens (optional, for testing)
        const network = await ethers.provider.getNetwork();
        if (network.name === "localhost" || network.name === "hardhat") {
            const testTokens = await deployTestTokens();
            console.log("\n🪙 Test tokens deployed:", testTokens);
        }

        // Show next steps
        console.log("\n🎯 Next Steps for Phase 2:");
        console.log("1. Update Factory contract to include StreamLockManager");
        console.log("2. Update Producer contract to integrate streaming");
        console.log("3. Add stream creation to customer plan flow");
        console.log("4. Test integration with existing system");

        console.log("\n✅ Phase 1 deployment completed successfully!");
        console.log(`🔗 StreamLockManager: ${addresses.streamLockManager}`);

        return addresses;

    } catch (error) {
        console.error("💥 Deployment script failed:", error);
        process.exit(1);
    }
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { deployStreamSystem, updateExistingProducers, deployTestTokens };

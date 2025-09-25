import { ethers } from "hardhat";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Configure Contract Dependencies Script
 * Sets StreamLockManager and ProducerStorage addresses in all logic contracts
 */

export interface ContractAddresses {
    factory: string;
    streamLockManager: string;
    producerStorage: string;
    uriGenerator: string;
    producerApi: string;
    producerVestingApi: string;
    producerNUsage: string;
    testUsdc?: string;
}

// Load addresses from latest deployment JSON
function loadAddressesFromLatest(networkName: string): ContractAddresses | null {
    try {
        const latestPath = path.join(__dirname, "..", "deployments", `latest-${networkName}.json`);
        if (fs.existsSync(latestPath)) {
            console.log(`📋 Loading addresses from: ${latestPath}`);
            const deploymentData = JSON.parse(fs.readFileSync(latestPath, "utf8"));
            return {
                factory: deploymentData.factory,
                streamLockManager: deploymentData.streamLockManager,
                producerStorage: deploymentData.producerStorage,
                uriGenerator: deploymentData.uriGenerator,
                producerApi: deploymentData.producerApi,
                producerVestingApi: deploymentData.producerVestingApi,
                producerNUsage: deploymentData.producerNUsage,
                testUsdc: deploymentData.testTokens?.usdc
            };
        }
    } catch (error) {
        console.warn(`⚠️  Could not load addresses from latest-${networkName}.json:`, error instanceof Error ? error.message : String(error));
    }
    return null;
}

export async function configureContractDependencies(addresses: ContractAddresses) {
    console.log("🔧 Starting Contract Dependencies Configuration");
    console.log("🌐 Network:", hre.network.name);
    console.log("=" .repeat(80));

    const [deployer] = await ethers.getSigners();
    console.log("👤 Configuring with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX");

    // Get contract instances
    const contracts = await getContractInstances(addresses);
    
    try {
        // Step 1: Configure ProducerApi
        await configureProducerApi(contracts.producerApi, addresses);
        
        // Step 2: Configure ProducerVestingApi
        await configureProducerVestingApi(contracts.producerVestingApi, addresses);
        
        // Step 3: Configure ProducerNUsage
        await configureProducerNUsage(contracts.producerNUsage, addresses);
        
        // Step 4: Configure StreamLockManager (if needed)
        // await configureStreamLockManager(contracts.streamLockManager, addresses);
        console.log("\n🔧 StreamLockManager configuration skipped (no additional config needed)");
        
        // Step 5: Validate all configurations
        await validateConfigurations(contracts, addresses);
        
        console.log("\n🎉 Contract Dependencies Configuration Complete!");
        console.log("=" .repeat(80));
        
    } catch (error) {
        console.error("💥 Configuration failed:", error);
        throw error;
    }
}

async function getContractInstances(addresses: ContractAddresses) {
    console.log("\n📋 Getting contract instances...");
    
    const producerApi = await ethers.getContractAt("ProducerApi", addresses.producerApi);
    const producerVestingApi = await ethers.getContractAt("ProducerVestingApi", addresses.producerVestingApi);
    const producerNUsage = await ethers.getContractAt("ProducerNUsage", addresses.producerNUsage);
    const streamLockManager = await ethers.getContractAt("StreamLockManager", addresses.streamLockManager);
    const producerStorage = await ethers.getContractAt("ProducerStorage", addresses.producerStorage);
    
    return {
        producerApi,
        producerVestingApi,
        producerNUsage,
        streamLockManager,
        producerStorage
    };
}

async function configureProducerApi(contract: any, addresses: ContractAddresses) {
    console.log("\n🔧 Configuring ProducerApi...");
    
    try {
        // Check current configurations
        const currentStreamLockManager = await contract.streamLockManager();
        const currentProducerStorage = await contract.producerStorage();
        
        console.log("   Current StreamLockManager:", currentStreamLockManager);
        console.log("   Target StreamLockManager: ", addresses.streamLockManager);
        console.log("   Current ProducerStorage: ", currentProducerStorage);
        console.log("   Target ProducerStorage:  ", addresses.producerStorage);
        
        // Set StreamLockManager if not set or different
        if (currentStreamLockManager.toLowerCase() !== addresses.streamLockManager.toLowerCase()) {
            console.log("   📝 Setting StreamLockManager...");
            const tx1 = await contract.setStreamLockManager(addresses.streamLockManager);
            await tx1.wait();
            console.log("   ✅ StreamLockManager set, tx:", tx1.hash);
        } else {
            console.log("   ✅ StreamLockManager already configured correctly");
        }
        
        // Set ProducerStorage if not set or different
        if (currentProducerStorage.toLowerCase() !== addresses.producerStorage.toLowerCase()) {
            console.log("   📝 Setting ProducerStorage...");
            const tx2 = await contract.setProducerStorage(addresses.producerStorage);
            await tx2.wait();
            console.log("   ✅ ProducerStorage set, tx:", tx2.hash);
        } else {
            console.log("   ✅ ProducerStorage already configured correctly");
        }
        
    } catch (error) {
        console.error("   ❌ ProducerApi configuration failed:", error);
        throw error;
    }
}

async function configureProducerVestingApi(contract: any, addresses: ContractAddresses) {
    console.log("\n🔧 Configuring ProducerVestingApi...");
    
    try {
        // Check current configurations
        const currentStreamLockManager = await contract.streamLockManager();
        const currentProducerStorage = await contract.producerStorage();
        
        console.log("   Current StreamLockManager:", currentStreamLockManager);
        console.log("   Target StreamLockManager: ", addresses.streamLockManager);
        console.log("   Current ProducerStorage: ", currentProducerStorage);
        console.log("   Target ProducerStorage:  ", addresses.producerStorage);
        
        // Set StreamLockManager if not set or different
        if (currentStreamLockManager.toLowerCase() !== addresses.streamLockManager.toLowerCase()) {
            console.log("   📝 Setting StreamLockManager...");
            const tx1 = await contract.setStreamLockManager(addresses.streamLockManager);
            await tx1.wait();
            console.log("   ✅ StreamLockManager set, tx:", tx1.hash);
        } else {
            console.log("   ✅ StreamLockManager already configured correctly");
        }
        
        // Set ProducerStorage if not set or different
        if (currentProducerStorage.toLowerCase() !== addresses.producerStorage.toLowerCase()) {
            console.log("   📝 Setting ProducerStorage...");
            const tx2 = await contract.setProducerStorage(addresses.producerStorage);
            await tx2.wait();
            console.log("   ✅ ProducerStorage set, tx:", tx2.hash);
        } else {
            console.log("   ✅ ProducerStorage already configured correctly");
        }
        
    } catch (error) {
        console.error("   ❌ ProducerVestingApi configuration failed:", error);
        throw error;
    }
}

async function configureProducerNUsage(contract: any, addresses: ContractAddresses) {
    console.log("\n🔧 Configuring ProducerNUsage...");
    
    try {
        // Check current configurations
        const currentStreamLockManager = await contract.streamLockManager();
        const currentProducerStorage = await contract.producerStorage();
        
        console.log("   Current StreamLockManager:", currentStreamLockManager);
        console.log("   Target StreamLockManager: ", addresses.streamLockManager);
        console.log("   Current ProducerStorage: ", currentProducerStorage);
        console.log("   Target ProducerStorage:  ", addresses.producerStorage);
        
        // Set StreamLockManager if not set or different
        if (currentStreamLockManager.toLowerCase() !== addresses.streamLockManager.toLowerCase()) {
            console.log("   📝 Setting StreamLockManager...");
            const tx1 = await contract.setStreamLockManager(addresses.streamLockManager);
            await tx1.wait();
            console.log("   ✅ StreamLockManager set, tx:", tx1.hash);
        } else {
            console.log("   ✅ StreamLockManager already configured correctly");
        }
        
        // Set ProducerStorage if not set or different
        if (currentProducerStorage.toLowerCase() !== addresses.producerStorage.toLowerCase()) {
            console.log("   📝 Setting ProducerStorage...");
            const tx2 = await contract.setProducerStorage(addresses.producerStorage);
            await tx2.wait();
            console.log("   ✅ ProducerStorage set, tx:", tx2.hash);
        } else {
            console.log("   ✅ ProducerStorage already configured correctly");
        }
        
    } catch (error) {
        console.error("   ❌ ProducerNUsage configuration failed:", error);
        throw error;
    }
}

async function configureStreamLockManager(contract: any, addresses: ContractAddresses) {
    console.log("\n🔧 Configuring StreamLockManager...");
    
    try {
        // Check if StreamLockManager needs any configuration
        const factory = await contract.factory();
        const producerStorage = await contract.producerStorage();
        
        console.log("   Current Factory:", factory);
        console.log("   Target Factory: ", addresses.factory);
        console.log("   Current ProducerStorage:", producerStorage);
        console.log("   Target ProducerStorage: ", addresses.producerStorage);
        
        // Set Factory if not set or different
        if (factory.toLowerCase() !== addresses.factory.toLowerCase()) {
            console.log("   📝 Setting Factory...");
            const tx1 = await contract.setFactory(addresses.factory);
            await tx1.wait();
            console.log("   ✅ Factory set, tx:", tx1.hash);
        } else {
            console.log("   ✅ Factory already configured correctly");
        }
        
        // Set ProducerStorage if not set or different
        if (producerStorage.toLowerCase() !== addresses.producerStorage.toLowerCase()) {
            console.log("   📝 Setting ProducerStorage...");
            const tx2 = await contract.setProducerStorage(addresses.producerStorage);
            await tx2.wait();
            console.log("   ✅ ProducerStorage set, tx:", tx2.hash);
        } else {
            console.log("   ✅ ProducerStorage already configured correctly");
        }
        
    } catch (error) {
        console.error("   ❌ StreamLockManager configuration failed:", error);
        throw error;
    }
}

async function validateConfigurations(contracts: any, addresses: ContractAddresses) {
    console.log("\n🔍 Validating all configurations...");
    
    let allValid = true;
    
    try {
        // Validate ProducerApi
        const apiStreamLockManager = await contracts.producerApi.streamLockManager();
        const apiProducerStorage = await contracts.producerApi.producerStorage();
        
        console.log("🧪 ProducerApi Validation:");
        console.log("   StreamLockManager:", apiStreamLockManager === addresses.streamLockManager ? "✅" : "❌", apiStreamLockManager);
        console.log("   ProducerStorage:  ", apiProducerStorage === addresses.producerStorage ? "✅" : "❌", apiProducerStorage);
        
        if (apiStreamLockManager !== addresses.streamLockManager || apiProducerStorage !== addresses.producerStorage) {
            allValid = false;
        }
        
        // Validate ProducerVestingApi
        const vestingStreamLockManager = await contracts.producerVestingApi.streamLockManager();
        const vestingProducerStorage = await contracts.producerVestingApi.producerStorage();
        
        console.log("🧪 ProducerVestingApi Validation:");
        console.log("   StreamLockManager:", vestingStreamLockManager === addresses.streamLockManager ? "✅" : "❌", vestingStreamLockManager);
        console.log("   ProducerStorage:  ", vestingProducerStorage === addresses.producerStorage ? "✅" : "❌", vestingProducerStorage);
        
        if (vestingStreamLockManager !== addresses.streamLockManager || vestingProducerStorage !== addresses.producerStorage) {
            allValid = false;
        }
        
        // Validate ProducerNUsage
        const nUsageStreamLockManager = await contracts.producerNUsage.streamLockManager();
        const nUsageProducerStorage = await contracts.producerNUsage.producerStorage();
        
        console.log("🧪 ProducerNUsage Validation:");
        console.log("   StreamLockManager:", nUsageStreamLockManager === addresses.streamLockManager ? "✅" : "❌", nUsageStreamLockManager);
        console.log("   ProducerStorage:  ", nUsageProducerStorage === addresses.producerStorage ? "✅" : "❌", nUsageProducerStorage);
        
        if (nUsageStreamLockManager !== addresses.streamLockManager || nUsageProducerStorage !== addresses.producerStorage) {
            allValid = false;
        }
        
        if (allValid) {
            console.log("\n🎉 All configurations are valid!");
        } else {
            console.log("\n❌ Some configurations are invalid!");
            throw new Error("Configuration validation failed");
        }
        
    } catch (error) {
        console.error("❌ Validation failed:", error);
        throw error;
    }
}

async function main() {
    console.log("🚀 Starting Contract Dependencies Configuration Script");
    console.log("🌐 Network:", hre.network.name);

    // Try to load latest deployment addresses for any network
    const addresses = loadAddressesFromLatest(hre.network.name);

    if (addresses) {
        console.log("🎯 Using latest deployed addresses");
        await configureContractDependencies(addresses);
    } else {
        console.error("❌ No deployment found for network:", hre.network.name);
        console.error("   Please run deployment first: npx hardhat run scripts/deploy-production.ts --network", hre.network.name);
        console.error("   Or check if deployments/ directory exists with latest-{network}.json file");
        process.exit(1);
    }
}

// Error handling
main()
    .then(() => {
        console.log("✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Script failed:", error);
        process.exit(1);
    });
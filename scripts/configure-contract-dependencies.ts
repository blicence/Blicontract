import { ethers } from "hardhat";
import hre from "hardhat";

/**
 * Configure Contract Dependencies Script
 * Sets StreamLockManager and ProducerStorage addresses in all logic contracts
 */

interface ContractAddresses {
    factory: string;
    streamLockManager: string;
    producerStorage: string;
    uriGenerator: string;
    producerApi: string;
    producerVestingApi: string;
    producerNUsage: string;
    testUsdc?: string;
}

// Fuji Testnet deployed addresses (from DEPLOYED_CONTRACTS_FUJI_FINAL.md)
const FUJI_ADDRESSES: ContractAddresses = {
    factory: "0xf8Daed2087F7783a7E51CdfA46b3333bf8CcA217",
    streamLockManager: "0x8d17E714c335C0BBE31A34e30927d081E028502b",
    producerStorage: "0x6a8558eDCE62d39e19Fd862F80D948D29aE31476",
    uriGenerator: "0xa634072802932dAc2ABaf9acA21164Dd21A147E4",
    producerApi: "0x736DA33041Bb40f6Bb9EC6388365CC554F0d25d0",
    producerVestingApi: "0x4782B5F2D823f3c340664902CF21C8977bed1dE0",
    producerNUsage: "0x711054694937e2B2ba13a39Bf55AC13BD7CC9fBf",
    testUsdc: "0x135dDd29e030fd7584f4edF6c2002Ff58eB32367"
};

async function configureContractDependencies(addresses: ContractAddresses) {
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
    
    if (hre.network.name === "fuji") {
        console.log("🎯 Using Fuji Testnet addresses");
        await configureContractDependencies(FUJI_ADDRESSES);
    } else {
        console.error("❌ This script is configured for Fuji testnet only");
        console.error("   Available networks: fuji");
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
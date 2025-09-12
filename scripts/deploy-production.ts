import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";
const { ethers, upgrades } = require("hardhat");

interface DeploymentConfig {
    network: string;
    verification: boolean;
    testTokens: boolean;
    gasPrice?: string;
}

export interface DeploymentResult {
    factory: string;
    streamLockManager: string;
    producerStorage: string;
    uriGenerator: string;
    producerApi: string;
    producerNUsage: string;
    producerVestingApi: string;
    testTokens?: {
        usdc: string;
        dai: string;
    };
    deployer: string;
    deploymentTime: string;
    network: any;
}

/**
 * Production Deployment Script
 * Deploys complete Blicontract streaming system
 */
class ProductionDeployer {
    private deployer: any;
    private config: DeploymentConfig;
    private deploymentResult: Partial<DeploymentResult> = {};

    constructor(config: DeploymentConfig) {
        this.config = config;
    }

    async initialize() {
        console.log("🚀 Initializing Production Deployment...");
        console.log("=" .repeat(60));
        
        [this.deployer] = await ethers.getSigners();
        console.log("📝 Deploying with account:", this.deployer.address);
        console.log("💰 Account balance:", ethers.formatEther(await this.deployer.provider.getBalance(this.deployer.address)));
        
        const network = await ethers.provider.getNetwork();
        console.log("🌐 Network:", network.name, "| Chain ID:", network.chainId);
        
        this.deploymentResult.deployer = this.deployer.address;
        this.deploymentResult.network = network;
        this.deploymentResult.deploymentTime = new Date().toISOString();
    }

    async deployStreamLockManager() {
        console.log("\n📦 Step 1: Deploying StreamLockManager...");
        
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        
        const MIN_STREAM_AMOUNT = ethers.parseEther("0.001"); // 0.001 ETH minimum
        const MIN_STREAM_DURATION = 3600; // 1 hour
        const MAX_STREAM_DURATION = 365 * 24 * 3600; // 1 year
        
        const streamLockManager = await // @ts-ignore
        upgrades.deployProxy(
            StreamLockManager,
            [
                this.deployer.address,
                MIN_STREAM_AMOUNT,
                MIN_STREAM_DURATION,
                MAX_STREAM_DURATION
            ],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );

        await streamLockManager.waitForDeployment();
        const address = await streamLockManager.getAddress();
        
        console.log("✅ StreamLockManager deployed to:", address);
        this.deploymentResult.streamLockManager = address;
        
        return streamLockManager;
    }

    async deployProducerStorage() {
        console.log("\n📦 Step 2: Deploying ProducerStorage...");
        
        const ProducerStorage = await ethers.getContractFactory("ProducerStorage");
        const producerStorage = await ProducerStorage.deploy(this.deployer.address);
        await producerStorage.waitForDeployment();
        
        const address = await producerStorage.getAddress();
        console.log("✅ ProducerStorage deployed to:", address);
        this.deploymentResult.producerStorage = address;
        
        return producerStorage;
    }

    async deployLogicContracts() {
        console.log("\n📦 Step 3: Deploying Logic Contracts...");
        
        // Deploy ProducerApi
        console.log("📦 Step 3a: Deploying ProducerApi...");
        const ProducerApi = await ethers.getContractFactory("ProducerApi");
        const producerApi = await // @ts-ignore
        upgrades.deployProxy(
            ProducerApi,
            [],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );

        await producerApi.waitForDeployment();
        const producerApiAddress = await producerApi.getAddress();
        console.log("✅ ProducerApi deployed to:", producerApiAddress);
        this.deploymentResult.producerApi = producerApiAddress;

        // Deploy ProducerNUsage
        console.log("📦 Step 3b: Deploying ProducerNUsage...");
        const ProducerNUsage = await ethers.getContractFactory("ProducerNUsage");
        const producerNUsage = await // @ts-ignore
        upgrades.deployProxy(
            ProducerNUsage,
            [],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );

        await producerNUsage.waitForDeployment();
        const producerNUsageAddress = await producerNUsage.getAddress();
        console.log("✅ ProducerNUsage deployed to:", producerNUsageAddress);
        this.deploymentResult.producerNUsage = producerNUsageAddress;

        // Deploy ProducerVestingApi
        console.log("📦 Step 3c: Deploying ProducerVestingApi...");
        const ProducerVestingApi = await ethers.getContractFactory("ProducerVestingApi");
        const producerVestingApi = await // @ts-ignore
        upgrades.deployProxy(
            ProducerVestingApi,
            [],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );

        await producerVestingApi.waitForDeployment();
        const producerVestingApiAddress = await producerVestingApi.getAddress();
        console.log("✅ ProducerVestingApi deployed to:", producerVestingApiAddress);
        this.deploymentResult.producerVestingApi = producerVestingApiAddress;

        return {
            producerApi,
            producerNUsage,
            producerVestingApi
        };
    }

    async deployURIGenerator() {
        console.log("\n📦 Step 4: Deploying URIGenerator...");
        
        const URIGenerator = await ethers.getContractFactory("URIGenerator");
        const uriGenerator = await // @ts-ignore
        upgrades.deployProxy(
            URIGenerator,
            [],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );

        await uriGenerator.waitForDeployment();
        const address = await uriGenerator.getAddress();
        
        console.log("✅ URIGenerator deployed to:", address);
        this.deploymentResult.uriGenerator = address;
        
        return uriGenerator;
    }

    async deployFactory(producerStorage: any, uriGenerator: any, streamLockManager: any, logicContracts: any) {
        console.log("\n📦 Step 5: Deploying Factory...");
        
        // Deploy Producer implementation
        const Producer = await ethers.getContractFactory("Producer");
        const producerImpl = await Producer.deploy();
        await producerImpl.waitForDeployment();
        const producerImplAddress = await producerImpl.getAddress();
        
        console.log("📝 Producer implementation:", producerImplAddress);
        
        // Deploy Factory with all dependencies
        const Factory = await ethers.getContractFactory("Factory");
        const factory = await // @ts-ignore
        upgrades.deployProxy(
            Factory,
            [
                await uriGenerator.getAddress(), // uriGenerator
                await producerStorage.getAddress(), // producerStorage  
                await logicContracts.producerApi.getAddress(), // producerApi
                await logicContracts.producerNUsage.getAddress(), // producerNUsage
                await logicContracts.producerVestingApi.getAddress(), // producerVestingApi
                await streamLockManager.getAddress(), // StreamLockManager
                producerImplAddress // Producer implementation
            ],
            {
                initializer: "initialize",
                kind: "uups",
                unsafeAllow: ['constructor']
            }
        );

        await factory.waitForDeployment();
        const address = await factory.getAddress();
        
        console.log("✅ Factory deployed to:", address);
        this.deploymentResult.factory = address;
        
        // Set Factory in ProducerStorage
        await producerStorage.setFactory(
            address,
            await logicContracts.producerApi.getAddress(), // producerApi
            await logicContracts.producerNUsage.getAddress(), // producerNUsage  
            await logicContracts.producerVestingApi.getAddress() // producerVestingApi
        );

        // Set ProducerStorage in logic contracts
        await logicContracts.producerApi.setProducerStorage(await producerStorage.getAddress());
        await logicContracts.producerNUsage.setProducerStorage(await producerStorage.getAddress());
        await logicContracts.producerVestingApi.setProducerStorage(await producerStorage.getAddress());
        
        // Authorize Factory in StreamLockManager
        await streamLockManager.setAuthorizedCaller(address, true);
        
        console.log("✅ Factory authorized in StreamLockManager");
        console.log("✅ Logic contracts configured");
        
        return factory;
    }

    async deployTestTokens() {
        if (!this.config.testTokens) return;
        
        console.log("\n🪙 Step 6: Deploying Test Tokens...");
        
        const TestToken = await ethers.getContractFactory("TestToken");
        
        // Deploy USDC mock
        const mockUSDC = await TestToken.deploy(
            "USD Coin",
            "USDC",
            6,
            ethers.parseUnits("1000000", 6)
        );
        await mockUSDC.waitForDeployment();
        
        // Deploy DAI mock
        const mockDAI = await TestToken.deploy(
            "Dai Stablecoin", 
            "DAI",
            18,
            ethers.parseUnits("1000000", 18)
        );
        await mockDAI.waitForDeployment();

        const usdcAddress = await mockUSDC.getAddress();
        const daiAddress = await mockDAI.getAddress();
        
        console.log("✅ Test USDC deployed to:", usdcAddress);
        console.log("✅ Test DAI deployed to:", daiAddress);
        
        this.deploymentResult.testTokens = {
            usdc: usdcAddress,
            dai: daiAddress
        };
    }

    async verifyContracts() {
        if (!this.config.verification) return;
        
        console.log("\n🔍 Step 6: Verifying Contracts...");
        
        try {
            if (this.deploymentResult.streamLockManager) {
                await run("verify:verify", {
                    address: this.deploymentResult.streamLockManager,
                    constructorArguments: []
                });
                console.log("✅ StreamLockManager verified");
            }
            
            if (this.deploymentResult.factory) {
                await run("verify:verify", {
                    address: this.deploymentResult.factory,
                    constructorArguments: []
                });
                console.log("✅ Factory verified");
            }
            
        } catch (error: any) {
            console.warn("⚠️ Verification failed (this is normal for local networks):", error.message);
        }
    }

    async saveDeploymentInfo() {
        console.log("\n💾 Saving Deployment Info...");
        
        const deploymentPath = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath, { recursive: true });
        }
        
        const filename = `deployment-${this.config.network}-${Date.now()}.json`;
        const filepath = path.join(deploymentPath, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.deploymentResult, null, 2));
        
        console.log("📄 Deployment info saved to:", filepath);
        
        // Also save as latest
        const latestPath = path.join(deploymentPath, `latest-${this.config.network}.json`);
        fs.writeFileSync(latestPath, JSON.stringify(this.deploymentResult, null, 2));
    }

    async run(): Promise<DeploymentResult> {
        await this.initialize();
        
        const streamLockManager = await this.deployStreamLockManager();
        const producerStorage = await this.deployProducerStorage();
        const logicContracts = await this.deployLogicContracts();
        const uriGenerator = await this.deployURIGenerator();
        const factory = await this.deployFactory(producerStorage, uriGenerator, streamLockManager, logicContracts);
        
        await this.deployTestTokens();
        await this.verifyContracts();
        await this.saveDeploymentInfo();
        
        console.log("\n🎉 Production Deployment Complete!");
        console.log("=" .repeat(60));
        console.log("📋 Deployment Summary:");
        console.log(`🏭 Factory: ${this.deploymentResult.factory}`);
        console.log(`🔒 StreamLockManager: ${this.deploymentResult.streamLockManager}`);
        console.log(`📦 ProducerStorage: ${this.deploymentResult.producerStorage}`);
        console.log(`🔗 URIGenerator: ${this.deploymentResult.uriGenerator}`);
        console.log(`📊 ProducerApi: ${this.deploymentResult.producerApi}`);
        console.log(`📈 ProducerNUsage: ${this.deploymentResult.producerNUsage}`);
        console.log(`🔄 ProducerVestingApi: ${this.deploymentResult.producerVestingApi}`);
        
        if (this.deploymentResult.testTokens) {
            console.log(`🪙 Test USDC: ${this.deploymentResult.testTokens.usdc}`);
            console.log(`🪙 Test DAI: ${this.deploymentResult.testTokens.dai}`);
        }
        
        return this.deploymentResult as DeploymentResult;
    }
}

// Network configurations
const NETWORK_CONFIGS: Record<string, DeploymentConfig> = {
    localhost: {
        network: "localhost",
        verification: false,
        testTokens: true
    },
    sepolia: {
        network: "sepolia",
        verification: true,
        testTokens: true
    },
    mainnet: {
        network: "mainnet", 
        verification: true,
        testTokens: false
    }
};

async function main() {
    const networkName = process.env.HARDHAT_NETWORK || "localhost";
    const config = NETWORK_CONFIGS[networkName] || NETWORK_CONFIGS.localhost;
    
    console.log(`🌟 Starting Production Deployment for ${config.network}`);
    
    const deployer = new ProductionDeployer(config);
    const result = await deployer.run();
    
    return result;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("💥 Deployment failed:", error);
            process.exit(1);
        });
}

export { ProductionDeployer };

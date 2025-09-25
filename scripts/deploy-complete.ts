import { ProductionDeployer, DeploymentResult } from "./deploy-production";
import { configureContractDependencies, ContractAddresses } from "./configure-contract-dependencies";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Complete Deployment Orchestrator
 * Handles full deployment + validation pipeline
 */
async function deployComplete() {
    console.log("🌟 Starting Complete Production Deployment Pipeline");
    console.log("=".repeat(70));

    try {
        const networkName = hre.network.name;

        // Check if contracts are already deployed
        const latestPath = path.join(__dirname, "..", "deployments", `latest-${networkName}.json`);
        let deploymentResult: DeploymentResult;

        if (fs.existsSync(latestPath)) {
            console.log("📋 Found existing deployment at:", latestPath);
            console.log("🔄 Skipping deployment, using existing contracts");

            const deploymentData = JSON.parse(fs.readFileSync(latestPath, "utf8"));
            deploymentResult = deploymentData as DeploymentResult;

            // Configure contract dependencies
            console.log("\n🔧 Configuring Contract Dependencies");
            const addresses: ContractAddresses = {
                factory: deploymentResult.factory,
                streamLockManager: deploymentResult.streamLockManager,
                producerStorage: deploymentResult.producerStorage,
                uriGenerator: deploymentResult.uriGenerator,
                producerApi: deploymentResult.producerApi,
                producerVestingApi: deploymentResult.producerVestingApi,
                producerNUsage: deploymentResult.producerNUsage,
                testUsdc: deploymentResult.testTokens?.usdc
            };

            await configureContractDependencies(addresses);

        } else {
            console.log("🚀 No existing deployment found, starting fresh deployment");

            // Deploy all contracts
            console.log("🚀 Phase 1: Contract Deployment");

            const deployer = new ProductionDeployer({
                network: networkName,
                verification: networkName !== "localhost",
                testTokens: networkName !== "mainnet"
            });

            deploymentResult = await deployer.run();

            // Configure contract dependencies
            console.log("\n🔧 Phase 2: Configuring Contract Dependencies");
            const addresses: ContractAddresses = {
                factory: deploymentResult.factory,
                streamLockManager: deploymentResult.streamLockManager,
                producerStorage: deploymentResult.producerStorage,
                uriGenerator: deploymentResult.uriGenerator,
                producerApi: deploymentResult.producerApi,
                producerVestingApi: deploymentResult.producerVestingApi,
                producerNUsage: deploymentResult.producerNUsage,
                testUsdc: deploymentResult.testTokens?.usdc
            };

            await configureContractDependencies(addresses);
        }

        // Summary
        console.log("\n🎊 DEPLOYMENT & CONFIGURATION PIPELINE COMPLETE!");
        console.log("=".repeat(70));
        console.log("🏭 Factory:", deploymentResult.factory);
        console.log("🔒 StreamLockManager:", deploymentResult.streamLockManager);
        console.log("📦 ProducerStorage:", deploymentResult.producerStorage);
        console.log("🔗 URIGenerator:", deploymentResult.uriGenerator);
        console.log("📊 ProducerApi:", deploymentResult.producerApi);
        console.log("🔄 ProducerVestingApi:", deploymentResult.producerVestingApi);
        console.log("📈 ProducerNUsage:", deploymentResult.producerNUsage);

        if (deploymentResult.testTokens) {
            console.log("🪙 Test USDC:", deploymentResult.testTokens.usdc);
            console.log("🪙 Test DAI:", deploymentResult.testTokens.dai);
        }

        console.log("\n📋 Next Steps:");
        console.log("1. Update frontend with new contract addresses");
        console.log("2. Configure monitoring and alerts");
        console.log("3. Run integration tests");
        console.log("4. Begin gradual migration of users");

        return deploymentResult;

    } catch (error) {
        console.error("💥 Complete deployment failed:", error);
        throw error;
    }
}

if (require.main === module) {
    deployComplete()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { deployComplete };
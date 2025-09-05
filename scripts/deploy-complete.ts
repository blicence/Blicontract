import { ProductionDeployer, DeploymentResult } from "./deploy-production";

/**
 * Complete Deployment Orchestrator
 * Handles full deployment + validation pipeline
 */
async function deployComplete() {
    console.log("🌟 Starting Complete Production Deployment Pipeline");
    console.log("=" .repeat(70));
    
    try {
        // Step 1: Deploy all contracts
        console.log("🚀 Phase 1: Contract Deployment");
        const networkName = process.env.HARDHAT_NETWORK || "localhost";
        
        const deployer = new ProductionDeployer({
            network: networkName,
            verification: networkName !== "localhost",
            testTokens: networkName !== "mainnet"
        });
        
        const deploymentResult = await deployer.run();
        
        // Wait a bit for network propagation
        console.log("\n⏳ Waiting for network propagation...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 2: Summary
        console.log("\n🎊 DEPLOYMENT PIPELINE COMPLETE!");
        console.log("=" .repeat(70));
        console.log("🏭 Factory:", deploymentResult.factory);
        console.log("🔒 StreamLockManager:", deploymentResult.streamLockManager);
        console.log("📦 ProducerStorage:", deploymentResult.producerStorage);
        console.log("🔗 URIGenerator:", deploymentResult.uriGenerator);
        
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

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Phase 3: Superfluid to Custom Stream Migration Script
 * Migrates existing Superfluid streams to custom StreamLockManager system
 */

interface SuperfluidStreamData {
    flowId: string;
    sender: string;
    receiver: string;
    token: string;
    flowRate: string; // wei per second
    lastUpdated: number;
    userData?: string;
}

interface MigrationResult {
    success: boolean;
    migratedStreams: number;
    failedStreams: number;
    errors: string[];
    newStreamIds: string[];
}

/**
 * Main migration function
 */
async function migrateSuperfluidToCustomStream(
    streamLockManagerAddress: string,
    superfluidData: SuperfluidStreamData[]
): Promise<MigrationResult> {
    console.log("🔄 Starting Superfluid to Custom Stream Migration...");
    console.log("=" .repeat(60));
    
    const [deployer] = await ethers.getSigners();
    console.log("📝 Migration executor:", deployer.address);
    
    const result: MigrationResult = {
        success: false,
        migratedStreams: 0,
        failedStreams: 0,
        errors: [],
        newStreamIds: []
    };

    try {
        // Get StreamLockManager instance
        const streamLockManager = await ethers.getContractAt(
            "StreamLockManager", 
            streamLockManagerAddress
        );

        console.log(`📋 Found ${superfluidData.length} Superfluid streams to migrate`);
        console.log(`🎯 Target StreamLockManager: ${streamLockManagerAddress}`);

        // Migrate each stream
        for (let i = 0; i < superfluidData.length; i++) {
            const stream = superfluidData[i];
            console.log(`\n🔄 Migrating stream ${i + 1}/${superfluidData.length}...`);
            console.log(`   From: ${stream.sender}`);
            console.log(`   To: ${stream.receiver}`);
            console.log(`   Token: ${stream.token}`);
            console.log(`   Flow Rate: ${stream.flowRate} wei/sec`);

            try {
                // Calculate equivalent values for custom stream
                const migrationParams = await calculateMigrationParameters(stream);
                
                // Create equivalent custom stream
                const newStreamId = await createCustomStream(
                    streamLockManager,
                    migrationParams
                );

                result.newStreamIds.push(newStreamId);
                result.migratedStreams++;
                
                console.log(`   ✅ Success! New Stream ID: ${newStreamId}`);

                // Log migration mapping
                await logMigrationMapping(stream.flowId, newStreamId, migrationParams);

            } catch (error) {
                console.log(`   ❌ Failed to migrate stream: ${error}`);
                result.errors.push(`Stream ${stream.flowId}: ${error}`);
                result.failedStreams++;
            }
        }

        // Generate migration report
        result.success = result.failedStreams === 0;
        await generateMigrationReport(result, superfluidData);

        console.log("\n" + "=".repeat(60));
        console.log("📊 MIGRATION SUMMARY");
        console.log("=".repeat(60));
        console.log(`✅ Successful migrations: ${result.migratedStreams}`);
        console.log(`❌ Failed migrations: ${result.failedStreams}`);
        console.log(`📈 Success rate: ${((result.migratedStreams / superfluidData.length) * 100).toFixed(1)}%`);
        
        if (result.success) {
            console.log("🎉 ALL STREAMS MIGRATED SUCCESSFULLY!");
        } else {
            console.log("⚠️  SOME STREAMS FAILED TO MIGRATE - CHECK LOGS");
        }

        return result;

    } catch (error) {
        console.error("💥 Migration process failed:", error);
        result.errors.push(`Migration process error: ${error}`);
        return result;
    }
}

/**
 * Calculate migration parameters from Superfluid stream
 */
async function calculateMigrationParameters(stream: SuperfluidStreamData) {
    console.log("   🔢 Calculating migration parameters...");
    
    // Convert Superfluid flow rate to custom stream parameters
    const flowRatePerSecond = ethers.BigNumber.from(stream.flowRate);
    
    // For custom streams, we need total amount and duration
    // Let's assume a reasonable duration (e.g., 30 days) and calculate total amount
    const defaultDuration = 30 * 24 * 3600; // 30 days in seconds
    const totalAmount = flowRatePerSecond.mul(defaultDuration);
    
    console.log(`   💰 Total amount for 30 days: ${ethers.utils.formatEther(totalAmount)} tokens`);
    console.log(`   ⏱️  Duration: ${defaultDuration} seconds (30 days)`);
    
    return {
        sender: stream.sender,
        recipient: stream.receiver,
        token: stream.token,
        totalAmount: totalAmount,
        duration: defaultDuration,
        originalFlowRate: flowRatePerSecond,
        lastUpdated: stream.lastUpdated
    };
}

/**
 * Create custom stream from migration parameters
 */
async function createCustomStream(streamLockManager: any, params: any): Promise<string> {
    console.log("   🔧 Creating custom stream...");
    
    // Ensure the sender has approved the StreamLockManager
    const token = await ethers.getContractAt("IERC20", params.token);
    const allowance = await token.allowance(params.sender, streamLockManager.address);
    
    if (allowance.lt(params.totalAmount)) {
        throw new Error(`Insufficient allowance. Required: ${params.totalAmount}, Available: ${allowance}`);
    }
    
    // Create the stream
    const tx = await streamLockManager.createStreamLock(
        params.recipient,
        params.token,
        params.totalAmount,
        params.duration
    );
    
    const receipt = await tx.wait();
    const streamEvent = receipt.events?.find((event: any) => event.event === "StreamCreated");
    
    if (!streamEvent) {
        throw new Error("Stream creation event not found");
    }
    
    return streamEvent.args.streamId;
}

/**
 * Log migration mapping for reference
 */
async function logMigrationMapping(oldFlowId: string, newStreamId: string, params: any) {
    const mapping = {
        timestamp: new Date().toISOString(),
        superfluid: {
            flowId: oldFlowId,
            flowRate: params.originalFlowRate.toString()
        },
        customStream: {
            streamId: newStreamId,
            totalAmount: params.totalAmount.toString(),
            duration: params.duration
        },
        migration: {
            sender: params.sender,
            recipient: params.recipient,
            token: params.token
        }
    };
    
    // Save to migration log file
    const logDir = path.join(__dirname, "../migration-logs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `migration-${Date.now()}.json`);
    fs.appendFileSync(logFile, JSON.stringify(mapping, null, 2) + "\n");
}

/**
 * Generate comprehensive migration report
 */
async function generateMigrationReport(result: MigrationResult, originalData: SuperfluidStreamData[]) {
    const report = {
        migrationSummary: {
            timestamp: new Date().toISOString(),
            totalStreams: originalData.length,
            successful: result.migratedStreams,
            failed: result.failedStreams,
            successRate: `${((result.migratedStreams / originalData.length) * 100).toFixed(1)}%`
        },
        newStreamIds: result.newStreamIds,
        errors: result.errors,
        recommendations: generateRecommendations(result),
        nextSteps: [
            "Verify all migrated streams are functioning correctly",
            "Update customer interfaces to use new stream IDs",
            "Monitor stream performance and settlement patterns",
            "Setup alerts for any failed settlements",
            "Plan deprecation of old Superfluid integration"
        ]
    };
    
    // Save detailed report
    const reportDir = path.join(__dirname, "../migration-reports");
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportFile = path.join(reportDir, `migration-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Detailed migration report saved to: ${reportFile}`);
    
    return report;
}

/**
 * Generate recommendations based on migration results
 */
function generateRecommendations(result: MigrationResult): string[] {
    const recommendations: string[] = [];
    
    if (result.failedStreams > 0) {
        recommendations.push("Review failed migrations and retry with corrected parameters");
        recommendations.push("Check token allowances for failed stream senders");
        recommendations.push("Verify StreamLockManager authorization for all required callers");
    }
    
    if (result.migratedStreams > 0) {
        recommendations.push("Setup monitoring for newly created streams");
        recommendations.push("Notify customers about migration to new system");
        recommendations.push("Update documentation with new stream management procedures");
    }
    
    if (result.success) {
        recommendations.push("Begin deprecation process for Superfluid integration");
        recommendations.push("Update all client applications to use new StreamLockManager");
        recommendations.push("Setup backup and recovery procedures for custom streams");
    }
    
    return recommendations;
}

/**
 * Export Superfluid data (mock function - would integrate with actual Superfluid)
 */
async function exportSuperfluidData(): Promise<SuperfluidStreamData[]> {
    console.log("📤 Exporting Superfluid stream data...");
    
    // Mock data for demonstration - in production this would query actual Superfluid streams
    const mockData: SuperfluidStreamData[] = [
        {
            flowId: "0x1234...abcd",
            sender: "0x1111111111111111111111111111111111111111",
            receiver: "0x2222222222222222222222222222222222222222", 
            token: "0x3333333333333333333333333333333333333333",
            flowRate: ethers.utils.parseEther("0.001").toString(), // 0.001 tokens per second
            lastUpdated: Date.now()
        },
        {
            flowId: "0x5678...efgh",
            sender: "0x4444444444444444444444444444444444444444",
            receiver: "0x5555555555555555555555555555555555555555",
            token: "0x6666666666666666666666666666666666666666", 
            flowRate: ethers.utils.parseEther("0.002").toString(), // 0.002 tokens per second
            lastUpdated: Date.now()
        }
    ];
    
    console.log(`📋 Found ${mockData.length} Superfluid streams to export`);
    return mockData;
}

/**
 * Validate migration prerequisites
 */
async function validateMigrationPrerequisites(streamLockManagerAddress: string): Promise<boolean> {
    console.log("🔍 Validating migration prerequisites...");
    
    try {
        const streamLockManager = await ethers.getContractAt("StreamLockManager", streamLockManagerAddress);
        
        // Check if contract is deployed and working
        const version = await streamLockManager.getVersion();
        console.log(`✅ StreamLockManager version: ${version}`);
        
        // Check if deployer is authorized
        const [deployer] = await ethers.getSigners();
        const isAuthorized = await streamLockManager.authorizedCallers(deployer.address);
        
        if (!isAuthorized) {
            console.log("⚠️  Deployer is not authorized - authorizing for migration...");
            await streamLockManager.setAuthorizedCaller(deployer.address, true);
        }
        
        console.log("✅ All prerequisites validated");
        return true;
        
    } catch (error) {
        console.error("❌ Prerequisites validation failed:", error);
        return false;
    }
}

/**
 * Main migration execution function
 */
async function executeMigration(streamLockManagerAddress: string) {
    try {
        console.log("🚀 SUPERFLUID TO CUSTOM STREAM MIGRATION");
        console.log("🎯 Replacing Superfluid with custom token locking system");
        console.log("=" .repeat(80));

        // Step 1: Validate prerequisites
        const prerequisitesValid = await validateMigrationPrerequisites(streamLockManagerAddress);
        if (!prerequisitesValid) {
            throw new Error("Migration prerequisites not met");
        }

        // Step 2: Export Superfluid data
        const superfluidData = await exportSuperfluidData();
        
        // Step 3: Execute migration
        const migrationResult = await migrateSuperfluidToCustomStream(
            streamLockManagerAddress,
            superfluidData
        );

        // Step 4: Final validation
        if (migrationResult.success) {
            console.log("\n🎊 MIGRATION COMPLETED SUCCESSFULLY!");
            console.log("🚀 Superfluid replacement system is now active!");
            console.log(`📊 Migrated ${migrationResult.migratedStreams} streams successfully`);
        } else {
            console.log("\n⚠️  MIGRATION COMPLETED WITH ERRORS");
            console.log(`✅ ${migrationResult.migratedStreams} streams migrated successfully`);
            console.log(`❌ ${migrationResult.failedStreams} streams failed migration`);
        }

        return migrationResult;

    } catch (error) {
        console.error("💥 Migration execution failed:", error);
        throw error;
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const streamLockManagerAddress = args[0];

    if (!streamLockManagerAddress) {
        console.error("❌ Please provide StreamLockManager address");
        console.log("Usage: npx hardhat run scripts/migrate-superfluid.ts --network <network> -- <StreamLockManager-address>");
        process.exit(1);
    }

    try {
        await executeMigration(streamLockManagerAddress);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

// Execute if called directly
if (require.main === module) {
    main();
}

export {
    migrateSuperfluidToCustomStream,
    exportSuperfluidData,
    validateMigrationPrerequisites,
    executeMigration
};

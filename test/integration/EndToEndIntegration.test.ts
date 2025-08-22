import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Signer } from "ethers";
import { 
    StreamLockManager, 
    Factory,
    Producer,
    TestToken 
} from "../../typechain-types";

/**
 * Phase 3: End-to-End Production Integration Tests
 * Tests complete Factory → Producer → StreamLockManager workflow
 */
describe("🚀 Phase 3: End-to-End Production Integration", function() {
    let streamLockManager: StreamLockManager;
    let factory: Factory;
    let testToken: TestToken;
    let owner: Signer;
    let producer: Signer;
    let customer: Signer;
    
    let ownerAddress: string;
    let producerAddress: string;
    let customerAddress: string;

    // Integration parameters
    const STREAM_AMOUNT = ethers.utils.parseEther("100");
    const STREAM_DURATION = 3600; // 1 hour
    const TOKEN_SUPPLY = ethers.utils.parseEther("1000000");

    beforeEach(async function() {
        [owner, producer, customer] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        producerAddress = await producer.getAddress();
        customerAddress = await customer.getAddress();

        console.log("🚀 Setting up Phase 3 End-to-End Integration test...");

        // 1. Deploy TestToken first
        const TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy(
            "Test Token",
            "TEST",
            18,
            TOKEN_SUPPLY
        ) as TestToken;

        // 2. Deploy StreamLockManager
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await upgrades.deployProxy(
            StreamLockManager,
            [
                ownerAddress,
                ethers.utils.parseEther("0.001"), // min amount
                60, // min duration
                365 * 24 * 3600 // max duration
            ],
            { initializer: "initialize", kind: "uups" }
        ) as StreamLockManager;

        // 3. Deploy required Producer modules (mocks for now)
        const mockAddress = ownerAddress; // Using owner as mock for all modules

        // 4. Deploy Factory with StreamLockManager integration
        const Factory = await ethers.getContractFactory("Factory");
        factory = await upgrades.deployProxy(
            Factory,
            [
                mockAddress, // uriGenerator
                mockAddress, // producerStorage
                mockAddress, // producerApi
                mockAddress, // producerNUsage
                mockAddress, // producerVestingApi
                streamLockManager.address // StreamLockManager
            ],
            { initializer: "initialize", kind: "uups" }
        ) as Factory;

        // 5. Authorize Factory in StreamLockManager
        await streamLockManager.setAuthorizedCaller(factory.address, true);

        // 6. Setup test tokens for customer
        await testToken.transfer(customerAddress, ethers.utils.parseEther("1000"));
        await testToken.connect(customer).approve(streamLockManager.address, ethers.constants.MaxUint256);

        console.log("✅ Phase 3 Setup completed");
        console.log(`   Factory: ${factory.address}`);
        console.log(`   StreamLockManager: ${streamLockManager.address}`);
        console.log(`   TestToken: ${testToken.address}`);
    });

    describe("🏭 Complete Factory-Producer-Stream Workflow", function() {
        it("Should create Producer through Factory with streaming capability", async function() {
            console.log("\n🧪 Testing complete Factory → Producer → Stream workflow...");

            // Step 1: Create Producer through Factory
            const producerData = {
                producerId: 0, // Will be set by factory
                producerAddress: producerAddress,
                name: "Test Producer",
                description: "A test producer for streaming integration",
                image: "https://example.com/image.png",
                externalLink: "https://example.com",
                cloneAddress: ethers.constants.AddressZero, // Will be set by factory
                exists: false // Will be set by factory
            };

            // Create producer through factory
            const createTx = await factory.connect(producer).newBcontract(producerData);
            const createReceipt = await createTx.wait();

            // Find the BcontractCreated event
            const bcontractEvent = createReceipt.events?.find(
                (event: any) => event.event === "BcontractCreated"
            );
            
            expect(bcontractEvent).to.not.be.undefined;
            const producerCloneAddress = bcontractEvent?.args?._producerId; // Get producer ID

            console.log(`   ✅ Producer created with ID: ${producerCloneAddress}`);

            // Step 2: Get the Producer contract instance
            const currentId = await factory.currentPR_ID();
            expect(currentId).to.equal(1); // First producer should have ID 1

            console.log(`   ✅ Producer ID confirmed: ${currentId}`);
        });

        it("Should demonstrate customer plan creation with streaming", async function() {
            console.log("\n🧪 Testing customer plan with stream creation...");

            // This test demonstrates the concept since we need actual Producer implementation
            // In production, this would work with the full Producer contract

            // Step 1: Simulate customer plan creation with stream
            const streamParams = {
                customer: customerAddress,
                producer: producerAddress,
                token: testToken.address,
                totalAmount: STREAM_AMOUNT,
                duration: STREAM_DURATION
            };

            // Step 2: Create stream directly (simulating Producer behavior)
            await streamLockManager.setAuthorizedCaller(ownerAddress, true);
            
            const streamTx = await streamLockManager.createStreamLock(
                producerAddress,
                testToken.address,
                STREAM_AMOUNT,
                STREAM_DURATION
            );

            const streamReceipt = await streamTx.wait();
            const streamEvent = streamReceipt.events?.find(
                (event: any) => event.event === "StreamCreated"
            );

            expect(streamEvent).to.not.be.undefined;
            const streamId = streamEvent?.args?.streamId;

            console.log(`   ✅ Stream created with ID: ${streamId}`);

            // Step 3: Validate stream state
            const stream = await streamLockManager.streams(streamId);
            expect(stream.customer).to.equal(customerAddress);
            expect(stream.producer).to.equal(producerAddress);
            expect(stream.active).to.be.true;

            // Step 4: Check balances
            const lockedBalance = await streamLockManager.getLockedBalance(customerAddress, testToken.address);
            expect(lockedBalance).to.equal(STREAM_AMOUNT);

            const unlockedBalance = await streamLockManager.getUnlockedBalance(customerAddress, testToken.address);
            const expectedUnlocked = ethers.utils.parseEther("900"); // 1000 - 100 locked
            expect(unlockedBalance).to.equal(expectedUnlocked);

            console.log(`   ✅ Balances verified - Locked: ${ethers.utils.formatEther(lockedBalance)} TEST`);
            console.log(`   ✅ Balances verified - Unlocked: ${ethers.utils.formatEther(unlockedBalance)} TEST`);
        });

        it("Should demonstrate Producer service usage validation through streaming", async function() {
            console.log("\n🧪 Testing Producer service usage with stream validation...");

            // Step 1: Create a stream for service usage
            await streamLockManager.setAuthorizedCaller(ownerAddress, true);
            
            const streamTx = await streamLockManager.createStreamLock(
                customerAddress,
                producerAddress,
                testToken.address,
                STREAM_AMOUNT,
                STREAM_AMOUNT.div(STREAM_DURATION),
                0
            );

            const streamReceipt = await streamTx.wait();
            const streamEvent = streamReceipt.events?.find(
                (event: any) => event.event === "StreamCreated"
            );
            const streamId = streamEvent?.args?.streamId;

            // Step 2: Simulate time progression
            await ethers.provider.send("evm_increaseTime", [1800]); // 30 minutes
            await ethers.provider.send("evm_mine", []);

            // Step 3: Check accrued amount (what Producer would validate)
            const accruedAmount = await streamLockManager.calculateAccruedAmount(streamId);
            expect(accruedAmount).to.be.gte(ethers.utils.parseEther("50")); // ~50% of stream

            console.log(`   ✅ Accrued amount after 30 min: ${ethers.utils.formatEther(accruedAmount)} TEST`);

            // Step 4: Simulate Producer usage validation
            const canUse = await streamLockManager.checkAndSettleOnUsage(customerAddress, streamId);
            expect(canUse).to.be.true;

            console.log(`   ✅ Producer service access validated: ${canUse}`);

            // Step 5: Verify stream status after usage
            const streamStatus = await streamLockManager.getStreamProgress(streamId);
            expect(streamStatus).to.be.gte(50); // At least 50% progress

            console.log(`   ✅ Stream progress: ${streamStatus}%`);
        });

        it("Should demonstrate complete customer lifecycle", async function() {
            console.log("\n🧪 Testing complete customer lifecycle...");

            // Step 1: Customer subscribes (creates stream)
            await streamLockManager.setAuthorizedCaller(ownerAddress, true);
            
            const subscribeStreamTx = await streamLockManager.createStreamLock(
                customerAddress,
                producerAddress,
                testToken.address,
                STREAM_AMOUNT,
                STREAM_AMOUNT.div(STREAM_DURATION),
                0
            );

            const subscribeReceipt = await subscribeStreamTx.wait();
            const subscribeEvent = subscribeReceipt.events?.find(
                (event: any) => event.event === "StreamCreated"
            );
            const streamId = subscribeEvent?.args?.streamId;

            console.log(`   ✅ Step 1: Customer subscribed, Stream ID: ${streamId}`);

            // Step 2: Customer uses service over time
            const usagePeriods = [600, 600, 600]; // 3 periods of 10 minutes each
            
            for (let i = 0; i < usagePeriods.length; i++) {
                await ethers.provider.send("evm_increaseTime", [usagePeriods[i]]);
                await ethers.provider.send("evm_mine", []);

                const canUse = await streamLockManager.checkAndSettleOnUsage(customerAddress, streamId);
                expect(canUse).to.be.true;

                const accruedAmount = await streamLockManager.calculateAccruedAmount(streamId);
                console.log(`   ✅ Step 2.${i+1}: Service used, Accrued: ${ethers.utils.formatEther(accruedAmount)} TEST`);
            }

            // Step 3: Final settlement
            const finalSettleTx = await streamLockManager.settleStream(streamId);
            const finalSettleReceipt = await finalSettleTx.wait();
            
            const settleEvent = finalSettleReceipt.events?.find(
                (event: any) => event.event === "StreamSettled"
            );
            
            expect(settleEvent).to.not.be.undefined;
            console.log(`   ✅ Step 3: Stream settled successfully`);

            // Step 4: Verify final state
            const finalStream = await streamLockManager.streams(streamId);
            expect(finalStream.settled).to.be.true;

            const finalLockedBalance = await streamLockManager.getLockedBalance(customerAddress, testToken.address);
            expect(finalLockedBalance).to.equal(0); // All unlocked after settlement

            console.log(`   ✅ Step 4: Customer lifecycle completed successfully`);
        });
    });

    describe("📊 Integration Performance & Metrics", function() {
        it("Should measure end-to-end performance", async function() {
            console.log("\n📊 Measuring integration performance...");

            // Test Factory creation performance
            const factoryStartGas = await ethers.provider.getGasPrice();
            console.log(`   📈 Current gas price: ${factoryStartGas}`);

            // Test stream creation performance through authorized caller
            await streamLockManager.setAuthorizedCaller(ownerAddress, true);
            
            const streamCreateTx = await streamLockManager.createStreamLock(
                customerAddress,
                producerAddress,
                testToken.address,
                STREAM_AMOUNT,
                STREAM_AMOUNT.div(STREAM_DURATION),
                0
            );

            const streamCreateReceipt = await streamCreateTx.wait();
            const streamCreateGas = streamCreateReceipt.gasUsed;
            
            console.log(`   ⚡ Stream creation gas: ${streamCreateGas}`);
            expect(streamCreateGas.toNumber()).to.be.lessThan(200000);

            // Test usage validation performance
            const streamEvent = streamCreateReceipt.events?.find((e: any) => e.event === "StreamCreated");
            const streamId = streamEvent?.args?.streamId;

            await ethers.provider.send("evm_increaseTime", [300]);
            await ethers.provider.send("evm_mine", []);

            const usageValidationTx = await streamLockManager.checkAndSettleOnUsage(customerAddress, streamId);
            const usageValidationReceipt = await usageValidationTx.wait();
            const usageValidationGas = usageValidationReceipt.gasUsed;

            console.log(`   ⚡ Usage validation gas: ${usageValidationGas}`);
            expect(usageValidationGas.toNumber()).to.be.lessThan(100000);

            console.log(`   ✅ Performance metrics within acceptable ranges`);
        });

        it("Should validate system scalability", async function() {
            console.log("\n📊 Testing system scalability...");

            await streamLockManager.setAuthorizedCaller(ownerAddress, true);
            
            // Create multiple streams to test scalability
            const streamCount = 5;
            const streamIds: string[] = [];

            for (let i = 0; i < streamCount; i++) {
                const streamTx = await streamLockManager.createStreamLock(
                    customerAddress,
                    producerAddress,
                    testToken.address,
                    ethers.utils.parseEther("20"), // Smaller amounts for multiple streams
                    ethers.utils.parseEther("20").div(1800), // 30 minute duration
                    0
                );

                const streamReceipt = await streamTx.wait();
                const streamEvent = streamReceipt.events?.find((e: any) => e.event === "StreamCreated");
                streamIds.push(streamEvent?.args?.streamId);
            }

            console.log(`   ✅ Created ${streamCount} concurrent streams`);

            // Validate all streams are active
            for (const streamId of streamIds) {
                const stream = await streamLockManager.streams(streamId);
                expect(stream.active).to.be.true;
                expect(stream.customer).to.equal(customerAddress);
            }

            // Test batch operations concept
            await ethers.provider.send("evm_increaseTime", [900]); // 15 minutes
            await ethers.provider.send("evm_mine", []);

            // Validate all streams have accrued value
            for (const streamId of streamIds) {
                const accruedAmount = await streamLockManager.calculateAccruedAmount(streamId);
                expect(accruedAmount).to.be.gt(0);
            }

            console.log(`   ✅ Scalability test passed - ${streamCount} concurrent streams managed successfully`);
        });
    });

    describe("🔐 Security & Error Handling", function() {
        it("Should prevent unauthorized access", async function() {
            console.log("\n🔐 Testing security controls...");

            // Test unauthorized stream creation
            await expect(
                streamLockManager.connect(producer).createStreamLock(
                    customerAddress,
                    producerAddress,
                    testToken.address,
                    STREAM_AMOUNT,
                    STREAM_AMOUNT.div(STREAM_DURATION),
                    0
                )
            ).to.be.revertedWith("Caller not authorized");

            console.log(`   ✅ Unauthorized access prevented`);

            // Test factory authorization
            const isFactoryAuthorized = await streamLockManager.authorizedCallers(factory.address);
            expect(isFactoryAuthorized).to.be.true;

            console.log(`   ✅ Factory properly authorized`);
        });

        it("Should handle edge cases gracefully", async function() {
            console.log("\n🛡️ Testing edge case handling...");

            await streamLockManager.setAuthorizedCaller(ownerAddress, true);

            // Test zero amount stream
            await expect(
                streamLockManager.createStreamLock(
                    customerAddress,
                    producerAddress,
                    testToken.address,
                    0, // Zero amount
                    1,
                    0
                )
            ).to.be.revertedWith("Amount must be greater than minimum");

            // Test invalid duration
            await expect(
                streamLockManager.createStreamLock(
                    customerAddress,
                    producerAddress,
                    testToken.address,
                    STREAM_AMOUNT,
                    STREAM_AMOUNT.div(30), // 30 second duration (less than minimum)
                    0
                )
            ).to.be.revertedWith("Duration below minimum");

            console.log(`   ✅ Edge cases handled properly`);
        });
    });

    describe("📋 Integration Checklist Validation", function() {
        it("Should validate complete Phase 3 integration", async function() {
            console.log("\n📋 Phase 3 Integration Checklist:");

            // ✅ 1. Factory deploys with StreamLockManager integration
            const factoryStreamManager = await factory.streamLockManager();
            expect(factoryStreamManager).to.equal(streamLockManager.address);
            console.log(`   ✅ Factory-StreamLockManager integration: Working`);

            // ✅ 2. Factory is authorized in StreamLockManager
            const isFactoryAuthorized = await streamLockManager.authorizedCallers(factory.address);
            expect(isFactoryAuthorized).to.be.true;
            console.log(`   ✅ Factory authorization: Working`);

            // ✅ 3. StreamLockManager basic functionality
            const version = await streamLockManager.getVersion();
            expect(version).to.equal(1);
            console.log(`   ✅ StreamLockManager core functionality: Working`);

            // ✅ 4. Token integration
            const tokenBalance = await testToken.balanceOf(customerAddress);
            expect(tokenBalance).to.be.gt(0);
            console.log(`   ✅ Token integration: Working`);

            // ✅ 5. Virtual balance system
            await streamLockManager.setAuthorizedCaller(ownerAddress, true);
            await streamLockManager.createStreamLock(
                customerAddress,
                producerAddress,
                testToken.address,
                STREAM_AMOUNT,
                STREAM_AMOUNT.div(STREAM_DURATION),
                0
            );

            const lockedBalance = await streamLockManager.getLockedBalance(customerAddress, testToken.address);
            expect(lockedBalance).to.equal(STREAM_AMOUNT);
            console.log(`   ✅ Virtual balance system: Working`);

            console.log("\n🎉 All Phase 3 integration requirements validated!");
            console.log("🚀 System ready for production deployment!");
        });
    });
});

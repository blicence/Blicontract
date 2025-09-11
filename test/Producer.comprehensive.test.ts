import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther, formatEther } from "ethers";
import { 
    StreamLockManager, 
    Producer, 
    Factory, 
    ProducerStorage,
    ProducerNUsage,
    URIGenerator,
    TestToken
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("🧪 Producer Comprehensive Stream Integration Tests", function () {
    let owner: SignerWithAddress;
    let producer: SignerWithAddress;
    let customer1: SignerWithAddress;
    let customer2: SignerWithAddress;
    
    let streamLockManager: StreamLockManager;
    let factory: Factory;
    let producerContract: Producer;
    let producerStorage: ProducerStorage;
    let producerNUsage: ProducerNUsage;
    let uriGenerator: URIGenerator;
    let testToken: TestToken;
    
    let producerId: bigint;
    let producerCloneAddress: string;
    let planId: bigint;

    beforeEach(async function () {
        [owner, producer, customer1, customer2] = await ethers.getSigners();

        // 1. Deploy TestToken
        console.log("📄 Deploying TestToken...");
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        testToken = await TestTokenFactory.deploy("Test Token", "TEST", 18, parseEther("1000000"));
        console.log(`   ✅ TestToken deployed: ${await testToken.getAddress()}`);

        // 2. Deploy StreamLockManager
        console.log("🔒 Deploying StreamLockManager...");
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await StreamLockManagerFactory.deploy();
        await streamLockManager.initialize(
            parseEther("1"), // minStreamAmount
            3600, // minStreamDuration (1 hour)
            31536000 // maxStreamDuration (1 year)
        );
        console.log(`   ✅ StreamLockManager deployed: ${await streamLockManager.getAddress()}`);

        // 3. Deploy Core Storage Contracts
        console.log("🗄️ Deploying Storage Contracts...");
        const ProducerStorageFactory = await ethers.getContractFactory("ProducerStorage");
        producerStorage = await ProducerStorageFactory.deploy();
        await producerStorage.initialize();

        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await ProducerNUsageFactory.deploy();
        await producerNUsage.initialize();

        const URIGeneratorFactory = await ethers.getContractFactory("URIGenerator");
        uriGenerator = await URIGeneratorFactory.deploy();
        await uriGenerator.initialize();

        // 4. Deploy Factory
        console.log("🏭 Deploying Factory...");
        const FactoryContract = await ethers.getContractFactory("Factory");
        factory = await FactoryContract.deploy();
        await factory.initialize(
            await producerStorage.getAddress(),
            await uriGenerator.getAddress(),
            await streamLockManager.getAddress()
        );

        // 5. Deploy Producer Implementation
        console.log("🏢 Deploying Producer Implementation...");
        const ProducerFactory = await ethers.getContractFactory("Producer");
        const producerImpl = await ProducerFactory.deploy();
        
        // 6. Set up Factory references
        await producerStorage.setFactory(
            await factory.getAddress(),
            await producerImpl.getAddress(),
            await producerNUsage.getAddress(),
            ethers.ZeroAddress // vestingApi not used in tests
        );

        // 7. Authorize Factory in StreamLockManager
        await streamLockManager.setAuthorizedCaller(await factory.getAddress(), true);

        // 8. Distribute tokens to test users
        await testToken.transfer(customer1.address, parseEther("10000"));
        await testToken.transfer(customer2.address, parseEther("10000"));
        
        console.log("🎉 Setup completed successfully!\n");
    });

    describe("🚀 Complete Workflow Tests", function () {
        
        it("Should create Producer and add plan with stream configuration", async function () {
            console.log("🧪 Test: Producer Creation & Plan Setup with Stream...");

            // Create Producer
            const producerData = {
                name: "Test Producer",
                description: "Test Description", 
                webSite: "https://test.com",
                logoUrl: "https://logo.com",
                isActive: true,
                producerAddress: producer.address
            };

            const tx = await factory.connect(producer).addProducer(producerData);
            const receipt = await tx.wait();
            
            // Get producer ID from event
            const event = receipt?.logs?.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log as any);
                    return parsed?.name === "LogAddProducer";
                } catch { return false; }
            });
            
            expect(event).to.not.be.undefined;
            const parsedEvent = factory.interface.parseLog(event as any);
            producerId = parsedEvent?.args?.producerId;
            producerCloneAddress = await producerStorage.getCloneId(producerId);
            
            console.log(`   ✅ Producer created with ID: ${producerId}`);
            console.log(`   ✅ Producer clone address: ${producerCloneAddress}`);

            // Get Producer instance
            producerContract = await ethers.getContractAt("Producer", producerCloneAddress);

            // Add nUsage plan
            const planData = {
                name: "Basic Plan",
                description: "Basic plan description",
                price: parseEther("100"),
                planType: 0, // nUsage
                isActive: true,
                producerAddress: producer.address,
                priceAddress: await testToken.getAddress(),
                status: 1 // active
            };

            const planInfoNUsage = {
                oneUsagePrice: parseEther("20"),
                maxUsage: 5
            };

            const addPlanTx = await producerContract.connect(producer).addPlan(planData, planInfoNUsage);
            const planReceipt = await addPlanTx.wait();
            
            const planEvent = planReceipt?.logs?.find(log => {
                try {
                    const parsed = producerContract.interface.parseLog(log as any);
                    return parsed?.name === "LogAddPlan";
                } catch { return false; }
            });

            const parsedPlanEvent = producerContract.interface.parseLog(planEvent as any);
            planId = parsedPlanEvent?.args?.planId;

            console.log(`   ✅ Plan created with ID: ${planId}`);
            
            expect(producerId).to.be.greaterThan(0n);
            expect(planId).to.be.greaterThan(0n);
        });

        it("Should create customer plan with stream and validate all mappings", async function () {
            console.log("🧪 Test: Customer Plan with Stream Creation...");

            // First setup producer and plan
            await this.test?.parent?.tests[0].fn.call(this);

            // Approve tokens for customer
            const totalAmount = parseEther("100"); // 5 usage * 20 per usage
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            // Create customer plan with stream
            const customerPlanData = {
                custumerPlanId: 0n, // Will be generated
                planId: planId,
                planType: 0, // nUsage
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1 // active
            };

            const streamDuration = 3600n; // 1 hour
            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                streamDuration
            );
            const receipt = await tx.wait();

            // Parse events
            let customerPlanId: bigint = 0n;
            let streamLockId: string = "";

            for (const log of receipt?.logs || []) {
                try {
                    const parsed = producerContract.interface.parseLog(log as any);
                    if (parsed?.name === "CustomerPlanWithStreamCreated") {
                        customerPlanId = parsed.args.customerPlanId;
                        streamLockId = parsed.args.streamLockId;
                        break;
                    }
                } catch { continue; }
            }

            expect(customerPlanId).to.be.greaterThan(0n);
            expect(streamLockId).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

            console.log(`   ✅ Customer Plan ID: ${customerPlanId}`);
            console.log(`   ✅ Stream Lock ID: ${streamLockId}`);

            // Verify bidirectional mapping
            const retrievedStreamId = await producerContract.getStreamLockIdForCustomerPlan(customerPlanId);
            const retrievedCustomerPlanId = await producerContract.getCustomerPlanIdForStreamLock(streamLockId);

            expect(retrievedStreamId).to.equal(streamLockId);
            expect(retrievedCustomerPlanId).to.equal(customerPlanId);
            console.log(`   ✅ Bidirectional mapping verified`);

            // Verify stream status
            const streamStatus = await streamLockManager.getStreamStatus(streamLockId);
            expect(streamStatus.isActive).to.be.true;
            expect(streamStatus.isExpired).to.be.false;
            console.log(`   ✅ Stream is active and not expired`);

            // Verify customer balance
            const balance = await testToken.balanceOf(customer1.address);
            expect(balance).to.equal(parseEther("9900")); // 10000 - 100
            console.log(`   ✅ Customer balance updated: ${formatEther(balance)} TEST`);
        });

        it("Should validate usage with stream checks", async function () {
            console.log("🧪 Test: Usage Validation with Stream...");

            // Setup from previous tests
            await this.test?.parent?.tests[0].fn.call(this);
            await this.test?.parent?.tests[1].fn.call(this);

            const customerPlanId = 1n; // From previous test

            // Test 1: Immediate validation (should pass)
            const [canUse1, remainingTime1, streamLockId] = await producerContract.validateUsageWithStream(customerPlanId);
            expect(canUse1).to.be.true;
            expect(remainingTime1).to.be.greaterThan(0n);
            console.log(`   ✅ Initial validation: canUse=${canUse1}, remainingTime=${remainingTime1}s`);

            // Test 2: Fast forward time and test again
            await ethers.provider.send("evm_increaseTime", [1800]); // 30 minutes
            await ethers.provider.send("evm_mine", []);

            const [canUse2, remainingTime2] = await producerContract.validateUsageWithStream(customerPlanId);
            expect(canUse2).to.be.true;
            expect(remainingTime2).to.be.lessThan(remainingTime1);
            console.log(`   ✅ After 30min: canUse=${canUse2}, remainingTime=${remainingTime2}s`);

            // Test 3: Check stream accrual
            const streamStatus = await streamLockManager.getStreamStatus(streamLockId);
            expect(streamStatus.accruedAmount).to.be.greaterThan(0n);
            console.log(`   ✅ Stream accrued: ${formatEther(streamStatus.accruedAmount)} TEST`);
        });

        it("Should handle service usage with stream settlement", async function () {
            console.log("🧪 Test: Service Usage with Stream Settlement...");

            // Setup from previous tests  
            await this.test?.parent?.tests[0].fn.call(this);
            await this.test?.parent?.tests[1].fn.call(this);

            const customerPlanId = 1n;
            const usageAmount = 1n; // Use 1 quota

            // Before usage - check quota
            const customerPlanBefore = await producerStorage.getCustomerPlan(customerPlanId);
            expect(customerPlanBefore.remainingQuota).to.equal(5n);

            // Perform usage settlement
            const tx = await producerContract.connect(customer1).settleStreamOnUsage(customerPlanId, usageAmount);
            const receipt = await tx.wait();

            // Check events
            let streamUsageValidated = false;
            for (const log of receipt?.logs || []) {
                try {
                    const parsed = producerContract.interface.parseLog(log as any);
                    if (parsed?.name === "StreamUsageValidated") {
                        streamUsageValidated = true;
                        console.log(`   ✅ Stream usage validated event emitted`);
                        break;
                    }
                } catch { continue; }
            }

            expect(streamUsageValidated).to.be.true;

            // Verify quota was decremented
            const customerPlanAfter = await producerStorage.getCustomerPlan(customerPlanId);
            expect(customerPlanAfter.remainingQuota).to.equal(4n);
            console.log(`   ✅ Quota decremented: ${customerPlanBefore.remainingQuota} → ${customerPlanAfter.remainingQuota}`);
        });

        it("Should handle multiple customers and batch operations", async function () {
            console.log("🧪 Test: Multiple Customers & Batch Operations...");

            // Setup producer first
            await this.test?.parent?.tests[0].fn.call(this);

            const totalAmount = parseEther("100");
            
            // Customer 1 setup
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);
            const customerPlan1 = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1
            };

            // Customer 2 setup  
            await testToken.connect(customer2).approve(producerCloneAddress, totalAmount);
            const customerPlan2 = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAddress: customer2.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1
            };

            // Create customer plans with streams
            const tx1 = await producerContract.connect(customer1).addCustomerPlanWithStream(customerPlan1, 3600n);
            const tx2 = await producerContract.connect(customer2).addCustomerPlanWithStream(customerPlan2, 7200n);

            await tx1.wait();
            await tx2.wait();

            console.log(`   ✅ Created 2 customer plans with different stream durations`);

            // Validate both customers can use service
            const [canUse1] = await producerContract.validateUsageWithStream(1n);
            const [canUse2] = await producerContract.validateUsageWithStream(2n);

            expect(canUse1).to.be.true;
            expect(canUse2).to.be.true;
            console.log(`   ✅ Both customers validated for service access`);

            // Fast forward and check expiry differences
            await ethers.provider.send("evm_increaseTime", [3700]); // 1 hour + 100 seconds
            await ethers.provider.send("evm_mine", []);

            const [canUse1After] = await producerContract.validateUsageWithStream(1n);
            const [canUse2After] = await producerContract.validateUsageWithStream(2n);

            // Customer 1 stream should be expired, Customer 2 should still be active
            expect(canUse1After).to.be.false;
            expect(canUse2After).to.be.true;
            console.log(`   ✅ Different expiry times working correctly`);
        });

        it("Should handle edge cases and error scenarios", async function () {
            console.log("🧪 Test: Edge Cases & Error Handling...");

            await this.test?.parent?.tests[0].fn.call(this);

            // Test 1: Invalid customer plan ID
            const [canUse, remainingTime, streamId] = await producerContract.validateUsageWithStream(999n);
            expect(canUse).to.be.false;
            expect(remainingTime).to.equal(0n);
            expect(streamId).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            console.log(`   ✅ Invalid customer plan ID handled correctly`);

            // Test 2: Zero stream duration (no stream creation)
            await testToken.connect(customer1).approve(producerCloneAddress, parseEther("100"));
            const customerPlanZeroStream = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1
            };

            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(customerPlanZeroStream, 0n);
            const receipt = await tx.wait();

            // Should not emit CustomerPlanWithStreamCreated event
            let streamCreatedEvent = false;
            for (const log of receipt?.logs || []) {
                try {
                    const parsed = producerContract.interface.parseLog(log as any);
                    if (parsed?.name === "CustomerPlanWithStreamCreated") {
                        streamCreatedEvent = true;
                        break;
                    }
                } catch { continue; }
            }

            expect(streamCreatedEvent).to.be.false;
            console.log(`   ✅ Zero stream duration handled - no stream created`);

            // Test 3: Settlement with invalid customer plan
            await expect(
                producerContract.settleStreamOnUsage(999n, 1n)
            ).to.be.revertedWith("Customer plan not active");
            console.log(`   ✅ Invalid settlement correctly reverted`);
        });
    });

    describe("🔧 Gas Optimization Tests", function () {
        it("Should measure gas costs for key operations", async function () {
            console.log("⛽ Gas Cost Analysis...");

            await this.test?.parent?.tests[0].fn.call(this);

            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlan = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1
            };

            // Measure addCustomerPlanWithStream
            const tx1 = await producerContract.connect(customer1).addCustomerPlanWithStream(customerPlan, 3600n);
            const receipt1 = await tx1.wait();
            console.log(`   📊 addCustomerPlanWithStream: ${receipt1?.gasUsed} gas`);

            // Measure validateUsageWithStream
            const tx2 = await producerContract.validateUsageWithStream.staticCall(1n);
            console.log(`   📊 validateUsageWithStream: view function (no gas cost)`);

            // Measure settleStreamOnUsage
            const tx3 = await producerContract.connect(customer1).settleStreamOnUsage(1n, 1n);
            const receipt3 = await tx3.wait();
            console.log(`   📊 settleStreamOnUsage: ${receipt3?.gasUsed} gas`);

            expect(receipt1?.gasUsed).to.be.lessThan(500000n); // Should be under 500k gas
            expect(receipt3?.gasUsed).to.be.lessThan(100000n); // Should be under 100k gas
        });
    });

    describe("🛡️ Security Tests", function () {
        it("Should prevent unauthorized access", async function () {
            console.log("🛡️ Security: Unauthorized Access Prevention...");

            await this.test?.parent?.tests[0].fn.call(this);

            // Test unauthorized setStreamLockManager
            await expect(
                producerContract.connect(customer1).setStreamLockManager(ethers.ZeroAddress)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            // Test settlement from wrong user
            await this.test?.parent?.tests[1].fn.call(this);
            
            await expect(
                producerContract.connect(customer2).settleStreamOnUsage(1n, 1n)
            ).to.be.revertedWith("Customer plan not active");

            console.log(`   ✅ Unauthorized access properly prevented`);
        });

        it("Should handle contract pausing scenarios", async function () {
            console.log("🛡️ Security: Contract Pausing...");

            await this.test?.parent?.tests[0].fn.call(this);

            // Pause the producer contract
            await producerContract.connect(producer).pause();

            const customerPlan = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1
            };

            // Should revert when paused
            await expect(
                producerContract.connect(customer1).addCustomerPlanWithStream(customerPlan, 3600n)
            ).to.be.revertedWith("Pausable: paused");

            // Unpause and retry
            await producerContract.connect(producer).unpause();
            
            await testToken.connect(customer1).approve(producerCloneAddress, parseEther("100"));
            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(customerPlan, 3600n);
            expect(tx).to.not.be.reverted;

            console.log(`   ✅ Pausing mechanism working correctly`);
        });
    });
});

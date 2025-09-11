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
import { Signer } from "ethers";

// Helper function for event parsing
function parseEventFromReceipt(receipt: any, contractInstance: any, eventName: string) {
    if (!receipt || !receipt.logs) return null;
    
    for (const log of receipt.logs) {
        try {
            const parsed = contractInstance.interface.parseLog({
                topics: log.topics,
                data: log.data
            });
            if (parsed && parsed.name === eventName) {
                return parsed;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

describe("🧪 Producer Stream Integration - Detailed Testing Suite", function () {
    let owner: Signer;
    let producer: Signer;
    let customer1: Signer;
    let customer2: Signer;
    
    let streamLockManager: StreamLockManager;
    let factory: Factory;
    let producerContract: Producer;
    let producerStorage: ProducerStorage;
    let producerNUsage: ProducerNUsage;
    let uriGenerator: URIGenerator;
    let testToken: TestToken;
    
    let ownerAddress: string;
    let producerAddress: string;
    let customer1Address: string;
    let customer2Address: string;
    
    let producerId: bigint;
    let producerCloneAddress: string;
    let planId: bigint;

    before(async function () {
        console.log("🏗️ Setting up comprehensive test environment...");
        
        [owner, producer, customer1, customer2] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        producerAddress = await producer.getAddress();
        customer1Address = await customer1.getAddress();
        customer2Address = await customer2.getAddress();

        // 1. Deploy TestToken with large supply
        console.log("💰 Deploying TestToken...");
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        testToken = await TestTokenFactory.deploy("Test Token", "TEST", 18, parseEther("1000000"));
        console.log(`   ✅ TestToken: ${await testToken.getAddress()}`);

        // 2. Deploy StreamLockManager
        console.log("🔒 Deploying StreamLockManager...");
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await StreamLockManagerFactory.deploy();
        await streamLockManager.initialize(
            ownerAddress,
            parseEther("1"), // minStreamAmount  
            3600, // minStreamDuration
            31536000 // maxStreamDuration
        );
        console.log(`   ✅ StreamLockManager: ${await streamLockManager.getAddress()}`);

        // 3. Deploy Storage contracts
        console.log("🗄️ Deploying Storage contracts...");
        const ProducerStorageFactory = await ethers.getContractFactory("ProducerStorage");
        producerStorage = await ProducerStorageFactory.deploy(ownerAddress);

        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await ProducerNUsageFactory.deploy(ownerAddress);

        const URIGeneratorFactory = await ethers.getContractFactory("URIGenerator");
        uriGenerator = await URIGeneratorFactory.deploy(ownerAddress);

        console.log(`   ✅ ProducerStorage: ${await producerStorage.getAddress()}`);
        console.log(`   ✅ ProducerNUsage: ${await producerNUsage.getAddress()}`);
        console.log(`   ✅ URIGenerator: ${await uriGenerator.getAddress()}`);

        // 4. Deploy Producer implementation
        console.log("🏢 Deploying Producer implementation...");
        const ProducerFactory = await ethers.getContractFactory("Producer");
        const producerImpl = await ProducerFactory.deploy();
        console.log(`   ✅ Producer implementation: ${await producerImpl.getAddress()}`);

        // 5. Deploy Factory
        console.log("🏭 Deploying Factory...");
        const FactoryContractFactory = await ethers.getContractFactory("Factory");
        factory = await FactoryContractFactory.deploy();
        await factory.initialize(
            await uriGenerator.getAddress(),
            await producerStorage.getAddress(),
            ethers.ZeroAddress, // producerApi
            await producerNUsage.getAddress(),
            ethers.ZeroAddress, // producerVestingApi
            await streamLockManager.getAddress(),
            await producerImpl.getAddress()
        );
        console.log(`   ✅ Factory: ${await factory.getAddress()}`);

        // 6. Configure relationships
        console.log("⚙️ Configuring relationships...");
        await producerStorage.setFactory(
            await factory.getAddress(),
            await producerImpl.getAddress(),
            await producerNUsage.getAddress(),
            ethers.ZeroAddress
        );

        await streamLockManager.setAuthorizedCaller(await factory.getAddress(), true);
        console.log("   ✅ Factory authorized in StreamLockManager");

        // 7. Distribute tokens
        await testToken.transfer(customer1Address, parseEther("10000"));
        await testToken.transfer(customer2Address, parseEther("10000"));
        console.log("   ✅ Tokens distributed to customers");

        console.log("🎉 Environment setup completed!\n");
    });

    describe("📋 1. Basic Setup & Configuration", function () {
        it("Should verify all contracts are properly deployed", async function () {
            expect(await testToken.symbol()).to.equal("TEST");
            expect(await streamLockManager.VERSION()).to.equal(1n);
            expect(await factory.currentPR_ID()).to.equal(0n);
            
            const customer1Balance = await testToken.balanceOf(customer1Address);
            const customer2Balance = await testToken.balanceOf(customer2Address);
            
            expect(customer1Balance).to.equal(parseEther("10000"));
            expect(customer2Balance).to.equal(parseEther("10000"));
            
            console.log("   ✅ All contracts verified and tokens distributed");
        });

        it("Should create Producer through Factory", async function () {
            const producerData = {
                name: "Premium Producer",
                description: "High-quality service provider",
                webSite: "https://premium.com",
                logoUrl: "https://premium.com/logo.png",
                isActive: true,
                producerAddress: producerAddress
            };

            const tx = await factory.connect(producer).createProducer(producerData);
            const receipt = await tx.wait();

            const event = parseEventFromReceipt(receipt, factory, "LogAddProducer");
            expect(event).to.not.be.null;
            
            producerId = event!.args.producerId;
            producerCloneAddress = await producerStorage.getCloneId(producerId);

            expect(producerId).to.be.greaterThan(0n);
            expect(producerCloneAddress).to.not.equal(ethers.ZeroAddress);

            console.log(`   ✅ Producer created - ID: ${producerId}, Clone: ${producerCloneAddress}`);
        });

        it("Should add nUsage plan to Producer", async function () {
            producerContract = await ethers.getContractAt("Producer", producerCloneAddress);

            const planData = {
                planId: 0n,
                name: "Standard Plan",
                description: "Standard service access",
                price: parseEther("100"),
                planType: 0, // nUsage
                isActive: true,
                producerAddress: producerAddress,
                priceAddress: await testToken.getAddress(),
                status: 1, // active
                cloneAddress: producerCloneAddress,
                producerId: producerId,
                externalLink: "",
                maxSupply: 0n,
                currentSupply: 0n,
                planExpiration: 0n
            };

            const planInfoNUsage = {
                oneUsagePrice: parseEther("20"),
                maxUsage: 5n
            };

            const tx = await producerContract.connect(producer).addPlan(planData);
            const receipt = await tx.wait();

            const event = parseEventFromReceipt(receipt, producerContract, "LogAddPlan");
            expect(event).to.not.be.null;
            
            planId = event!.args.planId;
            expect(planId).to.be.greaterThan(0n);

            // Add plan info
            await producerContract.connect(producer).addPlanInfoNUsage(planInfoNUsage, planId);

            console.log(`   ✅ Plan created - ID: ${planId}`);
        });
    });

    describe("🚀 2. Stream-Aware Customer Plan Creation", function () {
        let customerPlanId: bigint;
        let streamLockId: string;

        it("Should create customer plan with stream successfully", async function () {
            const quotaAmount = 5n;
            const totalAmount = parseEther("100"); // 5 * 20

            // Approve tokens
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0, // nUsage
                customerAdress: customer1Address, // Note: typo in original contract
                customerAddress: customer1Address,
                producerAddress: producerAddress,
                remainingQuota: quotaAmount,
                endDate: 0n,
                status: 1, // active
                producerId: producerId,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            const streamDuration = 3600n; // 1 hour

            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                streamDuration
            );
            const receipt = await tx.wait();

            const event = parseEventFromReceipt(receipt, producerContract, "CustomerPlanWithStreamCreated");
            expect(event).to.not.be.null;

            customerPlanId = event!.args.customerPlanId;
            streamLockId = event!.args.streamLockId;

            expect(customerPlanId).to.be.greaterThan(0n);
            expect(streamLockId).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

            console.log(`   ✅ Customer Plan ID: ${customerPlanId}`);
            console.log(`   ✅ Stream Lock ID: ${streamLockId}`);

            // Verify token transfer
            const customer1Balance = await testToken.balanceOf(customer1Address);
            expect(customer1Balance).to.equal(parseEther("9900"));
            console.log(`   ✅ Customer balance after payment: ${formatEther(customer1Balance)} TEST`);
        });

        it("Should verify bidirectional mapping works", async function () {
            const retrievedStreamId = await producerContract.getStreamLockIdForCustomerPlan(customerPlanId);
            const retrievedCustomerPlanId = await producerContract.getCustomerPlanIdForStreamLock(streamLockId);

            expect(retrievedStreamId).to.equal(streamLockId);
            expect(retrievedCustomerPlanId).to.equal(customerPlanId);

            console.log("   ✅ Bidirectional mapping verified");
        });

        it("Should validate stream status is active", async function () {
            const [isActive, isExpired, accruedAmount, remainingAmount, streamRemainingTime] = 
                await streamLockManager.getStreamStatus(streamLockId);

            expect(isActive).to.be.true;
            expect(isExpired).to.be.false;
            expect(remainingAmount).to.be.greaterThan(0n);
            expect(streamRemainingTime).to.be.greaterThan(0n);

            console.log(`   ✅ Stream Status: active=${isActive}, expired=${isExpired}`);
            console.log(`   ✅ Stream Remaining: ${formatEther(remainingAmount)} TEST, Time: ${streamRemainingTime}s`);
        });
    });

    describe("🔍 3. Usage Validation with Streams", function () {
        let customerPlanId: bigint = 1n; // From previous test

        it("Should validate immediate service access", async function () {
            const [canUse, remainingTime, streamLockId] = await producerContract.validateUsageWithStream(customerPlanId);

            expect(canUse).to.be.true;
            expect(remainingTime).to.be.greaterThan(0n);
            expect(streamLockId).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

            console.log(`   ✅ Initial validation: canUse=${canUse}, remainingTime=${remainingTime}s`);
        });

        it("Should validate service access after time passes", async function () {
            // Fast forward 30 minutes
            await ethers.provider.send("evm_increaseTime", [1800]);
            await ethers.provider.send("evm_mine", []);

            const [canUse, remainingTime] = await producerContract.validateUsageWithStream(customerPlanId);

            expect(canUse).to.be.true;
            expect(remainingTime).to.be.greaterThan(0n);
            expect(remainingTime).to.be.lessThan(3600n); // Less than original 1 hour

            console.log(`   ✅ After 30min: canUse=${canUse}, remainingTime=${remainingTime}s`);
        });

        it("Should show stream expiration behavior", async function () {
            // Fast forward to near expiration (59 minutes total)
            await ethers.provider.send("evm_increaseTime", [1740]); // 29 more minutes
            await ethers.provider.send("evm_mine", []);

            const [canUse, remainingTime] = await producerContract.validateUsageWithStream(customerPlanId);

            expect(remainingTime).to.be.lessThan(60n); // Less than 1 minute remaining
            console.log(`   ✅ Near expiration: canUse=${canUse}, remainingTime=${remainingTime}s`);

            // Fast forward past expiration
            await ethers.provider.send("evm_increaseTime", [120]); // 2 more minutes
            await ethers.provider.send("evm_mine", []);

            const [canUseExpired, remainingTimeExpired] = await producerContract.validateUsageWithStream(customerPlanId);
            
            // After expiration, should fall back to traditional validation
            // Since this is nUsage with remaining quota, it should still allow usage
            console.log(`   ✅ After expiration: canUse=${canUseExpired}, remainingTime=${remainingTimeExpired}s`);
        });
    });

    describe("💰 4. Settlement and Usage Tracking", function () {
        let newCustomerPlanId: bigint;

        it("Should create fresh customer plan for settlement tests", async function () {
            const totalAmount = parseEther("100");
            await testToken.connect(customer2).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer2Address,
                customerAddress: customer2Address,
                producerAddress: producerAddress,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: producerId,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            const tx = await producerContract.connect(customer2).addCustomerPlanWithStream(
                customerPlanData,
                7200n // 2 hours
            );
            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, producerContract, "CustomerPlanWithStreamCreated");
            
            newCustomerPlanId = event!.args.customerPlanId;
            console.log(`   ✅ Fresh customer plan created: ${newCustomerPlanId}`);
        });

        it("Should perform settlement on service usage", async function () {
            const usageAmount = 1n;

            // Check quota before
            const customerPlanBefore = await producerStorage.getCustomerPlan(newCustomerPlanId);
            expect(customerPlanBefore.remainingQuota).to.equal(5n);

            // Perform settlement
            const tx = await producerContract.connect(customer2).settleStreamOnUsage(
                newCustomerPlanId, 
                usageAmount
            );
            const receipt = await tx.wait();

            // Check for event
            const event = parseEventFromReceipt(receipt, producerContract, "StreamUsageValidated");
            expect(event).to.not.be.null;

            console.log(`   ✅ Settlement event emitted: ${event!.args.canUse}`);

            // Check quota after
            const customerPlanAfter = await producerStorage.getCustomerPlan(newCustomerPlanId);
            expect(customerPlanAfter.remainingQuota).to.equal(4n);

            console.log(`   ✅ Quota updated: ${customerPlanBefore.remainingQuota} → ${customerPlanAfter.remainingQuota}`);
        });

        it("Should track multiple usage events", async function () {
            // Use service 2 more times
            await producerContract.connect(customer2).settleStreamOnUsage(newCustomerPlanId, 1n);
            await producerContract.connect(customer2).settleStreamOnUsage(newCustomerPlanId, 1n);

            const customerPlan = await producerStorage.getCustomerPlan(newCustomerPlanId);
            expect(customerPlan.remainingQuota).to.equal(2n);

            console.log(`   ✅ After 3 total usages, remaining quota: ${customerPlan.remainingQuota}`);
        });

        it("Should prevent usage when quota exhausted", async function () {
            // Use remaining quota
            await producerContract.connect(customer2).settleStreamOnUsage(newCustomerPlanId, 2n);

            const customerPlan = await producerStorage.getCustomerPlan(newCustomerPlanId);
            expect(customerPlan.remainingQuota).to.equal(0n);

            // Should revert on next usage attempt
            await expect(
                producerContract.connect(customer2).settleStreamOnUsage(newCustomerPlanId, 1n)
            ).to.be.revertedWith("Insufficient quota");

            console.log(`   ✅ Quota exhaustion properly prevented further usage`);
        });
    });

    describe("🛡️ 5. Edge Cases and Security", function () {
        it("Should handle invalid customer plan IDs", async function () {
            const [canUse, remainingTime, streamLockId] = await producerContract.validateUsageWithStream(999n);

            expect(canUse).to.be.false;
            expect(remainingTime).to.equal(0n);
            expect(streamLockId).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

            console.log(`   ✅ Invalid customer plan ID handled correctly`);
        });

        it("Should handle customer plan creation without stream", async function () {
            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer1Address,
                customerAddress: customer1Address,
                producerAddress: producerAddress,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: producerId,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            // Zero duration = no stream
            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                0n
            );
            const receipt = await tx.wait();

            // Should not emit CustomerPlanWithStreamCreated event
            const event = parseEventFromReceipt(receipt, producerContract, "CustomerPlanWithStreamCreated");
            expect(event).to.be.null;

            console.log(`   ✅ Zero stream duration handled - no stream created`);
        });

        it("Should prevent unauthorized stream manager changes", async function () {
            await expect(
                producerContract.connect(customer1).setStreamLockManager(ethers.ZeroAddress)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            console.log(`   ✅ Unauthorized access properly prevented`);
        });

        it("Should handle settlement with invalid customer plan", async function () {
            await expect(
                producerContract.connect(customer1).settleStreamOnUsage(999n, 1n)
            ).to.be.revertedWith("Customer plan not active");

            console.log(`   ✅ Invalid settlement properly reverted`);
        });
    });

    describe("⚡ 6. Performance and Gas Analysis", function () {
        it("Should measure gas costs for key operations", async function () {
            console.log("⛽ Gas Cost Analysis:");

            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer1Address,
                customerAddress: customer1Address,
                producerAddress: producerAddress,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: producerId,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            // Measure addCustomerPlanWithStream
            const tx1 = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData, 
                3600n
            );
            const receipt1 = await tx1.wait();
            console.log(`   📊 addCustomerPlanWithStream: ${receipt1!.gasUsed.toLocaleString()} gas`);

            // Measure settleStreamOnUsage
            const newCustomerPlanId = parseEventFromReceipt(receipt1, producerContract, "CustomerPlanWithStreamCreated")!.args.customerPlanId;
            
            const tx2 = await producerContract.connect(customer1).settleStreamOnUsage(newCustomerPlanId, 1n);
            const receipt2 = await tx2.wait();
            console.log(`   📊 settleStreamOnUsage: ${receipt2!.gasUsed.toLocaleString()} gas`);

            // Gas costs should be reasonable
            expect(receipt1!.gasUsed).to.be.lessThan(800000n); // Less than 800k gas
            expect(receipt2!.gasUsed).to.be.lessThan(150000n); // Less than 150k gas

            console.log(`   ✅ Gas costs within acceptable limits`);
        });
    });

    describe("🏁 7. Complete Customer Lifecycle", function () {
        it("Should demonstrate end-to-end customer journey", async function () {
            console.log("🌟 Complete Customer Lifecycle Test:");

            // Step 1: Customer subscribes
            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer1Address,
                customerAddress: customer1Address,
                producerAddress: producerAddress,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: producerId,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                3600n
            );
            const receipt = await tx.wait();
            const event = parseEventFromReceipt(receipt, producerContract, "CustomerPlanWithStreamCreated");
            const lifecycleCustomerPlanId = event!.args.customerPlanId;
            const lifecycleStreamLockId = event!.args.streamLockId;

            console.log(`   ✅ Step 1: Customer subscribed (Plan: ${lifecycleCustomerPlanId})`);

            // Step 2: Multiple service usages
            for (let i = 0; i < 3; i++) {
                await ethers.provider.send("evm_increaseTime", [600]); // 10 minutes
                await ethers.provider.send("evm_mine", []);

                const [canUse] = await producerContract.validateUsageWithStream(lifecycleCustomerPlanId);
                expect(canUse).to.be.true;

                await producerContract.connect(customer1).settleStreamOnUsage(lifecycleCustomerPlanId, 1n);
                
                const customerPlan = await producerStorage.getCustomerPlan(lifecycleCustomerPlanId);
                console.log(`   ✅ Step 2.${i+1}: Service used, remaining quota: ${customerPlan.remainingQuota}`);
            }

            // Step 3: Stream status check
            const [isActive, isExpired, accruedAmount] = await streamLockManager.getStreamStatus(lifecycleStreamLockId);
            expect(isActive).to.be.true;
            expect(accruedAmount).to.be.greaterThan(0n);
            console.log(`   ✅ Step 3: Stream status - Active: ${isActive}, Accrued: ${formatEther(accruedAmount)} TEST`);

            // Step 4: Final quota usage
            await producerContract.connect(customer1).settleStreamOnUsage(lifecycleCustomerPlanId, 2n);
            const finalCustomerPlan = await producerStorage.getCustomerPlan(lifecycleCustomerPlanId);
            expect(finalCustomerPlan.remainingQuota).to.equal(0n);
            console.log(`   ✅ Step 4: All quota consumed, lifecycle completed`);

            console.log("🎉 End-to-end customer journey completed successfully!");
        });
    });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther, formatEther } from "ethers";

describe("🚀 Producer Stream Integration - Detailed Analysis", function () {
    let owner: any, producer: any, customer1: any, customer2: any;
    let streamLockManager: any, factory: any, testToken: any, producerStorage: any;
    let producerCloneAddress: string;
    let producerContract: any;
    let planId: bigint;

    before(async function () {
        console.log("🔧 Setting up detailed stream integration test environment...\n");

        [owner, producer, customer1, customer2] = await ethers.getSigners();

        // Deploy test token
        const TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy("Test Token", "TEST", 18, parseEther("1000000"));
        console.log(`💰 TestToken deployed: ${await testToken.getAddress()}`);

        // Deploy StreamLockManager
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await StreamLockManager.deploy();
        await streamLockManager.initialize(
            owner.address,
            parseEther("1"), // minStreamAmount
            3600, // minStreamDuration (1 hour)
            31536000 // maxStreamDuration (1 year)
        );
        console.log(`🔒 StreamLockManager deployed: ${await streamLockManager.getAddress()}`);

        // Deploy core contracts
        const ProducerStorage = await ethers.getContractFactory("ProducerStorage");
        producerStorage = await ProducerStorage.deploy(owner.address);

        const ProducerNUsage = await ethers.getContractFactory("ProducerNUsage");
        const producerNUsage = await ProducerNUsage.deploy(owner.address);

        const URIGenerator = await ethers.getContractFactory("URIGenerator");
        const uriGenerator = await URIGenerator.deploy(owner.address);

        // Deploy Producer implementation
        const Producer = await ethers.getContractFactory("Producer");
        const producerImpl = await Producer.deploy();

        // Deploy Factory
        const FactoryContract = await ethers.getContractFactory("Factory");
        factory = await FactoryContract.deploy();
        await factory.initialize(
            await uriGenerator.getAddress(),
            await producerStorage.getAddress(),
            ethers.ZeroAddress, // producerApi
            await producerNUsage.getAddress(),
            ethers.ZeroAddress, // producerVestingApi
            await streamLockManager.getAddress(),
            await producerImpl.getAddress()
        );

        // Setup relationships
        await producerStorage.setFactory(
            await factory.getAddress(),
            await producerImpl.getAddress(),
            await producerNUsage.getAddress(),
            ethers.ZeroAddress
        );

        await streamLockManager.setAuthorizedCaller(await factory.getAddress(), true);

        // Create producer
        const producerData = {
            name: "Test Producer",
            description: "Test Description",
            webSite: "https://test.com",
            logoUrl: "https://logo.com",
            isActive: true,
            producerAddress: producer.address
        };

        const tx = await factory.connect(producer).createProducer(producerData);
        const receipt = await tx.wait();

        // Get producer info
        const producerId = await factory.currentPR_ID();
        producerCloneAddress = await producerStorage.getCloneId(producerId);
        producerContract = await ethers.getContractAt("Producer", producerCloneAddress);

        console.log(`🏭 Producer created: ${producerCloneAddress}`);

        // Create plan
        const planData = {
            planId: 0n,
            name: "Test Plan",
            description: "Test Plan Description",
            price: parseEther("100"),
            planType: 0, // nUsage
            isActive: true,
            producerAddress: producer.address,
            priceAddress: await testToken.getAddress(),
            status: 1, // active
            cloneAddress: producerCloneAddress,
            producerId: producerId,
            externalLink: "",
            maxSupply: 0n,
            currentSupply: 0n,
            planExpiration: 0n,
            totalSupply: 0n,
            backgroundColor: "#ffffff",
            image: "",
            startDate: 0n,
            custumerPlanIds: []
        };

        const addPlanTx = await producerContract.connect(producer).addPlan(planData);
        const planReceipt = await addPlanTx.wait();
        
        planId = await producerStorage.currentPR_ID(); // Use currentPR_ID instead

        // Add plan info
        const planInfoNUsage = {
            planId: planId,
            oneUsagePrice: parseEther("20"),
            maxUsage: 5n,
            minUsageLimit: 1n,
            maxUsageLimit: 10n
        };

        await producerContract.connect(producer).addPlanInfoNUsage(planInfoNUsage);

        // Distribute tokens
        await testToken.transfer(customer1.address, parseEther("10000"));
        await testToken.transfer(customer2.address, parseEther("10000"));

        console.log("✅ Environment setup completed!\n");
    });

    describe("📊 1. Stream-Aware Customer Plan Analysis", function () {
        let customerPlanId: bigint;
        let streamLockId: string;

        it("💫 Should analyze addCustomerPlanWithStream functionality", async function () {
            console.log("🔍 Testing addCustomerPlanWithStream with detailed analysis...");

            const quotaAmount = 5n;
            const totalAmount = parseEther("100"); // 5 * 20
            const streamDuration = 3600n; // 1 hour

            // Step 1: Approve tokens
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);
            console.log(`   💰 Customer approved ${formatEther(totalAmount)} TEST tokens`);

            // Step 2: Prepare customer plan data
            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0, // nUsage
                customerAdress: customer1.address, // Note: typo in original
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: quotaAmount,
                endDate: 0n,
                status: 1, // active
                producerId: 1n,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            // Step 3: Create customer plan with stream
            console.log(`   ⏰ Creating customer plan with ${streamDuration}s stream duration...`);
            
            const balanceBefore = await testToken.balanceOf(customer1.address);
            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                streamDuration
            );
            const receipt = await tx.wait();
            const balanceAfter = await testToken.balanceOf(customer1.address);

            console.log(`   📊 Gas used: ${receipt.gasUsed.toLocaleString()}`);
            console.log(`   💸 Token transfer: ${formatEther(balanceBefore - balanceAfter)} TEST`);

            // Step 4: Analyze events
            let streamEventFound = false;
            for (const log of receipt.logs) {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    if (parsed.name === "CustomerPlanWithStreamCreated") {
                        customerPlanId = parsed.args.customerPlanId;
                        streamLockId = parsed.args.streamLockId;
                        streamEventFound = true;
                        console.log(`   🎯 CustomerPlanWithStreamCreated event emitted:`);
                        console.log(`      - Customer Plan ID: ${customerPlanId}`);
                        console.log(`      - Stream Lock ID: ${streamLockId}`);
                        break;
                    }
                } catch (e) { /* ignore */ }
            }

            expect(streamEventFound).to.be.true;
            expect(customerPlanId).to.be.greaterThan(0n);
            expect(streamLockId).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

            // Step 5: Verify mappings
            const retrievedStreamId = await producerContract.getStreamLockIdForCustomerPlan(customerPlanId);
            const retrievedCustomerPlanId = await producerContract.getCustomerPlanIdForStreamLock(streamLockId);

            expect(retrievedStreamId).to.equal(streamLockId);
            expect(retrievedCustomerPlanId).to.equal(customerPlanId);
            console.log(`   🔗 Bidirectional mapping verified successfully`);

            // Step 6: Analyze stream state
            const [isActive, isExpired, accruedAmount, remainingAmount, streamRemainingTime] = 
                await streamLockManager.getStreamStatus(streamLockId);

            console.log(`   📈 Stream Analysis:`);
            console.log(`      - Active: ${isActive}`);
            console.log(`      - Expired: ${isExpired}`);
            console.log(`      - Accrued: ${formatEther(accruedAmount)} TEST`);
            console.log(`      - Remaining: ${formatEther(remainingAmount)} TEST`);
            console.log(`      - Time Remaining: ${streamRemainingTime}s`);

            expect(isActive).to.be.true;
            expect(isExpired).to.be.false;
            expect(remainingAmount).to.equal(totalAmount);
        });

        it("🔍 Should analyze validateUsageWithStream behavior over time", async function () {
            console.log("⏰ Testing validateUsageWithStream with time progression...");

            // Initial validation
            const [canUse1, remainingTime1, returnedStreamId] = await producerContract.validateUsageWithStream(customerPlanId);
            console.log(`   📊 Initial State:`);
            console.log(`      - Can Use: ${canUse1}`);
            console.log(`      - Remaining Time: ${remainingTime1}s`);
            console.log(`      - Stream ID Match: ${returnedStreamId === streamLockId}`);

            expect(canUse1).to.be.true;
            expect(remainingTime1).to.be.greaterThan(0n);

            // Progress time by 25%
            await ethers.provider.send("evm_increaseTime", [900]); // 15 minutes
            await ethers.provider.send("evm_mine", []);

            const [canUse2, remainingTime2] = await producerContract.validateUsageWithStream(customerPlanId);
            console.log(`   📊 After 15 minutes:`);
            console.log(`      - Can Use: ${canUse2}`);
            console.log(`      - Remaining Time: ${remainingTime2}s`);
            console.log(`      - Time Difference: ${remainingTime1 - remainingTime2}s`);

            expect(canUse2).to.be.true;
            expect(remainingTime2).to.be.lessThan(remainingTime1);

            // Progress time by 50%
            await ethers.provider.send("evm_increaseTime", [900]); // 15 more minutes
            await ethers.provider.send("evm_mine", []);

            const [canUse3, remainingTime3] = await producerContract.validateUsageWithStream(customerPlanId);
            console.log(`   📊 After 30 minutes:`);
            console.log(`      - Can Use: ${canUse3}`);
            console.log(`      - Remaining Time: ${remainingTime3}s`);

            expect(canUse3).to.be.true;
            expect(remainingTime3).to.be.lessThan(remainingTime2);

            // Check stream accrual
            const [, , accruedAmount] = await streamLockManager.getStreamStatus(streamLockId);
            console.log(`   💰 Stream accrued so far: ${formatEther(accruedAmount)} TEST`);
            expect(accruedAmount).to.be.greaterThan(0n);
        });

        it("⚡ Should analyze settleStreamOnUsage with quota tracking", async function () {
            console.log("🎯 Testing settleStreamOnUsage with detailed tracking...");

            // Check initial quota
            const customerPlanBefore = await producerStorage.getCustomerPlan(customerPlanId);
            console.log(`   📊 Initial quota: ${customerPlanBefore.remainingQuota}`);

            // Perform usage settlement
            const usageAmount = 1n;
            const tx = await producerContract.connect(customer1).settleStreamOnUsage(customerPlanId, usageAmount);
            const receipt = await tx.wait();

            console.log(`   📊 Settlement gas used: ${receipt.gasUsed.toLocaleString()}`);

            // Check events
            let usageEventFound = false;
            for (const log of receipt.logs) {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    if (parsed.name === "StreamUsageValidated") {
                        usageEventFound = true;
                        console.log(`   ✅ StreamUsageValidated event:`);
                        console.log(`      - Customer Plan ID: ${parsed.args.customerPlanId}`);
                        console.log(`      - Stream Lock ID: ${parsed.args.streamLockId}`);
                        console.log(`      - Customer: ${parsed.args.customer}`);
                        console.log(`      - Can Use: ${parsed.args.canUse}`);
                        break;
                    }
                } catch (e) { /* ignore */ }
            }

            expect(usageEventFound).to.be.true;

            // Check quota after
            const customerPlanAfter = await producerStorage.getCustomerPlan(customerPlanId);
            console.log(`   📊 Quota after usage: ${customerPlanAfter.remainingQuota}`);
            
            expect(customerPlanAfter.remainingQuota).to.equal(customerPlanBefore.remainingQuota - usageAmount);

            // Check stream status after usage
            const [, , accruedAfterUsage] = await streamLockManager.getStreamStatus(streamLockId);
            console.log(`   💰 Stream accrued after usage: ${formatEther(accruedAfterUsage)} TEST`);
        });
    });

    describe("🔬 2. Multiple Customer Scenario Analysis", function () {
        let customer2PlanId: bigint;
        let customer2StreamId: string;

        it("👥 Should handle multiple customers with different stream configurations", async function () {
            console.log("🌐 Testing multiple customer scenarios...");

            // Customer 2 setup
            const totalAmount = parseEther("100");
            await testToken.connect(customer2).approve(producerCloneAddress, totalAmount);

            const customer2PlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer2.address,
                customerAddress: customer2.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: 1n,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            // Create customer 2 with longer stream duration
            const longerDuration = 7200n; // 2 hours
            const tx = await producerContract.connect(customer2).addCustomerPlanWithStream(
                customer2PlanData,
                longerDuration
            );
            const receipt = await tx.wait();

            // Extract customer 2 data
            for (const log of receipt.logs) {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    if (parsed.name === "CustomerPlanWithStreamCreated") {
                        customer2PlanId = parsed.args.customerPlanId;
                        customer2StreamId = parsed.args.streamLockId;
                        break;
                    }
                } catch (e) { /* ignore */ }
            }

            console.log(`   👤 Customer 2 Plan ID: ${customer2PlanId}`);
            console.log(`   🔗 Customer 2 Stream ID: ${customer2StreamId}`);

            // Compare stream durations
            const [, , , , time1] = await streamLockManager.getStreamStatus(streamLockId);
            const [, , , , time2] = await streamLockManager.getStreamStatus(customer2StreamId);

            console.log(`   ⏰ Customer 1 remaining time: ${time1}s`);
            console.log(`   ⏰ Customer 2 remaining time: ${time2}s`);
            
            expect(time2).to.be.greaterThan(time1); // Customer 2 has longer duration
        });

        it("⚖️ Should demonstrate differential expiry behavior", async function () {
            console.log("🔄 Testing differential stream expiry...");

            // Fast forward to expire customer 1's stream but not customer 2's
            const timeToForward = 2700; // 45 minutes (customer 1 had 30 minutes left from previous tests)
            await ethers.provider.send("evm_increaseTime", [timeToForward]);
            await ethers.provider.send("evm_mine", []);

            // Check both customers
            const [canUse1, time1] = await producerContract.validateUsageWithStream(customerPlanId);
            const [canUse2, time2] = await producerContract.validateUsageWithStream(customer2PlanId);

            console.log(`   👤 Customer 1: canUse=${canUse1}, remainingTime=${time1}s`);
            console.log(`   👤 Customer 2: canUse=${canUse2}, remainingTime=${time2}s`);

            // Customer 1's stream should be expired/near expired, Customer 2 should still be active
            expect(time2).to.be.greaterThan(time1);
            expect(canUse2).to.be.true;

            // Both should still have traditional quota validation available
            const customer1Plan = await producerStorage.getCustomerPlan(customerPlanId);
            const customer2Plan = await producerStorage.getCustomerPlan(customer2PlanId);

            console.log(`   📊 Customer 1 quota: ${customer1Plan.remainingQuota}`);
            console.log(`   📊 Customer 2 quota: ${customer2Plan.remainingQuota}`);
        });
    });

    describe("🧪 3. Edge Case and Error Analysis", function () {
        it("🚫 Should handle zero stream duration gracefully", async function () {
            console.log("🔧 Testing zero stream duration scenario...");

            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer1.address,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: 1n,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            // Create customer plan with zero stream duration
            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                0n // Zero duration
            );
            const receipt = await tx.wait();

            // Should not emit CustomerPlanWithStreamCreated event
            let streamEventFound = false;
            for (const log of receipt.logs) {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    if (parsed.name === "CustomerPlanWithStreamCreated") {
                        streamEventFound = true;
                        break;
                    }
                } catch (e) { /* ignore */ }
            }

            expect(streamEventFound).to.be.false;
            console.log(`   ✅ Zero duration correctly handled - no stream created`);

            // Customer should still be able to use service traditionally
            const customerPlanId = await producerStorage.currentCustomerPlanId();
            const [canUse, , streamId] = await producerContract.validateUsageWithStream(customerPlanId);
            
            expect(canUse).to.be.true; // Should fall back to traditional validation
            expect(streamId).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            console.log(`   ✅ Traditional validation working without stream`);
        });

        it("⚠️ Should handle invalid customer plan operations", async function () {
            console.log("🛡️ Testing error handling scenarios...");

            // Test 1: Invalid customer plan ID
            const [canUse, remainingTime, streamId] = await producerContract.validateUsageWithStream(999n);
            expect(canUse).to.be.false;
            expect(remainingTime).to.equal(0n);
            expect(streamId).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            console.log(`   ✅ Invalid customer plan ID handled correctly`);

            // Test 2: Invalid settlement
            await expect(
                producerContract.connect(customer1).settleStreamOnUsage(999n, 1n)
            ).to.be.revertedWith("Customer plan not active");
            console.log(`   ✅ Invalid settlement properly reverted`);

            // Test 3: Unauthorized stream manager change
            await expect(
                producerContract.connect(customer1).setStreamLockManager(ethers.ZeroAddress)
            ).to.be.revertedWith("Ownable: caller is not the owner");
            console.log(`   ✅ Unauthorized access properly prevented`);
        });
    });

    describe("📈 4. Performance and Gas Analysis", function () {
        it("⛽ Should provide detailed gas analysis", async function () {
            console.log("📊 Comprehensive gas analysis...");

            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer1.address,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: 1n,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            // Measure different operations
            console.log(`   📊 Gas Analysis Results:`);

            // 1. addCustomerPlanWithStream with stream
            const tx1 = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                3600n
            );
            const receipt1 = await tx1.wait();
            console.log(`      - addCustomerPlanWithStream (with stream): ${receipt1.gasUsed.toLocaleString()} gas`);

            const newCustomerPlanId = await producerStorage.currentCustomerPlanId();

            // 2. validateUsageWithStream (view function - no gas cost)
            const startTime = Date.now();
            await producerContract.validateUsageWithStream(newCustomerPlanId);
            const endTime = Date.now();
            console.log(`      - validateUsageWithStream (view): ${endTime - startTime}ms execution time`);

            // 3. settleStreamOnUsage
            const tx3 = await producerContract.connect(customer1).settleStreamOnUsage(newCustomerPlanId, 1n);
            const receipt3 = await tx3.wait();
            console.log(`      - settleStreamOnUsage: ${receipt3.gasUsed.toLocaleString()} gas`);

            // 4. Mapping retrieval
            const startTime2 = Date.now();
            await producerContract.getStreamLockIdForCustomerPlan(newCustomerPlanId);
            const endTime2 = Date.now();
            console.log(`      - getStreamLockIdForCustomerPlan: ${endTime2 - startTime2}ms execution time`);

            // Verify gas costs are reasonable
            expect(receipt1.gasUsed).to.be.lessThan(800000n); // Should be under 800k gas
            expect(receipt3.gasUsed).to.be.lessThan(150000n); // Should be under 150k gas

            console.log(`   ✅ All gas costs within acceptable limits`);
        });
    });

    describe("🎯 5. End-to-End Customer Journey", function () {
        it("🌟 Should demonstrate complete customer lifecycle with streams", async function () {
            console.log("🎭 Complete Customer Lifecycle Demonstration:");

            const totalAmount = parseEther("100");
            await testToken.connect(customer1).approve(producerCloneAddress, totalAmount);

            // Step 1: Customer subscribes with stream
            console.log(`   🚀 Step 1: Customer Subscription`);
            const customerPlanData = {
                custumerPlanId: 0n,
                planId: planId,
                planType: 0,
                customerAdress: customer1.address,
                customerAddress: customer1.address,
                producerAddress: producer.address,
                remainingQuota: 5n,
                endDate: 0n,
                status: 1,
                producerId: 1n,
                cloneAddress: producerCloneAddress,
                priceAddress: await testToken.getAddress(),
                startDate: BigInt(Math.floor(Date.now() / 1000))
            };

            const balanceBefore = await testToken.balanceOf(customer1.address);
            const tx = await producerContract.connect(customer1).addCustomerPlanWithStream(
                customerPlanData,
                3600n
            );
            const receipt = await tx.wait();
            const balanceAfter = await testToken.balanceOf(customer1.address);

            let lifecycleCustomerPlanId: bigint = 0n;
            let lifecycleStreamId: string = "";

            for (const log of receipt.logs) {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    if (parsed.name === "CustomerPlanWithStreamCreated") {
                        lifecycleCustomerPlanId = parsed.args.customerPlanId;
                        lifecycleStreamId = parsed.args.streamLockId;
                        break;
                    }
                } catch (e) { /* ignore */ }
            }

            console.log(`      - Plan ID: ${lifecycleCustomerPlanId}`);
            console.log(`      - Stream ID: ${lifecycleStreamId}`);
            console.log(`      - Payment: ${formatEther(balanceBefore - balanceAfter)} TEST`);

            // Step 2: Multiple service usages over time
            console.log(`   📱 Step 2: Service Usage Pattern`);
            for (let i = 1; i <= 3; i++) {
                // Simulate time between usages
                await ethers.provider.send("evm_increaseTime", [600]); // 10 minutes
                await ethers.provider.send("evm_mine", []);

                // Validate access
                const [canUse, remainingTime] = await producerContract.validateUsageWithStream(lifecycleCustomerPlanId);
                expect(canUse).to.be.true;

                // Use service
                await producerContract.connect(customer1).settleStreamOnUsage(lifecycleCustomerPlanId, 1n);

                // Check status
                const customerPlan = await producerStorage.getCustomerPlan(lifecycleCustomerPlanId);
                const [, , accruedAmount] = await streamLockManager.getStreamStatus(lifecycleStreamId);

                console.log(`      - Usage ${i}: Quota=${customerPlan.remainingQuota}, Accrued=${formatEther(accruedAmount)} TEST, TimeLeft=${remainingTime}s`);
            }

            // Step 3: Final quota consumption
            console.log(`   🏁 Step 3: Final Usage`);
            await producerContract.connect(customer1).settleStreamOnUsage(lifecycleCustomerPlanId, 2n);
            
            const finalCustomerPlan = await producerStorage.getCustomerPlan(lifecycleCustomerPlanId);
            expect(finalCustomerPlan.remainingQuota).to.equal(0n);

            // Step 4: Attempt usage after quota exhaustion
            console.log(`   🚫 Step 4: Post-Quota Usage Attempt`);
            await expect(
                producerContract.connect(customer1).settleStreamOnUsage(lifecycleCustomerPlanId, 1n)
            ).to.be.revertedWith("Insufficient quota");

            // Step 5: Final stream analysis
            console.log(`   📊 Step 5: Final Stream Analysis`);
            const [isActive, isExpired, finalAccruedAmount, finalRemainingAmount] = 
                await streamLockManager.getStreamStatus(lifecycleStreamId);

            console.log(`      - Stream Active: ${isActive}`);
            console.log(`      - Stream Expired: ${isExpired}`);
            console.log(`      - Final Accrued: ${formatEther(finalAccruedAmount)} TEST`);
            console.log(`      - Final Remaining: ${formatEther(finalRemainingAmount)} TEST`);

            console.log(`   🎉 Customer lifecycle completed successfully!`);
        });
    });
});

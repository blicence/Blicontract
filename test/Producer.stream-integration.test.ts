import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, parseEther } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DataTypes } from "../typechain-types/contracts/Producer";

describe("Producer - Stream Integration", function () {
    let owner: HardhatEthersSigner;
    let producer: HardhatEthersSigner;
    let customer: HardhatEthersSigner;
    let factory: Contract;
    let producerContract: Contract;
    let streamLockManager: Contract;
    let mockToken: Contract;
    let uriGenerator: Contract;
    let producerStorage: Contract;
    let producerNUsage: Contract;

    const planPrice = parseEther("10");
    const oneUsagePrice = parseEther("1");
    const quotaAmount = 5;

    beforeEach(async function () {
        [owner, producer, customer] = await ethers.getSigners();

        // Deploy TestToken instead of MockERC20
        const TestToken = await ethers.getContractFactory("TestToken");
        mockToken = await TestToken.deploy("Test Token", "TEST", 18, parseEther("1000000"));

        // Deploy StreamLockManager
        const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await StreamLockManager.deploy();
        await streamLockManager.initialize(
            parseEther("1"), // minStreamAmount
            3600, // minStreamDuration (1 hour)
            31536000 // maxStreamDuration (1 year)
        );

        // Deploy URIGenerator
        const URIGenerator = await ethers.getContractFactory("URIGenerator");
        uriGenerator = await URIGenerator.deploy();
        await uriGenerator.initialize();

        // Deploy ProducerStorage
        const ProducerStorage = await ethers.getContractFactory("ProducerStorage");
        producerStorage = await ProducerStorage.deploy();
        await producerStorage.initialize();

        // Deploy ProducerNUsage
        const ProducerNUsage = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await ProducerNUsage.deploy();
        await producerNUsage.initialize();

        // Deploy Factory
        const Factory = await ethers.getContractFactory("Factory");
        factory = await Factory.deploy();
        await factory.initialize(
            streamLockManager.target,
            uriGenerator.target,
            producerStorage.target,
            producerNUsage.target,
            ethers.ZeroAddress, // producerApi
            ethers.ZeroAddress  // producerVestingApi
        );

        // Set up storage
        await producerStorage.setFactory(
            factory.target,
            ethers.ZeroAddress,
            producerNUsage.target,
            ethers.ZeroAddress
        );

        await producerNUsage.setFactory(
            factory.target,
            producerStorage.target
        );

        // Authorize factory in StreamLockManager
        await streamLockManager.setAuthorizedCaller(factory.target, true);

        // Create producer and get clone address
        const producerData: DataTypes.ProducerStruct = {
            producerAddress: producer.address,
            producerName: "Test Producer",
            producerDescription: "Test Description",
            producerImageUrl: "https://test.com/image.png",
            producerUrl: "https://test.com",
            status: 1 // active
        };

        const tx = await factory.connect(producer).createProducer(producerData);
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed?.name === "ProducerCreated";
            } catch {
                return false;
            }
        });

        const cloneAddress = event ? factory.interface.parseLog(event)?.args[1] : null;
        expect(cloneAddress).to.not.be.null;

        producerContract = await ethers.getContractAt("Producer", cloneAddress);

        // Mint tokens to customer
        await mockToken.mint(customer.address, parseEther("1000"));
        await mockToken.connect(customer).approve(cloneAddress, parseEther("1000"));
    });

    describe("Stream-Aware Customer Plan Creation", function () {
        let planId: number;

        beforeEach(async function () {
            // Create a plan first
            const planData: DataTypes.PlanStruct = {
                producerAddress: producer.address,
                name: "Test Plan",
                description: "Test Description",
                maxSupply: 100,
                priceAddress: mockToken.target,
                planType: 1, // nUsage
                status: 1 // active
            };

            const planInfoNUsage: DataTypes.PlanInfoNUsageStruct = {
                oneUsagePrice: oneUsagePrice,
                maxQuota: 10
            };

            const tx = await producerContract.connect(producer).addPlan(planData, planInfoNUsage);
            const receipt = await tx.wait();
            const planEvent = receipt?.logs.find((log: any) => {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    return parsed?.name === "LogAddPlan";
                } catch {
                    return false;
                }
            });

            planId = planEvent ? producerContract.interface.parseLog(planEvent)?.args[0] : 1;
        });

        it("Should create customer plan with stream", async function () {
            const streamDuration = 7 * 24 * 3600; // 7 days

            const customerPlanData: DataTypes.CustomerPlanStruct = {
                custumerPlanId: 0,
                planId: planId,
                customerAddress: customer.address,
                producerAddress: producer.address,
                remainingQuota: quotaAmount,
                endDate: 0,
                planType: 1, // nUsage
                status: 1 // active
            };

            const tx = await producerContract.connect(customer).addCustomerPlanWithStream(
                customerPlanData,
                streamDuration
            );

            const receipt = await tx.wait();
            expect(receipt?.status).to.equal(1);

            // Check for CustomerPlanWithStreamCreated event
            const streamEvent = receipt?.logs.find((log: any) => {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    return parsed?.name === "CustomerPlanWithStreamCreated";
                } catch {
                    return false;
                }
            });

            expect(streamEvent).to.not.be.undefined;

            if (streamEvent) {
                const parsedEvent = producerContract.interface.parseLog(streamEvent);
                const customerPlanId = parsedEvent?.args[0];
                const streamLockId = parsedEvent?.args[1];

                // Verify mappings
                expect(await producerContract.customerPlanToStreamLock(customerPlanId)).to.equal(streamLockId);
                expect(await producerContract.streamLockToCustomerPlan(streamLockId)).to.equal(customerPlanId);
            }
        });

        it("Should create customer plan without stream when duration is 0", async function () {
            const streamDuration = 0; // No stream

            const customerPlanData: DataTypes.CustomerPlanStruct = {
                custumerPlanId: 0,
                planId: planId,
                customerAddress: customer.address,
                producerAddress: producer.address,
                remainingQuota: quotaAmount,
                endDate: 0,
                planType: 1, // nUsage
                status: 1 // active
            };

            const tx = await producerContract.connect(customer).addCustomerPlanWithStream(
                customerPlanData,
                streamDuration
            );

            const receipt = await tx.wait();
            expect(receipt?.status).to.equal(1);

            // Should not have stream event
            const streamEvent = receipt?.logs.find((log: any) => {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    return parsed?.name === "CustomerPlanWithStreamCreated";
                } catch {
                    return false;
                }
            });

            expect(streamEvent).to.be.undefined;
        });
    });

    describe("Stream Usage Validation", function () {
        let customerPlanId: number;
        let streamLockId: string;

        beforeEach(async function () {
            // Create plan
            const planData: DataTypes.PlanStruct = {
                producerAddress: producer.address,
                name: "Test Plan",
                description: "Test Description",
                maxSupply: 100,
                priceAddress: mockToken.target,
                planType: 1, // nUsage
                status: 1 // active
            };

            const planInfoNUsage: DataTypes.PlanInfoNUsageStruct = {
                oneUsagePrice: oneUsagePrice,
                maxQuota: 10
            };

            await producerContract.connect(producer).addPlan(planData, planInfoNUsage);

            // Create customer plan with stream
            const customerPlanData: DataTypes.CustomerPlanStruct = {
                custumerPlanId: 0,
                planId: 1,
                customerAddress: customer.address,
                producerAddress: producer.address,
                remainingQuota: quotaAmount,
                endDate: 0,
                planType: 1, // nUsage
                status: 1 // active
            };

            const tx = await producerContract.connect(customer).addCustomerPlanWithStream(
                customerPlanData,
                7 * 24 * 3600 // 7 days
            );

            const receipt = await tx.wait();
            const streamEvent = receipt?.logs.find((log: any) => {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    return parsed?.name === "CustomerPlanWithStreamCreated";
                } catch {
                    return false;
                }
            });

            if (streamEvent) {
                const parsedEvent = producerContract.interface.parseLog(streamEvent);
                customerPlanId = parsedEvent?.args[0];
                streamLockId = parsedEvent?.args[1];
            }
        });

        it("Should validate usage with active stream", async function () {
            const result = await producerContract.validateUsageWithStream(customerPlanId);
            
            expect(result.canUse).to.be.true;
            expect(result.streamLockId).to.equal(streamLockId);
            expect(result.remainingTime).to.be.greaterThan(0);
        });

        it("Should check stream before usage", async function () {
            const canUse = await producerContract.checkStreamBeforeUsage(customerPlanId, customer.address);
            expect(canUse).to.be.true;
        });

        it("Should settle stream on usage", async function () {
            const usageAmount = 1;
            const success = await producerContract.settleStreamOnUsage(customerPlanId, usageAmount);
            expect(success).to.be.true;
        });
    });

    describe("Stream Mapping Functions", function () {
        it("Should get stream lock ID for customer plan", async function () {
            // Create a customer plan with stream first
            const planData: DataTypes.PlanStruct = {
                producerAddress: producer.address,
                name: "Test Plan",
                description: "Test Description",
                maxSupply: 100,
                priceAddress: mockToken.target,
                planType: 1, // nUsage
                status: 1 // active
            };

            const planInfoNUsage: DataTypes.PlanInfoNUsageStruct = {
                oneUsagePrice: oneUsagePrice,
                maxQuota: 10
            };

            await producerContract.connect(producer).addPlan(planData, planInfoNUsage);

            const customerPlanData: DataTypes.CustomerPlanStruct = {
                custumerPlanId: 0,
                planId: 1,
                customerAddress: customer.address,
                producerAddress: producer.address,
                remainingQuota: quotaAmount,
                endDate: 0,
                planType: 1, // nUsage
                status: 1 // active
            };

            const tx = await producerContract.connect(customer).addCustomerPlanWithStream(
                customerPlanData,
                7 * 24 * 3600 // 7 days
            );

            const receipt = await tx.wait();
            const streamEvent = receipt?.logs.find((log: any) => {
                try {
                    const parsed = producerContract.interface.parseLog(log);
                    return parsed?.name === "CustomerPlanWithStreamCreated";
                } catch {
                    return false;
                }
            });

            if (streamEvent) {
                const parsedEvent = producerContract.interface.parseLog(streamEvent);
                const customerPlanId = parsedEvent?.args[0];
                const streamLockId = parsedEvent?.args[1];

                // Test getter functions
                expect(await producerContract.getStreamLockIdForCustomerPlan(customerPlanId)).to.equal(streamLockId);
                expect(await producerContract.getCustomerPlanIdForStreamLock(streamLockId)).to.equal(customerPlanId);
            }
        });
    });
});

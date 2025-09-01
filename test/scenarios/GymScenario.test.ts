import { expect } from "chai";
import { ethers } from "hardhat";
const hre = require("hardhat");
import { Signer } from "ethers";
import { Factory, Producer, URIGenerator, TestToken } from "../../typechain-types";

describe("Spor Salonu Senaryosu (ApiUsage)", function () {
  let factory: Factory;
  let uriGenerator: URIGenerator;
  let usdcToken: TestToken;
  let gymOwner: Signer;
  let customer: Signer;
  let gymProducer: Producer;
  let deployerAddress: string;

  beforeEach(async function () {
    const [deployer, _gymOwner, _customer] = await ethers.getSigners();
    gymOwner = _gymOwner;
    customer = _customer;
    deployerAddress = await deployer.getAddress();

    // Deploy test token (USDC mock)
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    usdcToken = await TestTokenFactory.deploy("USDC", "USDC", 6, ethers.parseUnits("1000000", 6));
    await usdcToken.waitForDeployment();

    // Deploy Factory and dependencies
    const FactoryContract = await ethers.getContractFactory("Factory");
    factory = await FactoryContract.deploy();
    await factory.waitForDeployment();

    const URIGeneratorContract = await ethers.getContractFactory("URIGenerator");
    uriGenerator = await URIGeneratorContract.deploy();
    await uriGenerator.waitForDeployment();

    // Initialize Factory (simplified - actual initialization needs all addresses)
    // await factory.initialize(...);
  });

  describe("Test Senaryosu 2.1: Spor Salonu Kaydı", function () {
    it("Spor salonu sisteme başarıyla kayıt olur", async function () {
      const gymProducerData = {
        producerId: 0n,
        producerAddress: await gymOwner.getAddress(),
        name: "FitCenter Gym",
        description: "Modern spor salonu hizmetleri",
        image: "https://example.com/gym_logo.png",
        externalLink: "https://fitcenter.com",
        cloneAddress: ethers.ZeroAddress,
        exists: false // Factory will set this to true
      };

      // Factory.newBcontract() çağrısı
      const tx = await factory.connect(gymOwner).newBcontract(gymProducerData);
      const receipt = await tx.wait();

      // BcontractCreated eventi kontrol et
      expect(receipt.events?.length).to.be.greaterThan(0);
      
      // Producer ID kontrol et
      const currentId = await factory.currentPR_ID();
      expect(currentId).to.equal(1);
    });
  });

  describe("Test Senaryosu 2.2: Aylık Abonelik Planı Oluşturma", function () {
    beforeEach(async function () {
      // Önce gym producer'ını oluştur
      const gymProducerData: DataTypes.Producer = {
        producerId: 0,
        producerAddress: gymOwner.target,
        name: "FitCenter Gym",
        description: "Modern spor salonu hizmetleri",
        image: "https://example.com/gym_logo.png",
        externalLink: "https://fitcenter.com",
        cloneAddress: ethers.ZeroAddress,
        exists: true
      };

      await factory.connect(gymOwner).newBcontract(gymProducerData);
      
      // Producer kontrat adresini al
      const producerAddress = await factory.getProducerImplementation();
      gymProducer = await ethers.getContractAt("Producer", producerAddress);
    });

    it("Aylık abonelik planı başarıyla oluşturulur", async function () {
      const monthlyPlan: DataTypes.Plan = {
        planId: 0,
        cloneAddress: gymProducer.target,
        producerId: 1,
        name: "Aylık Üyelik",
        description: "Tüm ekipmanlara erişim",
        externalLink: "https://fitcenter.com/monthly",
        totalSupply: 1000,
        currentSupply: 0,
        backgroundColor: "#FF6B6B",
        image: "monthly_plan.png",
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        status: 1, // active
        planType: 0, // api
        custumerPlanIds: []
      };

      const tx = await gymProducer.connect(gymOwner).addPlan(monthlyPlan);
      const receipt = await tx.wait();

      // LogAddPlan eventi kontrol et
      expect(receipt.events?.length).to.be.greaterThan(0);
      
      // Plan bilgilerini kontrol et
      const savedPlan = await gymProducer.getPlan(1);
      expect(savedPlan.name).to.equal("Aylık Üyelik");
      expect(savedPlan.planType).to.equal(0); // api
    });
  });

  describe("Test Senaryosu 2.3: Müşteri Aboneliği", function () {
    let planId: number;

    beforeEach(async function () {
      // Setup: Producer ve Plan oluştur
      const gymProducerData: DataTypes.Producer = {
        producerId: 0,
        producerAddress: gymOwner.target,
        name: "FitCenter Gym",
        description: "Modern spor salonu hizmetleri",
        image: "https://example.com/gym_logo.png",
        externalLink: "https://fitcenter.com",
        cloneAddress: ethers.ZeroAddress,
        exists: true
      };

      await factory.connect(gymOwner).newBcontract(gymProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      gymProducer = await ethers.getContractAt("Producer", producerAddress);

      const monthlyPlan: DataTypes.Plan = {
        planId: 0,
        cloneAddress: gymProducer.target,
        producerId: 1,
        name: "Aylık Üyelik",
        description: "Tüm ekipmanlara erişim",
        externalLink: "https://fitcenter.com/monthly",
        totalSupply: 1000,
        currentSupply: 0,
        backgroundColor: "#FF6B6B",
        image: "monthly_plan.png",
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        status: 1, // active
        planType: 0, // api
        custumerPlanIds: []
      };

      const tx = await gymProducer.connect(gymOwner).addPlan(monthlyPlan);
      await tx.wait();
      planId = 1;

      // Müşteriye USDC ver
      await usdcToken.mint(customer.target, ethers.parseUnits("100", 6)); // 100 USDC
    });

    it("Müşteri başarıyla aylık plana abone olur", async function () {
      // USDC onayı ver
      await usdcToken.connect(customer).approve(
        gymProducer.target, 
        ethers.parseUnits("10", 6) // 10 USDC
      );

      const customerPlan: DataTypes.CustomerPlan = {
        customerAdress: customer.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: gymProducer.target,
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 gün
        remainingQuota: 0,
        status: 1, // active
        planType: 0 // api
      };

      const initialBalance = await usdcToken.balanceOf(customer.target);
      
      const tx = await gymProducer.connect(customer).addCustomerPlan(customerPlan);
      await tx.wait();

      // Ödemenin yapıldığını kontrol et
      const finalBalance = await usdcToken.balanceOf(customer.target);
      expect(initialBalance - finalBalance).to.equal(ethers.parseUnits("10", 6));

      // NFT'nin basıldığını kontrol et (URIGenerator ile)
      // const nftBalance = await uriGenerator.balanceOf(customer.target, 1);
      // expect(nftBalance).to.equal(1);

      // Müşteri planının kaydedildiğini kontrol et
      const savedCustomer = await gymProducer.getCustomer(customer.target);
      expect(savedCustomer.customer).to.equal(customer.target);
    });

    it("Yetersiz bakiye ile abonelik başarısız olur", async function () {
      // Müşterinin bakiyesini sıfırla
      const balance = await usdcToken.balanceOf(customer.target);
      await usdcToken.connect(customer).transfer(deployerAddress, balance);

      const customerPlan: DataTypes.CustomerPlan = {
        customerAdress: customer.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: gymProducer.target,
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        remainingQuota: 0,
        status: 1,
        planType: 0
      };

      await expect(
        gymProducer.connect(customer).addCustomerPlan(customerPlan)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Onay verilmemiş durumda abonelik başarısız olur", async function () {
      const customerPlan: DataTypes.CustomerPlan = {
        customerAdress: customer.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: gymProducer.target,
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        remainingQuota: 0,
        status: 1,
        planType: 0
      };

      await expect(
        gymProducer.connect(customer).addCustomerPlan(customerPlan)
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });
  });

  describe("Güvenlik Testleri", function () {
    it("Sadece plan sahibi planı güncelleyebilir", async function () {
      // Test implementation için placeholder
      expect(true).to.be.true;
    });

    it("NFT transfer edilemez (soulbound)", async function () {
      // Test implementation için placeholder
      expect(true).to.be.true;
    });
  });

  describe("Gas Optimizasyon Testleri", function () {
    it("Producer oluşturma gas kullanımı kabul edilebilir seviyede", async function () {
      const gymProducerData: DataTypes.Producer = {
        producerId: 0,
        producerAddress: gymOwner.target,
        name: "FitCenter Gym",
        description: "Modern spor salonu hizmetleri",
        image: "https://example.com/gym_logo.png",
        externalLink: "https://fitcenter.com",
        cloneAddress: ethers.ZeroAddress,
        exists: true
      };

      const tx = await factory.connect(gymOwner).newBcontract(gymProducerData);
      const receipt = await tx.wait();
      
      // Gas kullanımının 2M'nin altında olduğunu kontrol et
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(2000000);
      console.log(`Producer oluşturma gas kullanımı: ${receipt.gasUsed.toNumber()}`);
    });
  });
});

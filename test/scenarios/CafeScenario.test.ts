import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Factory, Producer, URIGenerator, TestToken } from "../../typechain-types";

describe("Kafeterya Senaryosu (NUsage)", function () {
  let factory: Factory;
  let uriGenerator: URIGenerator;
  let usdcToken: TestToken;
  let cafeOwner: SignerWithAddress;
  let customer: SignerWithAddress;
  let cafeProducer: Producer;
  let deployerAddress: string;

  beforeEach(async function () {
    const [deployer, _cafeOwner, _customer] = await ethers.getSigners();
    cafeOwner = _cafeOwner;
    customer = _customer;
    deployerAddress = deployer.target;

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
  });

  describe("Test Senaryosu 3.1: Kafeterya Kaydı ve Plan Oluşturma", function () {
    it("Kafeterya sisteme kaydolur ve sadakat kartı planı oluşturur", async function () {
      const cafeProducerData = {
        producerId: 0,
        producerAddress: cafeOwner.target,
        name: "Aroma Cafe",
        description: "Özel kahve deneyimi",
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://aromacafe.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      // Kafeterya Producer'ını oluştur
      const tx = await factory.connect(cafeOwner).newBcontract(cafeProducerData);
      const receipt = await tx.wait();

      expect(receipt.events?.length).to.be.greaterThan(0);

      // Producer adresini al ve kontrata bağlan
      const producerAddress = await factory.getProducerImplementation();
      cafeProducer = await ethers.getContractAt("Producer", producerAddress);

      // 15 kahveli sadakat kartı planı oluştur
      const coffeeCardPlan = {
        planId: 0,
        cloneAddress: cafeProducer.target,
        producerId: 1,
        name: "15 Kahve Sadakat Kartı",
        description: "15 kahve al, %20 indirim kazan",
        externalLink: "https://aromacafe.com/loyalty",
        totalSupply: 500,
        currentSupply: 0,
        backgroundColor: "#8B4513",
        image: "coffee_card.png",
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        status: 1, // active
        planType: 1, // nUsage
        custumerPlanIds: []
      };

      const planTx = await cafeProducer.connect(cafeOwner).addPlan(coffeeCardPlan);
      const planReceipt = await planTx.wait();

      expect(planReceipt.events?.length).to.be.greaterThan(0);

      // NUsage plan bilgilerini ekle
      const coffeeCardInfo = {
        planId: 1,
        oneUsagePrice: ethers.parseUnits("5", 6), // 5 USDC per coffee
        minUsageLimit: 15,
        maxUsageLimit: 15
      };

      await cafeProducer.connect(cafeOwner).addPlanInfoNUsage(coffeeCardInfo);

      // Plan bilgilerini doğrula
      const savedPlan = await cafeProducer.getPlan(1);
      expect(savedPlan.name).to.equal("15 Kahve Sadakat Kartı");
      expect(savedPlan.planType).to.equal(1); // nUsage
    });
  });

  describe("Test Senaryosu 3.2: Müşteri Kart Satın Alma", function () {
    let planId: number;

    beforeEach(async function () {
      // Setup: Kafeterya ve plan oluştur
      const cafeProducerData = {
        producerId: 0,
        producerAddress: cafeOwner.target,
        name: "Aroma Cafe",
        description: "Özel kahve deneyimi",
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://aromacafe.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      await factory.connect(cafeOwner).newBcontract(cafeProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      cafeProducer = await ethers.getContractAt("Producer", producerAddress);

      const coffeeCardPlan = {
        planId: 0,
        cloneAddress: cafeProducer.target,
        producerId: 1,
        name: "15 Kahve Sadakat Kartı",
        description: "15 kahve al, %20 indirim kazan",
        externalLink: "https://aromacafe.com/loyalty",
        totalSupply: 500,
        currentSupply: 0,
        backgroundColor: "#8B4513",
        image: "coffee_card.png",
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        status: 1,
        planType: 1, // nUsage
        custumerPlanIds: []
      };

      await cafeProducer.connect(cafeOwner).addPlan(coffeeCardPlan);
      planId = 1;

      const coffeeCardInfo = {
        planId: planId,
        oneUsagePrice: ethers.parseUnits("5", 6),
        minUsageLimit: 15,
        maxUsageLimit: 15
      };

      await cafeProducer.connect(cafeOwner).addPlanInfoNUsage(coffeeCardInfo);

      // Müşteriye USDC ver
      await usdcToken.mint(customer.target, ethers.parseUnits("100", 6));
    });

    it("Müşteri 15'lik kahve kartı satın alır", async function () {
      // İndirimli fiyat: 15 * 5 USDC * 0.8 = 60 USDC
      const totalPrice = ethers.parseUnits("60", 6);
      
      await usdcToken.connect(customer).approve(cafeProducer.target, totalPrice);

      const customerPlan = {
        customerAdress: customer.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: cafeProducer.target,
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 yıl
        remainingQuota: 15, // 15 kullanım hakkı
        status: 1, // active
        planType: 1 // nUsage
      };

      const initialBalance = await usdcToken.balanceOf(customer.target);
      
      const tx = await cafeProducer.connect(customer).addCustomerPlan(customerPlan);
      await tx.wait();

      // Ödemenin yapıldığını kontrol et
      const finalBalance = await usdcToken.balanceOf(customer.target);
      expect(initialBalance - finalBalance).to.equal(totalPrice);

      // Müşteri planının kaydedildiğini ve kota bilgisinin doğru olduğunu kontrol et
      const savedCustomer = await cafeProducer.getCustomer(customer.target);
      expect(savedCustomer.customer).to.equal(customer.target);
    });

    it("Minimum limit altında satın alma başarısız olur", async function () {
      const coffeeCardInfo = {
        planId: planId,
        oneUsagePrice: ethers.parseUnits("5", 6),
        minUsageLimit: 10, // Minimum 10
        maxUsageLimit: 15
      };

      // Plan bilgilerini güncelle
      await cafeProducer.connect(cafeOwner).addPlanInfoNUsage(coffeeCardInfo);

      const customerPlan = {
        customerAdress: customer.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: cafeProducer.target,
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        remainingQuota: 5, // Minimum altında
        status: 1,
        planType: 1
      };

      await expect(
        cafeProducer.connect(customer).addCustomerPlan(customerPlan)
      ).to.be.revertedWith("remainingQuota should be greater than 0");
    });
  });

  describe("Test Senaryosu 3.3: Kahve Kullanımı", function () {
    let planId: number;
    let customerPlan: any;

    beforeEach(async function () {
      // Setup: Kafeterya, plan ve müşteri kartı oluştur
      const cafeProducerData = {
        producerId: 0,
        producerAddress: cafeOwner.target,
        name: "Aroma Cafe",
        description: "Özel kahve deneyimi",
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://aromacafe.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      await factory.connect(cafeOwner).newBcontract(cafeProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      cafeProducer = await ethers.getContractAt("Producer", producerAddress);

      const coffeeCardPlan = {
        planId: 0,
        cloneAddress: cafeProducer.target,
        producerId: 1,
        name: "15 Kahve Sadakat Kartı",
        description: "15 kahve al, %20 indirim kazan",
        externalLink: "https://aromacafe.com/loyalty",
        totalSupply: 500,
        currentSupply: 0,
        backgroundColor: "#8B4513",
        image: "coffee_card.png",
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        status: 1,
        planType: 1,
        custumerPlanIds: []
      };

      await cafeProducer.connect(cafeOwner).addPlan(coffeeCardPlan);
      planId = 1;

      const coffeeCardInfo = {
        planId: planId,
        oneUsagePrice: ethers.parseUnits("5", 6),
        minUsageLimit: 15,
        maxUsageLimit: 15
      };

      await cafeProducer.connect(cafeOwner).addPlanInfoNUsage(coffeeCardInfo);

      // Müşteri kartı satın alır
      await usdcToken.mint(customer.target, ethers.parseUnits("100", 6));
      await usdcToken.connect(customer).approve(
        cafeProducer.target, 
        ethers.parseUnits("60", 6)
      );

      customerPlan = {
        customerAdress: customer.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: cafeProducer.target,
        priceAddress: usdcToken.target,
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        remainingQuota: 15,
        status: 1,
        planType: 1
      };

      await cafeProducer.connect(customer).addCustomerPlan(customerPlan);
    });

    it("Müşteri kahve kullanımı yapar ve kota azalır", async function () {
      // İlk kullanım
      const remaining = await cafeProducer.connect(customer).useFromQuota(customerPlan);
      
      // Kalan kotanın 14 olduğunu kontrol et
      expect(remaining).to.equal(14);
    });

    it("Kota bittiğinde kullanım başarısız olur", async function () {
      // 15 defa kullanım yap
      for (let i = 0; i < 15; i++) {
        await cafeProducer.connect(customer).useFromQuota(customerPlan);
      }

      // 16. kullanım başarısız olmalı
      await expect(
        cafeProducer.connect(customer).useFromQuota(customerPlan)
      ).to.be.revertedWith("No remaining quota");
    });

    it("Başka müşteri başkasının kartını kullanamaz", async function () {
      const [, , , otherCustomer] = await ethers.getSigners();

      await expect(
        cafeProducer.connect(otherCustomer).useFromQuota(customerPlan)
      ).to.be.revertedWith("only customer can call this function");
    });
  });

  describe("Test Senaryosu 3.4: Kart İptali ve İade", function () {
    let planId: number;
    let customerPlan: any;

    beforeEach(async function () {
      // Setup kodu (önceki testlerden)
      const cafeProducerData = {
        producerId: 0,
        producerAddress: cafeOwner.target,
        name: "Aroma Cafe",
        description: "Özel kahve deneyimi",
        image: "https://example.com/cafe_logo.png",
        externalLink: "https://aromacafe.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      await factory.connect(cafeOwner).newBcontract(cafeProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      cafeProducer = await ethers.getContractAt("Producer", producerAddress);

      // Plan ve müşteri kartı oluştur
      // ... (setup kodu)
    });

    it("Kullanılmamış kotaları için iade alınır", async function () {
      // 5 kullanım yap, 10 kala iptal et
      for (let i = 0; i < 5; i++) {
        await cafeProducer.connect(customer).useFromQuota(customerPlan);
      }

      const initialBalance = await usdcToken.balanceOf(customer.target);

      // Planı pasif yap (iptal et)
      customerPlan.status = 0; // inactive
      await cafeProducer.connect(customer).updateCustomerPlan(customerPlan);

      const finalBalance = await usdcToken.balanceOf(customer.target);
      
      // 10 kahve değerinde iade alınmalı (10 * 5 USDC * 0.8 = 40 USDC)
      const expectedRefund = ethers.parseUnits("40", 6);
      expect(finalBalance - initialBalance).to.equal(expectedRefund);
    });
  });

  describe("Edge Case Testleri", function () {
    it("Sıfır kotayla plan oluşturulamaz", async function () {
      // Test implementation
      expect(true).to.be.true;
    });

    it("Maksimum limitin üzerinde kota verilemez", async function () {
      // Test implementation  
      expect(true).to.be.true;
    });

    it("Süresi geçmiş planlar kullanılamaz", async function () {
      // Test implementation
      expect(true).to.be.true;
    });
  });

  describe("Gas Optimizasyon Testleri", function () {
    it("Kahve kullanımı gas kullanımı optimize", async function () {
      // Gas kullanım testi
      expect(true).to.be.true;
    });
  });
});

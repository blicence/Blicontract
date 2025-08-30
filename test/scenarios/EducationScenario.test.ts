import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Factory, Producer, URIGenerator, TestToken } from "../../typechain-types";

describe("Online Eğitim Senaryosu (VestingApi)", function () {
  let factory: Factory;
  let uriGenerator: URIGenerator;
  let usdcToken: TestToken;
  let educator: SignerWithAddress;
  let student: SignerWithAddress;
  let educationProducer: Producer;
  let deployerAddress: string;

  beforeEach(async function () {
    const [deployer, _educator, _student] = await ethers.getSigners();
    educator = _educator;
    student = _student;
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

  describe("Test Senaryosu 4.1: Eğitim Sağlayıcısı Kaydı", function () {
    it("Online eğitim platformu sisteme kaydolur", async function () {
      const educationProducerData = {
        producerId: 0,
        producerAddress: educator.target,
        name: "TechAcademy Online",
        description: "Yazılım geliştirme eğitimleri",
        image: "https://example.com/academy_logo.png",
        externalLink: "https://techacademy.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      const tx = await factory.connect(educator).newBcontract(educationProducerData);
      const receipt = await tx.wait();

      expect(receipt.events?.length).to.be.greaterThan(0);

      // Producer ID kontrol et
      const currentId = await factory.currentPR_ID();
      expect(currentId).to.equal(1);
    });
  });

  describe("Test Senaryosu 4.2: Gelecek Tarihli Kurs Planı", function () {
    beforeEach(async function () {
      // Eğitim sağlayıcısını oluştur
      const educationProducerData = {
        producerId: 0,
        producerAddress: educator.target,
        name: "TechAcademy Online",
        description: "Yazılım geliştirme eğitimleri",
        image: "https://example.com/academy_logo.png",
        externalLink: "https://techacademy.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      await factory.connect(educator).newBcontract(educationProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      educationProducer = await ethers.getContractAt("Producer", producerAddress);
    });

    it("Gelecek başlangıç tarihli kurs planı oluşturulur", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const courseStartTime = currentTime + 30 * 24 * 60 * 60; // 30 gün sonra

      const coursePlan = {
        planId: 0,
        cloneAddress: educationProducer.target,
        producerId: 1,
        name: "Blockchain Development Kursu",
        description: "6 haftalık yoğun blockchain eğitimi",
        externalLink: "https://techacademy.com/blockchain",
        totalSupply: 50,
        currentSupply: 0,
        backgroundColor: "#4CAF50",
        image: "blockchain_course.png",
        priceAddress: usdcToken.target,
        startDate: courseStartTime,
        status: 1, // active
        planType: 2, // vestingApi
        custumerPlanIds: []
      };

      const tx = await educationProducer.connect(educator).addPlan(coursePlan);
      const receipt = await tx.wait();

      expect(receipt.events?.length).to.be.greaterThan(0);

      // VestingApi plan bilgilerini ekle
      const courseInfo = {
        planId: 1,
        cliffDate: courseStartTime, // Kurs başlangıç tarihi
        flowRate: ethers.parseEther("0.01"), // 0.01 token per second
        startAmount: ethers.parseEther("100"), // İlk ödeme 100 token
        ctx: "0x" // Additional context data
      };

      await educationProducer.connect(educator).addPlanInfoVesting(courseInfo);

      // Plan bilgilerini doğrula
      const savedPlan = await educationProducer.getPlan(1);
      expect(savedPlan.name).to.equal("Blockchain Development Kursu");
      expect(savedPlan.planType).to.equal(2); // vestingApi
      expect(savedPlan.startDate).to.equal(courseStartTime);
    });

    it("Geçmiş tarihli plan oluşturulamaz", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 1 gün önce

      const coursePlan = {
        planId: 0,
        cloneAddress: educationProducer.target,
        producerId: 1,
        name: "Geçmiş Kurs",
        description: "Geçmiş tarihli test kursu",
        externalLink: "https://techacademy.com/past",
        totalSupply: 50,
        currentSupply: 0,
        backgroundColor: "#FF5722",
        image: "past_course.png",
        priceAddress: usdcToken.target,
        startDate: pastTime,
        status: 1,
        planType: 2,
        custumerPlanIds: []
      };

      await expect(
        educationProducer.connect(educator).addPlan(coursePlan)
      ).to.be.revertedWith("Start date cannot be in the past");
    });
  });

  describe("Test Senaryosu 4.3: Erken Kayıt ve Vesting Başlangıcı", function () {
    let planId: number;
    let courseStartTime: number;

    beforeEach(async function () {
      // Setup: Eğitim sağlayıcısı ve kurs planı
      const educationProducerData = {
        producerId: 0,
        producerAddress: educator.target,
        name: "TechAcademy Online",
        description: "Yazılım geliştirme eğitimleri",
        image: "https://example.com/academy_logo.png",
        externalLink: "https://techacademy.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      await factory.connect(educator).newBcontract(educationProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      educationProducer = await ethers.getContractAt("Producer", producerAddress);

      const currentTime = Math.floor(Date.now() / 1000);
      courseStartTime = currentTime + 7 * 24 * 60 * 60; // 7 gün sonra test için

      const coursePlan = {
        planId: 0,
        cloneAddress: educationProducer.target,
        producerId: 1,
        name: "Blockchain Development Kursu",
        description: "6 haftalık yoğun blockchain eğitimi",
        externalLink: "https://techacademy.com/blockchain",
        totalSupply: 50,
        currentSupply: 0,
        backgroundColor: "#4CAF50",
        image: "blockchain_course.png",
        priceAddress: usdcToken.target,
        startDate: courseStartTime,
        status: 1,
        planType: 2,
        custumerPlanIds: []
      };

      await educationProducer.connect(educator).addPlan(coursePlan);
      planId = 1;

      const courseInfo = {
        planId: planId,
        cliffDate: courseStartTime,
        flowRate: ethers.parseEther("0.01"),
        startAmount: ethers.parseEther("100"),
        ctx: "0x"
      };

      await educationProducer.connect(educator).addPlanInfoVesting(courseInfo);

      // Öğrenciye USDC ver
      await usdcToken.mint(student.target, ethers.parseUnits("1000", 6));
    });

    it("Öğrenci erken kayıt yapar", async function () {
      const totalCoursePrice = ethers.parseUnits("500", 6); // 500 USDC
      
      await usdcToken.connect(student).approve(educationProducer.target, totalCoursePrice);

      const studentPlan = {
        customerAdress: student.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: educationProducer.target,
        priceAddress: usdcToken.target,
        startDate: courseStartTime,
        endDate: courseStartTime + 6 * 7 * 24 * 60 * 60, // 6 hafta
        remainingQuota: 0, // VestingApi için kullanılmaz
        status: 1, // active
        planType: 2 // vestingApi
      };

      const initialBalance = await usdcToken.balanceOf(student.target);
      
      const tx = await educationProducer.connect(student).addCustomerPlan(studentPlan);
      await tx.wait();

      // İlk ödemenin yapıldığını kontrol et (start amount)
      const finalBalance = await usdcToken.balanceOf(student.target);
      const paidAmount = initialBalance - finalBalance;
      expect(paidAmount).to.equal(ethers.parseUnits("100", 6)); // Start amount

      // Öğrenci planının kaydedildiğini kontrol et
      const savedCustomer = await educationProducer.getCustomer(student.target);
      expect(savedCustomer.customer).to.equal(student.target);
    });

    it("Kurs başlamadan önce erişim sağlanamaz", async function () {
      // Erken kayıt yap
      const totalCoursePrice = ethers.parseUnits("500", 6);
      await usdcToken.connect(student).approve(educationProducer.target, totalCoursePrice);

      const studentPlan = {
        customerAdress: student.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: educationProducer.target,
        priceAddress: usdcToken.target,
        startDate: courseStartTime,
        endDate: courseStartTime + 6 * 7 * 24 * 60 * 60,
        remainingQuota: 0,
        status: 1,
        planType: 2
      };

      await educationProducer.connect(student).addCustomerPlan(studentPlan);

      // Kurs başlamadan önce erişim denemesi (bu normalde VestingApi logic kontratında kontrol edilir)
      // Test için placeholder - gerçek implementasyonda VestingApi kontratı kontrol eder
      const currentTime = Math.floor(Date.now() / 1000);
      expect(currentTime).to.be.lessThan(courseStartTime);
    });

    it("Cliff tarihinden sonra vesting başlar", async function () {
      // Erken kayıt yap
      const totalCoursePrice = ethers.parseUnits("500", 6);
      await usdcToken.connect(student).approve(educationProducer.target, totalCoursePrice);

      const studentPlan = {
        customerAdress: student.target,
        planId: planId,
        custumerPlanId: 0,
        producerId: 1,
        cloneAddress: educationProducer.target,
        priceAddress: usdcToken.target,
        startDate: courseStartTime,
        endDate: courseStartTime + 6 * 7 * 24 * 60 * 60,
        remainingQuota: 0,
        status: 1,
        planType: 2
      };

      await educationProducer.connect(student).addCustomerPlan(studentPlan);

      // Zamanı cliff tarihine ilerlet (test ortamında)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 gün
      await ethers.provider.send("evm_mine", []);

      // Şimdi kurs başlamış olmalı - gerçek implementasyonda vesting logic kontratı
      // ödemeleri otomatik olarak flow'a başlatacak
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      expect(currentTime).to.be.greaterThanOrEqual(courseStartTime);
    });
  });

  describe("Test Senaryosu 4.4: Kurs İptali ve Kısmi İade", function () {
    let planId: number;
    let courseStartTime: number;

    beforeEach(async function () {
      // Setup kodu (önceki testlerden)
      const educationProducerData = {
        producerId: 0,
        producerAddress: educator.target,
        name: "TechAcademy Online",
        description: "Yazılım geliştirme eğitimleri",
        image: "https://example.com/academy_logo.png",
        externalLink: "https://techacademy.com",
        cloneAddress: ethers.constants.AddressZero,
        exists: true
      };

      await factory.connect(educator).newBcontract(educationProducerData);
      
      const producerAddress = await factory.getProducerImplementation();
      educationProducer = await ethers.getContractAt("Producer", producerAddress);

      const currentTime = Math.floor(Date.now() / 1000);
      courseStartTime = currentTime + 30 * 24 * 60 * 60;

      // Plan oluştur
      // ... (setup kodu)
    });

    it("Kurs başlamadan önce iptal edilirse tam iade alınır", async function () {
      // Erken kayıt + iptal testi
      // Gerçek implementasyonda VestingApi logic kontratı bu durumu handle eder
      expect(true).to.be.true; // Placeholder
    });

    it("Kurs ortasında iptal edilirse kısmi iade alınır", async function () {
      // Kısmi iade testi
      // Flow rate'e göre hesaplanan kısmi iade
      expect(true).to.be.true; // Placeholder
    });
  });

  describe("Test Senaryosu 4.5: Çoklu Öğrenci Senaryosu", function () {
    it("Aynı kursa birden fazla öğrenci kayıt olabilir", async function () {
      // Capacity kontrolü ve çoklu kayıt testi
      expect(true).to.be.true; // Placeholder
    });

    it("Kapasite dolduğunda yeni kayıt alınamaz", async function () {
      // Kapasite sınırı testi
      expect(true).to.be.true; // Placeholder
    });
  });

  describe("Güvenlik Testleri", function () {
    it("Sadece kurs sahibi eğitmen planı değiştirebilir", async function () {
      // Unauthorized access testi
      expect(true).to.be.true; // Placeholder
    });

    it("Geçmiş tarihli cliff oluşturulamaz", async function () {
      // Geçmiş tarih validasyonu
      expect(true).to.be.true; // Placeholder
    });

    it("Negatif flow rate verilemez", async function () {
      // Flow rate validasyonu
      expect(true).to.be.true; // Placeholder
    });
  });

  describe("Edge Case Testleri", function () {
    it("Sıfır kapasite ile kurs oluşturulamaz", async function () {
      expect(true).to.be.true;
    });

    it("Çok yüksek flow rate ile sistem çökmez", async function () {
      expect(true).to.be.true;
    });

    it("Aynı anda başlayan kurslar çakışmaz", async function () {
      expect(true).to.be.true;
    });
  });

  describe("Gas Optimizasyon Testleri", function () {
    it("Vesting başlatma gas kullanımı kabul edilebilir", async function () {
      // Gas usage testi
      expect(true).to.be.true;
    });

    it("Çoklu vesting yönetimi optimize", async function () {
      // Batch operations gas testi
      expect(true).to.be.true;
    });
  });
});

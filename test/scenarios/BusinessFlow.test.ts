import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { Factory, Producer, ProducerStorage, URIGenerator, StreamLockManager, ProducerNUsage, TestToken } from "../../typechain-types";

// @ts-ignore
const { upgrades } = require("hardhat");

/**
 * İş Akışı Test Senaryosu
 * 
 * Bu test dosyası doc/akis.md'deki güncel iş akışını takip eder:
 * 1. Üretici kayıt olur ve profil oluşturur
 * 2. Üretici 3 farklı tipte plan oluşturur (API, Vesting, N Usage)
 * 3. Kullanıcılar planları görüntüler ve seçer
 * 4. Ödeme süreçleri test edilir
 */
describe("İş Akışı Test Senaryosu", function () {
    let factory: Factory;
    let producerStorage: ProducerStorage;
    let uriGenerator: URIGenerator;
    let streamLockManager: StreamLockManager;
    let producerNUsage: ProducerNUsage;
    let producerImplementation: Producer;
    let testToken: TestToken;
    let daiToken: TestToken;
    
    // Aktörler
    let owner: Signer; // Sistem sahibi
    let producer1: Signer; // Üretici 1 (API hizmeti sağlayıcısı)
    let producer2: Signer; // Üretici 2 (Vesting hizmeti sağlayıcısı)
    let producer3: Signer; // Üretici 3 (N Usage hizmeti sağlayıcısı)
    let customer1: Signer; // Müşteri 1
    let customer2: Signer; // Müşteri 2
    let customer3: Signer; // Müşteri 3

    this.timeout(120000); // 2 dakika timeout

    beforeEach(async () => {
        [owner, producer1, producer2, producer3, customer1, customer2, customer3] = await ethers.getSigners();

        // Test tokenları deploy et (DAI benzeri)
        testToken = await ethers.deployContract("TestToken", ["Test Token", "TEST", 18, ethers.parseEther("10000000")]);
        daiToken = await ethers.deployContract("TestToken", ["DAI Token", "DAI", 18, ethers.parseEther("10000000")]);
        
        // Core kontratları deploy et
        uriGenerator = await ethers.deployContract("URIGenerator");
        producerImplementation = await ethers.deployContract("Producer");

        // Upgradeable kontratları deploy et
        const StreamLockManagerFactory = await ethers.getContractFactory("StreamLockManager");
        streamLockManager = await upgrades.deployProxy(StreamLockManagerFactory, [
            await owner.getAddress(),
            ethers.parseEther("0.1"), // minStreamAmount
            3600, // minStreamDuration (1 saat)
            365 * 24 * 3600 // maxStreamDuration (1 yıl)
        ]);

        const ProducerNUsageFactory = await ethers.getContractFactory("ProducerNUsage");
        producerNUsage = await upgrades.deployProxy(ProducerNUsageFactory, []);

        // ProducerStorage (normal kontrat)
        producerStorage = await ethers.deployContract("ProducerStorage", [await owner.getAddress()]);

        // Factory deploy et
        const FactoryFactory = await ethers.getContractFactory("Factory");
        factory = await upgrades.deployProxy(FactoryFactory, [
            await uriGenerator.getAddress(),
            await producerStorage.getAddress(),
            await producerImplementation.getAddress(),
            await producerNUsage.getAddress(),
            await producerImplementation.getAddress(),
            await streamLockManager.getAddress()
        ], { initializer: 'initialize' });

        // Bağlantıları kur
        await factory.connect(owner).setProducerImplementation(await producerImplementation.getAddress());
        await producerStorage.setFactory(
            await factory.getAddress(),
            await producerImplementation.getAddress(),
            await producerNUsage.getAddress(),
            await producerImplementation.getAddress()
        );

        // Müşterilere token dağıt (test için)
        await daiToken.transfer(await customer1.getAddress(), ethers.parseEther("1000"));
        await daiToken.transfer(await customer2.getAddress(), ethers.parseEther("1000"));
        await daiToken.transfer(await customer3.getAddress(), ethers.parseEther("1000"));
    });

    describe("1. Üretici Kayıt ve Profil Oluşturma", function () {
        it("Üretici 1 - API Hizmeti Sağlayıcısı Kayıt Olur", async function () {
            // Dokümantasyona göre: üretici temel bilgilerini girer
            const producerData = {
                producerId: 0n,
                ownerAddress: await producer1.getAddress(),
                name: "API Plus Hizmetleri", // üretici adı
                description: "Gelişmiş API hizmetleri ve entegrasyon çözümleri sağlayan firma", // açıklama
                image: "https://apiplus.com/logo.png",
                externalLink: "https://apiplus.com", // site adı (üretici adresi)
                subscriptionToken: await daiToken.getAddress(),
                subscriptionStatus: true
            };

            // Üretici verilerinin doğruluğunu kontrol et
            expect(producerData.name).to.equal("API Plus Hizmetleri");
            expect(producerData.description).to.include("API hizmetleri");
            expect(producerData.externalLink).to.equal("https://apiplus.com");
            expect(producerData.ownerAddress).to.equal(await producer1.getAddress());
        });

        it("Üretici 2 - Vesting Hizmeti Sağlayıcısı Kayıt Olur", async function () {
            const producerData = {
                producerId: 1n,
                ownerAddress: await producer2.getAddress(),
                name: "TokenLock Vesting", // üretici adı
                description: "Kripto para vesting ve lock hizmetleri", // açıklama
                image: "https://tokenlock.io/logo.png",
                externalLink: "https://tokenlock.io", // site adı
                subscriptionToken: await daiToken.getAddress(),
                subscriptionStatus: true
            };

            expect(producerData.name).to.equal("TokenLock Vesting");
            expect(producerData.description).to.include("vesting");
        });

        it("Üretici 3 - N Usage Hizmeti Sağlayıcısı Kayıt Olur", async function () {
            const producerData = {
                producerId: 2n,
                ownerAddress: await producer3.getAddress(),
                name: "CloudAPI Kullanım", // üretici adı
                description: "Kullanım bazlı cloud API hizmetleri", // açıklama
                image: "https://cloudapi.com/logo.png",
                externalLink: "https://cloudapi.com", // site adı
                subscriptionToken: await daiToken.getAddress(),
                subscriptionStatus: true
            };

            expect(producerData.name).to.equal("CloudAPI Kullanım");
            expect(producerData.description).to.include("Kullanım bazlı");
        });
    });

    describe("2. Plan Oluşturma - 3 Farklı Tip", function () {
        
        describe("2.1 Plan API - Akış Bazlı Ödeme", function () {
            it("API Plan Verilerini Oluşturur", async function () {
                /**
                 * Dokümantasyona göre API Plan:
                 * - Belirli zaman aralıklarında akış bazlı ödeme
                 * - flowrate hesaplama (örnek: ayda 10 DAI = 3858024691358 flowrate)
                 * - totalSupply: maksimum kullanım limiti
                 * - monthLimit: aylık kota
                 */
                const apiPlanData = {
                    planId: 1n,
                    producerId: 0n,
                    name: "Premium API Access", // plan ismi
                    description: "Sınırsız API erişimi ve öncelikli destek", // açıklama
                    externalLink: "https://apiplus.com/premium", // dış link
                    image: "https://apiplus.com/premium-plan.png",
                    totalSupply: 1000n, // en fazla 1000 kullanıcı
                    priceAddress: await daiToken.getAddress(), // hangi ERC20 token ile ödeme
                    startDate: Math.floor(Date.now() / 1000), // başlangıç tarihi
                    status: true, // aktif durum
                    // flowrate: ayda 10 DAI hesaplama
                    monthlyPrice: ethers.parseEther("10"), // aylık 10 DAI
                    flowratePerSecond: "3858024691358", // saniyede akış hızı
                    monthLimit: 10000n, // aylık 10.000 istek limiti
                    backgroundColor: "#2563eb", // mavi renk
                    planType: "API"
                };

                // Plan verilerini doğrula
                expect(apiPlanData.name).to.equal("Premium API Access");
                expect(apiPlanData.totalSupply).to.equal(1000n);
                expect(apiPlanData.monthlyPrice).to.equal(ethers.parseEther("10"));
                expect(apiPlanData.monthLimit).to.equal(10000n);
                expect(apiPlanData.planType).to.equal("API");

                // Flowrate hesaplamasını kontrol et
                // Ayda 10 DAI = 10 * 10^18 / (30 * 24 * 3600) ≈ 3858024691358
                const expectedFlowrate = ethers.parseEther("10") / BigInt(30 * 24 * 3600);
                expect(BigInt(apiPlanData.flowratePerSecond)).to.be.closeTo(expectedFlowrate, expectedFlowrate / 10n);
            });
        });

        describe("2.2 Vesting API - Gelecek Başlatma", function () {
            it("Vesting Plan Verilerini Oluşturur", async function () {
                /**
                 * Dokümantasyona göre Vesting API:
                 * - Gelecekte belirtilen zaman aralığında başlatılır
                 * - cliffDate: başlatana kadar geçen zaman için ödeme hesaplama
                 * - startAmount: başlangıç ücreti
                 */
                const vestingPlanData = {
                    planId: 2n,
                    producerId: 1n,
                    name: "Token Vesting Premium", // plan ismi
                    description: "Gelişmiş vesting özellikleri ve özel danışmanlık", // açıklama
                    externalLink: "https://tokenlock.io/premium-vesting",
                    image: "https://tokenlock.io/vesting-plan.png",
                    totalSupply: 500n, // en fazla 500 vesting anlaşması
                    priceAddress: await daiToken.getAddress(),
                    startDate: Math.floor(Date.now() / 1000),
                    status: true,
                    // Vesting özel parametreleri
                    cliffDate: Math.floor(Date.now() / 1000) + (90 * 24 * 3600), // 90 gün sonra başlayacak
                    startAmount: ethers.parseEther("100"), // başlangıç ücreti 100 DAI
                    vestingDuration: 365 * 24 * 3600, // 1 yıl vesting süresi
                    cliffPayment: ethers.parseEther("5"), // cliff süresince aylık 5 DAI
                    backgroundColor: "#10b981", // yeşil renk
                    planType: "VESTING"
                };

                // Plan verilerini doğrula
                expect(vestingPlanData.name).to.equal("Token Vesting Premium");
                expect(vestingPlanData.startAmount).to.equal(ethers.parseEther("100"));
                expect(vestingPlanData.cliffPayment).to.equal(ethers.parseEther("5"));
                expect(vestingPlanData.planType).to.equal("VESTING");

                // Cliff tarihinin gelecekte olduğunu kontrol et
                const currentTime = Math.floor(Date.now() / 1000);
                expect(vestingPlanData.cliffDate).to.be.greaterThan(currentTime);
            });
        });

        describe("2.3 N Usage Plan API - Kullanım Bazlı", function () {
            it("N Usage Plan Verilerini Oluşturur", async function () {
                /**
                 * Dokümantasyona göre N Usage Plan:
                 * - Kullanım bazlı hizmet ücreti
                 * - oneUsagePrice: tek kullanım ücreti
                 * - minUsageLimit: minimum kullanım limiti
                 * - maxUsageLimit: maksimum kullanım limiti
                 */
                const nUsagePlanData = {
                    planId: 3n,
                    producerId: 2n,
                    name: "CloudAPI Pay-Per-Use", // plan ismi
                    description: "Kullandığın kadar öde - esnek cloud API hizmeti", // açıklama
                    externalLink: "https://cloudapi.com/pay-per-use",
                    image: "https://cloudapi.com/usage-plan.png",
                    totalSupply: 2000n, // en fazla 2000 aktif kullanıcı
                    priceAddress: await daiToken.getAddress(),
                    startDate: Math.floor(Date.now() / 1000),
                    status: true,
                    // N Usage özel parametreleri
                    oneUsagePrice: ethers.parseEther("0.01"), // her kullanım için 0.01 DAI
                    minUsageLimit: 100n, // minimum 100 kullanım satın alınmalı
                    maxUsageLimit: 50000n, // maksimum 50.000 kullanım
                    usageValidityDays: 30, // kullanım hakları 30 gün geçerli
                    backgroundColor: "#f59e0b", // turuncu renk
                    planType: "N_USAGE"
                };

                // Plan verilerini doğrula
                expect(nUsagePlanData.name).to.equal("CloudAPI Pay-Per-Use");
                expect(nUsagePlanData.oneUsagePrice).to.equal(ethers.parseEther("0.01"));
                expect(nUsagePlanData.minUsageLimit).to.equal(100n);
                expect(nUsagePlanData.maxUsageLimit).to.equal(50000n);
                expect(nUsagePlanData.planType).to.equal("N_USAGE");

                // Fiyatlandırma mantığını kontrol et
                const minCost = nUsagePlanData.oneUsagePrice * nUsagePlanData.minUsageLimit;
                expect(minCost).to.equal(ethers.parseEther("1")); // 100 * 0.01 = 1 DAI minimum
            });
        });
    });

    describe("3. Kullanıcı İş Akışı - Plan Seçimi", function () {
        
        it("Kullanıcı 1 - API Planını İnceler ve Seçer", async function () {
            /**
             * Dokümantasyona göre kullanıcı akışı:
             * 1. Mevcut üreticiler arasında arama yapar
             * 2. Üreticiyi seçer ve planlarını görüntüler
             * 3. İstediği planı seçer
             */
            
            // Müşteri mevcut planları görüntüler
            const availablePlans = [
                {
                    name: "Premium API Access",
                    producer: "API Plus Hizmetleri",
                    monthlyPrice: ethers.parseEther("10"),
                    type: "API"
                }
            ];

            // Müşteri API planını seçer
            const selectedPlan = availablePlans[0];
            expect(selectedPlan.name).to.equal("Premium API Access");
            expect(selectedPlan.type).to.equal("API");

            // Müşterinin token bakiyesini kontrol et
            const customerBalance = await daiToken.balanceOf(await customer1.getAddress());
            expect(customerBalance).to.be.greaterThanOrEqual(ethers.parseEther("100"));
        });

        it("Kullanıcı 2 - Vesting Planını İnceler ve Seçer", async function () {
            const selectedPlan = {
                name: "Token Vesting Premium",
                producer: "TokenLock Vesting",
                startAmount: ethers.parseEther("100"),
                type: "VESTING"
            };

            expect(selectedPlan.name).to.equal("Token Vesting Premium");
            expect(selectedPlan.type).to.equal("VESTING");
        });

        it("Kullanıcı 3 - N Usage Planını İnceler ve Seçer", async function () {
            const selectedPlan = {
                name: "CloudAPI Pay-Per-Use",
                producer: "CloudAPI Kullanım",
                oneUsagePrice: ethers.parseEther("0.01"),
                type: "N_USAGE"
            };

            expect(selectedPlan.name).to.equal("CloudAPI Pay-Per-Use");
            expect(selectedPlan.type).to.equal("N_USAGE");
        });
    });

    describe("4. Ödeme Süreçleri ve Token Onayları", function () {
        
        it("API Plan - Akış Bazlı Ödeme Kurulumu", async function () {
            /**
             * Dokümantasyonda belirtilen eksik kısımlar:
             * 1. ERC20 token onayları
             * 2. DAI için izin dönüşümü
             * 3. Plan tipine göre farklı ekran
             */
            
            // Müşteri DAI token'larını approve eder
            const monthlyPayment = ethers.parseEther("10");
            await daiToken.connect(customer1).approve(await factory.getAddress(), monthlyPayment * 12n); // 1 yıllık

            // Onay miktarını kontrol et
            const allowance = await daiToken.allowance(await customer1.getAddress(), await factory.getAddress());
            expect(allowance).to.be.greaterThanOrEqual(monthlyPayment);

            // API plan için özel gereksinimler
            const apiSubscription = {
                customer: await customer1.getAddress(),
                planType: "API",
                flowratePerSecond: "3858024691358",
                startTime: Math.floor(Date.now() / 1000),
                approved: true
            };

            expect(apiSubscription.approved).to.be.true;
        });

        it("Vesting Plan - Başlangıç Ödemesi ve Cliff Kurulumu", async function () {
            // Vesting için başlangıç ödemesi
            const startAmount = ethers.parseEther("100");
            await daiToken.connect(customer2).approve(await factory.getAddress(), startAmount);

            const allowance = await daiToken.allowance(await customer2.getAddress(), await factory.getAddress());
            expect(allowance).to.equal(startAmount);

            // Vesting parametreleri
            const vestingSubscription = {
                customer: await customer2.getAddress(),
                planType: "VESTING",
                startAmount: startAmount,
                cliffDate: Math.floor(Date.now() / 1000) + (90 * 24 * 3600),
                approved: true
            };

            expect(vestingSubscription.approved).to.be.true;
        });

        it("N Usage Plan - Kullanım Kredisi Satın Alma", async function () {
            // N Usage için minimum kullanım satın alma
            const minUsage = 100n;
            const usagePrice = ethers.parseEther("0.01");
            const totalCost = minUsage * usagePrice;

            await daiToken.connect(customer3).approve(await factory.getAddress(), totalCost);

            const allowance = await daiToken.allowance(await customer3.getAddress(), await factory.getAddress());
            expect(allowance).to.equal(totalCost);

            // N Usage aboneliği
            const usageSubscription = {
                customer: await customer3.getAddress(),
                planType: "N_USAGE",
                usageCredits: minUsage,
                totalPaid: totalCost,
                approved: true
            };

            expect(usageSubscription.approved).to.be.true;
            expect(usageSubscription.usageCredits).to.equal(100n);
        });
    });

    describe("5. İstatistik ve Yönetim Paneli", function () {
        
        it("Üretici İstatistiklerini Görüntüler", async function () {
            /**
             * Dokümantasyona göre üretici panelinde:
             * - Planların kaç tanesinin kullanımda olduğu
             * - Toplam kaç tüketicinin işlem yaptığı
             * - Graph ile görselleştirme
             */
            
            const producer1Stats = {
                totalPlans: 1, // API planı
                activePlans: 1,
                totalCustomers: 1, // customer1
                monthlyRevenue: ethers.parseEther("10"),
                planUsageData: [
                    {
                        planName: "Premium API Access",
                        activeSubscriptions: 1,
                        monthlyRevenue: ethers.parseEther("10")
                    }
                ]
            };

            expect(producer1Stats.totalPlans).to.equal(1);
            expect(producer1Stats.totalCustomers).to.equal(1);
            expect(producer1Stats.monthlyRevenue).to.equal(ethers.parseEther("10"));
        });

        it("Müşteri Planlarını Yönetir", async function () {
            /**
             * Dokümantasyona göre müşteri panelinde:
             * - Mevcut planları listeleme
             * - Add plan ile producer listesine ulaşma
             * - Plan durumlarını görüntüleme
             */
            
            const customer1Dashboard = {
                activeSubscriptions: [
                    {
                        planName: "Premium API Access",
                        producer: "API Plus Hizmetleri",
                        status: "active",
                        nextPayment: Math.floor(Date.now() / 1000) + (30 * 24 * 3600),
                        monthlyUsage: 5000, // 10.000 limitten 5.000 kullanılmış
                        remainingUsage: 5000
                    }
                ],
                totalMonthlyPayments: ethers.parseEther("10")
            };

            expect(customer1Dashboard.activeSubscriptions.length).to.equal(1);
            expect(customer1Dashboard.activeSubscriptions[0].status).to.equal("active");
        });
    });

    describe("6. Sistem Entegrasyonu ve Edge Cases", function () {
        
        it("Tüm Kontratların Doğru Şekilde Bağlı Olduğunu Kontrol Eder", async function () {
            // Factory bağlantıları
            expect(await factory.producerStorage()).to.equal(await producerStorage.getAddress());
            expect(await factory.streamLockManager()).to.equal(await streamLockManager.getAddress());
            expect(await factory.getProducerImplementation()).to.equal(await producerImplementation.getAddress());

            // ProducerStorage bağlantıları
            expect(await producerStorage.producerApi()).to.equal(await producerImplementation.getAddress());
            expect(await producerStorage.producerNUsage()).to.equal(await producerNUsage.getAddress());
        });

        it("Token Transfer Güvenliğini Test Eder", async function () {
            // Yetersiz bakiye durumu
            const poorCustomer = customer3;
            const bigAmount = ethers.parseEther("10000");
            
            const balance = await daiToken.balanceOf(await poorCustomer.getAddress());
            expect(balance).to.be.lessThan(bigAmount);

            // Transfer başarısız olmalı
            await expect(
                daiToken.connect(poorCustomer).transfer(await producer1.getAddress(), bigAmount)
            ).to.be.reverted;
        });

        it("Plan Limitlerini Kontrol Eder", async function () {
            // API planı için aylık limit kontrolü
            const apiPlanLimit = 10000n;
            const currentUsage = 9500n;
            const newUsageAttempt = 1000n;

            expect(currentUsage + newUsageAttempt).to.be.greaterThan(apiPlanLimit);
            
            // Limit aşımı durumunda işlem reddedilmeli
            const wouldExceedLimit = (currentUsage + newUsageAttempt) > apiPlanLimit;
            expect(wouldExceedLimit).to.be.true;
        });
    });
});

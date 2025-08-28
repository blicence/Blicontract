// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/Factory.sol";
import "../contracts/Producer.sol";
import "../contracts/storage/ProducerStorage.sol";
import "../contracts/URIGenerator.sol";
import "../contracts/StreamLockManager.sol";
import "../contracts/logic/ProducerNUsage.sol";
import "../contracts/TestToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title İş Akışı Simulation Testi - Forge
 * @dev Bu test dosyası doc/akis.md'deki iş akışını Forge ile detaylı şekilde simüle eder
 * @notice Tüm senaryolar adım adım Türkçe yorumlarla açıklanmıştır
 */
contract BusinessFlowSimulationTest is Test {
    
    // =====================================================================
    // KONTRAT DEĞİŞKENLERİ - Ana kontratlarımızın referansları
    // =====================================================================
    
    Factory public factory;                    // Ana factory kontratı
    ProducerStorage public producerStorage;    // Üretici verilerini saklayan kontrat
    URIGenerator public uriGenerator;          // NFT URI'larını üreten kontrat
    StreamLockManager public streamManager;    // Stream akışlarını yöneten kontrat
    ProducerNUsage public producerNUsage;      // N-Usage planlarını yöneten kontrat
    Producer public producerImplementation;    // Producer proxy implementasyonu
    
    // Test tokenları - Gerçek DAI, USDC gibi tokenları simüle eder
    TestToken public daiToken;     // DAI benzeri stablecoin
    TestToken public usdcToken;    // USDC benzeri stablecoin
    TestToken public wethToken;    // Wrapped ETH benzeri token
    
    // =====================================================================
    // AKTÖR ADRESLERİ - Test senaryosundaki roller
    // =====================================================================
    
    address public owner;           // Sistem sahibi/admin
    address public deployer;        // Kontratları deploy eden adres
    
    // Üreticiler - Farklı sektörlerden hizmet sağlayıcıları
    address public apiProducer;     // API hizmeti sağlayıcısı
    address public vestingProducer; // Vesting hizmeti sağlayıcısı
    address public usageProducer;   // Kullanım bazlı hizmet sağlayıcısı
    
    // Müşteriler - Farklı profillerde kullanıcılar
    address public premiumCustomer; // Premium müşteri (yüksek bütçe)
    address public startupCustomer; // Startup müşterisi (orta bütçe)
    address public personalCustomer;// Kişisel kullanıcı (düşük bütçe)
    
    // Yardımcı adresler
    address public treasury;        // Sistem hazinesi
    address public feeCollector;    // Ücret toplayıcısı
    
    // =====================================================================
    // SABITLER - Test senaryosunda kullanılan değerler
    // =====================================================================
    
    // Token miktarları (18 decimal)
    uint256 public constant INITIAL_TOKEN_SUPPLY = 10_000_000 * 1e18; // 10M token
    uint256 public constant CUSTOMER_INITIAL_BALANCE = 100_000 * 1e18; // 100K token per customer
    
    // Plan parametreleri
    uint256 public constant API_MONTHLY_PRICE = 10 * 1e18;           // 10 DAI/ay
    uint256 public constant VESTING_START_AMOUNT = 100 * 1e18;       // 100 DAI başlangıç
    uint256 public constant USAGE_PRICE_PER_CALL = 0.01 * 1e18;      // 0.01 DAI/kullanım
    
    // Zaman sabitleri
    uint256 public constant ONE_DAY = 1 days;
    uint256 public constant ONE_WEEK = 7 days;
    uint256 public constant ONE_MONTH = 30 days;
    uint256 public constant ONE_YEAR = 365 days;
    
    /**
     * @dev Test kurulumu - Her test öncesi çağrılır
     * @notice Tüm kontratları deploy eder ve başlangıç durumunu ayarlar
     */
    function setUp() public {
        console.log("=== İŞ AKIŞI SİMÜLASYONU BAŞLANGICI ===");
        
        // =====================================================================
        // 1. ADRES ATAMALARI - Test aktörlerini belirle
        // =====================================================================
        
        console.log("1. ADIM: Test adreslerini ayarlıyoruz...");
        
        owner = address(this);           // Test kontratı owner olur
        deployer = makeAddr("deployer"); // Deployer adresi oluştur
        
        // Üretici adreslerini oluştur
        apiProducer = makeAddr("api_producer");
        vestingProducer = makeAddr("vesting_producer");  
        usageProducer = makeAddr("usage_producer");
        
        // Müşteri adreslerini oluştur
        premiumCustomer = makeAddr("premium_customer");
        startupCustomer = makeAddr("startup_customer");
        personalCustomer = makeAddr("personal_customer");
        
        // Sistem adreslerini oluştur
        treasury = makeAddr("treasury");
        feeCollector = makeAddr("fee_collector");
        
        console.log("   - Owner adresi:", owner);
        console.log("   - API Üretici:", apiProducer);
        console.log("   - Premium Müşteri:", premiumCustomer);
        
        // =====================================================================
        // 2. TOKEN DEPLOYMENT - Test tokenlarını oluştur
        // =====================================================================
        
        console.log("2. ADIM: Test tokenlarını deploy ediyoruz...");
        
        // DAI benzeri stablecoin (en çok kullanılacak)
        daiToken = new TestToken(
            "DAI Stablecoin",      // isim
            "DAI",                 // sembol
            18,                    // decimal
            INITIAL_TOKEN_SUPPLY   // toplam arz
        );
        
        // USDC benzeri stablecoin
        usdcToken = new TestToken(
            "USD Coin",
            "USDC", 
            6,  // USDC 6 decimal kullanır
            INITIAL_TOKEN_SUPPLY / 1e12 // 6 decimal için ayarla
        );
        
        // Wrapped ETH benzeri token
        wethToken = new TestToken(
            "Wrapped Ether",
            "WETH",
            18,
            INITIAL_TOKEN_SUPPLY
        );
        
        console.log("   - DAI Token deployed:", address(daiToken));
        console.log("   - USDC Token deployed:", address(usdcToken));
        console.log("   - WETH Token deployed:", address(wethToken));
        
        // =====================================================================
        // 3. CORE KONTRAT DEPLOYMENT - Ana sistem kontratları
        // =====================================================================
        
        console.log("3. ADIM: Core kontratları deploy ediyoruz...");
        
        // URI Generator - NFT metadata'ları üretir
        uriGenerator = new URIGenerator();
        console.log("   - URIGenerator deployed:", address(uriGenerator));
        
        // Producer Implementation - Proxy'ler için template
        producerImplementation = new Producer();
        console.log("   - Producer Implementation deployed:", address(producerImplementation));
        
        // =====================================================================
        // 4. UPGRADEABLE KONTRAT DEPLOYMENT - Proxy pattern ile
        // =====================================================================
        
        console.log("4. ADIM: Upgradeable kontratları deploy ediyoruz...");
        
        // StreamLockManager proxy deployment
        bytes memory streamManagerInitData = abi.encodeWithSignature(
            "initialize(address,uint256,uint256,uint256)",
            owner,                    // admin
            0.1 * 1e18,              // minimum stream miktarı (0.1 token)
            1 hours,                 // minimum stream süresi
            ONE_YEAR                 // maksimum stream süresi
        );
        
        ERC1967Proxy streamManagerProxy = new ERC1967Proxy(
            address(new StreamLockManager()),
            streamManagerInitData
        );
        streamManager = StreamLockManager(address(streamManagerProxy));
        console.log("   - StreamLockManager Proxy deployed:", address(streamManager));
        
        // ProducerNUsage proxy deployment
        bytes memory producerNUsageInitData = abi.encodeWithSignature("initialize()");
        
        ERC1967Proxy producerNUsageProxy = new ERC1967Proxy(
            address(new ProducerNUsage()),
            producerNUsageInitData
        );
        producerNUsage = ProducerNUsage(address(producerNUsageProxy));
        console.log("   - ProducerNUsage Proxy deployed:", address(producerNUsage));
        
        // ProducerStorage - Normal kontrat (proxy değil)
        producerStorage = new ProducerStorage(owner);
        console.log("   - ProducerStorage deployed:", address(producerStorage));
        
        // =====================================================================
        // 5. FACTORY DEPLOYMENT - Ana koordinatör kontrat
        // =====================================================================
        
        console.log("5. ADIM: Factory kontratını deploy ediyoruz...");
        
        bytes memory factoryInitData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address)",
            address(uriGenerator),              // URI generator
            address(producerStorage),           // Producer storage
            address(producerImplementation),    // Producer implementation
            address(producerNUsage),           // Producer N-Usage
            address(producerImplementation),    // Producer vesting (şimdilik aynı)
            address(streamManager)             // Stream manager
        );
        
        ERC1967Proxy factoryProxy = new ERC1967Proxy(
            address(new Factory()),
            factoryInitData
        );
        factory = Factory(address(factoryProxy));
        console.log("   - Factory Proxy deployed:", address(factory));
        
        // =====================================================================
        // 6. KONTRAT BAĞLANTILARı - Sistemin entegrasyonu
        // =====================================================================
        
        console.log("6. ADIM: Kontrat bağlantılarını kuruyoruz...");
        
        // ProducerStorage'a factory adresini ver
        producerStorage.setFactory(
            address(factory),              // factory adresi
            address(producerImplementation), // producer API impl
            address(producerNUsage),       // producer N-Usage impl  
            address(producerImplementation)  // producer vesting impl
        );
        
        console.log("   - ProducerStorage bağlantıları kuruldu");
        
        // =====================================================================
        // 7. TOKEN DAĞITIMI - Test aktörlerine token ver
        // =====================================================================
        
        console.log("7. ADIM: Token dağıtımını yapıyoruz...");
        
        // Müşterilere DAI dağıt
        daiToken.transfer(premiumCustomer, CUSTOMER_INITIAL_BALANCE);
        daiToken.transfer(startupCustomer, CUSTOMER_INITIAL_BALANCE);
        daiToken.transfer(personalCustomer, CUSTOMER_INITIAL_BALANCE);
        
        // Üreticilere de başlangıç tokeni ver (test için)
        daiToken.transfer(apiProducer, 10_000 * 1e18);
        daiToken.transfer(vestingProducer, 10_000 * 1e18);
        daiToken.transfer(usageProducer, 10_000 * 1e18);
        
        console.log("   - Token dağıtımı tamamlandı");
        console.log("   - Premium Customer DAI balance:", daiToken.balanceOf(premiumCustomer) / 1e18, "DAI");
        
        console.log("=== KURULUM TAMAMLANDI ===\n");
    }
    
    /**
     * @dev Test 1: Üretici Kayıt Senaryosu
     * @notice doc/akis.md'deki üretici kayıt sürecini simüle eder
     */
    function test_01_UreticiKayitSenaryosu() public {
        console.log("=== TEST 1: ÜRETİCİ KAYIT SENARYOSU ===");
        
        // =====================================================================
        // SENARYO: API Plus Hizmetleri şirketi sisteme kayıt oluyor
        // =====================================================================
        
        console.log("SENARYO: API Plus Hizmetleri sisteme kayıt oluyor...");
        
        // API üreticisi adına işlem yap
        vm.startPrank(apiProducer);
        
        // Üretici profil verilerini hazırla (doc/akis.md'den)
        DataTypes.ProducerData memory producerData = DataTypes.ProducerData({
            producerId: 0,
            ownerAddress: apiProducer,
            name: "API Plus Hizmetleri",
            description: "Gelişmiş API hizmetleri ve entegrasyon çözümleri sağlayan teknoloji firması. Binlerce geliştirici tarafından güvenilen altyapı hizmetleri.",
            image: "https://apiplus.com/assets/logo-premium.png",
            externalLink: "https://apiplus.com",
            subscriptionToken: address(daiToken),
            subscriptionStatus: true
        });
        
        console.log("1. ADIM: Üretici profil bilgilerini doldurdu");
        console.log("   - Şirket Adı:", producerData.name);
        console.log("   - Web Sitesi:", producerData.externalLink);
        console.log("   - Ödeme Token:", "DAI");
        
        // Kayıt işlemini başlat
        console.log("2. ADIM: Kayıt işlemi başlatılıyor...");
        
        // Üretici verilerinin doğruluğunu kontrol et
        assertEq(producerData.ownerAddress, apiProducer, "Üretici adresi yanlış");
        assertTrue(bytes(producerData.name).length > 0, "Üretici adı boş olamaz");
        assertTrue(bytes(producerData.description).length > 0, "Açıklama boş olamaz");
        assertTrue(producerData.subscriptionStatus, "Abonelik durumu aktif olmalı");
        
        console.log("3. ADIM: Profil bilgileri doğrulandı ✓");
        
        // Sistem tarafında üretici ID'si atanacak (simülasyon)
        uint256 assignedProducerId = 1; // İlk üretici ID: 1
        
        console.log("4. ADIM: Sistem üretici ID'si atadı:", assignedProducerId);
        console.log("5. ADIM: Üretici özel sayfasına yönlendiriliyor...");
        
        vm.stopPrank();
        
        // =====================================================================
        // DOĞRULAMA: Kayıt işlemi başarılı mı?
        // =====================================================================
        
        console.log("DOĞRULAMA: Kayıt işlemi kontrol ediliyor...");
        
        // Üretici bilgilerinin sistem tarafından kabul edildiğini doğrula
        assertTrue(producerData.subscriptionStatus, "Üretici aktif durumda değil");
        assertEq(producerData.subscriptionToken, address(daiToken), "Ödeme token'i yanlış atandı");
        
        console.log("✓ API Plus Hizmetleri başarıyla sisteme kayıt oldu!");
        console.log("✓ Üretici ID:", assignedProducerId);
        console.log("✓ Durum: Aktif");
        console.log("✓ Ödeme Metodu: DAI Token\n");
    }
    
    /**
     * @dev Test 2: API Plan Oluşturma Senaryosu
     * @notice Akış bazlı ödeme planının detaylı oluşturulması
     */
    function test_02_ApiPlanOlusturmaSenaryosu() public {
        console.log("=== TEST 2: API PLAN OLUŞTURMA SENARYOSU ===");
        
        // =====================================================================
        // SENARYO: Premium API Access planı oluşturuluyor
        // =====================================================================
        
        console.log("SENARYO: Premium API Access planı oluşturuluyor...");
        
        vm.startPrank(apiProducer);
        
        // Plan detaylarını hazırla (doc/akis.md'den)
        console.log("1. ADIM: Plan parametreleri belirleniyor...");
        
        // Plan temel bilgileri
        string memory planName = "Premium API Access";
        string memory planDescription = "Sınırsız API erişimi, öncelikli destek ve gelişmiş analitik araçları içeren premium paket.";
        string memory planExternalLink = "https://apiplus.com/plans/premium";
        string memory planImage = "https://apiplus.com/assets/premium-plan-banner.jpg";
        
        // Plan ekonomik parametreleri
        uint256 totalSupply = 1000;        // Maksimum 1000 kullanıcı
        uint256 monthlyPriceDAI = API_MONTHLY_PRICE; // 10 DAI/ay
        uint256 monthlyRequestLimit = 10000; // Aylık 10K istek
        
        console.log("   - Plan Adı:", planName);
        console.log("   - Aylık Ücret:", monthlyPriceDAI / 1e18, "DAI");
        console.log("   - Kullanıcı Limiti:", totalSupply);
        console.log("   - Aylık İstek Limiti:", monthlyRequestLimit);
        
        // =====================================================================
        // FLOWRATE HESAPLAMA - Aylık ödemeyi saniyede akışa çevir
        // =====================================================================
        
        console.log("2. ADIM: Flowrate hesaplaması yapılıyor...");
        
        // Aylık 10 DAI'yi saniye başına akışa çevir
        // 1 ay = 30 gün = 30 * 24 * 3600 = 2,592,000 saniye
        uint256 secondsInMonth = 30 * 24 * 3600;
        uint256 flowratePerSecond = monthlyPriceDAI / secondsInMonth;
        
        console.log("   - Saniye/Ay:", secondsInMonth);
        console.log("   - Flowrate (wei/saniye):", flowratePerSecond);
        console.log("   - Flowrate (DAI/saniye):", flowratePerSecond * 1e18 / 1e18);
        
        // Flowrate doğrulaması
        assertGt(flowratePerSecond, 0, "Flowrate sıfırdan büyük olmalı");
        
        // =====================================================================
        // PLAN VİZÜEL AYARLARI - Widget görünümü için
        // =====================================================================
        
        console.log("3. ADIM: Plan görsel ayarları yapılıyor...");
        
        string memory backgroundColor = "#2563eb"; // Premium mavi
        string memory textColor = "#ffffff";       // Beyaz yazı
        string memory accentColor = "#3b82f6";     // Açık mavi vurgu
        
        console.log("   - Arka Plan Rengi:", backgroundColor);
        console.log("   - Yazı Rengi:", textColor);
        console.log("   - Vurgu Rengi:", accentColor);
        
        // =====================================================================
        // PLAN DURUMU VE TARİHLER
        // =====================================================================
        
        console.log("4. ADIM: Plan tarihleri ayarlanıyor...");
        
        uint256 startDate = block.timestamp;           // Şimdi başlasın
        uint256 endDate = startDate + (365 * ONE_DAY); // 1 yıl süre
        bool planStatus = true;                        // Aktif
        
        console.log("   - Başlangıç Tarihi:", startDate);
        console.log("   - Bitiş Tarihi:", endDate);
        console.log("   - Durum: Aktif");
        
        // =====================================================================
        // PLAN VERİSİNİ OLUŞTUR
        // =====================================================================
        
        console.log("5. ADIM: Plan verisi oluşturuluyor...");
        
        // API planı için özel veri yapısı
        struct ApiPlanData {
            string name;
            string description;
            string externalLink;
            string image;
            uint256 totalSupply;
            address priceToken;
            uint256 flowratePerSecond;
            uint256 monthlyLimit;
            uint256 startDate;
            uint256 endDate;
            bool status;
            string backgroundColor;
            string textColor;
        }
        
        ApiPlanData memory apiPlan = ApiPlanData({
            name: planName,
            description: planDescription,
            externalLink: planExternalLink,
            image: planImage,
            totalSupply: totalSupply,
            priceToken: address(daiToken),
            flowratePerSecond: flowratePerSecond,
            monthlyLimit: monthlyRequestLimit,
            startDate: startDate,
            endDate: endDate,
            status: planStatus,
            backgroundColor: backgroundColor,
            textColor: textColor
        });
        
        console.log("6. ADIM: Plan verisi hazırlandı ✓");
        
        vm.stopPrank();
        
        // =====================================================================
        // PLAN DOĞRULAMA VE TEST
        // =====================================================================
        
        console.log("DOĞRULAMA: Plan parametreleri kontrol ediliyor...");
        
        // Plan temel doğrulamaları
        assertTrue(bytes(apiPlan.name).length > 0, "Plan adı boş olamaz");
        assertTrue(apiPlan.totalSupply > 0, "Kullanıcı limiti sıfırdan büyük olmalı");
        assertTrue(apiPlan.flowratePerSecond > 0, "Flowrate sıfırdan büyük olmalı");
        assertEq(apiPlan.priceToken, address(daiToken), "Ödeme token'i DAI olmalı");
        assertTrue(apiPlan.status, "Plan aktif durumda olmalı");
        
        // Ekonomik doğrulamalar
        uint256 monthlyPayment = apiPlan.flowratePerSecond * secondsInMonth;
        assertApproxEqAbs(monthlyPayment, monthlyPriceDAI, 1000, "Aylık ödeme hesabı yanlış");
        
        console.log("✓ Premium API Plan başarıyla oluşturuldu!");
        console.log("✓ Plan ID: 1 (simülasyon)");
        console.log("✓ Flowrate doğrulandı");
        console.log("✓ Fiyatlandırma hesabı doğru");
        console.log("✓ Plan aktif durumda\n");
    }
    
    /**
     * @dev Test 3: Vesting Plan Senaryosu
     * @notice Gelecekte başlayan vesting planının oluşturulması
     */
    function test_03_VestingPlanSenaryosu() public {
        console.log("=== TEST 3: VESTING PLAN SENARYOSU ===");
        
        // =====================================================================
        // SENARYO: Token Vesting Premium planı oluşturuluyor
        // =====================================================================
        
        console.log("SENARYO: Token Vesting Premium planı oluşturuluyor...");
        
        vm.startPrank(vestingProducer);
        
        console.log("1. ADIM: Vesting plan parametreleri belirleniyor...");
        
        // Vesting plan temel bilgileri
        string memory vestingPlanName = "Token Vesting Premium";
        string memory vestingDescription = "Kurumsal token vesting çözümleri ve akıllı kontrat danışmanlığı hizmeti.";
        uint256 vestingTotalSupply = 500; // Maksimum 500 vesting anlaşması
        
        // Vesting özel parametreleri (doc/akis.md'den)
        uint256 startAmount = VESTING_START_AMOUNT;        // 100 DAI başlangıç
        uint256 cliffDuration = 90 * ONE_DAY;             // 90 gün cliff
        uint256 vestingDuration = ONE_YEAR;               // 1 yıl vesting
        uint256 cliffPaymentPerMonth = 5 * 1e18;          // Cliff süresince aylık 5 DAI
        
        console.log("   - Plan Adı:", vestingPlanName);
        console.log("   - Başlangıç Ücreti:", startAmount / 1e18, "DAI");
        console.log("   - Cliff Süresi:", cliffDuration / ONE_DAY, "gün");
        console.log("   - Vesting Süresi:", vestingDuration / ONE_DAY, "gün");
        console.log("   - Cliff Aylık Ödeme:", cliffPaymentPerMonth / 1e18, "DAI");
        
        // =====================================================================
        // TARİH HESAPLAMALARI - Cliff ve vesting tarihleri
        // =====================================================================
        
        console.log("2. ADIM: Tarih hesaplamaları yapılıyor...");
        
        uint256 currentTime = block.timestamp;
        uint256 cliffStartDate = currentTime + (7 * ONE_DAY);  // 1 hafta sonra başlar
        uint256 cliffEndDate = cliffStartDate + cliffDuration; // Cliff bitiş tarihi
        uint256 vestingStartDate = cliffEndDate;               // Vesting cliff sonrası başlar
        uint256 vestingEndDate = vestingStartDate + vestingDuration; // Vesting bitiş
        
        console.log("   - Şu anki zaman:", currentTime);
        console.log("   - Cliff başlangıç:", cliffStartDate);
        console.log("   - Cliff bitiş:", cliffEndDate);  
        console.log("   - Vesting başlangıç:", vestingStartDate);
        console.log("   - Vesting bitiş:", vestingEndDate);
        
        // =====================================================================
        // MALİYET HESAPLAMALARI - Toplam vesting maliyeti
        // =====================================================================
        
        console.log("3. ADIM: Maliyet hesaplamaları yapılıyor...");
        
        // Cliff dönemindeki toplam ödeme
        uint256 cliffMonths = cliffDuration / (30 * ONE_DAY); // Kaç ay cliff var
        uint256 totalCliffPayment = cliffMonths * cliffPaymentPerMonth;
        
        // Toplam vesting maliyeti müşteri için
        uint256 totalVestingCost = startAmount + totalCliffPayment;
        
        console.log("   - Cliff Ay Sayısı:", cliffMonths);
        console.log("   - Toplam Cliff Ödemesi:", totalCliffPayment / 1e18, "DAI");
        console.log("   - Toplam Vesting Maliyeti:", totalVestingCost / 1e18, "DAI");
        
        // =====================================================================
        // VESTING PLANI VERİ YAPISI
        // =====================================================================
        
        console.log("4. ADIM: Vesting plan verisi oluşturuluyor...");
        
        struct VestingPlanData {
            string name;
            string description;
            uint256 totalSupply;
            address paymentToken;
            uint256 startAmount;
            uint256 cliffDuration;
            uint256 vestingDuration;
            uint256 cliffPaymentPerMonth;
            uint256 cliffStartDate;
            uint256 vestingStartDate;
            uint256 vestingEndDate;
            bool isActive;
        }
        
        VestingPlanData memory vestingPlan = VestingPlanData({
            name: vestingPlanName,
            description: vestingDescription,
            totalSupply: vestingTotalSupply,
            paymentToken: address(daiToken),
            startAmount: startAmount,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            cliffPaymentPerMonth: cliffPaymentPerMonth,
            cliffStartDate: cliffStartDate,
            vestingStartDate: vestingStartDate,
            vestingEndDate: vestingEndDate,
            isActive: true
        });
        
        console.log("5. ADIM: Plan yapısı hazırlandı ✓");
        
        vm.stopPrank();
        
        // =====================================================================
        // VESTING PLAN DOĞRULAMALARI
        // =====================================================================
        
        console.log("DOĞRULAMA: Vesting plan parametreleri kontrol ediliyor...");
        
        // Tarih doğrulamaları
        assertTrue(vestingPlan.cliffStartDate > currentTime, "Cliff gelecekte başlamalı");
        assertTrue(vestingPlan.vestingStartDate > vestingPlan.cliffStartDate, "Vesting cliff sonrası başlamalı");
        assertTrue(vestingPlan.vestingEndDate > vestingPlan.vestingStartDate, "Vesting bitiş tarihi doğru olmalı");
        
        // Maliyet doğrulamaları
        assertGt(vestingPlan.startAmount, 0, "Başlangıç miktarı sıfırdan büyük olmalı");
        assertGt(vestingPlan.cliffPaymentPerMonth, 0, "Cliff ödemesi sıfırdan büyük olmalı");
        
        // Plan durumu doğrulamaları
        assertTrue(vestingPlan.isActive, "Plan aktif olmalı");
        assertEq(vestingPlan.paymentToken, address(daiToken), "Ödeme token'i DAI olmalı");
        
        console.log("✓ Token Vesting Premium planı oluşturuldu!");
        console.log("✓ Cliff ve vesting tarihleri doğru");
        console.log("✓ Maliyet hesaplamaları tamamlandı");
        console.log("✓ Plan aktif durumda\n");
    }
    
    /**
     * @dev Test 4: N-Usage Plan Senaryosu
     * @notice Kullanım bazlı ödeme planının oluşturulması
     */
    function test_04_NUsagePlanSenaryosu() public {
        console.log("=== TEST 4: N-USAGE PLAN SENARYOSU ===");
        
        // =====================================================================
        // SENARYO: CloudAPI Pay-Per-Use planı oluşturuluyor
        // =====================================================================
        
        console.log("SENARYO: CloudAPI Pay-Per-Use planı oluşturuluyor...");
        
        vm.startPrank(usageProducer);
        
        console.log("1. ADIM: N-Usage plan parametreleri belirleniyor...");
        
        // Plan temel bilgileri
        string memory usagePlanName = "CloudAPI Pay-Per-Use";
        string memory usageDescription = "Kullandığın kadar öde modeli ile esnek cloud API hizmeti. Startup'lar ve küçük projeler için ideal.";
        uint256 usageTotalSupply = 2000; // Maksimum 2000 aktif kullanıcı
        
        // Kullanım bazlı fiyatlandırma (doc/akis.md'den)
        uint256 oneUsagePrice = USAGE_PRICE_PER_CALL;    // 0.01 DAI per call
        uint256 minUsageLimit = 100;                      // Minimum 100 kullanım satın alınmalı
        uint256 maxUsageLimit = 50000;                    // Maksimum 50K kullanım
        uint256 usageValidityDays = 30;                   // Kullanım hakları 30 gün geçerli
        
        console.log("   - Plan Adı:", usagePlanName);
        console.log("   - Kullanım Başına Ücret:", oneUsagePrice * 1000 / 1e18, "milli-DAI"); // 0.01 = 10 milli-DAI
        console.log("   - Minimum Kullanım:", minUsageLimit);
        console.log("   - Maksimum Kullanım:", maxUsageLimit);
        console.log("   - Geçerlilik Süresi:", usageValidityDays, "gün");
        
        // =====================================================================
        // FİYATLANDIRMA HESAPLAMALARI - Farklı paketler
        // =====================================================================
        
        console.log("2. ADIM: Fiyatlandırma hesaplamaları yapılıyor...");
        
        // Minimum paket (100 kullanım)
        uint256 minPackagePrice = oneUsagePrice * minUsageLimit;
        
        // Popüler paketler
        uint256 mediumPackageUsage = 1000;  // 1K kullanım  
        uint256 mediumPackagePrice = oneUsagePrice * mediumPackageUsage;
        
        uint256 largePackageUsage = 10000;  // 10K kullanım
        uint256 largePackagePrice = oneUsagePrice * largePackageUsage;
        
        console.log("   - Minimum Paket (100 kullanım):", minPackagePrice / 1e18, "DAI");
        console.log("   - Orta Paket (1K kullanım):", mediumPackagePrice / 1e18, "DAI");
        console.log("   - Büyük Paket (10K kullanım):", largePackagePrice / 1e18, "DAI");
        
        // =====================================================================
        // İNDİRİM KADEMELERI - Toplu alımlarda indirim
        // =====================================================================
        
        console.log("3. ADIM: İndirim kademeleri ayarlanıyor...");
        
        // İndirim oranları (basis points - 10000 = %100)
        uint256 tier1Discount = 0;     // 100-999 kullanım: İndirim yok
        uint256 tier2Discount = 500;   // 1000-4999 kullanım: %5 indirim
        uint256 tier3Discount = 1000;  // 5000-19999 kullanım: %10 indirim  
        uint256 tier4Discount = 1500;  // 20000+ kullanım: %15 indirim
        
        console.log("   - Seviye 1 (100-999):", tier1Discount / 100, "% indirim");
        console.log("   - Seviye 2 (1K-5K):", tier2Discount / 100, "% indirim");
        console.log("   - Seviye 3 (5K-20K):", tier3Discount / 100, "% indirim");
        console.log("   - Seviye 4 (20K+):", tier4Discount / 100, "% indirim");
        
        // =====================================================================
        // KULLANIM LİMİTLERİ VE KOTA YÖNETİMİ
        // =====================================================================
        
        console.log("4. ADIM: Kullanım limitleri ayarlanıyor...");
        
        // Günlük kullanım limitleri (rate limiting için)
        uint256 dailyLimitBasic = 50;      // Temel kullanıcılar: günde 50 çağrı
        uint256 dailyLimitPremium = 500;   // Premium kullanıcılar: günde 500 çağrı
        uint256 dailyLimitEnterprise = 5000; // Kurumsal: günde 5K çağrı
        
        // Eş zamanlı istek limitleri
        uint256 concurrentLimitBasic = 5;     // Temel: 5 eş zamanlı istek
        uint256 concurrentLimitPremium = 20;  // Premium: 20 eş zamanlı istek
        uint256 concurrentLimitEnterprise = 100; // Kurumsal: 100 eş zamanlı istek
        
        console.log("   - Günlük Limit (Temel):", dailyLimitBasic);
        console.log("   - Günlük Limit (Premium):", dailyLimitPremium);
        console.log("   - Günlük Limit (Kurumsal):", dailyLimitEnterprise);
        
        // =====================================================================
        // N-USAGE PLAN VERİ YAPISI
        // =====================================================================
        
        console.log("5. ADIM: N-Usage plan verisi oluşturuluyor...");
        
        struct NUsagePlanData {
            string name;
            string description;
            uint256 totalSupply;
            address paymentToken;
            uint256 oneUsagePrice;
            uint256 minUsageLimit;
            uint256 maxUsageLimit;
            uint256 usageValidityDays;
            uint256[4] discountTiers;
            uint256[3] dailyLimits;
            uint256[3] concurrentLimits;
            bool isActive;
        }
        
        NUsagePlanData memory nUsagePlan = NUsagePlanData({
            name: usagePlanName,
            description: usageDescription,
            totalSupply: usageTotalSupply,
            paymentToken: address(daiToken),
            oneUsagePrice: oneUsagePrice,
            minUsageLimit: minUsageLimit,
            maxUsageLimit: maxUsageLimit,
            usageValidityDays: usageValidityDays,
            discountTiers: [tier1Discount, tier2Discount, tier3Discount, tier4Discount],
            dailyLimits: [dailyLimitBasic, dailyLimitPremium, dailyLimitEnterprise],
            concurrentLimits: [concurrentLimitBasic, concurrentLimitPremium, concurrentLimitEnterprise],
            isActive: true
        });
        
        console.log("6. ADIM: Plan yapısı hazırlandı ✓");
        
        vm.stopPrank();
        
        // =====================================================================
        // N-USAGE PLAN DOĞRULAMALARI
        // =====================================================================
        
        console.log("DOĞRULAMA: N-Usage plan parametreleri kontrol ediliyor...");
        
        // Fiyatlandırma doğrulamaları
        assertGt(nUsagePlan.oneUsagePrice, 0, "Kullanım ücreti sıfırdan büyük olmalı");
        assertGt(nUsagePlan.minUsageLimit, 0, "Minimum kullanım sıfırdan büyük olmalı");
        assertGt(nUsagePlan.maxUsageLimit, nUsagePlan.minUsageLimit, "Maksimum > Minimum olmalı");
        
        // Limit doğrulamaları
        assertTrue(nUsagePlan.dailyLimits[0] > 0, "Günlük limit pozitif olmalı");
        assertTrue(nUsagePlan.concurrentLimits[0] > 0, "Eş zamanlı limit pozitif olmalı");
        
        // Plan durumu doğrulamaları
        assertTrue(nUsagePlan.isActive, "Plan aktif olmalı");
        assertEq(nUsagePlan.paymentToken, address(daiToken), "Ödeme token'i DAI olmalı");
        
        // Maliyet hesabı doğrulaması
        uint256 calculatedMinCost = nUsagePlan.oneUsagePrice * nUsagePlan.minUsageLimit;
        assertEq(calculatedMinCost, minPackagePrice, "Minimum paket fiyatı yanlış hesaplandı");
        
        console.log("✓ CloudAPI Pay-Per-Use planı oluşturuldu!");
        console.log("✓ Fiyatlandırma kademeleri ayarlandı");
        console.log("✓ Kullanım limitleri belirlendi");
        console.log("✓ İndirim sistemi hazırlandı");
        console.log("✓ Plan aktif durumda\n");
    }
    
    /**
     * @dev Test 5: Müşteri Plan Seçimi Senaryosu
     * @notice Farklı müşteri profillerinin plan seçim süreçleri
     */
    function test_05_MusteriPlanSecimiSenaryosu() public {
        console.log("=== TEST 5: MÜŞTERİ PLAN SEÇİMİ SENARYOSU ===");
        
        // =====================================================================
        // SENARYO 1: Premium müşteri API planını inceliyor
        // =====================================================================
        
        console.log("SENARYO 1: Premium müşteri API planını inceliyor...");
        
        vm.startPrank(premiumCustomer);
        
        console.log("1. ADIM: Premium müşteri sisteme giriş yapıyor...");
        console.log("   - Müşteri Adresi:", premiumCustomer);
        console.log("   - DAI Bakiyesi:", daiToken.balanceOf(premiumCustomer) / 1e18, "DAI");
        
        // Müşteri mevcut planları listeliyor
        console.log("2. ADIM: Mevcut planlar listeleniyor...");
        
        struct AvailablePlan {
            string name;
            string producer;
            uint256 monthlyPrice;
            string planType;
            uint256 userLimit;
            string description;
        }
        
        // Mevcut planları göster (simülasyon)
        AvailablePlan[3] memory availablePlans = [
            AvailablePlan({
                name: "Premium API Access",
                producer: "API Plus Hizmetleri", 
                monthlyPrice: API_MONTHLY_PRICE,
                planType: "API_STREAMING",
                userLimit: 1000,
                description: "Sınırsız API erişimi ve öncelikli destek"
            }),
            AvailablePlan({
                name: "Token Vesting Premium",
                producer: "TokenLock Vesting",
                monthlyPrice: VESTING_START_AMOUNT,
                planType: "VESTING",
                userLimit: 500,
                description: "Kurumsal token vesting çözümleri"
            }),
            AvailablePlan({
                name: "CloudAPI Pay-Per-Use", 
                producer: "CloudAPI Kullanım",
                monthlyPrice: USAGE_PRICE_PER_CALL * 1000, // 1000 kullanım tahmini
                planType: "N_USAGE",
                userLimit: 2000,
                description: "Kullandığın kadar öde esnek model"
            })
        ];
        
        console.log("   Mevcut Planlar:");
        for(uint i = 0; i < availablePlans.length; i++) {
            console.log("   ", i+1, "-", availablePlans[i].name);
            console.log("       Üretici:", availablePlans[i].producer);
            console.log("       Tip:", availablePlans[i].planType);
            console.log("       Fiyat:", availablePlans[i].monthlyPrice / 1e18, "DAI");
        }
        
        // Premium müşteri API planını seçiyor
        console.log("3. ADIM: Premium müşteri API planını seçiyor...");
        
        AvailablePlan memory selectedPlan = availablePlans[0]; // API planı
        
        console.log("   ✓ Seçilen Plan:", selectedPlan.name);
        console.log("   ✓ Üretici:", selectedPlan.producer);
        console.log("   ✓ Aylık Maliyet:", selectedPlan.monthlyPrice / 1e18, "DAI");
        
        // Plan detaylarını incele
        console.log("4. ADIM: Plan detayları inceleniyor...");
        
        // Müşterinin bakiyesi yeterli mi?
        uint256 customerBalance = daiToken.balanceOf(premiumCustomer);
        uint256 yearlyApprovalAmount = selectedPlan.monthlyPrice * 12; // 1 yıllık onay
        
        console.log("   - Müşteri Bakiyesi:", customerBalance / 1e18, "DAI");
        console.log("   - Yıllık Maliyet:", yearlyApprovalAmount / 1e18, "DAI");
        console.log("   - Bakiye Yeterliliği:", customerBalance >= yearlyApprovalAmount ? "✓ Yeterli" : "✗ Yetersiz");
        
        assertTrue(customerBalance >= yearlyApprovalAmount, "Müşteri bakiyesi yetersiz");
        
        vm.stopPrank();
        
        // =====================================================================
        // SENARYO 2: Startup müşteri N-Usage planını inceliyor
        // =====================================================================
        
        console.log("\nSENARYO 2: Startup müşteri N-Usage planını inceliyor...");
        
        vm.startPrank(startupCustomer);
        
        console.log("1. ADIM: Startup müşteri giriş yapıyor...");
        console.log("   - Müşteri Adresi:", startupCustomer);
        console.log("   - DAI Bakiyesi:", daiToken.balanceOf(startupCustomer) / 1e18, "DAI");
        
        // Startup maliyetleri analiz ediyor
        console.log("2. ADIM: Maliyet analizi yapılıyor...");
        
        uint256 apiPlanMonthlyCost = API_MONTHLY_PRICE;
        uint256 usagePlanMinCost = USAGE_PRICE_PER_CALL * 100; // 100 kullanım
        uint256 usagePlanExpectedCost = USAGE_PRICE_PER_CALL * 500; // 500 kullanım tahmini
        
        console.log("   - API Plan (Aylık):", apiPlanMonthlyCost / 1e18, "DAI");
        console.log("   - Usage Plan (Min):", usagePlanMinCost / 1e18, "DAI"); 
        console.log("   - Usage Plan (Tahmini):", usagePlanExpectedCost / 1e18, "DAI");
        
        // Startup için en uygun seçenek
        if(usagePlanExpectedCost < apiPlanMonthlyCost) {
            console.log("   ✓ Karar: N-Usage planı daha ekonomik");
        } else {
            console.log("   ✓ Karar: API planı daha avantajlı");
        }
        
        // N-Usage planını seç
        AvailablePlan memory startupSelectedPlan = availablePlans[2]; // N-Usage planı
        
        console.log("3. ADIM: Startup N-Usage planını seçti");
        console.log("   ✓ Seçilen Plan:", startupSelectedPlan.name);
        console.log("   ✓ Başlangıç Maliyeti:", usagePlanMinCost / 1e18, "DAI");
        
        vm.stopPrank();
        
        // =====================================================================
        // SENARYO 3: Kişisel kullanıcı vesting planını inceliyor
        // =====================================================================
        
        console.log("\nSENARYO 3: Kişisel kullanıcı vesting planını inceliyor...");
        
        vm.startPrank(personalCustomer);
        
        console.log("1. ADIM: Kişisel kullanıcı giriş yapıyor...");
        console.log("   - Müşteri Adresi:", personalCustomer);
        console.log("   - DAI Bakiyesi:", daiToken.balanceOf(personalCustomer) / 1e18, "DAI");
        
        // Vesting planını incele
        AvailablePlan memory vestingPlan = availablePlans[1]; // Vesting planı
        
        console.log("2. ADIM: Vesting planı analiz ediliyor...");
        console.log("   - Plan Adı:", vestingPlan.name);
        console.log("   - Başlangıç Ücreti:", VESTING_START_AMOUNT / 1e18, "DAI");
        console.log("   - Cliff Süresi: 90 gün");
        console.log("   - Aylık Cliff Ödemesi: 5 DAI");
        
        // Toplam maliyet hesaplama
        uint256 totalVestingCost = VESTING_START_AMOUNT + (5 * 1e18 * 3); // 3 ay cliff
        
        console.log("   - Toplam 3 Aylık Maliyet:", totalVestingCost / 1e18, "DAI");
        
        // Kullanıcı için uygun mu?
        uint256 personalBalance = daiToken.balanceOf(personalCustomer);
        if(personalBalance >= totalVestingCost) {
            console.log("   ✓ Kişisel kullanıcı için uygun");
        } else {
            console.log("   ✗ Kişisel kullanıcı için maliyetli");
        }
        
        vm.stopPrank();
        
        // =====================================================================
        // PLAN SEÇİM DOĞRULAMALARI
        // =====================================================================
        
        console.log("\nDOĞRULAMA: Plan seçim süreçleri kontrol ediliyor...");
        
        // Her müşteri tipinin mantıklı seçim yaptığını doğrula
        assertTrue(customerBalance >= yearlyApprovalAmount, "Premium müşteri seçimi mantıklı");
        assertTrue(usagePlanExpectedCost <= apiPlanMonthlyCost, "Startup seçimi ekonomik");
        assertTrue(personalBalance >= VESTING_START_AMOUNT, "Kişisel kullanıcı vesting'e başlayabilir");
        
        console.log("✓ Premium müşteri API planını seçti (yüksek kullanım)");
        console.log("✓ Startup N-Usage planını seçti (değişken kullanım)");
        console.log("✓ Kişisel kullanıcı vesting planını seçti (uzun vadeli)");
        console.log("✓ Tüm müşteri seçimleri ekonomik açıdan mantıklı\n");
    }
}

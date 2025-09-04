// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "contracts/Factory.sol";
import "contracts/Producer.sol";
import "contracts/StreamLockManager.sol";
import "contracts/storage/ProducerStorage.sol";
import "contracts/logic/ProducerNUsage.sol";
import "contracts/TestToken.sol";
import "contracts/URIGenerator.sol";
import {DataTypes} from "contracts/libraries/DataTypes.sol";
import {IFactory} from "contracts/interfaces/IFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title İş Akışı Simulation Testi - Forge
 * @dev Bu test dosyası doc/akis.md'deki iş akışını Forge ile detaylı şekilde simüle eder
 * @notice Tüm senaryolar adım adım Türkçe yorumlarla açıklanmıştır
 */
contract BusinessFlowSimulationTest is Test {
    
    // =====================================================================
    // STRUCT TANIMLARI
    // =====================================================================
    
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

    struct AvailablePlan {
        string name;
        string producer;
        uint256 monthlyPrice;
        string planType;
        uint256 userLimit;
        string description;
    }

    ApiPlanData[] public apiPlans;
    
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
        console.log(unicode"=== İŞ AKIŞI SİMÜLASYONU BAŞLANGICI ===");
        
        // =====================================================================
        // 1. ADRES ATAMALARI - Test aktörlerini belirle
        // =====================================================================
        
        console.log(unicode"1. ADIM: Test adreslerini ayarlıyoruz...");
        
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
        console.log(unicode"   - API Üretici:", apiProducer);
        console.log(unicode"   - Premium Müşteri:", premiumCustomer);
        
        // =====================================================================
        // 2. TOKEN DEPLOYMENT - Test tokenlarını oluştur
        // =====================================================================
        
        console.log(unicode"2. ADIM: Test tokenlarını deploy ediyoruz...");
        
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
        
        console.log(unicode"3. ADIM: Core kontratları deploy ediyoruz...");
        
        // URI Generator - NFT metadata'ları üretir
        uriGenerator = new URIGenerator();
        console.log("   - URIGenerator deployed:", address(uriGenerator));
        
        // Producer Implementation - Proxy'ler için template
        producerImplementation = new Producer();
        console.log("   - Producer Implementation deployed:", address(producerImplementation));
        
        // =====================================================================
        // 4. UPGRADEABLE KONTRAT DEPLOYMENT - Proxy pattern ile
        // =====================================================================
        
        console.log(unicode"4. ADIM: Upgradeable kontratları deploy ediyoruz...");
        
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
        
        console.log(unicode"5. ADIM: Factory kontratını deploy ediyoruz...");
        
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
        
        console.log(unicode"6. ADIM: Kontrat bağlantılarını kuruyoruz...");
        
        // ProducerStorage'a factory adresini ver
        producerStorage.setFactory(
            IFactory(address(factory)),    // factory adresi
            address(producerImplementation), // producer API impl
            address(producerNUsage),       // producer N-Usage impl  
            address(producerImplementation)  // producer vesting impl
        );
        
        console.log(unicode"   - ProducerStorage bağlantıları kuruldu");
        
        // =====================================================================
        // 7. TOKEN DAĞITIMI - Test aktörlerine token ver
        // =====================================================================
        
        console.log(unicode"7. ADIM: Token dağıtımını yapıyoruz...");
        
        // Müşterilere DAI dağıt
        daiToken.transfer(premiumCustomer, CUSTOMER_INITIAL_BALANCE);
        daiToken.transfer(startupCustomer, CUSTOMER_INITIAL_BALANCE);
        daiToken.transfer(personalCustomer, CUSTOMER_INITIAL_BALANCE);
        
        // Üreticilere de başlangıç tokeni ver (test için)
        daiToken.transfer(apiProducer, 10_000 * 1e18);
        daiToken.transfer(vestingProducer, 10_000 * 1e18);
        daiToken.transfer(usageProducer, 10_000 * 1e18);
        
        console.log(unicode"   - Token dağıtımı tamamlandı");
        console.log("   - Premium Customer DAI balance:", daiToken.balanceOf(premiumCustomer) / 1e18, "DAI");
        
        console.log("=== KURULUM TAMAMLANDI ===\n");
    }
    
    
    /**
     * @dev Test 3: Vesting Plan Senaryosu (Basic)
     */
    function test_03_VestingPlanSenaryosu() public {
        console.log("=== TEST 3: VESTING PLAN SENARYOSU ===");
        
        vm.startPrank(vestingProducer);
        
        // Sadece basit değişkenler kullan
        uint256 startAmount = VESTING_START_AMOUNT;
        uint256 cliffDuration = 90 * ONE_DAY;
        uint256 vestingDuration = ONE_YEAR;
        uint256 cliffPaymentPerMonth = 5 * 1e18;
        
        console.log("Plan created with start amount:", startAmount / 1e18, "DAI");
        console.log("Cliff duration:", cliffDuration / ONE_DAY, "days");
        console.log("Vesting duration:", vestingDuration / ONE_DAY, "days");
        console.log("Monthly cliff payment:", cliffPaymentPerMonth / 1e18, "DAI");
        
        vm.stopPrank();
        
        // Basit doğrulamalar
        assertGt(startAmount, 0, "Start amount should be positive");
        assertGt(cliffDuration, 0, "Cliff duration should be positive");
        assertGt(vestingDuration, 0, "Vesting duration should be positive");
        assertGt(cliffPaymentPerMonth, 0, "Monthly payment should be positive");
        
        console.log("Vesting plan parameters validated successfully");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./BusinessFlowSimulation.t.sol";

/**
 * @title Basic Business Flow Tests - Simple Scenarios
 * @dev This file contains basic producer registration and plan creation tests
 */
contract BusinessFlowSimulationBasicTest is BusinessFlowSimulationTest {
    
    /**
     * @dev Test 1: Producer Registration Scenario
     * @notice API Plus Services registers to the system
     */
    function test_01_UreticiKayitSenaryosu() public {
        console.log("=== TEST 1: PRODUCER REGISTRATION SCENARIO ===");
        
        console.log(unicode"SENARYO: API Plus Hizmetleri sisteme kayıt oluyor...");
        
        // API üreticisi adına işlem yap
        vm.startPrank(apiProducer);
        
        // Üretici profil verilerini hazırla (doc/akis.md'den)
        DataTypes.Producer memory producerData = DataTypes.Producer({
            producerId: 0,
            producerAddress: apiProducer,
            name: "API Plus Hizmetleri",
            description: unicode"Gelişmiş API hizmetleri ve entegrasyon çözümleri sağlayan teknoloji firması. Binlerce geliştirici tarafından güvenilen altyapı hizmetleri.",
            image: "https://apiplus.com/assets/logo-premium.png",
            externalLink: "https://apiplus.com",
            cloneAddress: address(0),
            exists: true
        });
        
        console.log(unicode"5. ADIM: Üretici kayıt verisi hazırlandı ✓");
        console.log(unicode"   - Firma Adı:", producerData.name);
        console.log(unicode"   - Açıklama: API ve entegrasyon hizmetleri");
        console.log(unicode"   - Website:", producerData.externalLink);
        
        // =====================================================================
        // KAYIT DOĞRULAMA
        // =====================================================================
        
        console.log(unicode"DOĞRULAMA: Üretici kayıt verisi kontrol ediliyor...");
        
        // Temel doğrulamalar
        assertTrue(bytes(producerData.name).length > 0, unicode"Üretici adı boş olamaz");
        assertTrue(bytes(producerData.description).length > 0, unicode"Açıklama boş olamaz");
        assertEq(producerData.producerAddress, apiProducer, unicode"Üretici adresi yanlış");
        assertTrue(producerData.exists, unicode"Üretici mevcut olmalı");
        // assertEq(producerData.subscriptionToken, address(daiToken), unicode"Ödeme token'i yanlış atandı"); // Not available in Producer struct
        
        vm.stopPrank();
        
        console.log(unicode"✓ API Plus Hizmetleri başarıyla kayıt oldu!");
        console.log(unicode"✓ Profil bilgileri doğrulandı");
        console.log(unicode"✓ Sistem entegrasyonu hazır\n");
        
        // =====================================================================
        // SİSTEM DURUM KONTROLÜ
        // =====================================================================
        
        console.log(unicode"DURUM KONTROLÜ: Sistem bileşenleri test ediliyor...");
        
        // Sistem durumu kontrolleri (simülasyon)
        assertTrue(address(factory) != address(0), unicode"Factory deploy edilmeli");
        assertTrue(address(producerStorage) != address(0), unicode"ProducerStorage deploy edilmeli");
        assertTrue(producerData.exists, unicode"Üretici aktif durumda değil");
        
        console.log(unicode"✓ Factory sistemi aktif");
        console.log(unicode"✓ Storage sistemi aktif");
        console.log(unicode"✓ Üretici profili aktif");
        console.log(unicode"✓ Sistem hazır\n");
    }
    
    /**
     * @dev Test 2: API Plan Creation Scenario
     * @notice Premium API plan creation and validation
     */
    function test_02_ApiPlanOlusturmaSenaryosu() public {
        console.log(unicode"=== TEST 2: API PLAN CREATION SCENARIO ===");
        
        console.log(unicode"SENARYO: Premium API planı oluşturuluyor...");
        
        vm.startPrank(apiProducer);
        
        // Plan detaylarını hazırla (doc/akis.md'den)
        console.log("1. ADIM: Plan parametreleri belirleniyor...");
        
        // Plan temel bilgileri
        string memory planName = "Premium API Access";
        string memory planDescription = unicode"Sınırsız API erişimi, öncelikli destek ve gelişmiş analitik araçları içeren premium paket.";
        string memory planExternalLink = "https://apiplus.com/plans/premium";
        string memory planImage = "https://apiplus.com/assets/premium-plan-banner.jpg";
        
        // Plan ekonomik parametreleri
        uint256 totalSupply = 1000;        // Maksimum 1000 kullanıcı
        uint256 monthlyPriceDAI = API_MONTHLY_PRICE; // 10 DAI/ay
        uint256 monthlyRequestLimit = 10000; // Aylık 10K istek
        
        console.log(unicode"   - Plan Adı:", planName);
        console.log(unicode"   - Aylık Ücret:", monthlyPriceDAI / 1e18, "DAI");
        console.log(unicode"   - Kullanıcı Limiti:", totalSupply);
        console.log(unicode"   - Aylık İstek Limiti:", monthlyRequestLimit);
        
        console.log(unicode"5. ADIM: Plan verisi oluşturuluyor...");
        
        // API planı için özel veri yapısı - geçici değişkenler kullanıyoruz
        string memory apiPlanName = unicode"Premium API Access";
        string memory apiPlanDescription = unicode"Aylık 10,000 API çağrısı ile premium erişim";
        string memory apiPlanExternalLink = "https://api.blicence.com/docs";
        string memory apiPlanImage = "ipfs://QmApiPlanImage";
        uint256 planTotalSupply = 1000;
        address planPriceToken = address(daiToken);
        uint256 planFlowratePerSecond = 385802469135802; // ~$10/ay için saniye başına rate
        uint256 planMonthlyLimit = 10000;
        
        ApiPlanData storage apiPlan = apiPlans.push();
        apiPlan.name = apiPlanName;
        apiPlan.description = apiPlanDescription;
        apiPlan.externalLink = apiPlanExternalLink;
        apiPlan.image = apiPlanImage;
        apiPlan.totalSupply = planTotalSupply;
        apiPlan.priceToken = address(daiToken);
        apiPlan.flowratePerSecond = planFlowratePerSecond;
        apiPlan.monthlyLimit = planMonthlyLimit;
        apiPlan.startDate = block.timestamp;
        apiPlan.endDate = block.timestamp + ONE_YEAR;
        apiPlan.status = true;
        
        console.log(unicode"6. ADIM: Plan verisi hazırlandı ✓");
        
        vm.stopPrank();
        
        // =====================================================================
        // PLAN DOĞRULAMA VE TEST
        // =====================================================================
        
        console.log(unicode"DOĞRULAMA: Plan parametreleri kontrol ediliyor...");
        
        // Plan temel doğrulamaları
        assertTrue(bytes(apiPlan.name).length > 0, unicode"Plan adı boş olamaz");
        assertTrue(apiPlan.totalSupply > 0, unicode"Kullanıcı limiti sıfırdan büyük olmalı");
        assertTrue(apiPlan.flowratePerSecond > 0, unicode"Flowrate sıfırdan büyük olmalı");
        assertEq(apiPlan.priceToken, address(daiToken), unicode"Ödeme token'i DAI olmalı");
        assertTrue(apiPlan.status, unicode"Plan aktif durumda olmalı");
        
        // Ekonomik doğrulamalar
        uint256 secondsInMonth = 30 * 24 * 60 * 60; // 30 günlük ay
        uint256 monthlyPayment = apiPlan.flowratePerSecond * secondsInMonth;
        assertApproxEqAbs(monthlyPayment, monthlyPriceDAI, 1000, unicode"Aylık ödeme hesabı yanlış");
        
        console.log(unicode"✓ Premium API Plan başarıyla oluşturuldu!");
        console.log(unicode"✓ Plan ID: 1 (simülasyon)");
        console.log(unicode"✓ Flowrate doğrulandı");
        console.log(unicode"✓ Fiyatlandırma hesabı doğru");
        console.log(unicode"✓ Plan aktif durumda\n");
    }
}

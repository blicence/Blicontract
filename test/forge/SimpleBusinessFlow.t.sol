// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";

contract SimpleBusinessFlowTest is Test {
    
    struct ProducerData {
        address ownerAddress;
        string name;
        bool isActive;
    }
    
    struct ApiPlan {
        string name;
        uint256 monthlyPrice;
        uint256 userLimit;
        uint256 flowratePerSecond;
        bool isActive;
    }
    
    struct CompleteProducer {
        address owner;
        string name;
        bool isRegistered;
        uint256 totalEarnings;
        uint256 activeCustomers;
    }
    
    address public owner;
    address public apiProducer;     
    address public premiumCustomer; 
    
    uint256 public constant API_MONTHLY_PRICE = 10 ether;      
    uint256 public constant ONE_MONTH = 30 days;
    
    function setUp() public {
        console.log("=== BASIT IS AKISI SIMULASYONU BASLANGICI ===");
        
        owner = address(this);
        apiProducer = makeAddr("api_producer");
        premiumCustomer = makeAddr("premium_customer");
        
        vm.deal(premiumCustomer, 1000 ether);   
        
        console.log("=== KURULUM TAMAMLANDI ===");
    }
    
    function testUreticiKayit() public {
        console.log("=== TEST 1: URETICI KAYIT SENARYOSU ===");
        
        vm.startPrank(apiProducer);
        
        ProducerData memory producer = ProducerData({
            ownerAddress: apiProducer,
            name: "API Plus Hizmetleri",
            isActive: true
        });
        
        console.log("1. ADIM: Uretici profil bilgilerini doldurdu");
        console.log("   - Sirket Adi:", producer.name);
        
        assertEq(producer.ownerAddress, apiProducer, "Uretici adresi yanlis");
        assertTrue(bytes(producer.name).length > 0, "Uretici adi bos olamaz");
        assertTrue(producer.isActive, "Durum aktif olmali");
        
        console.log("API Plus Hizmetleri basariyla sisteme kayit oldu!");
        
        vm.stopPrank();
    }
    
    function testApiPlanOlusturma() public {
        console.log("=== TEST 2: API PLAN OLUSTURMA SENARYOSU ===");
        
        vm.startPrank(apiProducer);
        
        ApiPlan memory plan = ApiPlan({
            name: "Premium API Access",
            monthlyPrice: API_MONTHLY_PRICE,
            userLimit: 1000,
            flowratePerSecond: 0,
            isActive: true
        });
        
        console.log("   - Plan Adi:", plan.name);
        console.log("   - Aylik Ucret:", plan.monthlyPrice / 1 ether, "ETH");
        
        uint256 secondsInMonth = 30 * 24 * 3600;
        plan.flowratePerSecond = plan.monthlyPrice / secondsInMonth;
        
        console.log("   - Flowrate (wei/saniye):", plan.flowratePerSecond);
        
        assertGt(plan.flowratePerSecond, 0, "Flowrate sifirdan buyuk olmali");
        
        uint256 monthlyTotal = plan.flowratePerSecond * secondsInMonth;
        assertApproxEqAbs(monthlyTotal, plan.monthlyPrice, 100000, "Flowrate hesabi yanlis");
        
        console.log("Premium API Plan basariyla olusturuldu!");
        
        vm.stopPrank();
    }
    
    function testMusteriOdeme() public {
        console.log("=== TEST 3: MUSTERI ODEME SENARYOSU ===");
        
        vm.startPrank(premiumCustomer);
        
        uint256 customerBalance = premiumCustomer.balance;
        console.log("   - Musteri Bakiyesi:", customerBalance / 1 ether, "ETH");
        console.log("   - Plan Maliyeti:", API_MONTHLY_PRICE / 1 ether, "ETH");
        
        assertTrue(customerBalance >= API_MONTHLY_PRICE, "Musteri bakiyesi yeterli olmali");
        
        uint256 balanceBeforePayment = premiumCustomer.balance;
        
        payable(apiProducer).transfer(API_MONTHLY_PRICE);
        
        uint256 balanceAfterPayment = premiumCustomer.balance;
        uint256 producerBalance = apiProducer.balance;
        
        console.log("   - Musteri Bakiyesi (Once):", balanceBeforePayment / 1 ether, "ETH");
        console.log("   - Musteri Bakiyesi (Sonra):", balanceAfterPayment / 1 ether, "ETH");
        console.log("   - Producer Aldigi:", producerBalance / 1 ether, "ETH");
        
        assertEq(balanceBeforePayment - balanceAfterPayment, API_MONTHLY_PRICE, "Odeme miktari yanlis");
        assertEq(producerBalance, API_MONTHLY_PRICE, "Producer yanlis miktar aldi");
        
        console.log("Odeme basarili!");
        
        vm.stopPrank();
    }
    
    function testZamanBazliSimulasyon() public {
        console.log("=== TEST 4: ZAMAN BAZLI SIMULASYON ===");
        
        vm.startPrank(premiumCustomer);
        
        uint256 initialBalance = premiumCustomer.balance;
        uint256 initialProducerBalance = apiProducer.balance;
        
        console.log("BASLANGIC DURUMU:");
        console.log("   - Musteri Bakiyesi:", initialBalance / 1 ether, "ETH");
        console.log("   - Producer Bakiyesi:", initialProducerBalance / 1 ether, "ETH");
        
        for(uint256 month = 1; month <= 3; month++) {
            console.log("--- AY", month, "ODEMESI ---");
            
            vm.warp(block.timestamp + ONE_MONTH);
            
            uint256 balanceBefore = premiumCustomer.balance;
            
            payable(apiProducer).transfer(API_MONTHLY_PRICE);
            
            uint256 balanceAfter = premiumCustomer.balance;
            
            console.log("   - Zaman:", block.timestamp);
            console.log("   - Odeme Miktari:", API_MONTHLY_PRICE / 1 ether, "ETH");
            console.log("   - Musteri Bakiyesi:", balanceAfter / 1 ether, "ETH");
            
            assertEq(balanceBefore - balanceAfter, API_MONTHLY_PRICE, "Aylik odeme yanlis");
        }
        
        vm.stopPrank();
        
        uint256 finalBalance = premiumCustomer.balance;
        uint256 finalProducerBalance = apiProducer.balance;
        
        uint256 totalPaid = initialBalance - finalBalance;
        uint256 totalReceived = finalProducerBalance - initialProducerBalance;
        uint256 expectedTotal = API_MONTHLY_PRICE * 3;
        
        console.log("3 AYLIK OZET:");
        console.log("   - Toplam Odenen:", totalPaid / 1 ether, "ETH");
        console.log("   - Toplam Alinan:", totalReceived / 1 ether, "ETH");
        console.log("   - Beklenen Toplam:", expectedTotal / 1 ether, "ETH");
        
        assertEq(totalPaid, expectedTotal, "3 aylik toplam odeme yanlis");
        assertEq(totalReceived, expectedTotal, "3 aylik toplam alim yanlis");
        
        console.log("3 aylik simulasyon basarili!");
    }
    
    function testKapsamliSimulasyon() public {
        console.log("=== TEST 5: KAPSAMLI IS AKISI SIMULASYONU ===");
        
        CompleteProducer memory producer = CompleteProducer({
            owner: apiProducer,
            name: "Complete API Services",
            isRegistered: true,
            totalEarnings: 0,
            activeCustomers: 0
        });
        
        console.log("1. ADIM: Uretici kaydi tamamlandi");
        
        uint256 planPrice = 5 ether;
        console.log("2. ADIM: Plan olusturuldu - Ucret:", planPrice / 1 ether, "ETH");
        
        vm.startPrank(premiumCustomer);
        
        uint256 customerBalanceBefore = premiumCustomer.balance;
        payable(apiProducer).transfer(planPrice);
        uint256 customerBalanceAfter = premiumCustomer.balance;
        
        producer.totalEarnings += planPrice;
        producer.activeCustomers += 1;
        
        console.log("3. ADIM: Abonelik tamamlandi");
        console.log("   - Musteri Odedigi:", (customerBalanceBefore - customerBalanceAfter) / 1 ether, "ETH");
        console.log("   - Toplam Kazanc:", producer.totalEarnings / 1 ether, "ETH");
        
        vm.stopPrank();
        
        // Hizmet kullanimi simulasyonu
        uint256 apiCalls = 0;
        uint256 successfulCalls = 0;
        
        for(uint256 day = 1; day <= 30; day++) {
            vm.warp(block.timestamp + 1 days);
            
            uint256 dailyCalls = 100;
            apiCalls += dailyCalls;
            
            uint256 successful = (dailyCalls * 95) / 100;
            successfulCalls += successful;
        }
        
        console.log("4. ADIM: 30 gunluk hizmet kullanimi");
        console.log("   - Toplam API Cagrisi:", apiCalls);
        console.log("   - Basarili Cagri:", successfulCalls);
        console.log("   - Basari Orani: %", (successfulCalls * 100) / apiCalls);
        
        vm.startPrank(premiumCustomer);
        payable(apiProducer).transfer(planPrice);
        producer.totalEarnings += planPrice;
        vm.stopPrank();
        
        console.log("5. ADIM: Aylik yenileme tamamlandi");
        console.log("   - Producer Toplam Kazanc:", producer.totalEarnings / 1 ether, "ETH");
        
        console.log("KAPSAMLI SIMULASYON OZETI:");
        console.log("Toplam Producer Kazanci:", producer.totalEarnings / 1 ether, "ETH");
        console.log("Aktif Musteri Sayisi:", producer.activeCustomers);
        console.log("API Basari Orani: %", (successfulCalls * 100) / apiCalls);
        
        assertGt(producer.totalEarnings, 0, "Producer kazanc olmali");
        assertGt(producer.activeCustomers, 0, "Aktif musteri olmali");
        assertGt(successfulCalls, 0, "Basarili API cagrisi olmali");
        assertGe((successfulCalls * 100) / apiCalls, 90, "Basari orani %90'dan fazla olmali");
        
        console.log("KAPSAMLI IS AKISI SIMULASYONU BASARILI");
    }
}

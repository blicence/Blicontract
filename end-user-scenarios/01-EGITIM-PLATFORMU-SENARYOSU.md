# Senaryo 1: Online Eğitim Platformu (Aylık Abonelik Modeli)

Bu senaryoda, "CodeMaster" adında bir online eğitim platformu, video derslerine aylık abonelik ile erişim sunmaktadır.

**Katılımcılar:**
- **Üretici:** CodeMaster Eğitim Platformu (Ahmet Bey - Platform Sahibi)
- **Müşteri:** Ayşe Yılmaz, yazılım öğrenmek isteyen 24 yaşında bir üniversite öğrencisi.

## Ön Hazırlık: Platform Kurulumu

### Adım 1: Üretici Platformuna Kaydolur (CodeMaster - Ahmet Bey)

**1.1. Factory Contract ile Producer Oluşturma:**
1. Ahmet Bey, CodeMaster eğitim platformunu kurmak için önce `blicence.io` web sitesine gider.
2. "Yeni Platform Oluştur" butonuna tıklar ve cüzdanını (MetaMask) bağlar.
3. Platform bilgilerini doldurur:
   - **Platform Adı:** "CodeMaster Academy"
   - **Açıklama:** "Modern yazılım geliştirme teknikleri öğreten online platform"
   - **Logo:** platform_logo.png
   - **Web Sitesi:** https://codemaster.academy
4. "Platform Oluştur" butonuna tıklar. Bu işlem `Factory.newBcontract()` fonksiyonunu çağırır.
5. Cüzdanından işlem onayı verir (gaz ücreti: ~0.02 ETH).
6. İşlem tamamlandığında, Ahmet Bey'e özel bir `Producer` kontratı oluşturulur.
7. Sistem, Ahmet Bey'e yeni Producer ID'sini (örn. #247) ve kontrat adresini gösterir.

**1.2. Platform Yönetim Paneline Erişim:**
1. Ahmet Bey, artık kendi yönetim paneline erişebilir: `https://codemaster.academy/admin`
2. Bu panel, onun Producer kontratı ile etkileşim kuran bir web arayüzüdür.

### Adım 2: Üretici Hizmet Planlarını Oluşturur

**2.1. Temel Plan Oluşturma:**
1. Ahmet Bey, yönetim panelinde "Yeni Plan Ekle" sekmesine gider.
2. Plan detaylarını doldurur:
   - **Plan Adı:** "Aylık Pro Erişim"
   - **Plan Tipi:** API/Abonelik (sürekli erişim)
   - **Fiyat:** 15 USDC / Ay
   - **Ödeme Token'ı:** USDC (0xa0b86a33e6c8...)
   - **Plan Açıklaması:** "Tüm video derslere, kaynak kodlara ve canlı Q&A seanslarına sınırsız erişim"
   - **Özellikler:** 
     - 150+ Video Ders
     - Kaynak Kod İndirme
     - Haftalık Canlı Yayın
     - Topluluk Forumu Erişimi
     - Sertifika Programı

**2.2. Plan Konfigürasyonu (Teknik Detaylar):**
```solidity
// Ahmet Bey'in Producer kontratında çağrılan fonksiyon
function addPlan(DataTypes.Plan calldata vars) external onlyOwner returns (uint256 planId)

// Plan verisi:
DataTypes.Plan({
    planId: 0, // Otomatik atanacak
    producerAddress: 0x...(CodeMaster kontrat adresi),
    name: "Aylık Pro Erişim",
    description: "Tüm video derslere...",
    image: "ipfs://plan-image-hash",
    priceAddress: 0xa0b86a33e6c8... (USDC kontrat adresi),
    planType: DataTypes.PlanTypes.api,
    status: DataTypes.Status.active
})
```

3. "Planı Oluştur" butonuna tıklar ve cüzdanından işlemi onaylar.
4. Sistem, yeni Plan ID'sini (örn. Plan #12) döndürür.

**2.3. Plan API Bilgilerini Ekleme:**
1. Ahmet Bey, "Plan Detayları" sekmesinde API konfigürasyonunu yapar:
   - **Aylık Akış Oranı:** 15 USDC / 30 gün = 0.0000057 USDC/saniye
   - **Minimum Abonelik Süresi:** 7 gün
   - **Maksimum Abonelik Süresi:** 365 gün
   - **Otomatik Yenileme:** Kapalı (müşteri manuel olarak yenileyecek)

```solidity
// API plan bilgileri ekleme
function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external onlyOwner

DataTypes.PlanInfoApi({
    planId: 12,
    flowRate: 578703703703703, // wei/saniye cinsinden (15 USDC/ay)
    minDuration: 604800, // 7 gün (saniye)
    maxDuration: 31536000 // 365 gün (saniye)
})
```

## Müşteri Deneyimi: Abonelik Satın Alma

### Adım 3: Müşteri Platform Keşfi (Ayşe)

**3.1. İlk Keşif:**
1. Ayşe, Instagram'da bir reklam görür: "JavaScript'i 30 günde öğren! CodeMaster Academy ile başla."
2. Reklama tıklar ve `https://codemaster.academy` adresine yönlendirilir.
3. Ana sayfada şunları görür:
   - Platform tanıtım videosu
   - Öne çıkan kurslar (React, Node.js, Python)
   - Öğrenci yorumları
   - Fiyatlandırma planları

**3.2. Plan Karşılaştırması:**
Ayşe, fiyatlandırma sayfasında iki plan görür:

| Özellik | Ücretsiz Plan | Aylık Pro Erişim |
|---------|---------------|------------------|
| Video Ders Sayısı | 10 temel ders | 150+ ders |
| Kaynak Kod İndirme | ❌ | ✅ |
| Canlı Q&A | ❌ | ✅ Haftalık |
| Topluluk Forumu | Sadece okuma | Tam erişim |
| Sertifika | ❌ | ✅ |
| **Fiyat** | **Ücretsiz** | **15 USDC/ay** |

### Adım 4: Müşteri Planı Satın Alır (Ayşe)

**4.1. Satın Alma Süreci Başlangıcı:**
1. Ayşe, "Aylık Pro Erişim" planının altındaki "Şimdi Başla" butonuna tıklar.
2. Sistem, onu kayıt sayfasına yönlendirir.
3. Temel bilgilerini doldurur:
   - Ad Soyad: Ayşe Yılmaz
   - E-mail: ayse.yilmaz@gmail.com
   - Şifre oluşturur

**4.2. Cüzdan Bağlantısı:**
1. Kayıt sonrası, sistem "Ödeme için cüzdanını bağla" mesajı gösterir.
2. Ayşe, "MetaMask'ı Bağla" butonuna tıklar.
3. MetaMask açılır ve şu mesajı gösterir:
   ```
   CodeMaster Academy bu mesajı imzalamanızı istiyor:
   
   Blicence platformunda kimlik doğrulaması
   Nonce: 847392
   Timestamp: 2025-09-15T14:30:00Z
   ```
4. Ayşe "İmzala" butonuna tıklar.
5. Sistem, Ayşe'nin cüzdan adresini (0x742d35Cc6e...) hesabıyla eşleştirir.

**4.3. Cüzdan Bakiye Kontrolü:**
1. Sistem, Ayşe'nin cüzdanındaki USDC bakiyesini kontrol eder.
2. Ayşe'nin bakiyesi: 47.50 USDC (yeterli)
3. Eğer bakiye yetersiz olsaydı, sistem alternatif seçenekler sunardı:
   - DEX üzerinden swap (ETH → USDC)
   - Kredi kartı ile USDC satın alma (3. parti servis)
   - Banka transferi seçenekleri

**4.4. Abonelik Parametrelerini Seçme:**
1. Ayşe, abonelik süresini seçer:
   - ☑️ 1 Ay (15 USDC) - En popüler
   - ☐ 3 Ay (40 USDC) - %11 indirim
   - ☐ 6 Ay (75 USDC) - %17 indirim
2. "Stream" özelliğini açıklar sistem:
   ```
   💡 Akıllı Ödeme Sistemi:
   Ödemeniz tek seferde değil, kullandığınız süre boyunca
   yavaş yavaş öğretmene aktarılır. İstediğiniz zaman iptal
   edebilir, kullanmadığınız kısmın parasını geri alabilirsiniz.
   ```

**4.5. Blockchain İşlemi (Stream Oluşturma):**
1. Ayşe, "Abonelik Başlat" butonuna tıklar.
2. MetaMask, şu işlemi onaylamasını ister:

```
İşlem Detayları:
──────────────────────
Kontrat: StreamLockManager
Fonksiyon: createStreamForCustomerPlan()
Parametreler:
- Customer Plan ID: 1247
- Customer: 0x742d35Cc6e... (Ayşe)
- Producer: 0x891f2b4c5d... (CodeMaster)
- Token: 0xa0b86a33e6c8... (USDC)
- Total Amount: 15 USDC
- Duration: 2,592,000 saniye (30 gün)

Gaz Ücreti: ~0.015 ETH ($24)
Toplam Maliyet: 15 USDC + gaz ücreti
```

3. Ayşe "Onayla" butonuna tıklar.
4. İşlem blockchain'e gönderilir. Transaction hash: `0xabc123...`

**4.6. İşlem Onayı ve NFT Mint:**
1. İşlem 30 saniye içinde onaylanır.
2. Sistem, Ayşe'ye bir "Erişim NFT'si" mint eder:
   ```json
   {
     "tokenId": 1247,
     "name": "CodeMaster Pro Üyelik #1247",
     "description": "Aylık Pro Erişim - Başlangıç: 15 Eylül 2025",
     "image": "ipfs://membership-nft-image",
     "attributes": [
       {"trait_type": "Plan", "value": "Aylık Pro Erişim"},
       {"trait_type": "Başlangıç", "value": "2025-09-15"},
       {"trait_type": "Süre", "value": "30 gün"},
       {"trait_type": "Status", "value": "Aktif"}
     ]
   }
   ```

3. Ayşe'nin cüzdanında artık CodeMaster NFT'si görünür.
4. Sistem, başarı mesajı gösterir: "🎉 Tebrikler! Pro üyeliğin aktif."

## Ödeme Akışı ve Hizmet Kullanımı

### Adım 5: Ödeme Akışının Gerçekleşmesi (Stream Mekanizması)

**5.1. Stream Başlangıcı:**
1. Ayşe'nin işlemi onaylandığı anda, `StreamLockManager` kontratında şu değerler kaydedilir:
   ```solidity
   TokenLock({
     lockId: 0xdef456...,
     user: 0x742d35Cc6e... (Ayşe),
     recipient: 0x891f2b4c5d... (CodeMaster),
     token: 0xa0b86a33e6c8... (USDC),
     totalAmount: 15000000, // 15 USDC (6 decimal)
     streamRate: 578703703703703, // wei/saniye
     startTime: 1726407000, // 15 Eylül 2025, 14:30
     endTime: 1728999000, // 15 Ekim 2025, 14:30
     lastClaimTime: 1726407000,
     isActive: true
   })
   ```

**5.2. Gerçek Zamanlı Akış:**
1. Her saniye, `578703703703703 wei` (≈ 0.000578 USDC) CodeMaster'ın erişebileceği bakiyeye eklenir.
2. Bu akış, 30 gün = 2,592,000 saniye boyunca devam eder.
3. Hesaplama: `15 USDC ÷ 2,592,000 saniye = 0.000578 USDC/saniye`

**5.3. Producer Dashboard'da Görünüm (Ahmet Bey):**
Ahmet Bey, kendi yönetim panelinde şunları görür:
```
📊 Aktif Abonelikler: 1
💰 Bekleyen Gelir: 15.00 USDC
⏰ Bu Ayki Kazanç: 2.89 USDC (5 gün geçti)
🔄 Aktif Stream'ler: 1

┌─ Aktif Stream Detayları ─────────────────┐
│ Müşteri: 0x742d...Cc6e (Ayşe Y.)       │
│ Plan: Aylık Pro Erişim                   │
│ Toplam: 15.00 USDC                      │
│ Aktarılan: 2.89 USDC (19.3%)           │
│ Kalan: 12.11 USDC                       │
│ Günlük Rate: 0.50 USDC                  │
│ Bitiş: 15 Ekim 2025                     │
└──────────────────────────────────────────┘
```

### Adım 6: Müşteri Hizmeti Kullanır (Platform Erişimi)

**6.1. İlk Giriş:**
1. Ayşe, `codemaster.academy` adresine gider ve "Giriş Yap" butonuna tıklar.
2. Sistem, "Cüzdanla Giriş" seçeneği sunar.
3. MetaMask açılır ve Ayşe'den mesaj imzalamasını ister:
   ```
   CodeMaster Academy'ye giriş:
   
   Wallet: 0x742d35Cc6e...
   Timestamp: 2025-09-15T15:45:00Z
   Nonce: 567834
   ```
4. İmzalama sonrası sistem, Ayşe'nin NFT'sini kontrol eder.

**6.2. NFT Doğrulama Süreci:**
```solidity
// Producer kontratında çağrılan fonksiyon
function checkStreamBeforeUsage(
    uint256 customerPlanId, // 1247
    address customer // 0x742d35Cc6e...
) public returns (bool canUse)

// StreamLockManager'da kontrol
function checkAndSettleOnUsage(
    address consumer,
    bytes32 lockId
) external view onlyAuthorized returns (bool canUse)
```

**6.3. Dashboard Erişimi:**
Doğrulama başarılı olunca, Ayşe'ye özel dashboard açılır:

```
🎓 CodeMaster Academy - Pro Üyelik
─────────────────────────────────────

👋 Hoş geldin Ayşe!

📊 Üyelik Durumu:
├─ Plan: Aylık Pro Erişim ✅
├─ Kalan Süre: 25 gün
├─ Kullanılan Tutar: 2.89 USDC
└─ Kalan Tutar: 12.11 USDC

📚 Kurslarım:
├─ JavaScript Temelleri (İlerleme: %0)
├─ React Fundamentals (İlerleme: %0)
├─ Node.js Backend (İlerleme: %0)
└─ Full Stack Project (Kilitli - Önceki kursları tamamla)

🔔 Son Aktiviteler:
├─ Pro üyelik başladı (5 gün önce)
└─ Hoş geldin e-postası gönderildi
```

**6.4. Kurs İzleme Deneyimi:**
1. Ayşe, "JavaScript Temelleri"ne tıklar.
2. Her video izlediğinde:
   - İlerleme kaydedilir (blockchain'de değil, geleneksel database'de)
   - Stream durumu arka planda kontrol edilir
   - Eğer stream aktifse, video oynatılır
   - Eğer stream bitmişse, yenileme önerisi gösterilir

**6.5. Özel Özellikler (Pro Üyelik):**
1. **Kaynak Kod İndirme:**
   - Her video altında "Kodu İndir" butonu
   - ZIP dosyası anında indirme
   
2. **Canlı Q&A Katılımı:**
   - Haftalık Çarşamba 20:00'da Discord üzerinden
   - NFT sahipleri özel kanala erişim
   
3. **Topluluk Forumu:**
   - Soru sorma ve cevaplama hakkı
   - Diğer öğrencilerle etkileşim

## Abonelik Yönetimi ve İptal Senaryoları

### Adım 7: Müşteri Aboneliği İptal Eder (Farklı Senaryolar)

#### Senaryo A: Erken İptal (10 Gün Sonra)

**A.1. İptal Kararı:**
1. Ayşe, 10 gün boyunca kursları izler ancak içeriğin kendisine uygun olmadığına karar verir.
2. Şu ana kadar:
   - JavaScript Temelleri kursunu %60 tamamladı
   - 15 video izledi (toplam 47 saat içerik)
   - 2 canlı Q&A seansına katıldı

**A.2. İptal Süreci:**
1. Ayşe, hesap ayarlarında "Aboneliği İptal Et" sekmesine gider.
2. Sistem, mevcut durumu gösterir:
   ```
   💰 Abonelik Durumu:
   ├─ Toplam Ödenen: 15.00 USDC
   ├─ Kullanılan (10 gün): 5.00 USDC
   ├─ İade Edilecek: 10.00 USDC
   └─ İade Süresi: Anında (blockchain işlemi)
   
   ⚠️ İptal sonrası:
   ├─ Videolara erişim kapanır
   ├─ İndirilen kodları kullanabilirsin
   ├─ Sertifika programından çıkarılırsın
   └─ İade işlemi geri alınamaz
   ```

**A.3. Blockchain İşlemi (İptal):**
1. Ayşe, "Aboneliği İptal Et ve Para İadesi Al" butonuna tıklar.
2. MetaMask, şu işlemi onaylamasını ister:
   ```
   İşlem: cancelStream()
   Kontrat: StreamLockManager
   LockID: 0xdef456...
   
   Gas Fee: ~0.008 ETH
   İade Miktarı: 10.00 USDC
   ```
3. İşlem onaylanır (Transaction: `0x789xyz...`)

**A.4. İptal Sonrası Durum:**
1. `StreamLockManager` kontratında stream durumu `isActive: false` olur.
2. 10 USDC anında Ayşe'nin cüzdanına iade edilir.
3. Ayşe'nin NFT'si yakılır (burn edilir).
4. Platform erişimi kapanır:
   ```
   🚫 Üyelik İptal Edildi
   
   Hesap Durumu: Temel Üyelik
   İade Edilen: 10.00 USDC
   Erişim: Sadece ücretsiz içerikler
   
   💡 Tekrar abone olmak için "Planları Gör" butonuna tıkla.
   ```

#### Senaryo B: Süre Sonunda Yenileme

**B.1. Abonelik Süresi Doldu (30 Gün Sonra):**
1. 15 Ekim 2025, saat 14:30'da Ayşe'nin aboneliği otomatik olarak sona erer.
2. Stream tamamlanır: 15 USDC'nin tamamı CodeMaster'a aktarılmıştır.
3. Sistem, Ayşe'ye e-posta gönderir:
   ```
   📧 CodeMaster Academy - Abonelik Süresi Doldu
   
   Merhaba Ayşe,
   
   30 günlük Pro üyeliğin bugün sona erdi. Bu sürede:
   ✅ 89 video izledin
   ✅ 3 projeyi tamamladın
   ✅ JavaScript Sertifikası kazandın
   
   🔄 Öğrenmeye devam etmek için yenile:
   [Aboneliği Yenile - 15 USDC]
   
   Teşekkürler!
   CodeMaster Ekibi
   ```

**B.2. Yenileme Süreci:**
1. Ayşe, yenileme linkine tıklar.
2. Sistem, otomatik yenileme seçeneği sunar:
   ```
   🔄 Abonelik Yenileme
   
   Plan: Aylık Pro Erişim
   Fiyat: 15 USDC
   
   ☐ Otomatik yenileme aktif et
     (Her ay otomatik olarak yeni stream başlat)
   
   [Şimdi Yenile] [Daha Sonra]
   ```

#### Senaryo C: Kısmi Kullanım ve İade

**C.1. Düşük Kullanım Senaryosu:**
1. Ayşe, abonelik aldıktan sonra sadece 3 gün aktif olarak platform kullanır.
2. 25 gün sonra iptal etmeye karar verir.
3. İade durumu:
   ```
   📊 Kullanım Analizi:
   ├─ Aktif Kullanım: 3 gün
   ├─ Platform girişi: 8 kez
   ├─ İzlenen video: 12 adet
   ├─ Kullanılan değer: ~1.50 USDC
   └─ İade edilecek: ~13.50 USDC
   
   💡 Adil Kullanım: Sadece kullandığın kadar öde!
   ```

### Adım 8: Producer Gelir Yönetimi (Ahmet Bey)

**8.1. Gelir Takibi:**
Ahmet Bey, yönetim panelinde detaylı raporlar görebilir:
```
📈 Aylık Gelir Raporu - Eylül 2025
──────────────────────────────────────

👥 Toplam Aboneler: 47
💰 Toplam Gelir: 623.50 USDC
📊 Ortalama Abonelik Süresi: 22 gün
🔄 İptal Oranı: %12 (5 aboneden 1'i iptal etti)

📅 Günlük Breakdown:
├─ 15 Eylül: +5 abone, +75 USDC
├─ 16 Eylül: +2 abone, +30 USDC  
├─ 17 Eylül: +3 abone, -1 iptal, +30 USDC
└─ ...

🎯 En Başarılı İçerikler:
├─ React Fundamentals (ortalama %85 tamamlanma)
├─ JavaScript ES6+ (ortalama %92 tamamlanma)
└─ Full Stack Project (ortalama %67 tamamlanma)
```

**8.2. Stream'lerin Toplanması:**
1. Ahmet Bey, "Gelirleri Topla" butonuna tıklayabilir.
2. Bu, tüm aktif stream'lerden mevcut bakiyeyi kendi cüzdanına çeker.
3. Ya da gelirler otomatik olarak günlük/haftalık toplanabilir.

## Teknik Detaylar ve Edge Case'ler

### Platform Güvenlik Önlemleri

**1. Double Spending Koruması:**
- NFT kontrolü her sayfa yüklemesinde yapılır
- Stream durumu gerçek zamanlı kontrol edilir
- Expired stream'ler anında devre dışı bırakılır

**2. Ödeme Güvenliği:**
- USDC transferleri SafeERC20 kütüphanesi ile yapılır
- Stream rate hesaplamaları overflow/underflow'a karşı korunur
- Emergency pause mekanizması mevcuttur

**3. Platform Availability:**
- İçerik IPFS üzerinde dağıtık olarak saklanır
- Smart contract'lar upgradeability desteği sağlar
- Producer offline olsa bile stream'ler devam eder

**Sonuç:** Bu model, hem müşteri hem de üretici için şeffaf, güvenli ve adil bir abonelik sistemi oluşturur. Müşteri sadece kullandığı hizmet kadar ödeme yapar, üretici ise öngörülebilir bir gelir akışı elde eder.

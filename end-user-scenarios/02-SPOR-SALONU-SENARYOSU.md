# Senaryo 2: Spor Salonu (Kullandıkça Öde Modeli)

Bu senaryoda, "FitLife Gym" adında bir spor salonu, müşterilerine esnek kullanım paketleri sunmaktadır.

**Katılımcılar:**
- **Üretici:** FitLife Gym (Mehmet Abi - Salon Sahibi)
- **Müşteri:** Ali Kaya, düzenli spor yapmak isteyen 28 yaşında bir yazılım geliştirici.

## Platform Kurulumu ve Plan Oluşturma

### Adım 1: Spor Salonu Blicence'e Kaydolur

**1.1. Mehmet Abi'nin Motivasyonu:**
- Geleneksel üyelik sistemi müşterileri korkutuyor (yıllık ödeme zorlamasi)
- COVID sonrası esnek ödeme modelleri daha popüler
- Genç müşteriler blockchain ve kripto ödemelere açık
- Müşteri kaybını azaltmak ve şeffaflığı artırmak istiyor

**1.2. Producer Oluşturma Süreci:**
1. Mehmet Abi, `blicence.io` adresine gider ve "İşletmem için Başla" butonuna tıklar.
2. İşletme bilgilerini doldurur:
   ```
   İşletme Adı: FitLife Gym
   Kategori: Spor ve Fitness
   Açıklama: Modern ekipmanlar ve uzman eğitmenlerle donatılmış boutique fitness salonu
   Adres: Bağdat Caddesi No:123, Kadıköy/İstanbul
   Web Sitesi: https://fitlifegym.com.tr
   Instagram: @fitlifegym_kadikoy
   Logo: fitlife_logo.png
   ```
3. MetaMask ile cüzdanını bağlar ve Factory kontratından Producer oluşturur.
4. Producer ID #445 ve kontrat adresi 0x123abc... alır.

### Adım 2: Esnek Plan Paketleri Oluşturma

**2.1. "10 Giriş Paketi" Oluşturma:**
```
Plan Detayları:
──────────────────
Plan Adı: 10 Girişlik Fitness Paketi
Plan Tipi: nUsage (Kullandıkça Öde)
Paket Fiyatı: 50 USDC (5 USDC/giriş)
Geçerlilik Süresi: 90 gün
Kullanım Kotası: 10 giriş

Dahil Olan Hizmetler:
✅ Kardio ve ağırlık alanı erişimi
✅ Soyunma odası ve duş
✅ Ücretsiz Wi-Fi
✅ Temel danışmanlık
❌ Kişisel antrenör (ek ücret)
❌ Grup dersleri (ek ücret)
```

**2.2. Smart Contract Konfigürasyonu:**
```solidity
// Producer kontratında plan oluşturma
DataTypes.Plan({
    planId: 0, // Otomatik atanacak
    producerAddress: 0x123abc..., // FitLife kontratı
    name: "10 Girişlik Fitness Paketi", 
    description: "90 gün içinde kullanılabilir 10 salon girişi",
    image: "ipfs://fitness-package-nft-image",
    priceAddress: 0xa0b86a33e6c8..., // USDC kontratı
    planType: DataTypes.PlanTypes.nUsage,
    status: DataTypes.Status.active
})

// nUsage bilgileri ekleme
DataTypes.PlanInfoNUsage({
    planId: 67, // Yeni oluşturulan plan ID
    oneUsagePrice: 5000000, // 5 USDC (6 decimal)
    maxUsage: 10, // Maksimum kullanım sayısı
    usageDescription: "Salon girişi + temel ekipman kullanımı"
})
```

**2.3. Alternatif Planlar:**
Mehmet Abi, farklı müşteri segmentleri için ek planlar oluşturur:

| Plan | Tip | Fiyat | Süre | Özellikler |
|------|-----|--------|------|------------|
| 5 Girişlik Deneme | nUsage | 30 USDC | 30 gün | Temel ekipmanlar |
| 10 Girişlik Standart | nUsage | 50 USDC | 90 gün | + Danışmanlık |
| 20 Girişlik Pro | nUsage | 85 USDC | 120 gün | + 2 grup dersi |
| Aylık Sınırsız | API | 80 USDC/ay | 30 gün | Sınırsız giriş + tüm dersler |

## Müşteri Deneyimi: Esnek Paket Satın Alma

### Adım 3: Ali'nin Spor Salonu Keşfi

**3.1. Keşif Süreci:**
1. Ali, İstanbul'da yeni bir işe başlar ve evine yakın spor salonu arar.
2. Google Maps'te "spor salonu Kadıköy" arar ve FitLife Gym'i görür.
3. Google yorumlarında "esnek ödeme sistemi" ve "blockchain ile ödeme" yorumları dikkatini çeker.
4. `fitlifegym.com.tr` adresine gider.

**3.2. Web Sitesi Deneyimi:**
Ana sayfa şu bilgileri sunar:
```
🏋️ FitLife Gym - Geleceğin Fitness Deneyimi

💡 Yeni Nesil Üyelik Sistemi:
├─ Kullandığın kadar öde
├─ İstediğin zaman iptal et  
├─ Blockchain güvencesi
└─ Anında para iadesi

📍 Kadıköy Bağdat Caddesi
⏰ Hafta içi: 06:00-24:00 | Hafta sonu: 08:00-22:00
📱 Instagram: @fitlifegym_kadikoy

[Ücretsiz Deneme Al] [Planları Gör] [Turu İzle]
```

**3.3. Plan Karşılaştırması:**
Ali, "Planları Gör" sekmesinde detaylı karşılaştırma yapar:

```
💰 FitLife Gym Fiyatlandırma

┌─ ESNEK PAKETLER (Kullandıkça Öde) ────────┐
│                                            │
│ 🥉 5 Girişlik Deneme                      │
│    30 USDC • 30 gün geçerli               │
│    ✅ Temel ekipmanlar                      │
│    ❌ Grup dersleri                         │
│                                            │
│ 🥈 10 Girişlik Standart ⭐ EN POPÜLER     │
│    50 USDC • 90 gün geçerli               │
│    ✅ Tüm ekipmanlar                        │
│    ✅ Temel danışmanlık                     │
│    ❌ Grup dersleri                         │
│                                            │
│ 🥇 20 Girişlik Pro                         │
│    85 USDC • 120 gün geçerli              │
│    ✅ Tüm özellikler                        │
│    ✅ 2 ücretsiz grup dersi                 │
│    ✅ Beslenme planı                        │
└────────────────────────────────────────────┘

🔄 Geleneksel üyelik sistemiyle karşılaştırma:
├─ Diğer salonlar: 100-150 TL/ay (zorla yıllık)
├─ FitLife esnek: Sadece kullandığın kadar
├─ İptal garantisi: %100 para iadesi
└─ Şeffaflık: Blockchain üzerinde takip

💡 Neden FitLife?
"Klasik salonda 1 yıl üyelik aldım, 3 ay gittim.
9 ayın parasını çöpe attım. Burada sadece 
gittiğim günlerin parasını ödeyeceğim!" 
- Ahmet K. (Google yorumu)
```

### Adım 4: "10 Girişlik Standart" Paket Satın Alma

**4.1. Paket Seçimi:**
1. Ali, "10 Girişlik Standart" paketi seçer (en popüler, 90 gün süreli).
2. "Satın Al" butonuna tıklar ve kayıt formunu doldurur:
   ```
   Kişisel Bilgiler:
   ├─ Ad Soyad: Ali Kaya
   ├─ Telefon: +90 532 XXX XX XX
   ├─ E-mail: ali.kaya@gmail.com
   ├─ Doğum Tarihi: 1995-03-15
   └─ Acil Durum Kişisi: Ayşe Kaya (+90 533 XXX XX XX)
   
   Sağlık Bilgileri:
   ├─ Kronik hastalık: Yok
   ├─ Yaralanma geçmişi: Yok  
   ├─ İlaç kullanımı: Yok
   └─ Hedef: Kilo vermek ve kas yapmak
   ```

**4.2. Cüzdan Bağlantısı ve Ödeme:**
1. Ali, MetaMask'ını bağlar (cüzdan adresi: 0x456def...).
2. USDC bakiyesini kontrol eder: 127.50 USDC (yeterli).
3. İşlem detaylarını gözden geçirir:
   ```
   🧾 Satın Alma Özeti
   ──────────────────────
   
   📦 Paket: 10 Girişlik Standart
   💰 Fiyat: 50 USDC
   ⏰ Geçerlilik: 90 gün (18 Aralık 2025'e kadar)
   📍 Salon: FitLife Gym Kadıköy
   
   💡 Akıllı Ödeme:
   Paranız hemen salona gitmez. Her salon kullanımınızda
   5 USDC otomatik olarak salona aktarılır. Paket iptal
   ederseniz, kullanmadığınız girişlerin parasını anında
   geri alırsınız.
   
   📋 İşlem Detayları:
   ├─ Stream Süresi: 90 gün
   ├─ Kullanım başına ödeme: 5 USDC
   ├─ Maksimum kullanım: 10 kez
   └─ İptal hakkı: 90 gün boyunca
   
   Gas Fee: ~0.012 ETH
   [Satın Al ve Cüzdanı İmzala]
   ```

**4.3. Blockchain İşlemi (Stream + nUsage):**
1. Ali "Satın Al" butonuna tıklar.
2. MetaMask şu işlemi gösterir:
   ```solidity
   // 1. Ana CustomerPlan oluşturma
   addCustomerPlanWithStream(
     DataTypes.CustomerPlan({
       custumerPlanId: 2156,
       customerAdress: 0x456def..., // Ali
       cloneAddress: 0x123abc..., // FitLife  
       planId: 67,
       planType: DataTypes.PlanTypes.nUsage,
       remainingQuota: 10, // 10 giriş hakkı
       usedQuota: 0,
       status: DataTypes.Status.active
     }),
     streamDuration: 7776000 // 90 gün
   )
   
   // 2. StreamLockManager'da stream oluşturma
   createStreamForCustomerPlan(
     customerPlanId: 2156,
     customer: 0x456def...,
     producer: 0x123abc...,
     token: 0xa0b86a33e6c8..., // USDC
     totalAmount: 50000000, // 50 USDC
     duration: 7776000 // 90 gün
   )
   ```

3. İşlem onaylanır (Transaction: `0x123transaction...`).

**4.4. NFT Üyelik Kartı:**
İşlem tamamlandığında Ali'ye özel NFT gönderilir:
```json
{
  "tokenId": 2156,
  "name": "FitLife Gym Üyelik #2156",
  "description": "10 Girişlik Fitness Paketi - 90 gün geçerli",
  "image": "ipfs://fitlife-membership-nft",
  "attributes": [
    {"trait_type": "Salon", "value": "FitLife Gym Kadıköy"},
    {"trait_type": "Paket", "value": "10 Girişlik Standart"},
    {"trait_type": "Kalan Giriş", "value": "10"},
    {"trait_type": "Başlangıç", "value": "2025-09-15"},
    {"trait_type": "Bitiş", "value": "2025-12-18"},
    {"trait_type": "Status", "value": "Aktif"}
  ],
  "external_url": "https://fitlifegym.com.tr/membership/2156"
}
```

## Salon Kullanımı ve Gerçek Zamanlı Ödemeler

### Adım 5: İlk Salon Ziyareti (Ali)

**5.1. Salon Girişi:**
1. Ali, 3 gün sonra spor yapmaya karar verir ve FitLife Gym'e gider.
2. Salon girişinde şu teknolojiler mevcuttur:
   - QR kod scanner
   - NFC okuyucu  
   - Manuel NFT ID girişi
   - Mobil uygulama check-in

**5.2. QR Kod ile Giriş:**
1. Ali, telefonundaki MetaMask uygulamasını açar.
2. Salon girişindeki QR kodu okutması için kameraya yönlendirilir.
3. QR kod şu bilgileri içerir:
   ```json
   {
     "type": "gym_checkin",
     "producer_address": "0x123abc...",
     "location": "FitLife Gym Kadıköy",
     "service_type": "gym_entry",
     "timestamp": "2025-09-18T09:30:00Z"
   }
   ```

**5.3. Smart Contract İşlemi (Kotadan Kullanım):**
1. QR kod okutulunca, MetaMask otomatik olarak şu işlemi hazırlar:
   ```solidity
   // Producer kontratında useFromQuota fonksiyonu
   useFromQuota(
     DataTypes.CustomerPlan({
       custumerPlanId: 2156,
       customerAdress: 0x456def..., // Ali
       cloneAddress: 0x123abc..., // FitLife
       planId: 67,
       planType: DataTypes.PlanTypes.nUsage,
       remainingQuota: 10, // Mevcut kota
       usedQuota: 0, // Şu ana kadar kullanılan
       status: DataTypes.Status.active
     })
   )
   ```

2. İşlem öncesi otomatik kontroller:
   ```solidity
   // 1. Stream durumu kontrolü
   checkStreamBeforeUsage(2156, 0x456def...)
   
   // 2. NFT ownership kontrolü  
   require(ownerOf(2156) == 0x456def...)
   
   // 3. Kota kontrolü
   require(remainingQuota > 0)
   
   // 4. Plan geçerlilik kontrolü
   require(block.timestamp <= plan.endTime)
   ```

**5.4. Ödeme ve Kota Düşürme:**
İşlem başarılı olunca:
1. Ali'nin NFT'sindeki `remainingQuota` 10'dan 9'a düşer.
2. `usedQuota` 0'dan 1'e çıkar.
3. StreamLockManager'dan 5 USDC anında FitLife Gym'e aktarılır:
   ```
   Stream Güncelleme:
   ├─ Toplam kilitlenen: 50 USDC
   ├─ Bu güne kadar aktarılan: 5 USDC (1 kullanım)
   ├─ Kalan locked miktar: 45 USDC
   └─ Kalan kullanım hakkı: 9
   ```

**5.5. Salon Girişi Onayı:**
1. İşlem onaylandığında (3-5 saniye), salon turnikleri açılır.
2. Ali'nin telefonunda başarı mesajı görünür:
   ```
   ✅ FitLife Gym'e Hoş Geldin Ali!
   
   📊 Üyelik Durumu:
   ├─ Kalan Giriş: 9/10
   ├─ Bu Kullanım: 5 USDC ödendi
   ├─ Kalan Bakiye: 45 USDC
   └─ Geçerlilik: 85 gün
   
   💡 İpucu: Antrenman sonrası check-out yapmayı unutma!
   [Antrenman Planını Gör] [Check-out Yap]
   ```

3. Resepsiyonda bulunan ekranda da Ali'nin girişi görünür:
   ```
   👋 Hoş Geldin Ali Kaya!
   Üyelik: 10 Girişlik Standart (9 giriş kaldı)
   Son Ziyaret: İlk kez
   Hedef: Kilo verme + kas yapma
   ```

### Adım 6: Düzenli Salon Kullanımı

**6.1. 2. Hafta - Rutin Oluşturma:**
Ali, haftada 3 kez salon kullanmaya başlar:
```
📅 Ali'nin Salon Geçmişi:

🗓️ 1. Hafta:
├─ 18 Eylül (Çarşamba): Giriş #1 ✅
├─ 20 Eylül (Cuma): Giriş #2 ✅  
└─ 22 Eylül (Pazar): Giriş #3 ✅

💰 Ödeme Durumu:
├─ Toplam ödenen: 15 USDC (3 × 5 USDC)
├─ Kalan kilitli: 35 USDC
└─ Kalan giriş: 7

🗓️ 2. Hafta:
├─ 25 Eylül (Çarşamba): Giriş #4 ✅
├─ 27 Eylül (Cuma): Giriş #5 ✅
└─ 29 Eylül (Pazar): Giriş #6 ✅

💰 Güncel Durum:
├─ Toplam ödenen: 30 USDC (6 × 5 USDC)  
├─ Kalan kilitli: 20 USDC
└─ Kalan giriş: 4
```

**6.2. Salon Sahibinin Perspektifi (Mehmet Abi):**
Mehmet Abi, yönetim panelinde Ali'nin durumunu takip edebilir:
```
👤 Müşteri Detayı: Ali Kaya (ID: 2156)
────────────────────────────────────────

📊 Kullanım İstatistikleri:
├─ Kayıt Tarihi: 15 Eylül 2025
├─ Toplam Giriş: 6/10
├─ Ortalama/Hafta: 3 giriş
├─ En Aktif Gün: Cuma
├─ Ortalama Kalış: 1.2 saat

💰 Gelir Durumu:
├─ Ödenen: 30 USDC
├─ Beklenen: 20 USDC (4 giriş kaldı)
├─ Risk Skoru: Düşük (düzenli kullanım)

📈 Öneriler:
├─ Grup dersi önerisi gönder
├─ 20 girişlik pakete upgrade öner
└─ Beslenme danışmanlığı tanıt
```

### Adım 7: Paket İptali Senaryoları

#### Senaryo A: Erken İptal (6 Giriş Sonrası)

**A.1. İptal Kararı:**
1. Ali, 6 giriş yaptıktan sonra işyerinde spor salonu açıldığını öğrenir.
2. FitLife paketini iptal etmeye karar verir.
3. Kalan 4 girişin parasını (20 USDC) geri almak ister.

**A.2. İptal Süreci:**
1. Ali, fitlifegym.com.tr/my-membership adresine gider.
2. "Üyeliği İptal Et" butonuna tıklar.
3. Sistem, detaylı özet gösterir:
   ```
   🔄 Üyelik İptal İşlemi
   ──────────────────────
   
   📊 Mevcut Durum:
   ├─ Toplam Paket: 10 giriş (50 USDC)
   ├─ Kullanılan: 6 giriş (30 USDC)
   ├─ Kullanılmayan: 4 giriş (20 USDC)
   └─ Geçerlilik: 55 gün kaldı
   
   💰 İade Hesabı:
   ├─ İade edilecek: 20 USDC
   ├─ İşlem ücreti: ~0.008 ETH
   ├─ İade süresi: Anında
   └─ Toplam tasarruf: %40 (20/50 USDC)
   
   ⚠️ İptal sonrası:
   ├─ Salon erişimi kapanır
   ├─ NFT yakılır (geri getirilemez)
   ├─ Kalan girişler geçersiz olur
   └─ Yeniden katılım için yeni paket gerekir
   
   [İptal Et ve Para İadesi Al] [Vazgeç]
   ```

**A.3. Blockchain İptal İşlemi:**
1. Ali "İptal Et" butonuna tıklar.
2. MetaMask şu işlemi gösterir:
   ```solidity
   // 1. CustomerPlan güncelleme
   updateCustomerPlan(
     DataTypes.CustomerPlan({
       // ... diğer bilgiler
       status: DataTypes.Status.inactive,
       remainingQuota: 4 // Kalan giriş sayısı
     })
   )
   
   // 2. Stream iptal etme (StreamLockManager)
   cancelStream(streamLockId: 0xdef456...)
   
   // 3. NFT yakma
   uriGenerator.burn(customerPlanData)
   ```

3. İşlem onaylandığında:
   - 20 USDC anında Ali'nin cüzdanına iade edilir
   - Stream deaktive edilir
   - NFT yakılır
   - Salon erişimi kapanır

#### Senaryo B: Tam Kullanım ve Yenileme

**B.1. Paket Tamamlanması:**
1. Ali, 5 hafta içinde tüm 10 girişini kullanır.
2. Son giriş sonrası sistem mesajı:
   ```
   🎉 Paket Tamamlandı!
   
   📊 Kullanım Özeti:
   ├─ Toplam giriş: 10/10 ✅
   ├─ Toplam ödenen: 50 USDC
   ├─ Ortalama/hafta: 2.5 giriş
   ├─ Toplam antrenman: 12.5 saat
   └─ Kalori yakımı: ~3,750 cal
   
   🔄 Yenileme Seçenekleri:
   ├─ Aynı paket (10 giriş - 50 USDC)
   ├─ Upgrade (20 giriş - 85 USDC) %15 indirim
   ├─ Premium (Aylık sınırsız - 80 USDC)
   └─ Ara ver (istediğin zaman geri dön)
   ```

**B.2. Otomatik Yenileme Önerisi:**
```
💡 Kişiselleştirilmiş Öneri (AI bazlı):

Ali, son 5 haftadaki kullanım paternin analiz edildi:

📈 Analiz Sonucu:
├─ Haftada ortalama 2.5 giriş yapıyorsun
├─ En aktif günler: Çarşamba, Cuma, Pazar
├─ Ortalama kalış süresi: 75 dakika
└─ Antrenman consistency: %86 (çok iyi!)

🎯 Tavsiye: 20 Girişlik Pro Paket
├─ Mevcut hızınla 8 hafta kullanabilirsin
├─ Grup dersleri dahil olur
├─ Giriş başına maliyet: 4.25 USDC (%15 tasarruf)
└─ Beslenme planı hediye

[20 Girişlik Pro'ya Geç] [10 Girişlik Tekrarla] [Ara Ver]
```

### Adım 8: Salon Sahibinin Gelir Analizi

**8.1. Aylık Rapor (Mehmet Abi):**
```
📊 FitLife Gym - Eylül 2025 Raporu
─────────────────────────────────────

👥 Toplam Üye Sayısı: 127
💰 Toplam Gelir: 4,850 USDC
📈 Bir Önceki Ay: +%18 büyüme

📦 Paket Dağılımı:
├─ 5 Girişlik: 23 üye (%18)
├─ 10 Girişlik: 67 üye (%53) ⭐ En popüler
├─ 20 Girişlik: 28 üye (%22)
└─ Aylık Sınırsız: 9 üye (%7)

🔄 Kullanım İstatistikleri:
├─ Ortalama paket tamamlama: %78
├─ İptal oranı: %12 (sektör ort: %35)
├─ Yenileme oranı: %67 (sektör ort: %45)
└─ Müşteri memnuniyeti: 4.7/5

💡 Blicence Avantajları:
├─ Geleneksel sisteme göre %23 daha az iptal
├─ Müşteri güveni: %100 para iadesi garantisi
├─ Nakit akışı: Öngörülebilir stream ödemeleri
└─ Operasyon: Otomatik üyelik yönetimi

🎯 Gelecek Ay Hedefleri:
├─ 150 üyeye ulaşmak
├─ Grup dersi paketleri eklemek
├─ Kişisel antrenör stream sistemi
└─ Beslenme danışmanlığı modülü
```

## Teknik Detaylar ve Edge Case'ler

### Özel Durumlar ve Çözümleri

**1. Internet Bağlantısı Kesilmesi:**
- Offline mod: Son 24 saat içindeki işlemler cache'lenir
- Manuel ID girişi ile salon erişimi sağlanır
- Bağlantı gelince işlemler blockchain'e senkronize edilir

**2. NFT Kaybı veya Cüzdan Değişikliği:**
- E-mail + telefon ile kimlik doğrulama
- Yeni cüzdana NFT transfer işlemi
- Güvenlik için 24 saat bekleme süresi

**3. Fiyat Volatilitesi (USDC/TL):**
- Sabit USDC fiyatlandırması
- TL'ye çevrim güncel kurlarla gösterilir
- Opsiyonel: Stablecoin hedge mekanizmaları

**4. Salon Kapanması veya Taşınması:**
- Otomatik para iadesi sistemi
- Partner salonlarda kullanım hakkı
- Force majeure protokolleri

**Sonuç:** Bu nUsage modeli, geleneksel spor salonu üyeliklerinin dezavantajlarını ortadan kaldırarak, hem müşteri hem işletme için adil ve şeffaf bir sistem oluşturur. Müşteriler sadece kullandıkları hizmet kadar öderken, işletmeler de düzenli ve öngörülebilir gelir elde ederler.

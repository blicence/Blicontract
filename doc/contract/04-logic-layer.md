# Mantık Katmanı (Logic Layer)

Bu dokümantasyon, BliContract sisteminin mantık katmanını oluşturan üç ana kontratı detaylarıyla açıklamaktadır. Bu kontratlar, farklı plan türlerine özgü iş mantığını yönetir.

## İçindekiler
- [Genel Bakış](#genel-bakış)
- [ProducerApi](#producerapi)
- [ProducerNUsage](#producernusage)
- [ProducerVestingApi](#producervestingapi)
- [Ortak Özellikler](#ortak-özellikler)
- [Güvenlik Düşünceleri](#güvenlik-düşünceleri)

---

## Genel Bakış

Mantık katmanı, BliContract sisteminde farklı abonelik plan türlerinin özel iş mantığını yönetir. Her kontrat belirli bir plan türüne odaklanır ve modüler bir yapı sağlar.

### Plan Türleri ve İlgili Kontratlar

| Plan Türü | Kontrat | Açıklama |
|-----------|---------|----------|
| `api` | [`ProducerApi`](#producerapi) | Superfluid stream tabanlı API abonelikleri |
| `nUsage` | [`ProducerNUsage`](#producernusage) | Kota tabanlı kullanım planları |
| `vestingApi` | [`ProducerVestingApi`](#producervestingapi) | Vesting schedule tabanlı planlar |

### Mimari Prensipleri

1. **Separation of Concerns**: Her kontrat tek bir plan türünü yönetir
2. **Storage Delegation**: Veri işlemleri ProducerStorage'a delege edilir
3. **Producer Authorization**: Yalnızca doğru Producer kontratları çağrı yapabilir
4. **Upgradeable Pattern**: UUPS proxy pattern ile yükseltilebilirlik

---

## ProducerApi

### Genel Bakış
[`ProducerApi.sol`](../../contracts/logic/ProducerApi.sol) kontratı, Superfluid tabanlı API abonelik planlarının mantığını yönetir.

### Kalıtım
```solidity
contract ProducerApi is
    IProducerApi,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
```

### Durum Değişkenleri

```solidity
IProducerStorage public producerStorage;
```

### Superfluid Entegrasyonu

#### Kütüphane Kullanımı
```solidity
using SuperTokenV1Library for ISuperToken;
```

**SuperTokenV1Library**: Superfluid token işlemleri için yardımcı kütüphane

### Olaylar

```solidity
event startedStream(address indexed customerAdress, address producer);
event stoppedStream(address indexed customerAdress, address producer);
```

| Olay | Ne Zaman Tetiklenir |
|------|-------------------|
| `startedStream` | Yeni stream başlatıldığında |
| `stoppedStream` | Stream durdurulduğunda |

### Başlatma

#### `initialize()`
```solidity
function initialize() external initializer onlyProxy
```
- OpenZeppelin kontratlarını başlatır
- UUPS proxy pattern gereksinimi

#### `setProducerStorage()`
```solidity
function setProducerStorage(address _producerStorage) external onlyOwner
```
ProducerStorage kontrat adresini ayarlar.

### Modifier'lar

#### `onlyProducer`
```solidity
modifier onlyProducer(address _cloneAddress)
```
- Yalnızca belirtilen Producer clone'unun çağrı yapabilmesini sağlar
- `producerStorage.getProducer(_cloneAddress).cloneAddress == msg.sender` kontrolü

#### `OnlyRightProducer`
```solidity
modifier OnlyRightProducer(uint256 _producerId, address cloneAddress)
```
- Producer ID ve clone address eşleşmesini doğrular
- `producerStorage.getCloneId(_producerId) == cloneAddress` kontrolü

#### `onlyExistCustumer`
```solidity
modifier onlyExistCustumer(uint256 planId, address customerAddress, address cloneAddress)
```
Müşteri planının var olduğunu kontrol eder.

### Ana Fonksiyonlar

#### `addCustomerPlan()`
```solidity
function addCustomerPlan(DataTypes.CustomerPlan memory vars) 
    external onlyProducer(vars.cloneAddress)
```

**İş Akışı:**
1. Plan bilgilerini storage'dan alır (`getPlanInfoApi`)
2. Superfluid stream oluşturur
3. Müşteri planını storage'a ekler
4. `startedStream` olayını yayınlar

**Stream Oluşturma:**
```solidity
ISuperToken(vars.priceAddress).createFlowFrom(
    vars.customerAdress, 
    vars.cloneAddress, 
    planInfoApi.flowRate
);
```

#### `updateCustomerPlan()`
```solidity
function updateCustomerPlan(DataTypes.CustomerPlan calldata vars)
    external onlyProducer(vars.cloneAddress) OnlyRightProducer(vars.producerId, vars.cloneAddress)
```

**İş Akışı:**
1. Mevcut stream'in varlığını kontrol eder
2. Mevcut stream'i siler
3. Plan aktifse yeni stream oluşturur
4. Müşteri planını günceller

**Stream Kontrolleri:**
```solidity
require(
    getFlow(vars.priceAddress, vars.customerAdress, address(this)) <= 0,
    "flow non exist for this address this token"
);
```

### Superfluid Yardımcı Fonksiyonlar

#### Token Wrapping/Unwrapping
```solidity
function wrapSuperToken(address token, address superTokenAddress, uint amountToWrap) internal
function unwrapSuperToken(address superTokenAddress, uint amountToUnwrap) internal
```

**Wrap İşlemi:**
1. ERC20 token'ı SuperToken'a onay verir
2. `upgrade()` fonksiyonu ile wrap eder

**Unwrap İşlemi:**
1. `downgrade()` fonksiyonu ile unwrap eder

#### Stream Yönetimi
```solidity
function createFlow(address superTokenAddress, address receiver, int96 flowRate) internal
function deleteFlow(address superTokenAddress, address sender, address receiver) internal
```

#### Stream Sorgulama
```solidity
function getFlow(address superTokenAddress, address sender, address receiver) 
    public view returns (int96)

function getFlowInfo(address superTokenAddress, address sender, address receiver)
    public view returns (uint256 lastUpdated, int96 flowRate, uint256 deposit, uint256 owedDeposit)

function getNetFlow(ISuperToken superToken, address account) 
    public view returns (int96)
```

### API Plan Özellikleri

- **Sürekli Ödeme**: Superfluid stream ile saniye bazında ödeme
- **Otomatik Ödeme**: Müşteri bakiyesi olduğu sürece otomatik ödeme
- **Flow Rate Kontrolü**: Aylık/yıllık abonelik fiyatının saniye bazında hesaplanması
- **Stream Yönetimi**: Başlatma, durdurma, güncelleme

---

## ProducerNUsage

### Genel Bakış
[`ProducerNUsage.sol`](../../contracts/logic/ProducerNUsage.sol) kontratı, kullanım kotası tabanlı planların mantığını yönetir.

### Kalıtım
```solidity
contract ProducerNUsage is
    IProducerNUsage,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
```

### Durum Değişkenleri

```solidity
IProducerStorage public producerStorage;
```

### Başlatma

#### `initialize()`
```solidity
function initialize() external initializer onlyProxy
```

#### `setProducerStorage()`
```solidity
function setProducerStorage(address _producerStorage) external onlyOwner
```

### Modifier'lar

ProducerApi ile aynı modifier'ları kullanır:
- `onlyProducer(address _cloneAddress)`
- `OnlyRightProducer(uint256 _producerId, address cloneAddress)`

### Ana Fonksiyonlar

#### `addCustomerPlan()`
```solidity
function addCustomerPlan(DataTypes.CustomerPlan memory vars) 
    external onlyProducer(vars.cloneAddress)
```

**Basit İş Akışı:**
1. Yalnızca Producer'dan gelen çağrıyı doğrular
2. Müşteri planını doğrudan storage'a ekler

**Not**: Ödeme mantığı Producer kontratında yönetilir:
- Token bakiye kontrolü
- Token transferi
- Kota hesaplaması

#### `updateCustomerPlan()`
```solidity
function updateCustomerPlan(DataTypes.CustomerPlan calldata vars)
    external onlyProducer(vars.cloneAddress) OnlyRightProducer(vars.producerId, vars.cloneAddress)
```

Müşteri planını storage'da günceller. İade mantığı Producer kontratında işlenir.

#### `useFromQuota()`
```solidity
function useFromQuota(DataTypes.CustomerPlan calldata vars)
    external onlyProducer(vars.cloneAddress) OnlyRightProducer(vars.producerId, vars.cloneAddress)
    returns (uint256)
```

**Amaç**: Müşterinin kotasından kullanım yapılması
**Dönüş**: Storage'dan dönen kalan kota miktarı

### NUsage Plan Özellikleri

- **Ön Ödemeli Sistem**: Müşteri önceden kota satın alır
- **Kota Takibi**: Her kullanımda kota azaltılır
- **İade Mekanizması**: İptal durumunda kalan kota iade edilir
- **Basit Mantık**: Sadece storage operasyonları, ödeme Producer'da

---

## ProducerVestingApi

### Genel Bakış
[`ProducerVestingApi.sol`](../../contracts/logic/ProducerVestingApi.sol) kontratı, vesting (hak ediş) tabanlı planların mantığını yönetir.

### Kalıtım
```solidity
contract ProducerVestingApi is
    IProducerVestingApi,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
```

### Durum Değişkenleri

```solidity
IVestingScheduler private vestingScheduler;
IProducerStorage public producerStorage;
```

### Başlatma

#### `initialize()`
```solidity
function initialize() external initializer onlyProxy
```

#### `setSuperInitialize()`
```solidity
function setSuperInitialize(IVestingScheduler _vestingScheduler) external onlyOwner
```

**Amaç**: Harici VestingScheduler kontratını ayarlar
**Önemli**: Bu kontrat harici bir vesting sistemi kullanır

#### `setProducerStorage()`
```solidity
function setProducerStorage(address _producerStorage) external onlyOwner
```

### Modifier'lar

ProducerApi ile aynı modifier'ları kullanır:
- `onlyProducer(address _cloneAddress)`
- `OnlyRightProducer(uint256 _producerId, address cloneAddress)`

### Vesting Schedule Yönetimi

#### `createVestingSchedule()`
```solidity
function createVestingSchedule(
    ISuperToken superToken,
    address receiver,
    uint32 startDate,
    uint32 cliffDate,
    int96 flowRate,
    uint256 startAmount,
    uint32 endDate,
    bytes memory ctx
) public
```

**Parametreler:**
- `superToken`: Vesting yapılacak SuperToken
- `receiver`: Token alıcısı
- `startDate`: Başlangıç tarihi
- `cliffDate`: Cliff tarihi (ani ödeme tarihi)
- `flowRate`: Stream akış hızı
- `startAmount`: Cliff'te ödenecek miktar
- `endDate`: Bitiş tarihi
- `ctx`: Superfluid context

**Harici Delegasyon**: `vestingScheduler.createVestingSchedule()` çağırır

#### `getVestingSchedule()`
```solidity
function getVestingSchedule(
    ISuperToken superToken,
    address account,
    address receiver
) public view returns (IVestingScheduler.VestingSchedule memory)
```

Mevcut vesting schedule'ını sorgular.

#### `updateVestingSchedule()`
```solidity
function updateVestingSchedule(
    ISuperToken superToken,
    address receiver,
    uint32 endDate,
    bytes memory ctx
) public returns (bytes memory newCtx)
```

Vesting schedule'ının bitiş tarihini günceller.

#### `deleteVestingSchedule()`
```solidity
function deleteVestingSchedule(
    ISuperToken superToken,
    address receiver,
    bytes memory ctx
) public returns (bytes memory newCtx)
```

Vesting schedule'ını siler.

### Müşteri Plan Yönetimi

#### `addCustomerPlan()`
```solidity
function addCustomerPlan(DataTypes.CustomerPlan calldata vars) 
    public onlyProducer(vars.cloneAddress)
```

**İş Akışı:**
1. Plan bilgilerini storage'dan alır (`getPlanInfoVesting`)
2. Vesting schedule oluşturur
3. Müşteri planını storage'a ekler

**Schedule Oluşturma:**
```solidity
createVestingSchedule(
    ISuperToken(vars.priceAddress),
    vars.cloneAddress,           // receiver
    vars.startDate,              // start
    planInfoVesting.cliffDate,   // cliff
    planInfoVesting.flowRate,    // flow rate
    planInfoVesting.startAmount, // cliff amount
    vars.endDate,                // end
    ""                          // empty context
);
```

#### `updateCustomerPlan()`
```solidity
function updateCustomerPlan(DataTypes.CustomerPlan calldata vars)
    public onlyProducer(vars.cloneAddress) OnlyRightProducer(vars.producerId, vars.cloneAddress)
```

**İş Akışı:**
1. Mevcut vesting schedule'ını siler
2. Plan aktifse yeni schedule oluşturur
3. Müşteri planını günceller

### Superfluid Token Yardımcıları

#### Token Wrapping
```solidity
function wrapSuperToken(address token, address superTokenAddress, uint amountToWrap) internal
function unwrapSuperToken(address superTokenAddress, uint amountToUnwrap) internal
```

ProducerApi ile aynı mantık.

### Vesting Plan Özellikleri

- **Cliff + Stream**: Başlangıçta ani ödeme + sonrasında stream
- **Zaman Tabanlı**: Belirli tarih aralığında vesting
- **Harici Scheduler**: VestingScheduler kontratı kullanımı
- **Superfluid Entegrasyonu**: Stream tabanlı vesting
- **Esnek Güncelleme**: Bitiş tarihi güncellenebilir

---

## Ortak Özellikler

### 1. UUPS Proxy Pattern

Tüm kontratlar yükseltilebilir:
```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

### 2. Producer Authorization

Ortak modifier'lar:
```solidity
modifier onlyProducer(address _cloneAddress) {
    require(
        producerStorage.getProducer(_cloneAddress).cloneAddress == msg.sender,
        "Only producer contract can call this function"
    );
    _;
}

modifier OnlyRightProducer(uint256 _producerId, address cloneAddress) {
    require(
        producerStorage.getCloneId(_producerId) == cloneAddress,
        "right producer contract can call this function"
    );
    _;
}
```

### 3. Storage Delegation

Tüm kontratlar veri işlemlerini ProducerStorage'a delege eder:
- `producerStorage.addCustomerPlan(vars)`
- `producerStorage.updateCustomerPlan(vars)`
- `producerStorage.getPlanInfo**(planId)`

### 4. Başlatma Paterni

```solidity
function initialize() external initializer onlyProxy {
    __Ownable_init();
}

function setProducerStorage(address _producerStorage) external onlyOwner {
    producerStorage = IProducerStorage(_producerStorage);
}
```

---

## Güvenlik Düşünceleri

### 1. Access Control

#### Producer Doğrulama
- **İkili Kontrol**: `onlyProducer` + `OnlyRightProducer`
- **Clone Validation**: Storage'dan clone adresi doğrulaması
- **ID Mapping**: Producer ID ve clone address eşleşmesi

#### Owner Privileges
- **Storage Address**: Yalnızca owner storage adresini değiştirebilir
- **Upgrade Authorization**: Yalnızca owner yükseltme yapabilir
- **Vesting Scheduler**: Yalnızca owner harici scheduler ayarlayabilir

### 2. External Dependencies

#### Superfluid Riskleri
- **Stream Durumu**: Stream'in beklenmedik şekilde kapanması
- **Token Yetkinliği**: SuperToken'ın doğru çalışması
- **Flow Rate Limits**: Platform limitlerinin aşılması

#### VestingScheduler Riskleri
- **Harici Kontrat**: Güvenilir olması gereken harici bağımlılık
- **Schedule Execution**: Backend servislerin düzgün çalışması
- **Context Management**: Superfluid context'inin doğru kullanımı

### 3. State Consistency

#### Cross-Contract Calls
- **Storage Synchronization**: Tüm kontratlar aynı storage'ı kullanır
- **Atomic Operations**: İşlem başarısızlığında rollback
- **Event Consistency**: Duruma uygun event emission

#### Plan State Management
- **Status Transitions**: `active` ↔ `inactive` geçişleri
- **Resource Cleanup**: İptal durumunda kaynakların temizlenmesi
- **Quota Tracking**: NUsage planlarında kota tutarlılığı

### 4. Economic Security

#### Payment Validation
- **API Plans**: Stream'in doğru akması
- **NUsage Plans**: Ön ödeme ve kota hesaplaması
- **Vesting Plans**: Cliff ve stream miktarlarının doğruluğu

#### Refund Mechanisms
- **NUsage Refunds**: Kalan kotanın doğru hesaplanması
- **Stream Cleanup**: İptal edilen stream'lerin temizlenmesi
- **Vesting Cancellation**: Erken iptal durumları

### 5. Upgrade Safety

#### Storage Layout
- **Compatibility**: Yeni versiyonlarda storage layout uyumluluğu
- **State Migration**: Gerektiğinde veri migrasyonu
- **Rollback Plan**: Yükseltme başarısızlığında geri dönüş

#### Interface Stability
- **Backward Compatibility**: Mevcut integrations'ı bozmama
- **Deprecation Strategy**: Eski fonksiyonların devre dışı bırakılması
- **Version Management**: Versiyon kontrolü ve dokümantasyonu

---

## Sonuç

Mantık katmanı, BliContract sisteminin iş mantığını plan türlerine göre organize eder:

- **ProducerApi**: Sürekli ödeme stream'leri ile API abonelikleri
- **ProducerNUsage**: Ön ödemeli kota sistemleri
- **ProducerVestingApi**: Zaman tabanlı hak ediş planları

Her kontrat kendi uzmanlık alanında odaklanır ve modüler bir yapı sağlar. Bu yaklaşım:

- **Bakım Kolaylığı**: Ayrı sorumluluklar
- **Genişletilebilirlik**: Yeni plan türleri eklenebilir
- **Test Edilebilirlik**: İzole test senaryoları
- **Güvenlik**: Focused security review

imkanları sunar.
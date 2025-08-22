# Arayüz Katmanı (Interface Layer)

Bu dokümantasyon, BliContract sistemindeki tüm interface kontratlarını ve API spesifikasyonlarını detaylarıyla açıklamaktadır.

## İçindekiler
- [Genel Bakış](#genel-bakış)
- [IFactory](#ifactory)
- [IProducerStorage](#iproducerstorage)
- [IURIGenerator](#iurigenerator)
- [IProducerApi](#iproducerapi)
- [IProducerNUsage](#iproducernusage)
- [IProducerVestingApi](#iproducervestingapi)
- [IVestingScheduler](#ivestingscheduler)
- [ICustomerNft](#icustomernft)

---

## Genel Bakış

Interface katmanı, BliContract sisteminin farklı bileşenleri arasındaki etkileşimi standardize eder. Her interface, ilgili kontratların uygulaması gereken fonksiyonları tanımlar ve tip güvenliği sağlar.

### Interface Kategorileri

1. **Temel Sistem Interfaces**: `IFactory`, `IProducerStorage`, `IURIGenerator`
2. **Plan Mantığı Interfaces**: `IProducerApi`, `IProducerNUsage`, `IProducerVestingApi`
3. **Harici Entegrasyon Interfaces**: `IVestingScheduler`
4. **Yardımcı Interfaces**: `ICustomerNft`

---

## IFactory

### Genel Bakış
[`IFactory.sol`](../../contracts/interfaces/IFactory.sol) arayüzü, Factory kontratının dış dünyaya sunduğu fonksiyonları tanımlar.

### Fonksiyonlar

#### `initialize()`
```solidity
function initialize(
    address _uriGeneratorAddress,
    address _producerStorageAddress, 
    address _producerApiAddress,
    address _producerNUsageAddress,
    address _producerVestingApiAddress
) external;
```

**Amaç**: Factory kontratının başlatılması
**Parametreler**:
- `_uriGeneratorAddress`: URI oluşturucu kontrat adresi
- `_producerStorageAddress`: Depolama kontrat adresi
- `_producerApiAddress`: API mantık kontrat adresi
- `_producerNUsageAddress`: Kullanım mantık kontrat adresi
- `_producerVestingApiAddress`: Vesting mantık kontrat adresi

#### `newBcontract()`
```solidity
function newBcontract(DataTypes.Producer calldata vars) external;
```

**Amaç**: Yeni Producer kontratı klonu oluşturur
**Parametreler**:
- `vars`: Producer bilgilerini içeren struct

#### Implementation Yönetimi
```solidity
function getProducerImplementation() external view returns (address);
function setProducerImplementation(address _ProducerImplementationAddress) external;
```

**`getProducerImplementation()`**:
- **Dönüş**: Mevcut Producer implementation adresi
- **Kullanım**: Hangi implementation'ın kullanıldığını öğrenmek için

**`setProducerImplementation()`**:
- **Amaç**: Yeni Producer implementation ayarlar
- **Yetki**: Yalnızca sahip

#### ID Yönetimi
```solidity
function currentPR_ID() external view returns (uint256);
function incrementPR_ID() external returns (uint256);
```

**`currentPR_ID()`**:
- **Dönüş**: Mevcut Producer ID sayacı
- **Kullanım**: Son Producer ID'sini öğrenmek için

**`incrementPR_ID()`**:
- **Amaç**: Producer ID sayacını artırır
- **Dönüş**: Yeni Producer ID

---

## IProducerStorage

### Genel Bakış
[`IProducerStorage.sol`](../../contracts/interfaces/IProducerStorage.sol) arayüzü, veri depolama işlemlerinin tam API'sını tanımlar.

### Sistem Yapılandırması

#### `setFactory()`
```solidity
function setFactory(
    IFactory _factory,
    address _producerApi,
    address _producerUsageApi,
    address _producervestingApi
) external;
```

**Amaç**: Factory ve mantık kontratlarının adreslerini ayarlar

### Producer Yönetimi

#### Varlık Kontrolü
```solidity
function exsistProducer(address _producerAddress) external view returns (bool);
function exsistProducerClone(address producerAddres) external view returns (bool);
```

**`exsistProducer()`**: Producer adresinin var olup olmadığını kontrol eder
**`exsistProducerClone()`**: Clone adresinin var olup olmadığını kontrol eder

#### Producer CRUD İşlemleri
```solidity
function addProducer(DataTypes.Producer calldata vars) external;
function setProducer(DataTypes.Producer calldata vars) external;
function getProducer(address cloneAddress) external view returns (DataTypes.Producer memory);
function getProducerInfo(address producerAddress) external view returns (DataTypes.Producer memory);
```

### Plan Yönetimi

#### Plan CRUD İşlemleri
```solidity
function addPlan(DataTypes.Plan calldata vars) external returns (uint256 planId);
function setPlan(DataTypes.Plan calldata vars) external;
function getPlan(uint256 _planId) external view returns (DataTypes.Plan memory plan);
function getPlans(address producerAddress) external view returns (DataTypes.Plan[] memory);
```

#### Plan Bilgisi İşlemleri
```solidity
function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external;
function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars) external;
function addPlanInfoVesting(DataTypes.PlanInfoVesting calldata vars) external;

function getPlanInfoApi(uint256 _planId) external view returns (DataTypes.PlanInfoApi memory);
function getPlanInfoNUsage(uint256 _planId) external view returns (DataTypes.PlanInfoNUsage memory);
function getPlanInfoVesting(uint256 _planId) external view returns (DataTypes.PlanInfoVesting memory);
```

### Müşteri Yönetimi

#### Müşteri CRUD İşlemleri
```solidity
function getCustomer(address customerAddress) external view returns (DataTypes.Customer memory);
function addCustomerPlan(DataTypes.CustomerPlan calldata vars) external;
function updateCustomerPlan(DataTypes.CustomerPlan calldata vars) external;
```

#### Müşteri Plan İşlemleri
```solidity
function getCustomerPlan(uint custumerPlanId) external view returns (DataTypes.CustomerPlan memory);
function getCustomerPlanId(
    uint256 planid,
    address customeraddress,
    address producerAddress
) external pure returns (uint);
```

#### Kota Yönetimi
```solidity
function useFromQuota(DataTypes.CustomerPlan calldata vars) external returns (uint256);
```

#### Varlık Kontrolü
```solidity
function exsitCustomerPlan(
    uint256 planId,
    address customerAddress,
    address cloneAddress
) external view returns (bool);
```

### Clone Yönetimi

```solidity
function SetCloneId(uint256 _producerId, address _cloneAddress) external;
function getCloneId(uint256 _producerId) external view returns (address);
function getClones() external view returns (address[] memory);
```

### ID Sayaçları

```solidity
function incrementPR_ID() external returns (uint256);
function currentPR_ID() external view returns (uint256);
```

---

## IURIGenerator

### Genel Bakış
[`IURIGenerator.sol`](../../contracts/interfaces/IURIGenerator.sol) arayüzü, NFT URI oluşturma ve yönetimi için gerekli fonksiyonları tanımlar.

### UriMeta Struct
```solidity
struct UriMeta {
    uint256 custumerPlanId;
    uint256 planId;
    string producerName;
    address cloneAddress;
    string description;
    string externalLink;
    int256 totalSupply;
    int256 currentSupply;
    string backgroundColor;
    string image;
    address priceAddress;
    uint32 startDate;
    uint32 endDate;
    uint256 remainingQuota;
    DataTypes.PlanTypes planType;
    DataTypes.Status status;
}
```

### NFT İşlemleri

#### Basım ve Yakma
```solidity
function mint(DataTypes.CustomerPlan calldata vars) external;
function burn(DataTypes.CustomerPlan calldata vars) external;
function uri(uint256 tokenId) external view returns (string memory);
```

### URI Oluşturma Fonksiyonları

#### Ana Oluşturma Fonksiyonu
```solidity
function constructTokenURI(UriMeta memory params) external view returns (string memory);
```

**Amaç**: Tam JSON meta verisi oluşturur
**Dönüş**: Base64 kodlanmış JSON URI

#### Plan Türüne Özgü Fonksiyonlar
```solidity
function constructTokenUriApi(UriMeta memory params) external view returns (string memory);
function constructTokenUriVestingApi(UriMeta memory params) external view returns (string memory);
function constructTokenUriNUsage(UriMeta memory params) external view returns (string memory);
```

### İçerik Oluşturma Fonksiyonları

#### Meta Veri Bileşenleri
```solidity
function generateName(UriMeta memory params) external pure returns (string memory);
function generateDescription(UriMeta memory params) external pure returns (string memory);
function generateNFT(UriMeta memory params) external view returns (string memory);
```

**`generateName()`**: NFT için ad oluşturur
**`generateDescription()`**: NFT için açıklama oluşturur  
**`generateNFT()`**: SVG görüntüsü oluşturur

---

## IProducerApi

### Genel Bakış
[`IProducerApi.sol`](../../contracts/interfaces/IProducerApi.sol) arayüzü, API tabanlı abonelik planları için mantık işlemlerini tanımlar.

### Fonksiyonlar

#### Yapılandırma
```solidity
function setProducerStorage(address _producerStorage) external;
```

**Amaç**: ProducerStorage kontrat adresini ayarlar

#### Müşteri Plan İşlemleri
```solidity
function addCustomerPlan(DataTypes.CustomerPlan memory vars) external;
function updateCustomerPlan(DataTypes.CustomerPlan memory vars) external;
```

**`addCustomerPlan()`**: Yeni API aboneliği oluşturur
**`updateCustomerPlan()`**: Mevcut API aboneliğini günceller

### API Plan Özellikleri

- **Superfluid Stream Tabanlı**: Sürekli ödeme akışı
- **Aylık Limitler**: API çağrı sayısı kısıtlamaları
- **Akış Yönetimi**: Stream başlatma/durdurma

---

## IProducerNUsage

### Genel Bakış
[`IProducerNUsage.sol`](../../contracts/interfaces/IProducerNUsage.sol) arayüzü, kullanım kotası tabanlı planlar için mantık işlemlerini tanımlar.

### Fonksiyonlar

#### Yapılandırma
```solidity
function setProducerStorage(address _producerStorage) external;
```

#### Müşteri Plan İşlemleri
```solidity
function addCustomerPlan(DataTypes.CustomerPlan memory vars) external;
function updateCustomerPlan(DataTypes.CustomerPlan memory vars) external;
```

#### Kota Kullanımı
```solidity
function useFromQuota(DataTypes.CustomerPlan calldata vars) external returns (uint256);
```

**Amaç**: Müşterinin kotasından belirli miktarda kullanım yapar
**Dönüş**: Kalan kota miktarı

### NUsage Plan Özellikleri

- **Ön Ödemeli Sistem**: Token ile kota satın alma
- **Kota Yönetimi**: Kullanım takibi ve kontrol
- **İade Mekanizması**: Kullanılmayan kotanın iadesi

---

## IProducerVestingApi

### Genel Bakış
[`IProducerVestingApi.sol`](../../contracts/interfaces/IProducerVestingApi.sol) arayüzü, vesting (hak ediş) tabanlı planlar için mantık işlemlerini tanımlar.

### Fonksiyonlar

#### Süper İnisiyalizasyon
```solidity
function setSuperInitialize(IVestingScheduler _vestingScheduler) external;
```

**Amaç**: VestingScheduler kontratını ayarlar

#### Vesting Yönetimi
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
) external;
```

**Parametreler**:
- `superToken`: Vesting yapılacak token
- `receiver`: Alıcı adres
- `startDate`: Başlangıç tarihi
- `cliffDate`: Cliff tarihi
- `flowRate`: Akış hızı
- `startAmount`: Başlangıç miktarı
- `endDate`: Bitiş tarihi
- `ctx`: Superfluid context

#### Vesting Sorgulama ve Güncelleme
```solidity
function getVestingSchedule(
    ISuperToken superToken,
    address account,
    address receiver
) external view returns (IVestingScheduler.VestingSchedule memory);

function updateVestingSchedule(
    ISuperToken superToken,
    address receiver,
    uint32 endDate,
    bytes memory ctx
) external returns (bytes memory newCtx);

function deleteVestingSchedule(
    ISuperToken superToken,
    address receiver,
    bytes memory ctx
) external returns (bytes memory newCtx);
```

#### Müşteri Plan İşlemleri
```solidity
function addCustomerPlan(DataTypes.CustomerPlan calldata vars) external;
function updateCustomerPlan(DataTypes.CustomerPlan calldata vars) external;
```

---

## IVestingScheduler

### Genel Bakış
[`IVestingScheduler.sol`](../../contracts/interfaces/IVestingScheduler.sol) arayüzü, Superfluid tabanlı vesting sistemi için harici bir kontratın arayüzüdür.

### VestingSchedule Struct
```solidity
struct VestingSchedule {
    uint32 cliffAndFlowDate; // Cliff ve akış başlangıç tarihi
    uint32 endDate;          // Bitiş tarihi
    int96 flowRate;          // Akış hızı
    uint256 cliffAmount;     // Cliff miktarı
}
```

### Özel Hatalar
```solidity
error TimeWindowInvalid();
error AccountInvalid();
error ZeroAddress();
error HostInvalid();
error FlowRateInvalid();
error CliffInvalid();
error ScheduleAlreadyExists();
error ScheduleDoesNotExist();
error ScheduleNotFlowing();
```

### Olaylar

#### Vesting Schedule Oluşturma
```solidity
event VestingScheduleCreated(
    ISuperToken indexed superToken,
    address indexed sender,
    address indexed receiver,
    uint32 startDate,
    uint32 cliffDate,
    int96 flowRate,
    uint32 endDate,
    uint256 cliffAmount
);
```

#### Vesting Schedule Güncelleme
```solidity
event VestingScheduleUpdated(
    ISuperToken indexed superToken,
    address indexed sender,
    address indexed receiver,
    uint32 oldEndDate,
    uint32 endDate
);
```

#### Vesting Schedule Silme
```solidity
event VestingScheduleDeleted(
    ISuperToken indexed superToken,
    address indexed sender,
    address indexed receiver
);
```

#### Cliff ve Akış Yürütme
```solidity
event VestingCliffAndFlowExecuted(
    ISuperToken indexed superToken,
    address indexed sender,
    address indexed receiver,
    uint32 cliffAndFlowDate,
    int96 flowRate,
    uint256 cliffAmount,
    uint256 flowDelayCompensation
);
```

#### Vesting Sonu
```solidity
event VestingEndExecuted(
    ISuperToken indexed superToken,
    address indexed sender,
    address indexed receiver,
    uint32 endDate,
    uint256 earlyEndCompensation,
    bool didCompensationFail
);
```

### Ana Fonksiyonlar

#### Vesting Schedule CRUD
```solidity
function createVestingSchedule(
    ISuperToken superToken,
    address receiver,
    uint32 startDate,
    uint32 cliffDate,
    int96 flowRate,
    uint256 cliffAmount,
    uint32 endDate,
    bytes memory ctx
) external returns (bytes memory newCtx);

function updateVestingSchedule(
    ISuperToken superToken,
    address receiver,
    uint32 endDate,
    bytes memory ctx
) external returns(bytes memory newCtx);

function deleteVestingSchedule(
    ISuperToken superToken,
    address receiver,
    bytes memory ctx
) external returns (bytes memory newCtx);

function getVestingSchedule(
    address superToken,
    address sender,
    address receiver
) external view returns (VestingSchedule memory);
```

#### Yürütme Fonksiyonları
```solidity
function executeCliffAndFlow(
    ISuperToken superToken,
    address sender,
    address receiver
) external returns(bool success);

function executeEndVesting(
    ISuperToken superToken,
    address sender,
    address receiver
) external returns(bool success);
```

**Not**: Bu fonksiyonlar backend servisleri tarafından çağrılması için tasarlanmıştır.

---

## ICustomerNft

### Genel Bakış
[`ICustomerNft.sol`](../../contracts/interfaces/ICustomerNft.sol) arayüzü şu anda boş bir interface'dir.

```solidity
interface ICustomerNft {
    // Henüz fonksiyon tanımlanmamış
}
```

Bu interface gelecekte müşteri NFT'leri için özel fonksiyonlar tanımlamak üzere yer ayrılmış gibi görünmektedir.

---

## Interface Kullanım Patterns

### 1. Dependency Injection Pattern
```solidity
// Kontratlar interface'leri dependency olarak alır
contract Producer {
    IURIGenerator public uriGenerator;
    IProducerStorage public producerStorage;
    // ...
}
```

### 2. Factory Pattern Integration
```solidity
// Factory, tüm bağımlılıkları koordine eder
factory.initialize(
    uriGeneratorAddress,
    producerStorageAddress,
    producerApiAddress,
    // ...
);
```

### 3. Plan Type Routing
```solidity
// Plan türüne göre doğru interface kullanımı
if (planType == DataTypes.PlanTypes.api) {
    producerApi.addCustomerPlan(vars);
} else if (planType == DataTypes.PlanTypes.nUsage) {
    producerNUsage.addCustomerPlan(vars);
}
```

### 4. Storage Centralization
```solidity
// Tüm kontratlar merkezi storage'ı kullanır
interface IProducerStorage {
    // Tek veri kaynağı
}
```

## Güvenlik Düşünceleri

### 1. Access Control
- Interface'ler erişim kontrolü tanımlamaz
- Implementation'lar uygun modifier'ları eklemeli

### 2. Data Validation
- Interface'ler parametre doğrulaması yapmaz
- Implementation'lar validasyon eklemeli

### 3. State Consistency
- Cross-contract çağrılarda state tutarlılığı
- Storage kontratında merkezi kontrol

### 4. Upgrade Safety
- Interface değişiklikleri breaking changes yaratabilir
- Geriye uyumluluk düşünülmeli

---

## Sonuç

Interface katmanı, BliContract sisteminin modüler ve genişletilebilir olmasını sağlar. Her interface belirli bir sorumluluk alanını tanımlar ve kontratlar arası etkileşimi standardize eder. Bu yaklaşım:

- **Kod Yeniden Kullanımı**: Ortak arayüzler
- **Test Edilebilirlik**: Mock implementasyonlar
- **Genişletilebilirlik**: Yeni implementasyonlar
- **Bakım Kolaylığı**: Açık API sözleşmeleri

sağlar.
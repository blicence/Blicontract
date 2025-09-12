# Temel Kontratlar (Core Contracts)

Bu dokümantasyon, BliContract sisteminin temel katmanını oluşturan dört ana kontratı detaylarıyla açıklamaktadır.

## İçindekiler
- [DelegateCall](#delegatecall)
- [Factory](#factory)
- [Producer](#producer)
- [URIGenerator](#urigenerator)

---

## DelegateCall

### Genel Bakış
[`DelegateCall.sol`](../../contracts/DelegateCall.sol) soyut kontratı, proxy desenlerinde güvenli `delegatecall` operasyonları için temel altyapıyı sağlar.

### Amaç
- Proxy kontratlarının mantık kontratlarına güvenli çağrı yapmasını sağlamak
- `delegatecall` kontrolü ile doğrudan çağrıları engellemek
- EIP-1967 standardına uygun proxy deseni desteği

### Durum Değişkenleri

```solidity
bytes32 internal constant _IMPLEMENTATION_SLOT = 
    0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
address private immutable __self;
```

| Değişken | Tür | Açıklama |
|----------|-----|----------|
| `_IMPLEMENTATION_SLOT` | `bytes32` | EIP-1967 standardı implementation slot hash'i |
| `__self` | `address` | Kontratın kendi dağıtım adresi |

### Özel Hatalar

```solidity
error NotActiveProxyError();
error NotDelegateCall();
```

| Hata | Ne Zaman Oluşur |
|------|-----------------|
| `NotActiveProxyError` | Aktif proxy uygulaması olmayan kontratlar çağrıldığında |
| `NotDelegateCall` | Fonksiyon `delegatecall` yerine doğrudan çağrıldığında |

### Fonksiyonlar

#### `checkDelegateCall()`
```solidity
function checkDelegateCall() private view
```
- **Amaç**: Mevcut çağrının `delegatecall` olup olmadığını kontrol eder
- **Mantık**: `address(this) == __self` kontrolü ile doğrudan çağrıları tespit eder
- **Hata**: Doğrudan çağrıda `NotDelegateCall()` fırlatır

#### `_getImplementation()`
```solidity
function _getImplementation() internal view returns (address)
```
- **Amaç**: Mevcut proxy implementation adresini döndürür
- **Dönüş**: EIP-1967 slot'undan okunan implementation adresi
- **Kullanım**: UUPS proxy pattern'da implementation kontrolü için

### Modifier'lar

#### `onlyProxy`
```solidity
modifier onlyProxy()
```
- **Kontrol**: `checkDelegateCall()` çağırır
- **Yorum**: Implementation kontrolü şu anda devre dışı
- **Kullanım**: Proxy üzerinden çağrılması gereken fonksiyonlarda

#### `onlyMinimalProxy`
```solidity
modifier onlyMinimalProxy()
```
- **Kontrol**: Yalnızca `checkDelegateCall()` çağırır
- **Amaç**: EIP-1167 minimal proxy'ler için
- **Fark**: Implementation kontrolü yapmaz

### Kullanım Senaryoları

1. **Factory Kontratı**: Proxy üzerinden initialization
2. **Producer Kontratı**: Clone pattern ile çoğaltma
3. **URIGenerator**: UUPS proxy pattern desteği

### Güvenlik Önemli Notlar

⚠️ **Dikkat**: `onlyProxy` modifier'ındaki implementation kontrolü şu anda yorum satırında. Bu kontrolün aktif edilmesi durumunda:
- Yalnızca aktif proxy implementation'ı çağrı yapabilir
- Eski implementation'lardan çağrılar engellenmiş olur

---

## Factory

### Genel Bakış
[`Factory.sol`](../../contracts/Factory.sol) kontratı, yeni [`Producer`](#producer) kontratı klonlarının oluşturulması için merkezi bir fabrika görevi görür.

### Amaç
- EIP-1167 minimal proxy standardı ile verimli Producer klonları oluşturmak
- Sistem bileşenlerinin adreslerini merkezi yönetim
- Producer kontratlarının başlatma sürecini koordine etmek

### Kalıtım
```solidity
contract Factory is Initializable, OwnableUpgradeable, DelegateCall, IFactory
```

### Durum Değişkenleri

```solidity
address private uriGeneratorAddress;
address private producerLogicAddress;      // Kullanılmıyor
address private producerApiAddress;
address private producerNUsageAddress;
address private producerVestingApiAddress;
address ProducerImplementation;
IProducerStorage public producerStorage;
```

| Değişken | Tür | Açıklama |
|----------|-----|----------|
| `uriGeneratorAddress` | `address` | URIGenerator kontrat adresi |
| `producerApiAddress` | `address` | ProducerApi mantık kontrat adresi |
| `producerNUsageAddress` | `address` | ProducerNUsage mantık kontrat adresi |
| `producerVestingApiAddress` | `address` | ProducerVestingApi mantık kontrat adresi |
| `ProducerImplementation` | `address` | Ana Producer mantık kontrat adresi (klonlanacak) |
| `producerStorage` | `IProducerStorage` | Depolama kontrat arayüzü |

### Olaylar

```solidity
event BcontractCreated(
    uint256 _producerId,
    string _name,
    string _description,
    string _image,
    string _externalLink,
    address owner
);
```

### Ana Fonksiyonlar

#### `initialize()`
```solidity
function initialize(
    address _uriGeneratorAddress,
    address _producerStorageAddress,
    address _producerApiAddress,
    address _producerNUsageAddress,
    address _producerVestingApiAddress
) external initializer onlyProxy
```

**Parametreler:**
- `_uriGeneratorAddress`: NFT URI oluşturucu kontrat adresi
- `_producerStorageAddress`: Veri depolama kontrat adresi  
- `_producerApiAddress`: API mantık kontrat adresi
- `_producerNUsageAddress`: Kullanım mantık kontrat adresi
- `_producerVestingApiAddress`: Vesting mantık kontrat adresi

**İşlemler:**
1. `OwnableUpgradeable` başlatma
2. Bağımlılık adreslerini ayarlama
3. Yeni `Producer` implementation'ı dağıtma

#### `newBcontract()`
```solidity
function newBcontract(DataTypes.Producer calldata vars) external
```

**Amaç**: Yeni Producer kontratı klonu oluşturur

**İş Akışı:**
1. **Kontroler**: Çağıranın zaten bir producer'ı olmadığını doğrular
2. **Klonlama**: `Clones.clone()` ile minimal proxy oluşturur
3. **ID Üretimi**: Yeni producer ID'si artırır
4. **Kayıt**: Clone adresini ve ID'yi storage'a kaydeder
5. **Yapılandırma**: Producer struct'ını doldurur
6. **Depolama**: Producer bilgilerini storage'a ekler
7. **Başlatma**: Clone'un `initialize()` fonksiyonunu çağırır
8. **Olay**: `BcontractCreated` olayını yayınlar

**Gereksinimler:**
- Çağıranın daha önce producer oluşturmamış olması
- Geçerli `DataTypes.Producer` struct'ı

#### `setProducerImplementation()`
```solidity
function setProducerImplementation(address _ProducerImplementationAddress) 
    external onlyOwner onlyProxy
```

**Amaç**: Gelecekteki klonlar için yeni implementation ayarlar
**Kontrol**: Adresin geçerli bir kontrat olduğunu doğrular

#### `getAllProducers()`
```solidity
function getAllProducers() external view returns (DataTypes.Producer[] memory producers)
```

**Amaç**: Sistemde kayıtlı tüm producers'ları getirir

**Döndürür:**
- `producers`: Tüm producer struct'larının array'i

**İş Akışı:**
1. Toplam producer sayısını alır (`currentPR_ID()`)
2. Producer array'ini oluşturur
3. Her producer ID için storage'dan bilgileri alır
4. Array'i doldurur ve döndürür

#### `getActiveProducers()`
```solidity
function getActiveProducers() external view returns (DataTypes.Producer[] memory activeProducers)
```

**Amaç**: Yalnızca aktif (exists=true) producers'ları getirir

**Döndürür:**
- `activeProducers`: Aktif producer struct'larının array'i

**İş Akışı:**
1. **İlk Geçiş**: Aktif producer sayısını sayar
2. **Array Oluşturma**: Uygun boyutta array oluşturur
3. **İkinci Geçiş**: Aktif producers'ları array'e ekler

**Optimizasyon**: İki geçişli yaklaşım ile memory kullanımını optimize eder

#### `getProducerById()`
```solidity
function getProducerById(uint256 producerId) external view returns (DataTypes.Producer memory producer)
```

**Amaç**: Belirli ID'ye sahip producer'ı getirir

**Parametreler:**
- `producerId`: Producer ID'si

**Döndürür:**
- `producer`: Producer struct'ı

**İş Akışı:**
1. Producer ID'den clone adresini alır
2. Clone adresinden producer bilgilerini alır

#### `currentPR_ID()` & `incrementPR_ID()`
```solidity
function currentPR_ID() public view returns (uint256)
function incrementPR_ID() public returns (uint256)
```

**Amaç**: Producer ID'lerini yönetir
**Yetki**: Yalnızca sahip çağırabilir

### Yardımcı Fonksiyonlar

#### `currentPR_ID()` & `incrementPR_ID()`
```solidity
function currentPR_ID() public view returns (uint256)
function incrementPR_ID() public returns (uint256)
```
- Storage kontratındaki ID sayacına proxy fonksiyonlar
- Producer ID'lerinin benzersizliğini sağlar

### Gaz Optimizasyonu

**EIP-1167 Minimal Proxy Avantajları:**
- Her clone ~45 byte (vs tam kontrat ~20KB)
- Deployment maliyeti %99 azalma
- Runtime overhead minimum (~2000 gas ekstra per call)

### Güvenlik Kontroleri

1. **Tekrarlılık Kontrolü**: Aynı adres ikinci producer oluşturamaz
2. **Sahiplik Kontrolü**: Implementation değişikliği yalnızca sahip
3. **Kontrat Doğrulama**: Yeni implementation'ın geçerli kontrat olduğu kontrolü
4. **Proxy Koruması**: `onlyProxy` modifier ile korumalı fonksiyonlar

---

## Producer

### Genel Bakış
[`Producer.sol`](../../contracts/Producer.sol) kontratı, tek bir üreticinin (hizmet sağlayıcısının) iş mantığını yönetir.

### Amaç
- Hizmet planlarının oluşturulması ve yönetimi
- Müşteri aboneliklerinin işlenmesi
- Plan türlerine göre özel mantık kontratlarıyla etkileşim
- NFT tabanlı abonelik sistemi

### Kalıtım
```solidity
contract Producer is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    DelegateCall,
    PausableUpgradeable
```

### Durum Değişkenleri

```solidity
IURIGenerator public uriGenerator;
IProducerStorage public producerStorage;
IProducerNUsage public producerNUsage;
IStreamLockManager public streamLockManager;

// Mapping to store stream lock IDs for customer plans
mapping(uint256 => bytes32) public customerPlanToStreamLock;
mapping(bytes32 => uint256) public streamLockToCustomerPlan;
```

### Olaylar

```solidity
event LogAddPlan(
    uint256 planId,
    address producerAddress,
    string name,
    DataTypes.PlanTypes planType
);

event CustomerPlanWithStreamCreated(
    uint256 indexed customerPlanId,
    bytes32 indexed streamLockId,
    address indexed customer
);

event StreamUsageValidated(
    uint256 indexed customerPlanId,
    bytes32 indexed streamLockId,
    address indexed customer,
    bool canUse
);
```

### Constructor
```solidity
constructor() {
    _disableInitializers();
}
```
Kontratın yalnızca proxy üzerinden başlatılabilmesini sağlar.

### Başlatma

#### `initialize()`
```solidity
function initialize(
    address payable user,
    address _uriGeneratorAddress,
    address _producerNUsageAddress,
    address _producerStorageAddress,
    address _streamLockManagerAddress
) external initializer onlyProxy
```

**İşlemler:**
1. OpenZeppelin kontratlarını başlatır (`Ownable`, `Pausable`, `ReentrancyGuard`)
2. Bağımlılık kontratlarının arayüzlerini ayarlar
3. StreamLockManager entegrasyonunu yapılandırır
4. Sahipliği `user` adresine devreder

### Plan Yönetimi

#### `addPlan()`
```solidity
function addPlan(DataTypes.Plan calldata vars) 
    external onlyOwner returns (uint256 planId)
```
- **Amaç**: Yeni hizmet planı oluşturur
- **Yetki**: Yalnızca kontrat sahibi
- **Dönüş**: Oluşturulan plan ID'si
- **Olay**: `LogAddPlan` yayınlar

#### Plan Bilgisi Ekleme Fonksiyonları
```solidity
function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external onlyOwner
function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars) external onlyOwner  
function addPlanInfoVesting(DataTypes.PlanInfoVesting calldata vars) external onlyOwner
```
Plan türüne özgü ek bilgileri storage'a kaydeder.

#### `setPlan()`
```solidity
function setPlan(DataTypes.Plan calldata vars) external onlyOwner
```
Mevcut planın bilgilerini günceller.

### Müşteri Yönetimi

#### `addCustomerPlan()`
```solidity
function addCustomerPlan(DataTypes.CustomerPlan memory vars) public
```

**Plan Türüne Göre İşlemler:**

**1. NUsage Planları:**
```solidity
if (vars.planType == DataTypes.PlanTypes.nUsage) {
    // Kota kontrolü
    require(vars.remainingQuota > 0, "remainingQuota must be higher than zero!");
    
    // Bakiye kontrolü
    require(SolmateERC20(plan.priceAddress).balanceOf(msg.sender) >= 
            pInfoNUsage.oneUsagePrice * vars.remainingQuota, 
            "Amount must be higher than zero!");
    
    // Stream oluşturma
    uint256 totalAmount = pInfoNUsage.oneUsagePrice * vars.remainingQuota;
    uint256 streamDuration = _calculateStreamDuration(vars.planId, vars.remainingQuota);
    
    streamLockId = _createCustomerPlanStream(
        vars.custumerPlanId,
        msg.sender,
        address(this),
        address(plan.priceAddress),
        totalAmount,
        streamDuration
    );
    
    producerNUsage.addCustomerPlan(vars);
}
```

**Son Adım:**
```solidity
uriGenerator.mint(vars); // NFT basımı

// Stream event
if (streamLockId != bytes32(0)) {
    emit CustomerPlanWithStreamCreated(vars.custumerPlanId, streamLockId, msg.sender);
}
```

#### `addCustomerPlanWithStream()` - ✨ Yeni Özellik
```solidity
function addCustomerPlanWithStream(
    DataTypes.CustomerPlan memory vars,
    uint256 streamDuration
) external returns (uint256 custumerPlanId, bytes32 streamLockId)
```

**Amaç**: Gelişmiş customer plan oluşturma ile explicit stream yapılandırması

**Desteklenen Plan Türleri:**

**1. NUsage Plans (Kota Tabanlı):**
- Token bakiye kontrolü
- Kota validasyonu 
- Stream oluşturma (eğer duration > 0)
- ProducerNUsage entegrasyonu

**2. API Plans (Subscription Tabanlı):** ✨ **YENİ**
```solidity
else if (vars.planType == DataTypes.PlanTypes.api) {
    DataTypes.PlanInfoApi memory pInfoApi = producerStorage.getPlanInfoApi(vars.planId);
    
    // Stream oluşturma
    if (streamDuration > 0 && address(streamLockManager) != address(0)) {
        uint256 totalAmount = uint256(int256(pInfoApi.flowRate)) * streamDuration;
        
        // StreamLockManager üzerinden stream oluştur
        streamLockId = streamLockManager.createStreamForCustomerPlan(...);
        
        // Mapping kaydet
        customerPlanToStreamLock[custumerPlanId] = streamLockId;
        streamLockToCustomerPlan[streamLockId] = custumerPlanId;
    }
    
    // Unlimited quota for API plans
    vars.remainingQuota = type(uint256).max;
    vars.endDate = uint32(block.timestamp + streamDuration);
    
    producerStorage.addCustomerPlan(vars);
}
```

**3. VestingApi Plans (Zaman Tabanlı):** ✨ **YENİ**
```solidity
else if (vars.planType == DataTypes.PlanTypes.vestingApi) {
    DataTypes.PlanInfoVesting memory pInfoVesting = producerStorage.getPlanInfoVesting(vars.planId);
    
    // Cliff date kontrolü
    require(pInfoVesting.cliffDate > block.timestamp, "Cliff date must be in the future");
    
    // Total vesting amount (cliff + stream)
    uint256 streamAmount = uint256(int256(pInfoVesting.flowRate)) * streamDuration;
    uint256 totalAmount = pInfoVesting.startAmount + streamAmount;
    
    // Stream oluşturma
    if (streamDuration > 0 && address(streamLockManager) != address(0)) {
        streamLockId = streamLockManager.createStreamForCustomerPlan(...);
        
        // Mapping kaydet
        customerPlanToStreamLock[custumerPlanId] = streamLockId;
        streamLockToCustomerPlan[streamLockId] = custumerPlanId;
    }
    
    // Unlimited quota + cliff + stream end date
    vars.remainingQuota = type(uint256).max;
    vars.endDate = uint32(pInfoVesting.cliffDate + streamDuration);
    
    producerStorage.addCustomerPlan(vars);
}
```

### Stream Validasyon Fonksiyonları ✨ **YENİ BÖLÜM**

#### `validateUsageWithStream()`
```solidity
function validateUsageWithStream(uint256 customerPlanId) 
    external view returns (bool canUse, uint256 remainingTime, bytes32 streamLockId)
```

**Amaç**: Stream durumuna göre servis kullanım izni kontrolü

**İş Akışı:**
1. **Customer Plan Kontrolü**: Aktif olduğunu doğrula
2. **Stream Lookup**: customerPlanToStreamLock mapping'den stream ID al
3. **Stream Status**: StreamLockManager'dan durumu sorgula
4. **Fallback Logic**: Stream yoksa geleneksel kota/tarih kontrolü

#### `settleStreamOnUsage()`
```solidity
function settleStreamOnUsage(uint256 customerPlanId, uint256 usageAmount) 
    external returns (bool success)
```

**Amaç**: Servis kullanımında stream güncelleme ve customer plan settlement

**İşlemler:**
1. StreamLockManager.updateStreamOnUsage() çağır
2. NUsage plan ise kota düşür
3. Storage'da customer plan güncelle
4. Event emit et

#### `checkStreamBeforeUsage()`
```solidity
function checkStreamBeforeUsage(uint256 customerPlanId, address customer) 
    public returns (bool canUse)
```

**Amaç**: Servis kullanımı öncesi stream durumu kontrolü

#### Helper Fonksiyonlar

**Stream Mapping Fonksiyonları:**
```solidity
function getStreamLockIdForCustomerPlan(uint256 customerPlanId) external view returns (bytes32)
function getCustomerPlanIdForStreamLock(bytes32 streamLockId) external view returns (uint256)
```

**Stream Duration Hesaplama:**
```solidity
function _calculateStreamDuration(uint256 planId, uint256 quota) internal view returns (uint256)
```
- NUsage planları için kota bazlı süre hesaplama
- Kota <= 10: 7 gün
- Kota <= 100: 30 gün  
- Kota > 100: 90 gün

**Stream Oluşturma:**
```solidity
function _createCustomerPlanStream(...) internal returns (bytes32 lockId)
```
- StreamLockManager entegrasyonu
- Hata durumunda graceful fallback

#### `updateCustomerPlan()`
```solidity
function updateCustomerPlan(DataTypes.CustomerPlan calldata vars) 
    public onlyExistCustumer(...) onlyCustomer(msg.sender)
```

**NUsage Plan İptali:**
```solidity
if (vars.status == DataTypes.Status.inactive) {
    // Kalan kotanın token olarak iadesi
    SafeTransferLib.safeTransferFrom(
        ERC20(plan.priceAddress),
        address(this),
        msg.sender,
        (pInfoNUsage.oneUsagePrice) * cpnu.remainingQuota
    );
}
```

**NFT Yakma:**
```solidity
if (vars.status == DataTypes.Status.inactive) {
    uriGenerator.burn(vars);
}
```

#### `useFromQuota()`
```solidity
function useFromQuota(DataTypes.CustomerPlan calldata vars)
    public onlyExistCustumer(...) onlyCustomer(msg.sender)
    returns (uint256)
```
NUsage planlarında müşterinin kotasından kullanım yapar.

### Modifier'lar

#### `onlyExistCustumer`
```solidity
modifier onlyExistCustumer(
    uint256 planId,
    address customerAddress,
    address cloneAddress
)
```
Müşteri planının var olduğunu kontrol eder.

#### `onlyCustomer`
```solidity
modifier onlyCustomer(address customerAddress)
```
Yalnızca plan sahibi müşterinin fonksiyonu çağırabilmesini sağlar.

### Fon Yönetimi

#### `withdraw()`
```solidity
function withdraw() public onlyOwner
```
Kontrattaki ETH bakiyesini sahibine transfer eder.

#### `withdrawTokens()`
```solidity
function withdrawTokens(ERC20 token) public onlyOwner
```
Belirli ERC20 token bakiyesini sahibine transfer eder.

### Güvenlik Özellikleri

1. **Reentrancy Koruması**: `ReentrancyGuard` ile korumalı
2. **Duraklatılabilirlik**: `PausableUpgradeable` ile acil durum kontrolü
3. **Sahiplik Kontrolü**: Kritik fonksiyonlarda `onlyOwner`
4. **Müşteri Doğrulama**: `onlyCustomer` ve `onlyExistCustumer` modifier'ları
5. **Güvenli Transfer**: `SafeTransferLib` kullanımı

---

## URIGenerator

### Genel Bakış
[`URIGenerator.sol`](../../contracts/URIGenerator.sol) kontratı, müşteri aboneliklerini temsil eden ERC1155 NFT'leri için dinamik URI'lar ve meta veriler oluşturur.

### Amaç
- Abonelik NFT'lerinin basılması ve yakılması
- Dinamik SVG tabanlı görsel oluşturma
- Zincir üstü meta veri depolama
- Devredilemez (soulbound) NFT sistemi

### Kalıtım
```solidity
contract URIGenerator is
    IURIGenerator,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC1155Upgradeable
```

### Durum Değişkenleri

```solidity
IProducerStorage public producerStorage;
```

### Özel Hatalar

```solidity
error NFT_TransferIsNotAllowed();
error NFT_Unauthorized();
error NFT_Deprecated(uint256 at);
```

### Başlatma

#### `initialize()`
```solidity
function initialize() public initializer
```
Tüm OpenZeppelin kontratlarını başlatır.

#### `setProducerStorage()`
```solidity
function setProducerStorage(address _producerStorage) external onlyOwner
```
ProducerStorage kontrat adresini ayarlar.

### NFT İşlemleri

#### `mint()`
```solidity
function mint(DataTypes.CustomerPlan calldata vars)
    external onlyExistCustumer(...)
```

**İşlemler:**
1. Plan bilgilerini storage'dan alır
2. ERC1155 token'ı basar (`amount: 1`)
3. Clone adresini token verisine encode eder

**⚠️ Önemli Not**: Kodda `amount` parametresi `1` olarak düzeltilmiş (orijinalde `0` idi).

#### `burn()`
```solidity
function burn(DataTypes.CustomerPlan calldata vars)
    external onlyExistCustumer(...)
```
Belirtilen müşteri planına ait NFT'yi yakar.

### Transfer Kısıtlamaları

#### Devredilemez NFT'ler
```solidity
function safeTransferFrom(...) public pure override {
    revert NFT_TransferIsNotAllowed();
}

function safeBatchTransferFrom(...) public pure override {
    revert NFT_TransferIsNotAllowed();
}
```
Bu fonksiyonlar NFT'lerin **soulbound** (devredilemez) olmasını sağlar.

### Meta Veri Oluşturma

#### `uri()`
```solidity
function uri(uint256 tokenId) public view returns (string memory)
```

**İş Akışı:**
1. **Veri Toplama**: Token ID'den müşteri planı, plan ve üretici bilgilerini alır
2. **UriMeta Yapısı**: Tüm bilgileri `UriMeta` struct'ında toplar
3. **Plan Türü Kontrolü**: Plan türüne göre uygun fonksiyonu çağırır

```solidity
if (uriMeta.planType == DataTypes.PlanTypes.api) {
    return constructTokenUriApi(uriMeta);
}
if (uriMeta.planType == DataTypes.PlanTypes.vestingApi) {
    return constructTokenUriVestingApi(uriMeta);
}
if (uriMeta.planType == DataTypes.PlanTypes.nUsage) {
    return constructTokenUriNUsage(uriMeta);
}
```

#### Plan Türü Fonksiyonları
```solidity
function constructTokenUriApi(UriMeta memory params) public view returns (string memory)
function constructTokenUriVestingApi(UriMeta memory params) public view returns (string memory)
function constructTokenUriNUsage(UriMeta memory params) public view returns (string memory)
```

**⚠️ Not**: Bu fonksiyonlar şu anda doğrudan SVG döndürüyor. JSON meta verisi için `constructTokenURI()` çağırılmalı.

#### `constructTokenURI()`
```solidity
function constructTokenURI(UriMeta memory params) public view returns (string memory)
```

**JSON Yapısı:**
```json
{
  "name": "ProducerName-PlanId-CustomerPlanId",
  "description": "NFT representing a Bilicance contract...",
  "image": "data:image/svg+xml;base64,<base64-encoded-svg>"
}
```

**Base64 Encoding**: Tüm JSON Base64 olarak kodlanır ve `data:application/json;base64,` ile döndürülür.

### SVG Oluşturma

#### `generateNFT()`
```solidity
function generateNFT(UriMeta memory params) public view returns (string memory)
```

**SVG Bileşenleri:**
1. **Temel SVG**: 400x300 boyutunda, yuvarlatılmış köşeli
2. **Arka Plan**: Mavi gradient (#3E5DC7)
3. **Logo**: Şeffaf beyaz Bilicance logosu
4. **Header**: Üretici adı
5. **Fiyat Bölümü**: Token bilgisi ve fiyat
6. **Tarih Bölümü**: Başlangıç ve bitiş tarihleri

#### SVG Bölüm Fonksiyonları

```solidity
function _generateHeaderSection(string memory _priceSymbol) internal pure
function _generateAmountsSection(uint256 _price, string memory _priceSymbol, uint8 _priceDecimals) internal pure
function _generateDateSection(UriMeta memory params) internal pure
```

### Yardımcı Fonksiyonlar

#### Ad ve Açıklama
```solidity
function generateName(UriMeta memory params) public pure returns (string memory)
function generateDescription(UriMeta memory params) public pure returns (string memory)
```

#### Tarih İşlemleri
```solidity
function _getDateUnits(uint256 _timestamp) internal pure returns (uint256 month, uint256 day, uint256 year)
function _generateDateString(uint256 _timestamp) internal pure returns (string memory)
```
Unix timestamp'ları "MM/DD/YYYY" formatına dönüştürür.

#### Sayı Formatlama
```solidity
function _decimalString(uint256 number, uint8 decimals, bool isPercent) internal pure
function _toString(uint256 value) internal pure returns (string memory)
```

#### Adres Dönüştürme
```solidity
function toHexString(uint256 value, uint256 length) internal pure returns (string memory)
function addressToString(address addr) internal pure returns (string memory)
```

### UUPS Yükseltme

#### `_authorizeUpgrade()`
```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyOwner
```
Kontratın UUPS proxy pattern ile yükseltilebilmesini sağlar.

### Duraklatma Kontrolü

```solidity
function pause() public onlyOwner
function unpause() public onlyOwner
```
Acil durumlarda kontrat işlemlerini durdurma yeteneği.

### Güvenlik Özellikleri

1. **Soulbound NFT'ler**: Transfer edilemez abonelik token'ları
2. **Yetki Kontrolü**: `onlyExistCustumer` modifier'ı
3. **UUPS Güvenliği**: Yalnızca sahip yükseltme yapabilir
4. **Duraklatılabilirlik**: Acil durum kontrolü
5. **Zincir Üstü Meta Veri**: Merkezi olmayan veri depolama

### Gaz Optimizasyonu Notları

⚠️ **Dikkat**: SVG oluşturma işlemi gaz açısından maliyetli olabilir:
- Karmaşık SVG'ler yüksek gaz tüketimi
- `uri()` fonksiyonu `view` olduğu için gaz tüketmez
- Ancak transaction'larda çağrılırsa maliyet artabilir

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

Bu struct, NFT meta verisi oluşturmak için gereken tüm bilgileri toplar.

---

## Sonuç

Bu dört temel kontrat, BliContract sisteminin omurgasını oluşturur:

- **DelegateCall**: Güvenli proxy operasyonları
- **Factory**: Efficient clone deployment
- **Producer**: İş mantığı yönetimi  
- **URIGenerator**: Dinamik NFT meta verileri

Her kontrat belirli bir sorumluluğa sahiptir ve sistem bütünlüğü için dikkatli bir şekilde tasarlanmıştır.
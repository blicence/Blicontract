# Solidity Kontrat Dokümantasyonu: `contracts` Klasörü

Bu doküman, `contracts` klasöründeki Solidity akıllı kontratlarının ayrıntılı bir analizini sunmaktadır. Her bir kontratın amacı, temel özellikleri, önemli fonksiyonları, olayları, değiştiricileri ve diğer kontratlarla olan etkileşimleri açıklanmaktadır.

## Genel Mimari Bakışı

Sistem, merkezi olmayan bir abonelik ve hizmet platformu oluşturmak üzere tasarlanmıştır. Temel bileşenler şunlardır:

1.  **`Factory.sol`**: Yeni `Producer` (üretici/hizmet sağlayıcı) kontratlarının örneklerini (klonlarını) oluşturmaktan sorumlu merkezi bir kontrattır.
2.  **`Producer.sol`**: Tek bir üreticinin temel mantığını temsil eder. Plan yönetimi, müşteri abonelikleri ve farklı hizmet türleri için özel mantık kontratlarıyla etkileşimleri içerir.
3.  **`URIGenerator.sol`**: Müşteri aboneliklerini temsil eden ERC1155 NFT'leri için URI'lar (ve dolayısıyla meta veriler) oluşturur. Bu NFT'ler genellikle devredilemezdir ve bir müşterinin belirli bir plana erişimini zincir üzerinde temsil eder.
4.  **`DelegateCall.sol`**: Proxy desenlerinde kullanılan, mantık kontratlarının bir proxy'nin depolama bağlamında güvenli bir şekilde yürütülmesini sağlayan soyut bir kontrattır. Bu, kontrat mantığının depolamayı etkilemeden yükseltilebilmesine olanak tanır.
5.  **Depolama Kontratları (örn: `ProducerStorage.sol`)**: Kalıcı verilerin (üretici bilgileri, plan detayları, müşteri abonelikleri vb.) saklandığı kontratlardır. Bu dokümantasyonda doğrudan içeriği verilmese de, `Producer.sol` ve `URIGenerator.sol` gibi kontratlar tarafından yoğun bir şekilde kullanılırlar.
6.  **Mantık/API Kontratları (örn: `ProducerApi.sol`, `ProducerNUsage.sol`, `ProducerVestingApi.sol`)**: `Producer.sol` tarafından çağrılan, farklı abonelik planı türlerine (API erişimi, kullanıma dayalı, hak edişli API vb.) özgü iş mantığını içeren kontratlardır.

**Temel Akış:**

1.  **Kurulum**: `Factory`, `URIGenerator` ve çeşitli depolama/mantık kontratları dağıtılır ve başlangıç yapılandırmaları yapılır.
2.  **Üretici Oluşturma**: Bir kullanıcı, `Factory.newBcontract()` fonksiyonunu çağırarak yeni bir `Producer` kontratı (klon) oluşturur. Bu klon, gerekli bağımlılık adresleriyle (örneğin, `URIGenerator`, `ProducerStorage`) başlatılır.
3.  **Plan Yönetimi**: `Producer` sahibi, kendi `Producer` kontratı üzerinden hizmet planları oluşturur ve yönetir. Bu bilgiler `ProducerStorage`'a kaydedilir.
4.  **Müşteri Aboneliği**: Müşteriler, bir `Producer`'ın planına abone olmak için `Producer.addCustomerPlan()` fonksiyonunu çağırır. Bu işlem sırasında ödeme yapılabilir ve aboneliği temsil eden bir NFT (`URIGenerator.mint()` aracılığıyla) basılır.
5.  **Hizmet Kullanımı**: Müşteriler, abone oldukları hizmetleri kullanır. Kullanıma dayalı planlar için `Producer.useFromQuota()` gibi fonksiyonlar çağrılabilir.
6.  **NFT Meta Verileri**: Cüzdanlar veya pazar yerleri, abonelik NFT'lerinin meta verilerini `URIGenerator.uri()` fonksiyonu aracılığıyla sorgular. `URIGenerator`, dinamik olarak SVG tabanlı bir görsel ve JSON meta verisi oluşturur.

---

## Kontrat Detayları

### 1. `DelegateCall.sol`

Bu soyut kontrat, `delegatecall` operasyonlarının güvenli ve doğru bir şekilde kullanılmasını sağlamak için tasarlanmıştır, özellikle proxy desenlerinde.

*   **Dosya Yolu**: `contracts/DelegateCall.sol`
*   **Temel Amaç**: Proxy kontratlarının mantık kontratlarına güvenli bir şekilde çağrı yapmasını sağlamak ve çağrının `delegatecall` olup olmadığını doğrulamak.

**Durum Değişkenleri:**

*   `_IMPLEMENTATION_SLOT (bytes32 internal constant)`: EIP-1967 standardına göre mevcut proxy uygulamasının adresini tutan depolama yuvasının sabit karması.
*   `__self (address private immutable)`: Kontratın kendi dağıtım adresini saklar. Bu, `delegatecall` kontrolü için kullanılır.

**Hatalar (Errors):**

*   `NotActiveProxyError()`: Çağrılan kontratın aktif proxy uygulaması olmadığını belirtir (mevcut kodda yorum satırında).
*   `NotDelegateCall()`: Bir fonksiyonun `delegatecall` yerine doğrudan çağrıldığını belirtir.

**Fonksiyonlar:**

*   `checkDelegateCall() private view`:
    *   Mevcut çağrının `delegatecall` olup olmadığını kontrol eder. Eğer `address(this)` (mevcut yürütme bağlamının adresi) `__self` (kontratın kendi adresi) ile aynıysa, bu doğrudan bir çağrıdır ve `NotDelegateCall` hatası fırlatılır.
*   `_getImplementation() internal view returns (address)`:
    *   `_IMPLEMENTATION_SLOT` depolama yuvasından mevcut proxy uygulamasının adresini okur ve döndürür. `StorageSlotUpgradeable.getAddressSlot()` kullanır.

**Değiştiriciler (Modifiers):**

*   `onlyProxy`:
    *   `checkDelegateCall()`'ı çağırarak çağrının bir `delegatecall` olduğunu doğrular.
    *   (Yorum satırındaki kısım aktif olsaydı) `_getImplementation()` ile alınan adresin `__self` ile aynı olup olmadığını kontrol ederek, bu mantık kontratının gerçekten aktif proxy uygulaması olup olmadığını doğrulardı.
*   `onlyMinimalProxy`:
    *   `checkDelegateCall()`'ı çağırarak çağrının bir `delegatecall` olduğunu doğrular. Minimal proxy'ler (EIP-1167) genellikle uygulama adresini kendi depolamalarında tutmadığından, uygulama kontrolünü atlar.

**Kullanım Senaryoları:**

*   Yükseltilebilir kontratlarda (örneğin, UUPS veya Transparent Proxy Pattern) mantık kontratlarının temelini oluşturur.
*   `Factory.sol` ve `Producer.sol` gibi kontratlar, proxy aracılığıyla çağrılan başlatma fonksiyonlarını korumak için bu kontrattan kalıtım alır.

---

### 2. `Factory.sol`

Bu kontrat, `Producer` kontratlarının yeni örneklerini (klonlarını) oluşturmak ve yönetmek için bir fabrika görevi görür. EIP-1167 (Minimal Proxy Standardı) kullanarak gaz açısından verimli bir şekilde yeni `Producer` kontratları oluşturur.

*   **Dosya Yolu**: `contracts/Factory.sol`
*   **Temel Amaç**: `Producer` kontratlarının dağıtımını merkezileştirmek ve yönetmek.

**Kalıtım Aldığı Kontratlar ve Arayüzler:**

*   `Initializable` (OpenZeppelin): Yükseltilebilir kontratlar için başlatma fonksiyonu sağlar.
*   `OwnableUpgradeable` (OpenZeppelin): Sahiplik tabanlı erişim kontrolü sağlar.
*   `DelegateCall`: Proxy çağrılarını yönetmek için.
*   `IFactory`: Bu fabrikanın uyguladığı arayüz.

**Durum Değişkenleri:**

*   `uriGeneratorAddress (address private)`: `URIGenerator` kontratının adresi.
*   `producerLogicAddress (address private)`: (Kullanılmıyor gibi görünüyor, ancak benzer bir amaç için `producerApiAddress` vb. var).
*   `producerApiAddress (address private)`: `ProducerApi` mantık kontratının adresi.
*   `producerNUsageAddress (address private)`: `ProducerNUsage` mantık kontratının adresi.
*   `producerVestingApiAddress (address private)`: `ProducerVestingApi` mantık kontratının adresi.
*   `ProducerImplementation (address)`: Klonlanacak olan ana `Producer` mantık kontratının adresi.
*   `producerStorage (IProducerStorage public)`: Üretici ve plan verilerini saklayan `ProducerStorage` kontratının arayüzü.

**Olaylar (Events):**

*   `BcontractCreated(uint256 _producerId, string _name, string _description, string _image, string _externalLink, address owner)`: Yeni bir `Producer` (Bcontract) kontratı başarıyla oluşturulduğunda tetiklenir.

**Fonksiyonlar:**

*   `initialize(address _uriGeneratorAddress, address _producerStorageAddress, address _producerApiAddress, address _producerNUsageAddress, address _producerVestingApiAddress) external initializer onlyProxy`:
    *   Fabrika kontratını başlatır.
    *   `OwnableUpgradeable`'ı başlatır (`__Ownable_init()`).
    *   Sağlanan adresleri ilgili durum değişkenlerine atar.
    *   Yeni bir `Producer` kontratı dağıtır ve adresini `ProducerImplementation`'a kaydeder. Bu, klonlanacak olan temel mantık kontratıdır.
    *   `onlyProxy` değiştiricisi, bu fonksiyonun yalnızca bir proxy aracılığıyla çağrılabilmesini sağlar.
*   `getProducerImplementation() external view returns (address)`:
    *   Mevcut `ProducerImplementation` adresini döndürür.
*   `setProducerImplementation(address _ProducerImplementationAddress) external onlyOwner onlyProxy`:
    *   Sahibinin (`onlyOwner`) `ProducerImplementation` adresini güncellemesine olanak tanır. Bu, gelecekte oluşturulacak `Producer` klonlarının yeni bir mantık sürümünü kullanmasını sağlar.
    *   `Address.isContract()` ile sağlanan adresin bir kontrat adresi olduğunu doğrular.
*   `newBcontract(DataTypes.Producer calldata vars) external`:
    *   Yeni bir `Producer` kontratı (Bcontract) oluşturur.
    *   `producerStorage.exsistProducerClone(msg.sender)` ile çağıranın zaten bir üretici klonuna sahip olup olmadığını kontrol eder. Eğer varsa, "producer already existing!" hatası verir.
    *   `Clones.clone(ProducerImplementation)` kullanarak `ProducerImplementation`'ın bir EIP-1167 minimal proxy'sini (klonunu) oluşturur.
    *   `incrementPR_ID()` ile yeni bir üretici ID'si alır.
    *   `producerStorage.SetCloneId()` ile yeni üretici ID'sini ve klon adresini `ProducerStorage`'a kaydeder.
    *   `DataTypes.Producer` yapısını `vars` ve diğer bilgilerle (ID, klon adresi, sahip adresi vb.) doldurur.
    *   `producerStorage.addProducer()` ile bu üretici verilerini `ProducerStorage`'a ekler.
    *   Yeni oluşturulan klonun (`Producer(clone)`) `initialize()` fonksiyonunu çağırarak onu başlatır. Başlatma parametreleri arasında `msg.sender` (sahip), `uriGeneratorAddress`, çeşitli API adresleri ve `producerStorage` adresi bulunur.
    *   `BcontractCreated` olayını yayınlar.
*   `currentPR_ID() public view returns (uint256)`:
    *   `producerStorage.currentPR_ID()` aracılığıyla mevcut en son üretici ID'sini döndürür.
*   `incrementPR_ID() public returns (uint256)`:
    *   `producerStorage.incrementPR_ID()` aracılığıyla üretici ID sayacını artırır ve yeni ID'yi döndürür.

**Kullanım Senaryoları:**

*   Platforma yeni üreticilerin (hizmet sağlayıcıların) katılması için merkezi bir giriş noktası görevi görür.
*   Gaz açısından verimli bir şekilde yeni `Producer` kontratları oluşturur.
*   Tüm `Producer`'ların kullanacağı temel hizmetlerin (URI oluşturucu, depolama, API mantıkları) adreslerini yönetir.

---

### 3. `Producer.sol`

Bu kontrat, bir üreticinin (hizmet sağlayıcının) temel iş mantığını içerir. Planları yönetme, müşteri aboneliklerini işleme ve farklı plan türleri için özel mantık kontratlarıyla etkileşim kurma yeteneklerine sahiptir.

*   **Dosya Yolu**: `contracts/Producer.sol`
*   **Temel Amaç**: Tek bir üreticinin hizmetlerini, planlarını ve müşterilerini yönetmek.

**Kalıtım Aldığı Kontratlar ve Arayüzler:**

*   `Initializable`
*   `OwnableUpgradeable`
*   `ReentrancyGuard` (OpenZeppelin): Yeniden giriş saldırılarına karşı koruma sağlar.
*   `DelegateCall`
*   `PausableUpgradeable` (OpenZeppelin): Kontrat fonksiyonlarını duraklatma/devam ettirme yeteneği sağlar.
*   `IURIGenerator`, `IProducerStorage`, `IProducerNUsage`, `IProducerVestingApi`, `IProducerApi`: İlgili arayüzler.

**Durum Değişkenleri:**

*   `uriGenerator (IURIGenerator public)`: `URIGenerator` kontratının arayüzü.
*   `producerStorage (IProducerStorage public)`: `ProducerStorage` kontratının arayüzü.
*   `producerNUsage (IProducerNUsage public)`: `ProducerNUsage` mantık kontratının arayüzü.
*   `producerVestingApi (IProducerVestingApi public)`: `ProducerVestingApi` mantık kontratının arayüzü.
*   `producerApi (IProducerApi public)`: `ProducerApi` mantık kontratının arayüzü.

**Olaylar (Events):**

*   `LogAddPlan(uint256 planId, address producerAddress, string name, DataTypes.PlanTypes planType)`: Yeni bir hizmet planı eklendiğinde tetiklenir.

**Constructor:**

*   `constructor()`: `_disableInitializers()` çağırarak, kontratın yalnızca `initialize()` fonksiyonu aracılığıyla başlatılabilmesini sağlar (yükseltilebilir kontratlar için standart bir pratiktir).

**Fonksiyonlar:**

*   `initialize(address payable user, address _uriGeneratorAddress, address _producerApiAddress, address _producerNUsageAddress, address _producerVestingApiAddress, address _producerStorageAddress) external initializer onlyProxy`:
    *   `Producer` kontratını (klonunu) başlatır.
    *   `OwnableUpgradeable` ve `PausableUpgradeable`'ı başlatır.
    *   Sağlanan adresleri ilgili arayüz değişkenlerine atar.
    *   `_transferOwnership(user)` ile kontratın sahipliğini `user` (genellikle `Factory.newBcontract`'ı çağıran kişi) adresine devreder.
    *   `onlyProxy` ile korunur.
*   `addPlan(DataTypes.Plan calldata vars) external onlyOwner returns (uint256 planId)`:
    *   Yeni bir hizmet planı ekler. `producerStorage.addPlan(vars)` çağırarak planı depolama kontratına kaydeder.
    *   `LogAddPlan` olayını yayınlar.
    *   Oluşturulan `planId`'yi döndürür.
    *   `onlyOwner` ile yalnızca kontrat sahibi tarafından çağrılabilir.
*   `addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external onlyOwner`:
    *   API tipi planlar için ek bilgileri (`DataTypes.PlanInfoApi`) `producerStorage`'a ekler.
*   `addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars) external onlyOwner`:
    *   Kullanıma dayalı (N-Usage) planlar için ek bilgileri (`DataTypes.PlanInfoNUsage`) `producerStorage`'a ekler.
*   `addPlanInfoVesting(DataTypes.PlanInfoVesting calldata vars) external onlyOwner`:
    *   Hak edişli (Vesting) planlar için ek bilgileri (`DataTypes.PlanInfoVesting`) `producerStorage`'a ekler.
*   `setPlan(DataTypes.Plan calldata vars) external onlyOwner`:
    *   Mevcut bir planın bilgilerini `producerStorage.setPlan(vars)` çağırarak günceller.
*   `getProducer() public view returns (DataTypes.Producer memory)`:
    *   Bu `Producer` kontratına (klonuna) ait üretici bilgilerini `producerStorage.getProducer(address(this))` çağırarak döndürür.
*   `setProducer(DataTypes.Producer calldata vars) external onlyOwner`:
    *   Üretici bilgilerini `producerStorage.setProducer(vars)` çağırarak günceller.
*   `getPlan(uint256 _planId) public view returns (DataTypes.Plan memory plan)`:
    *   Belirli bir `_planId`'ye sahip planın detaylarını `producerStorage.getPlan(_planId)` çağırarak döndürür.
*   `getPlans() public view returns (DataTypes.Plan[] memory)`:
    *   Bu üreticiye ait tüm planların bir dizisini `producerStorage.getPlans(address(this))` çağırarak döndürür.
*   `addCustomerPlan(DataTypes.CustomerPlan memory vars) public`:
    *   Bir müşterinin belirli bir plana abone olmasını sağlar.
    *   `vars.planType`'a göre ilgili mantık kontratını (`producerVestingApi`, `producerNUsage`, `producerApi`) çağırarak müşteri planını ekler.
    *   `NUsage` planları için:
        *   `vars.remainingQuota > 0` kontrolü yapılır.
        *   Müşterinin yeterli ERC20 token bakiyesine sahip olup olmadığı (`ERC20(...).balanceOf(msg.sender) >= ...`) kontrol edilir.
        *   Bu kontrata token harcaması için onay (`ERC20(...).approve(...)`) alınır.
        *   `SafeTransferLib.safeTransferFrom(...)` ile müşteriden bu kontrata token transferi yapılır.
    *   `uriGenerator.mint(vars)` çağırarak aboneliği temsil eden bir NFT basılır.
*   `updateCustomerPlan(DataTypes.CustomerPlan calldata vars) public onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) onlyCustomer(msg.sender)`:
    *   Mevcut bir müşteri planını günceller.
    *   `onlyExistCustumer` ve `onlyCustomer` değiştiricileri ile korunur.
    *   `vars.planType`'a göre ilgili mantık kontratını çağırır.
    *   Eğer plan durumu `inactive` olarak ayarlanırsa:
        *   `NUsage` planları için: Müşterinin kalan kotası (`cpnu.remainingQuota`) hesaplanır ve ilgili token miktarı (`SafeTransferLib.safeTransferFrom(...)` ile) müşteriye iade edilir.
        *   `uriGenerator.burn(vars)` çağırarak ilgili NFT yakılır.
*   `useFromQuota(DataTypes.CustomerPlan calldata vars) public onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) onlyCustomer(msg.sender) returns (uint256)`:
    *   `NUsage` tipi planlarda müşterinin kotasından kullanım yapılmasını sağlar.
    *   `producerNUsage.useFromQuota(vars)` çağırır.
    *   Kalan kotayı veya ilgili bir değeri döndürür.
*   `uri(uint256 tokenId) public view returns (string memory)`:
    *   Belirli bir `tokenId`'ye (müşteri plan ID'si) sahip NFT'nin URI'sini `uriGenerator.uri(tokenId)` çağırarak döndürür.
*   `getCustomer(address adr) public view returns (DataTypes.Customer memory)`:
    *   Belirli bir adrese (`adr`) sahip müşterinin bilgilerini `producerStorage.getCustomer(adr)` çağırarak döndürür.
*   `withdraw() public onlyOwner`:
    *   Kontratta biriken ETH bakiyesini kontrat sahibine transfer eder.
*   `withdrawTokens(ERC20 token) public onlyOwner`:
    *   Kontratta biriken belirli bir ERC20 tokeninin bakiyesini kontrat sahibine transfer eder.

**Değiştiriciler (Modifiers):**

*   `onlyExistCustumer(uint256 planId, address customerAddress, address cloneAddress)`:
    *   `producerStorage.exsitCustomerPlan(...)` çağırarak belirtilen müşteri planının var olup olmadığını kontrol eder. Yoksa "Customer plan not exist" hatası verir.
*   `onlyCustomer(address customerAddress)`:
    *   `producerStorage.getCustomer(customerAddress).customer == msg.sender` kontrolü ile yalnızca plan sahibi müşterinin fonksiyonu çağırabilmesini sağlar. Yoksa "only customer can call this function" hatası verir.

**Kullanım Senaryoları:**

*   Her bir hizmet sağlayıcının (üreticinin) kendi özel kontrat örneği (klonu) olarak çalışır.
*   Hizmet planlarının oluşturulmasını, güncellenmesini ve yönetilmesini sağlar.
*   Müşteri aboneliklerini, ödemelerini (özellikle `NUsage` planları için) ve hizmet kullanımlarını yönetir.
*   Farklı plan türleri için özel iş mantığını içeren harici mantık kontratlarıyla (API, NUsage, Vesting) etkileşime girer.
*   Abonelikleri temsil eden NFT'lerin basılması ve yakılması için `URIGenerator` ile koordinasyon sağlar.

---

### 4. `URIGenerator.sol`

Bu kontrat, `Producer` kontratlarındaki müşteri aboneliklerini temsil eden ERC1155 NFT'leri için URI'lar (ve dolayısıyla meta veriler) oluşturmaktan sorumludur. Dinamik olarak SVG görüntüleri oluşturur ve bunları Base64 formatında JSON meta verilerine gömer.

*   **Dosya Yolu**: `contracts/URIGenerator.sol`
*   **Temel Amaç**: Abonelik NFT'leri için dinamik, zincir üstü meta veriler ve görseller oluşturmak.

**Kalıtım Aldığı Kontratlar ve Arayüzler:**

*   `IURIGenerator`: Bu kontratın uyguladığı arayüz.
*   `Initializable`
*   `OwnableUpgradeable`
*   `PausableUpgradeable`
*   `UUPSUpgradeable` (OpenZeppelin): Yükseltilebilirlik için UUPS proxy desenini destekler.
*   `ERC1155Upgradeable` (OpenZeppelin): ERC1155 NFT standardını uygular.
*   `IProducerStorage`: `ProducerStorage` kontratıyla etkileşim için.

**Durum Değişkenleri:**

*   `producerStorage (IProducerStorage public)`: `ProducerStorage` kontratının arayüzü.

**Hatalar (Errors):**

*   `NFT_TransferIsNotAllowed()`: NFT transferlerinin izin verilmediğini belirtir.
*   `NFT_Unauthorized()`: Yetkisiz bir işlem denendiğini belirtir.
*   `NFT_Deprecated(uint256 at)`: Bir NFT'nin kullanımdan kaldırıldığını belirtir.

**Fonksiyonlar:**

*   `initialize() public initializer`:
    *   Kontratı başlatır. `OwnableUpgradeable`, `PausableUpgradeable`, `UUPSUpgradeable` ve `ERC1155Upgradeable` (`__ERC1155_init("")` ile) başlatıcılarını çağırır.
*   `setProducerStorage(address _producerStorage) external onlyOwner`:
    *   Sahibinin `producerStorage` adresini ayarlamasına olanak tanır. Bu, `URIGenerator`'ın doğru depolama kontratından veri çekmesini sağlar.
*   `pause() public onlyOwner`:
    *   `PausableUpgradeable`'dan gelen `_pause()` fonksiyonunu çağırarak kontrat fonksiyonlarını duraklatır.
*   `unpause() public onlyOwner`:
    *   `PausableUpgradeable`'dan gelen `_unpause()` fonksiyonunu çağırarak kontrat fonksiyonlarını devam ettirir.
*   `_authorizeUpgrade(address newImplementation) internal override onlyOwner`:
    *   UUPS yükseltme mekanizmasının bir parçasıdır. Yalnızca sahip tarafından çağrılabilir ve yeni bir uygulama adresine yükseltmeyi yetkilendirir.
*   `mint(DataTypes.CustomerPlan calldata vars) external onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress)`:
    *   Belirli bir müşteri planı (`vars.custumerPlanId` token ID'si olarak kullanılır) için `vars.customerAdress` adresine yeni bir ERC1155 tokeni (NFT) basar. Miktar (`amount`) 0 olarak ayarlanmış gibi görünüyor, bu genellikle tekil NFT'ler için 1 olmalıdır veya ERC1155'in yarı-fungible doğasına göre ayarlanmalıdır. `abi.encode(vars.cloneAddress)` verisiyle basılır.
    *   `onlyExistCustumer` değiştiricisi ile korunur.
*   `safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) public pure override`:
    *   ERC1155 standardından gelen bu fonksiyonu geçersiz kılarak `NFT_TransferIsNotAllowed()` hatası fırlatır. Bu, basılan NFT'lerin devredilemez (soulbound) olmasını sağlar.
*   `safeBatchTransferFrom(...) public pure override`:
    *   Benzer şekilde, toplu transferleri de engeller.
*   `burn(DataTypes.CustomerPlan calldata vars) external onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress)`:
    *   Belirli bir müşteri planına ait NFT'yi (`vars.custumerPlanId` token ID'si) `vars.customerAdress` adresinden yakar. Miktar yine 0 olarak belirtilmiş.
    *   `onlyExistCustumer` ile korunur.
*   `uri(uint256 tokenId) public view override(ERC1155Upgradeable, IURIGenerator) returns (string memory)`:
    *   ERC1155 standardının gerektirdiği ve `IURIGenerator` arayüzünde tanımlanan bu fonksiyon, belirli bir `tokenId` (müşteri plan ID'si) için meta veri URI'sini döndürür.
    *   `producerStorage.getCustomerPlan(tokenId)` ile müşteri planı detaylarını alır.
    *   `producerStorage.getPlan(capi.planId)` ile plan detaylarını alır.
    *   `producerStorage.getProducer(capi.customerAdress)` ile üretici detaylarını alır (burada `capi.customerAdress` yerine `capi.cloneAddress` veya planla ilişkili üretici adresi daha mantıklı olabilir, kontrol edilmeli).
    *   Bu verilerle bir `UriMeta` yapısı doldurur.
    *   `uriMeta.planType`'a göre ilgili `constructTokenUri<Type>()` fonksiyonunu çağırır. Ancak mevcut implementasyonda bu fonksiyonlar doğrudan `generateNFT(uriMeta)` sonucunu döndürüyor. İdealde, `constructTokenURI(uriMeta)` çağrılmalıydı.
*   `constructTokenUriApi(UriMeta memory params) public view returns (string memory)`, `constructTokenUriVestingApi(...)`, `constructTokenUriNUsage(...)`:
    *   Bu fonksiyonlar şu anda doğrudan `generateNFT(params)` çağırarak SVG dizesini döndürür. Tam JSON meta verisi için `constructTokenURI`'yi çağırmaları beklenirdi.
*   `constructTokenURI(UriMeta memory params) public view returns (string memory)`:
    *   NFT için tam JSON meta veri dizesini oluşturur.
    *   `generateNFT(params)` ile SVG görüntüsünü alır.
    *   JSON yapısını (`name`, `description`, `image`) oluşturur. `image` alanı, Base64 kodlanmış SVG verisini içerir (`data:image/svg+xml;base64,...`).
    *   Tüm JSON dizesi de Base64 olarak kodlanır ve `data:application/json;base64,...` URI şemasıyla döndürülür.
*   `generateName(UriMeta memory params) public pure returns (string memory)`:
    *   NFT için bir ad oluşturur: `params.producerName + "-" + params.planId + "-" + params.custumerPlanId`.
*   `generateDescription(UriMeta memory params) public pure returns (string memory)`:
    *   NFT için bir açıklama oluşturur, üretici adı, plan ID'si, müşteri plan ID'si ve üretici kontrat adresini içerir.
*   `generateNFT(UriMeta memory params) public view returns (string memory)`:
    *   Dinamik olarak bir SVG görüntüsü oluşturur.
    *   SVG, bir arka plan, bir logo/desen ve metin bölümleri (üretici adı, fiyat bilgisi, başlangıç/bitiş tarihleri) içerir.
    *   `ERC20(params.priceAddress).decimals()` ile fiyatın ondalık basamak sayısını alır.
*   Yardımcı SVG Oluşturma Fonksiyonları:
    *   `_generateHeaderSection`, `_generateAmountsSection`, `_generateDateSection`, `_generateAmountString`, `_generateTimestampString`: SVG'nin belirli bölümlerini ve metinlerini oluşturur.
*   Yardımcı Dize ve Tarih Formatlama Fonksiyonları:
    *   `_decimalString`, `_generateDecimalString`: Sayıları ondalıklı dizelere dönüştürür.
    *   `_generateDateString`, `_getDateUnits`: Unix zaman damgalarını "AA/GG/YYYY" formatında tarihlere dönüştürür.
    *   `_toString`: `uint256` değerlerini dizeye dönüştürür.
    *   `toHexString`, `addressToString`: Adresleri onaltılık dizelere dönüştürür.

**Değiştiriciler (Modifiers):**

*   `onlyExistCustumer(uint256 planId, address customerAddress, address cloneAddress)`:
    *   `producerStorage.exsitCustomerPlan(...)` çağırarak belirtilen müşteri planının var olup olmadığını kontrol eder.

**Kullanım Senaryoları:**

*   Müşteri aboneliklerini temsil eden, devredilemez (soulbound) ERC1155 NFT'leri basar ve yakar.
*   Bu NFT'ler için tamamen zincir üzerinde, dinamik olarak meta veriler ve SVG tabanlı görseller oluşturur. Bu, harici sunuculara veya IPFS'e bağımlılığı ortadan kaldırır.
*   UUPS proxy deseni sayesinde yükseltilebilir bir yapıya sahiptir.

---

## Diğer Önemli Klasörler ve Dosyalar (İçerikleri Sağlanmadı, Ancak Tahminler)

*   **`contracts/fortest/`**: Test senaryoları için kullanılan yardımcı kontratları (mock'lar, test token'ları vb.) içerebilir.
*   **`contracts/interfaces/`**: Sistemdeki çeşitli kontratlar tarafından uygulanan arayüz tanımlarını içerir (örneğin, `IFactory.sol`, `IProducerStorage.sol`, `IProducerApi.sol` vb.). Bu arayüzler, kontratlar arası etkileşimleri standartlaştırır.
*   **`contracts/lib/`**: Muhtemelen OpenZeppelin veya diğer üçüncü parti kütüphaneler gibi harici Solidity kütüphanelerini içerir.
*   **`contracts/libraries/`**: Projeye özgü yardımcı kütüphaneleri içerir. Örneğin:
    *   `Base64.sol`: Base64 kodlama/kod çözme işlemleri için.
    *   `DataTypes.sol`: Sistem genelinde kullanılan özel veri yapılarını (struct'lar, enum'lar) tanımlar (örneğin, `Producer`, `Plan`, `CustomerPlan` vb.).
    *   `SafeTransferLib.sol`: ERC20 token transferlerini güvenli bir şekilde yapmak için (örneğin, `transferFrom` çağrılarında dönüş değerlerini kontrol ederek).
*   **`contracts/logic/`**: `Producer.sol` tarafından çağrılan, belirli plan türlerine (API, NUsage, Vesting) özgü daha karmaşık iş mantığını içeren kontratları barındırır. Bu, ana `Producer` kontratını daha modüler ve yönetilebilir tutar.
    *   `ProducerApi.sol`
    *   `ProducerNUsage.sol`
    *   `ProducerVestingApi.sol`
*   **`contracts/storage/`**: Veri depolama mantığını içeren kontratları barındırır.
    *   `ProducerStorage.sol`: Üretici bilgileri, plan detayları, müşteri abonelikleri gibi kritik verileri saklar. Diğer kontratlar bu verileri okumak ve yazmak için bu kontratla etkileşime girer. Bu, mantık ve depolamanın ayrılmasına yardımcı olur (proxy desenleriyle yükseltmeleri kolaylaştırır).

Bu detaylı dökümantasyon, `contracts` klasöründeki Solidity kod yapısının daha kapsamlı bir anlayışını sunmayı amaçlamaktadır.

---

## Öneriler ve İyileştirme Alanları

Bu bölüm, incelenen kod tabanına ve dokümantasyona dayanarak potansiyel iyileştirmeler, dikkat edilmesi gereken noktalar ve genel öneriler sunmaktadır.

### 1. Genel Öneriler

*   **NatSpec Dokümantasyonu**: Tüm `public` ve `external` fonksiyonlar, olaylar ve durum değişkenleri için NatSpec yorumlarının (`@notice`, `@dev`, `@param`, `@return` vb.) kapsamlı bir şekilde kullanılması, kodun okunabilirliğini artırır ve otomatik doküman oluşturmayı kolaylaştırır. Mevcut dokümantasyon iyi bir başlangıçtır ancak daha da detaylandırılabilir.
*   **Custom Errors (Özel Hatalar)**: `DelegateCall.sol`'de özel hatalar kullanılmıştır. Gaz verimliliği ve daha açıklayıcı hata mesajları için proje genelinde `require` ifadelerindeki string mesajlar yerine özel hataların (Solidity 0.8.4+ ile gelen özellik) tutarlı bir şekilde kullanılması önerilir.
*   **Test Kapsamı**: Kapsamlı birim testleri ve entegrasyon testleri kritik öneme sahiptir. Özellikle erişim kontrolü, yeniden giriş (reentrancy), aritmetik taşmalar, mantıksal hatalar ve ekonomik saldırı vektörleri gibi güvenlik açıklarını kapsayan senaryolar test edilmelidir. Kenar durumlar (edge cases) unutulmamalıdır.
*   **Güvenlik Denetimi (Audit)**: Ana ağa (mainnet) dağıtımdan önce profesyonel bir güvenlik denetiminden geçirilmesi şiddetle tavsiye edilir.
*   **Gaz Optimizasyonu**: Özellikle döngüler, depolama erişimleri (SSTORE/SLOAD) ve zincir üstü SVG oluşturma gibi karmaşık hesaplamalar, gaz maliyetleri açısından gözden geçirilmelidir. Optimizasyonlar, sistemin kullanılabilirliğini ve maliyet etkinliğini artırabilir.
*   **Olay (Event) Emisyonu**: Tüm önemli durum değişikliklerinin olaylar aracılığıyla yayınlanması, zincir dışı servislerin (örn: The Graph, izleme araçları) sistemi etkin bir şekilde takip etmesini sağlar. Mevcut olaylar iyi bir temel oluşturmaktadır.
*   **Girdi Doğrulaması**: Tüm `public` ve `external` fonksiyonlara gelen girdilerin (parametrelerin) titizlikle doğrulanması önemlidir (örn: adres parametreleri için `address(0)` kontrolü, sayısal değerler için mantıksal aralık kontrolleri).
*   **Sürüm Pragma'sı**: `pragma solidity 0.8.17;` gibi sabit bir pragma kullanılması tutarlılık açısından iyidir.
*   **Modülerlik ve Yükseltilebilirlik**: `ProducerStorage`, çeşitli `Producer` API mantık kontratları ve proxy desenlerinin (klonlar, UUPS) kullanılması, modülerlik ve yükseltilebilirlik açısından olumlu adımlardır. Yükseltme süreçlerinin (özellikle UUPS için depolama düzeni uyumluluğu) iyi anlaşılması ve test edilmesi gerekir.

### 2. Kontrat Bazlı Öneriler

#### `DelegateCall.sol`

*   `onlyProxy` değiştiricisindeki `_getImplementation() != __self` kontrolü yorum satırındadır. Bu kontrolün kasıtlı olarak mı kaldırıldığı yoksa bir eksiklik mi olduğu değerlendirilmelidir. Eğer mantık kontratının yalnızca aktif proxy uygulaması tarafından çağrılması isteniyorsa, bu kontrolün aktif edilmesi düşünülebilir.

#### `Factory.sol`

*   `producerLogicAddress` durum değişkeni tanımlanmış ancak mevcut kodda kullanılmıyor gibi görünmektedir. Eğer gelecekte bir kullanım planı yoksa, kod temizliği açısından kaldırılabilir.
*   `// todo research Clones.sol or ClonesUpgradeable` yorumu bir araştırma noktasına işaret etmektedir. `Clones.sol` (EIP-1167) genellikle değişmez minimal proxy'ler oluşturmak için uygundur. `ClonesUpgradeable.sol` ise klonlama mantığının kendisinin yükseltilebilir olması gerektiğinde (daha nadir bir durum) relevant olabilir. Mevcut kullanım için `Clones.sol` doğru bir seçim gibi durmaktadır.
*   `setProducerImplementation` fonksiyonunda `_ProducerImplementationAddress` için `address(0)` kontrolü eklenebilir.

#### `Producer.sol`

*   `ERC1155Upgradeable` importu ve `__ERC1155_init("")` çağrısı yorum satırındadır. Eğer `Producer` kontratı doğrudan ERC1155 fonksiyonlarını kullanmıyorsa (bu işlevsellik `URIGenerator.sol` tarafından yönetiliyor gibi görünüyor), bu kısımlar kod temizliği için kaldırılabilir.
*   **`addCustomerPlan` (`NUsage` Tipi Planlar İçin Ödeme Mantığı)**:
    *   `// todo add payment to the producer` yorumu bulunmaktadır. Mevcut kod, tokenları müşteriden (`msg.sender`) bu `Producer` kontratına (`address(this)`) transfer etmektedir. Eğer amaç, `Producer` kontratının bir aracı olması ve ardından kontrat sahibinin bu fonları `withdrawTokens()` ile çekmesi ise, bu yapı uygundur.
    *   `ERC20(address(plan.priceAddress)).approve(address(this), ...)` çağrısı `Producer` kontratı içinde yapılıyor. ERC20 akışında, token sahibi (`msg.sender` yani müşteri) *öncelikle* `Producer` kontratına kendi tokenlarını harcaması için onay vermelidir. Bu onay genellikle müşteri tarafında (UI üzerinden veya ayrı bir işlemle) yapılır. `Producer` kontratı daha sonra `transferFrom` ile tokenları çeker. Mevcut `approve` çağrısı ya gereksizdir (müşteri zaten onay verdiyse) ya da token sahibi olmadığı için başarısız olacaktır. Bu akışın gözden geçirilmesi önemlidir.
*   **`onlyCustomer` Değiştiricisi**: `producerStorage.getCustomer(address(customerAddress)).customer == address(msg.sender)` kontrolü, `customerAddress`'ın her zaman `msg.sender` olacağını varsayar. Eğer bir yönetici gibi farklı bir adres, müşteri adına işlem yapabilecekse bu kısıtlama sorun yaratabilir. Ancak `updateCustomerPlan` ve `useFromQuota` fonksiyonlarındaki `onlyCustomer(msg.sender)` kullanımı, bu varsayımın doğru olduğunu düşündürmektedir.

#### `URIGenerator.sol`

*   **NFT Basım Miktarı (`mint`/`burn`)**: `_mint` ve `_burn` fonksiyonlarına `amount` parametresi olarak `0` geçilmektedir. ERC1155 standardında bu, sıfır adet token basmak/yakmak anlamına gelir. Bir aboneliği temsil eden benzersiz bir NFT için bu miktar genellikle `1` olmalıdır. Bu, düzeltilmesi gereken önemli bir nokta olabilir.
*   **`uri()` Fonksiyonunda Üretici Bilgisi**: `producerStorage.getProducer(capi.customerAdress)` çağrısı, üretici bilgilerini müşteri adresinden almaya çalışmaktadır. Bu mantıksal olarak hatalı olabilir. Üretici bilgisi, planla (`capi.planId`) veya klon adresiyle (`capi.cloneAddress`) ilişkili olmalıdır. Örneğin, `producerStorage.getProducer(plan.producerAddress)` gibi bir yapı daha doğru olabilir (eğer `Plan` struct'ında üretici adresi tutuluyorsa) veya `Producer` kontratının adresi (`capi.cloneAddress`) üzerinden bir arama yapılabilir.
*   **Token URI Oluşturma Fonksiyonları**: `constructTokenUriApi`, `constructTokenUriVestingApi`, `constructTokenUriNUsage` fonksiyonları şu anda doğrudan SVG dizesini (`generateNFT(params)`) döndürmektedir. Dokümantasyonda da belirtildiği gibi, tam JSON meta verisini döndürmek için `constructTokenURI(params)` fonksiyonunu çağırmaları daha doğru olacaktır.
*   **SVG Oluşturma ve Gaz Maliyeti**: Zincir üstü SVG oluşturma yenilikçi bir yaklaşım olsa da, özellikle karmaşık SVG'ler için yüksek gaz maliyetlerine yol açabilir. Bu durum, özellikle yoğun kullanılan fonksiyonlarda (örn: `uri()`) kullanıcı deneyimini olumsuz etkileyebilir. Alternatif olarak, temel NFT özelliklerini zincir üzerinde tutup, daha karmaşık görselleri IPFS gibi zincir dışı çözümlerde barındırmak ve URI'da buna referans vermek düşünülebilir. Ancak mevcut yaklaşım, tamamen merkeziyetsiz ve bağımsız bir meta veri sunar.
*   **NFT Devredilemezliği**: `safeTransferFrom` ve `safeBatchTransferFrom` fonksiyonlarının `NFT_TransferIsNotAllowed` hatası fırlatacak şekilde geçersiz kılınması, bu NFT'lerin "soulbound" (devredilemez) olmasını sağlar, bu da abonelikler için genellikle istenen bir davranıştır.

### 3. Potansiyel Geliştirmeler

*   **Rol Tabanlı Erişim Kontrolü (RBAC)**: `OwnableUpgradeable` basit sahiplik için yeterlidir. Ancak daha karmaşık yönetim senaryoları (örn: belirli fonksiyonları yalnızca belirli rollere sahip adreslerin çağırabilmesi) için OpenZeppelin'in `AccessControlUpgradeable` kontratı gibi daha gelişmiş bir RBAC sistemi entegre edilebilir.
*   **Toplu İşlemler (Batch Operations)**: Yöneticiler veya üreticiler için bazı işlemleri toplu halde yapabilme (örn: birden fazla planı güncelleme, birden fazla müşteriye bildirim gönderme - eğer böyle bir özellik eklenirse) yeteneği, kullanım kolaylığı sağlayabilir. Ancak bu tür fonksiyonlar gaz limitlerini zorlayabilir.
*   **Gelişmiş Sorgu Fonksiyonları**: `ProducerStorage` gibi depolama kontratlarına, zincir dışı servislerin veri çekmesini kolaylaştıracak daha fazla `view` fonksiyonu eklenebilir (örn: belirli kriterlere göre planları/müşterileri filtreleme).
*   **Standart Arayüzlere Uyum**: Eğer mümkünse, ERC standartları (örn: EIP-2981 NFT Royalty Standardı, eğer NFT'ler bir şekilde ikincil piyasada değerlenecekse - mevcut durumda devredilemez olsalar da) veya topluluk tarafından kabul görmüş diğer standart arayüzlere uyum sağlamak, entegrasyonları kolaylaştırabilir.

Bu öneriler, mevcut kod tabanının sağlamlığını artırmaya, kullanıcı deneyimini iyileştirmeye ve gelecekteki geliştirmeler için esneklik sağlamaya yardımcı olabilir.

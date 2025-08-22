# Kütüphane Katmanı (Library Layer)

Bu dokümantasyon, BliContract sisteminde kullanılan kütüphane kontratları ve yardımcı utilitylerini detaylarıyla açıklamaktadır.

## İçindekiler
- [Genel Bakış](#genel-bakış)
- [Base64](#base64)
- [SafeTransferLib](#safetransferlib)
- [ERC20](#erc20)
- [ApiSuperAppBaseFlow](#apisuperappbaseflow)
- [SuperToken](#supertoken)
- [Kullanım Örnekleri](#kullanım-örnekleri)
- [Güvenlik Düşünceleri](#güvenlik-düşünceleri)

---

## Genel Bakış

Kütüphane katmanı, BliContract sisteminin çeşitli bileşenlerinde kullanılan yardımcı fonksiyonlar ve temel kontratları içerir. Bu kütüphaneler:

- **Gas Optimization**: Düşük seviye optimizasyonlar
- **Security**: Güvenli token operasyonları
- **Utility Functions**: Encoding, formatting ve helper fonksiyonlar
- **Superfluid Integration**: Stream tabanlı işlemler için framework

### Kütüphane Türleri

| Kütüphane | Tür | Amaç |
|-----------|-----|------|
| [`Base64`](#base64) | Pure Library | SVG ve JSON encoding |
| [`SafeTransferLib`](#safetransferlib) | Gas-Optimized Library | Güvenli token transferleri |
| [`ERC20`](#erc20) | Abstract Contract | Modern ERC20 implementasyonu |
| [`ApiSuperAppBaseFlow`](#apisuperappbaseflow) | Abstract Contract | Superfluid SuperApp framework |
| [`SuperToken`](#supertoken) | Abstract Contract | Superfluid token abstraksiyonu |

---

## Base64

### Genel Bakış
[`Base64.sol`](../../contracts/libraries/Base64.sol) kütüphanesi, binary verilerin Base64 formatına encode edilmesi için kullanılır.

### Kaynak
**OpenZeppelin Contracts v4.7.0** tabanlı implementasyon.

### Ana Fonksiyon

#### `encode()`
```solidity
function encode(bytes memory data) internal pure returns (string memory)
```

**Amaç**: Binary verileri Base64 string'e dönüştürür
**Giriş**: `bytes` formatında data
**Çıkış**: Base64 encoded string

### Teknik Detaylar

#### Encoding Tablosu
```solidity
string internal constant _TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
```

**64 karakter**: A-Z, a-z, 0-9, +, /

#### Algoritma Özellikleri
- **3-byte chunks**: Her 3 byte'ı 4 karaktere dönüştürür
- **Padding**: Eksik byte'lar için `=` padding
- **Assembly optimized**: Gas efficient implementation

#### Assembly Implementation
```solidity
assembly {
    // Lookup table pointer
    let tablePtr := add(table, 1)
    
    // Result pointer
    let resultPtr := add(result, 32)
    
    // Process 3 bytes at a time
    for {
        let dataPtr := data
        let endPtr := add(data, mload(data))
    } lt(dataPtr, endPtr) {
        dataPtr := add(dataPtr, 3)
        let input := mload(dataPtr)
        
        // Extract 6-bit chunks and map to table
        mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
        resultPtr := add(resultPtr, 1)
        // ... (diğer karakterler)
    }
    
    // Handle padding
    switch mod(mload(data), 3)
    case 1 { /* Add == padding */ }
    case 2 { /* Add = padding */ }
}
```

### BliContract'te Kullanımı

#### NFT Meta Verilerinde
```solidity
// URIGenerator.sol içinde
string memory svg = generateNFT(params);
return string(
    abi.encodePacked(
        "data:application/json;base64,",
        Base64.encode(
            abi.encodePacked(
                '{"name":"', generateName(params),
                '", "description": "', generateDescription(params),
                '", "image": "data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '"}'
            )
        )
    )
);
```

#### Kullanım Senaryoları
1. **SVG Encoding**: NFT görsellerinin Base64'e dönüştürülmesi
2. **JSON Meta Data**: Token URI'larının encoding'i
3. **On-chain Storage**: Binary verinin string olarak saklanması

### Performance Characteristics
- **Gas Efficient**: Assembly kullanımı ile optimize edilmiş
- **Memory Safe**: OpenZeppelin'in güvenli implementasyonu
- **Standard Compliant**: RFC 4648 Base64 standardına uygun

---

## SafeTransferLib

### Genel Bakış
[`SafeTransferLib.sol`](../../contracts/libraries/SafeTransferLib.sol) kütüphanesi, ERC20 token'ların güvenli transferi için optimize edilmiş fonksiyonlar sağlar.

### Kaynak
**Solmate** library'sinden alınmış, gas-optimized implementasyon.

### Ana Fonksiyonlar

#### ETH İşlemleri

##### `safeTransferETH()`
```solidity
function safeTransferETH(address to, uint256 amount) internal
```

**Assembly Implementation**:
```solidity
assembly {
    success := call(gas(), to, amount, 0, 0, 0, 0)
}
require(success, "ETH_TRANSFER_FAILED");
```

**Özellikler**:
- Direct assembly call kullanımı
- Gas efficiency
- Failure handling

#### ERC20 İşlemleri

##### `safeTransferFrom()`
```solidity
function safeTransferFrom(ERC20 token, address from, address to, uint256 amount) internal
```

**Assembly Implementation**:
```solidity
assembly {
    // Function selector: transferFrom(address,address,uint256)
    mstore(freeMemoryPointer, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
    mstore(add(freeMemoryPointer, 4), from)
    mstore(add(freeMemoryPointer, 36), to)
    mstore(add(freeMemoryPointer, 68), amount)

    success := and(
        // Return value check: either returns true or no return data
        or(and(eq(mload(0), 1), gt(returndatasize(), 31)), iszero(returndatasize())),
        // Call successful
        call(gas(), token, 0, freeMemoryPointer, 100, 0, 32)
    )
}
require(success, "TRANSFER_FROM_FAILED");
```

##### `safeTransfer()`
```solidity
function safeTransfer(ERC20 token, address to, uint256 amount) internal
```

##### `safeApprove()`
```solidity
function safeApprove(ERC20 token, address to, uint256 amount) internal
```

### Güvenlik Özellikleri

#### Return Value Handling
```solidity
// Accepts both:
// 1. Tokens that return true on success
// 2. Tokens that return nothing (no return data)
or(and(eq(mload(0), 1), gt(returndatasize(), 31)), iszero(returndatasize()))
```

#### Missing Return Value Support
Bazı ERC20 token'lar (örn: USDT) return value vermez. SafeTransferLib bu durumu handle eder.

### BliContract'te Kullanımı

#### Producer Kontratında
```solidity
// NUsage plan payments
SafeTransferLib.safeTransferFrom(
    ERC20(address(plan.priceAddress)), 
    msg.sender, 
    address(this), 
    pInfoNUsage.oneUsagePrice * vars.remainingQuota
);

// Refunds
SafeTransferLib.safeTransferFrom(
    ERC20(address(plan.priceAddress)),
    address(this),
    msg.sender,
    (pInfoNUsage.oneUsagePrice) * cpnu.remainingQuota
);
```

### Gas Optimizasyonları

1. **Direct Assembly**: Solidity function call overhead'ini bypass eder
2. **Memory Management**: Efficient memory pointer kullanımı
3. **Batch Operations**: Single call ile multiple parametreler

### Güvenlik Avantajları

1. **Reentrancy Safe**: External call'lar güvenli şekilde handle edilir
2. **Return Value Agnostic**: Farklı ERC20 implementasyonlarıyla uyumlu
3. **Gas Limit Safe**: Call failure'ları proper şekilde handle edilir

---

## ERC20

### Genel Bakış
[`ERC20.sol`](../../contracts/libraries/ERC20.sol), modern ve gas-efficient bir ERC20 + EIP-2612 implementasyonudur.

### Kaynak
**Solmate** library'sinden alınmış, Uniswap'ten modifiye edilmiş.

### Özellikler

#### ERC20 Standard Compliance
```solidity
abstract contract ERC20 {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
}
```

#### EIP-2612 Permit Support
```solidity
// Permit storage
uint256 internal immutable INITIAL_CHAIN_ID;
bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;
mapping(address => uint256) public nonces;
```

### Ana Fonksiyonlar

#### Standard ERC20
```solidity
function approve(address spender, uint256 amount) public virtual returns (bool);
function transfer(address to, uint256 amount) public virtual returns (bool);
function transferFrom(address from, address to, uint256 amount) public virtual returns (bool);
```

#### EIP-2612 Permit
```solidity
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) public virtual
```

**Gasless Approvals**: İmza tabanlı approval, gas-free UX sağlar.

#### Internal Mint/Burn
```solidity
function _mint(address to, uint256 amount) internal virtual;
function _burn(address from, uint256 amount) internal virtual;
```

### Gas Optimizasyonları

#### Unchecked Math
```solidity
// Overflow kontrolsüz optimizasyonlar
unchecked {
    balanceOf[to] += amount;  // Overflow impossible due to totalSupply check
}

unchecked {
    totalSupply -= amount;    // Underflow impossible due to balance check
}
```

#### Efficient Allowance Check
```solidity
uint256 allowed = allowance[from][msg.sender];
if (allowed != type(uint256).max) {
    allowance[from][msg.sender] = allowed - amount;
}
```

**Infinite Approval Optimization**: `type(uint256).max` değeri infinite approval olarak kullanılır.

### Domain Separator Management

#### Chain-Aware Implementation
```solidity
function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
    return block.chainid == INITIAL_CHAIN_ID 
        ? INITIAL_DOMAIN_SEPARATOR 
        : computeDomainSeparator();
}
```

**Fork Protection**: Chain ID değişikliklerinde domain separator'ı yeniden hesaplar.

### BliContract'te Kullanımı

Bu kontrat doğrudan BliContract'te kullanılmaz, ancak SafeTransferLib'in tiplerinde kullanılır:

```solidity
import {ERC20} from "./ERC20.sol";

function safeTransferFrom(ERC20 token, address from, address to, uint256 amount) internal;
```

---

## ApiSuperAppBaseFlow

### Genel Bakış
[`ApiSuperAppBaseFlow.sol`](../../contracts/libraries/ApiSuperAppBaseFlow.sol), Superfluid SuperApp'ler için temel framework sağlar.

### Amaç
Superfluid stream'lerini dinleyen ve otomatik olarak tepki veren kontratlar için base class.

### Kalıtım
```solidity
abstract contract ApiSuperAppBaseFlow is ISuperApp
```

### SuperApp Konsepti

#### Superfluid SuperApp
- **Stream Listener**: Token stream'lerini real-time dinler
- **Automatic Reactions**: Stream olaylarına otomatik tepki verir
- **Programmable Money**: Stream'ler üzerinde custom logic çalıştırır

### Ana Bileşenler

#### Initialization
```solidity
function setSuperInitialize(
    ISuperfluid host_,
    bool activateOnCreated,
    bool activateOnUpdated,
    bool activateOnDeleted
) external
```

**Callback Configuration**: Hangi stream olaylarının dinleneceğini ayarlar.

#### Callback Functions
```solidity
function onFlowCreated(ISuperToken superToken, address sender, bytes calldata ctx) 
    internal virtual returns (bytes memory);

function onFlowUpdated(ISuperToken superToken, address sender, int96 previousFlowRate, 
    uint256 lastUpdated, bytes calldata ctx) internal virtual returns (bytes memory);

function onFlowDeleted(ISuperToken superToken, address sender, address receiver, 
    int96 previousFlowRate, uint256 lastUpdated, bytes calldata ctx) 
    internal virtual returns (bytes memory);
```

**Override Required**: Alt sınıflar bu fonksiyonları implement etmelidir.

### Low-Level Callbacks

#### Before/After Pattern
```solidity
function beforeAgreementCreated(...) external pure override returns (bytes memory);
function afterAgreementCreated(...) external override returns (bytes memory);

function beforeAgreementUpdated(...) external view override returns (bytes memory);
function afterAgreementUpdated(...) external override returns (bytes memory);

function beforeAgreementTerminated(...) external view override returns (bytes memory);
function afterAgreementTerminated(...) external override returns (bytes memory);
```

**Data Flow**: Before callback'ler veri toplar, after callback'ler işlem yapar.

### Güvenlik Kontrolleri

#### Host Verification
```solidity
if (msg.sender != address(host)) revert UnauthorizedHost();
```

#### Agreement Filtering
```solidity
function isAcceptedAgreement(address agreementClass) internal view virtual returns (bool) {
    return agreementClass == address(host.getAgreementClass(CFAV1_TYPE));
}
```

#### Token Filtering
```solidity
function isAcceptedSuperToken(ISuperToken superToken) public view virtual returns (bool) {
    return true; // Override for custom filtering
}
```

### BliContract'te Kullanımı

Bu kontrat şu anda ProducerApi'de comment'li durumda:
```solidity
// import {ApiSuperAppBaseFlow} from "./../libraries/ApiSuperAppBaseFlow.sol";
```

**Potansiyel Kullanım**: 
- Producer'ların stream'leri otomatik izlemesi
- Payment failure'larda otomatik service suspension
- Stream rate değişikliklerinde plan upgrade/downgrade

---

## SuperToken

### Genel Bakış
[`SuperToken.sol`](../../contracts/libraries/SuperToken.sol), Superfluid SuperToken'lar için temel abstraksiyonu sağlar.

### Bileşenler

#### SuperTokenStorage
```solidity
abstract contract SuperTokenStorage {
    uint256[32] internal _storagePaddings;
}
```

**Storage Padding**: İlk 32 slot'u korur, implementation contract'ın state variable'larını override etmesini engeller.

#### UUPSProxy
```solidity
contract UUPSProxy is Proxy {
    bytes32 internal constant _IMPLEMENTATION_SLOT = 
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        
    function initializeProxy(address initialAddress) external;
    function _implementation() internal view virtual override returns (address impl);
}
```

**UUPS Pattern**: Upgradeable proxy pattern implementasyonu.

#### SuperTokenBase
```solidity
abstract contract SuperTokenBase is SuperTokenStorage, UUPSProxy {
    function _initialize(address factory, string memory name, string memory symbol) internal;
    function _totalSupply() internal view returns (uint256);
    function _mint(address account, uint256 amount, bytes memory userData) internal;
    function _burn(address from, uint256 amount, bytes memory userData) internal;
    function _approve(address account, address spender, uint256 amount) internal;
    function _transferFrom(address holder, address spender, address recipient, uint256 amount) internal;
}
```

### Teknik Özellikler

#### Factory Integration
```solidity
function _initialize(address factory, string memory name, string memory symbol) internal {
    ISuperTokenFactory(factory).initializeCustomSuperToken(address(this));
    ISuperToken(address(this)).initialize(IERC20(address(0)), 18, name, symbol);
}
```

**Two-Step Initialization**:
1. Factory'de token kaydı
2. SuperToken'ın kendi initialization'ı

#### Delegate Calls
```solidity
function _mint(address account, uint256 amount, bytes memory userData) internal {
    ISuperToken(address(this)).selfMint(account, amount, userData);
}
```

**Self-Delegation**: Proxy üzerinden kendi fonksiyonlarını çağırır.

### BliContract'te Kullanımı

SuperToken abstraksiyonu ProducerVestingApi ve ProducerApi'de indirect olarak kullanılır:

```solidity
// SuperToken operations
ISuperToken(superTokenAddress).createFlow(receiver, flowRate);
ISuperToken(superTokenAddress).deleteFlow(receiver, sender);
ISuperToken(superTokenAddress).upgrade(amountToWrap);
ISuperToken(superTokenAddress).downgrade(amountToUnwrap);
```

---

## Kullanım Örnekleri

### 1. NFT URI Generation
```solidity
// Base64 encoding for on-chain metadata
string memory svg = generateNFT(params);
string memory json = string(
    abi.encodePacked(
        '{"name":"', name, '","image":"data:image/svg+xml;base64,',
        Base64.encode(bytes(svg)), '"}'
    )
);
return string(
    abi.encodePacked(
        "data:application/json;base64,",
        Base64.encode(bytes(json))
    )
);
```

### 2. Safe Token Operations
```solidity
// Safe payment processing
DataTypes.PlanInfoNUsage memory pInfo = producerStorage.getPlanInfoNUsage(planId);
uint256 totalCost = pInfo.oneUsagePrice * quotaAmount;

SafeTransferLib.safeTransferFrom(
    ERC20(paymentToken),
    customer,
    address(this),
    totalCost
);
```

### 3. SuperApp Implementation
```solidity
contract CustomSuperApp is ApiSuperAppBaseFlow {
    function onFlowCreated(
        ISuperToken superToken,
        address sender,
        bytes calldata ctx
    ) internal override returns (bytes memory) {
        // Custom logic when stream starts
        activateSubscription(sender);
        return ctx;
    }
    
    function onFlowDeleted(
        ISuperToken superToken,
        address sender,
        address receiver,
        int96 previousFlowRate,
        uint256 lastUpdated,
        bytes calldata ctx
    ) internal override returns (bytes memory) {
        // Custom logic when stream ends
        deactivateSubscription(sender);
        return ctx;
    }
}
```

---

## Güvenlik Düşünceleri

### Base64 Library
✅ **Güvenli**: OpenZeppelin implementasyonu, memory-safe assembly
✅ **Pure Function**: External state'i etkilemez
⚠️ **Gas Cost**: Büyük veriler için pahalı olabilir

### SafeTransferLib
✅ **Battle Tested**: Solmate library, yaygın kullanım
✅ **Return Value Agnostic**: Farklı ERC20'lerle uyumlu
⚠️ **No Code Check**: Token kontrat varlığını kontrol etmez
⚠️ **Assembly Usage**: Yanlış kullanım riski

### ERC20 Implementation
✅ **Gas Optimized**: Unchecked math kullanımı
✅ **EIP-2612 Support**: Modern permit functionality
⚠️ **Permit Replay**: Cross-chain deployment'larda dikkat
⚠️ **Infinite Approval**: UI'da kullanıcıya açık gösterilmeli

### SuperApp Framework
✅ **Official Framework**: Superfluid tarafından sağlanan
✅ **Callback Protection**: Host verification
⚠️ **Jail Risk**: Callback failure durumunda SuperApp jail edilebilir
⚠️ **Context Management**: Superfluid context'inin doğru kullanımı kritik

### SuperToken Abstractions
✅ **Factory Pattern**: Güvenli initialization
✅ **UUPS Proxy**: Upgradeable architecture
⚠️ **Storage Layout**: Upgrade'lerde storage compatibility
⚠️ **Delegate Call**: Self-delegation pattern'ının doğru kullanımı

---

## Sonuç

Kütüphane katmanı, BliContract sisteminin temel altyapısını oluşturur:

### Güçlü Yönler
- **Gas Efficiency**: Assembly optimizasyonları
- **Security**: Battle-tested implementasyonlar
- **Modularity**: İyi ayrılmış sorumluluklar
- **Standards Compliance**: ERC20, EIP-2612, Superfluid uyumlu

### Kullanım Alanları
- **On-chain Metadata**: Base64 encoding
- **Safe Payments**: Token transfer güvenliği
- **Stream Integration**: Superfluid ecosystem
- **Upgrade Safety**: Proxy patterns

### Best Practices
1. **SafeTransferLib**: Her zaman ERC20 işlemleri için kullan
2. **Base64**: Büyük data'lar için gas cost'unu göz önünde bulundur
3. **SuperApp**: Callback fonksiyonlarında revert etme
4. **Assembly**: Doğru memory management kritik

Bu kütüphaneler, BliContract sisteminin güvenilir ve efficient çalışması için kritik öneme sahiptir.
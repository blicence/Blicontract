# 🔗 API Reference - Contract Functions

## 🏭 Factory Contract

### Marketplace Functions (NEW)

#### `getAllProducers()`
```solidity
function getAllProducers() external view returns (DataTypes.Producer[] memory)
```
**Açıklama**: Sistemdeki tüm producer'ları getirir  
**Gas**: ~50K-200K (producer sayısına göre)  
**Return**: Producer array

**Frontend Kullanımı:**
```typescript
const factory = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
const allProducers = await factory.getAllProducers();
```

#### `getActiveProducers()`
```solidity
function getActiveProducers() external view returns (DataTypes.Producer[] memory)
```
**Açıklama**: Sadece aktif producer'ları getirir  
**Gas**: ~30K-150K (active producer sayısına göre)  
**Return**: Active producer array

**Frontend Kullanımı:**
```typescript
const activeProducers = await factory.getActiveProducers();
```

#### `getProducerById(uint256 producerId)`
```solidity
function getProducerById(uint256 producerId) external view returns (DataTypes.Producer memory)
```
**Açıklama**: ID'ye göre specific producer getirir  
**Gas**: ~25K  
**Parameters**: 
- `producerId`: Producer unique ID
**Return**: Producer struct

**Frontend Kullanımı:**
```typescript
const producer = await factory.getProducerById(1);
```

### Core Functions

#### `newBcontract(DataTypes.Producer calldata _producer)`
```solidity
function newBcontract(DataTypes.Producer calldata _producer) external returns (uint256, address)
```
**Açıklama**: Yeni producer oluşturur  
**Gas**: ~2M  
**Parameters**: Producer data struct  
**Return**: (producerId, cloneAddress)

## 🧠 ProducerApi Contract (NEW)

### Plan Management

#### `addPlanInfoApi(DataTypes.PlanInfoApi memory _planInfoApi)`
```solidity
function addPlanInfoApi(DataTypes.PlanInfoApi memory _planInfoApi) external onlyProducer(msg.sender)
```
**Açıklama**: API plan bilgilerini ekler  
**Gas**: ~80K  
**Access**: Sadece producer contract  
**Parameters**: API plan data

**Frontend Kullanımı:**
```typescript
const producerContract = new ethers.Contract(producerAddress, producerABI, signer);
await producerContract.addPlan(basePlanData); // First create base plan
await producerApiContract.addPlanInfoApi({
    planId: planId,
    flowRate: ethers.parseEther("0.1"), // 0.1 token/second
    perMonthLimit: 10000, // 10K API calls/month
    perCallCost: ethers.parseEther("0.001") // 0.001 token/call
});
```

### Usage Validation

#### `validateApiUsage(uint256 _customerPlanId, uint256 _usageAmount)`
```solidity
function validateApiUsage(uint256 _customerPlanId, uint256 _usageAmount) public view returns (bool)
```
**Açıklama**: API kullanımını validate eder  
**Gas**: View function (free)  
**Parameters**: 
- `_customerPlanId`: Customer plan ID
- `_usageAmount`: Requested usage amount
**Return**: Validation result

#### `processApiUsage(uint256 _customerPlanId, uint256 _usageAmount)`
```solidity
function processApiUsage(uint256 _customerPlanId, uint256 _usageAmount) external onlyProducer(msg.sender)
```
**Açıklama**: API kullanımını process eder ve quota'yı günceller  
**Gas**: ~50K  
**Access**: Sadece producer contract

### Cost Calculation

#### `calculateApiCost(uint256 _planId, uint256 _duration)`
```solidity
function calculateApiCost(uint256 _planId, uint256 _duration) external view returns (uint256)
```
**Açıklama**: Stream duration'a göre toplam cost hesaplar  
**Gas**: View function (free)  
**Parameters**:
- `_planId`: Plan ID
- `_duration`: Duration in seconds
**Return**: Total cost in wei

## 🕰️ ProducerVestingApi Contract (NEW)

### Vesting Management

#### `addPlanInfoVesting(DataTypes.PlanInfoVesting memory _planInfoVesting)`
```solidity
function addPlanInfoVesting(DataTypes.PlanInfoVesting memory _planInfoVesting) external onlyProducer(msg.sender)
```
**Açıklama**: Vesting plan bilgilerini ekler  
**Gas**: ~85K  
**Access**: Sadece producer contract

**Frontend Kullanımı:**
```typescript
await producerVestingApiContract.addPlanInfoVesting({
    planId: planId,
    totalAmount: ethers.parseEther("1000"), // 1000 tokens total
    cliffDuration: 30 * 24 * 3600, // 30 days cliff
    vestingDuration: 365 * 24 * 3600, // 1 year total
    startTime: Math.floor(Date.now() / 1000) // Now
});
```

### Vesting Calculations

#### `calculateVestedAmount(uint256 _customerPlanId)`
```solidity
function calculateVestedAmount(uint256 _customerPlanId) external view returns (uint256)
```
**Açıklama**: Şu anki vested amount'ı hesaplar  
**Gas**: View function (free)  
**Return**: Currently vested amount

#### `isCliffEnded(uint256 _customerPlanId)`
```solidity
function isCliffEnded(uint256 _customerPlanId) external view returns (bool)
```
**Açıklama**: Cliff period'un bitip bitmediğini kontrol eder  
**Gas**: View function (free)  
**Return**: Cliff status

### Token Claims

#### `claimVestedTokens(uint256 _customerPlanId, uint256 _amount)`
```solidity
function claimVestedTokens(uint256 _customerPlanId, uint256 _amount) external
```
**Açıklama**: Vested token'ları claim eder  
**Gas**: ~150K  
**Access**: Customer veya authorized address

## 🌊 StreamLockManager Contract

### Stream Creation

#### `createStreamLock(address _producer, uint256 _amount, uint256 _duration)`
```solidity
function createStreamLock(address _producer, uint256 _amount, uint256 _duration) external returns (bytes32)
```
**Açıklama**: Yeni stream lock oluşturur  
**Gas**: ~200K  
**Return**: Stream ID

**Frontend Kullanımı:**
```typescript
// First approve tokens
await token.approve(streamLockManagerAddress, amount);

// Create stream
const tx = await streamLockManager.createStreamLock(
    producerAddress,
    ethers.parseEther("100"), // 100 tokens
    30 * 24 * 3600 // 30 days
);
const receipt = await tx.wait();
const streamId = receipt.logs[0].args.streamId;
```

### Stream Queries

#### `getAccruedAmount(bytes32 _streamId)`
```solidity
function getAccruedAmount(bytes32 _streamId) external view returns (uint256)
```
**Açıklama**: Stream'den şu ana kadar akan miktarı getirir  
**Gas**: View function (free)  
**Return**: Accrued amount

#### `validateStreamAccess(address _user, bytes32 _streamId)`
```solidity
function validateStreamAccess(address _user, bytes32 _streamId) external view returns (bool)
```
**Açıklama**: User'ın stream'e erişim hakkını kontrol eder  
**Gas**: View function (free)  
**Return**: Access validation

## 📊 ProducerStorage Contract

### Enhanced Functions (NEW)

#### `setPlanInfoApi(uint256 _planId, DataTypes.PlanInfoApi calldata vars)`
```solidity
function setPlanInfoApi(uint256 _planId, DataTypes.PlanInfoApi calldata vars) external
```
**Access**: ProducerApi contract veya Owner  
**Açıklama**: API plan bilgilerini set eder

#### `setPlanInfoVesting(uint256 _planId, DataTypes.PlanInfoVesting calldata vars)`
```solidity
function setPlanInfoVesting(uint256 _planId, DataTypes.PlanInfoVesting calldata vars) external
```
**Access**: ProducerVestingApi contract veya Owner  
**Açıklama**: Vesting plan bilgilerini set eder

#### `setCustomerPlan(uint256 _customerPlanId, DataTypes.CustomerPlan calldata vars)`
```solidity
function setCustomerPlan(uint256 _customerPlanId, DataTypes.CustomerPlan calldata vars) external
```
**Access**: Logic contracts veya Owner  
**Açıklama**: Customer plan bilgilerini günceller

## 🔧 Integration Patterns

### React Hook Patterns

#### useProducers Hook
```typescript
export function useProducers() {
    const { data: producersData, isLoading, error } = useReadContract({
        address: FACTORY_ADDRESS,
        abi: factoryABI,
        functionName: 'getActiveProducers',
    });

    const producers = useMemo(() => {
        if (!producersData) return [];
        return producersData.map((producer: any) => ({
            id: Number(producer.id),
            name: producer.name,
            description: producer.description,
            cloneAddress: producer.cloneAddress,
            status: producer.status,
            createdAt: Number(producer.createdAt)
        }));
    }, [producersData]);

    return { producers, isLoading, error };
}
```

#### useApiPlan Hook
```typescript
export function useApiPlan(planId: number) {
    const { data, isLoading, error } = useReadContract({
        address: PRODUCER_API_ADDRESS,
        abi: producerApiABI,
        functionName: 'getPlanInfoApi',
        args: [planId],
    });

    return { apiPlan: data, isLoading, error };
}
```

### Contract Interaction Patterns

#### Plan Creation Flow
```typescript
// 1. Create base plan
const planTx = await producerContract.addPlan({
    name: "Premium API",
    description: "High-volume API access",
    planType: 0, // API type
    price: ethers.parseEther("10")
});
const planReceipt = await planTx.wait();
const planId = planReceipt.logs[0].args.planId;

// 2. Add API-specific data
await producerApiContract.addPlanInfoApi({
    planId,
    flowRate: ethers.parseEther("0.1"),
    perMonthLimit: 100000,
    perCallCost: ethers.parseEther("0.0001")
});
```

#### Subscription Flow
```typescript
// 1. Approve tokens
await token.approve(streamLockManagerAddress, totalAmount);

// 2. Create customer plan with stream
const customerPlanTx = await producerContract.addCustomerPlan({
    planId,
    customerAddress: await signer.getAddress(),
    duration: 30 * 24 * 3600 // 30 days
});
```

### Error Handling

#### Common Errors
```typescript
try {
    await contract.someFunction();
} catch (error) {
    if (error.message.includes("Only producer contract can call")) {
        // Handle access control error
    } else if (error.message.includes("Insufficient quota")) {
        // Handle quota exceeded error
    } else if (error.message.includes("Invalid usage")) {
        // Handle validation error
    }
}
```

---

**API Documentation**: ✅ Complete  
**Last Updated**: 12 Eylül 2025  
**Version**: v1.0 Production Ready

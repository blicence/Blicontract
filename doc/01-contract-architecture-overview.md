# 🏗️ BliContract Architecture Overview

## 📋 Contract System Architecture

BliContract, decentralized subscription services için comprehensive bir smart contract ecosystem'idir.

### 🔧 Core Contracts

#### 1. **Factory.sol** - Main Entry Point
```solidity
contract Factory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // Producer Creation & Management
    function newBcontract(DataTypes.Producer calldata _producer) external;
    
    // NEW: Marketplace Discovery Functions
    function getAllProducers() external view returns (DataTypes.Producer[] memory);
    function getActiveProducers() external view returns (DataTypes.Producer[] memory);
    function getProducerById(uint256 producerId) external view returns (DataTypes.Producer memory);
}
```

**Yeni Özellikler:**
- ✅ Marketplace discovery functions
- ✅ Producer filtering ve search
- ✅ Gas-optimized producer listing

#### 2. **Producer.sol** - Producer Proxy Contract
```solidity
contract Producer is Initializable, OwnableUpgradeable, UUPSUpgradeable, ERC1155HolderUpgradeable {
    // Plan Management
    function addPlan(DataTypes.Plan calldata _plan) external onlyOwner;
    
    // Customer Plan Creation
    function addCustomerPlan(DataTypes.CustomerPlan calldata _customerPlan) external;
}
```

#### 3. **ProducerStorage.sol** - Centralized Storage
```solidity
contract ProducerStorage is IProducerStorage, Ownable {
    // Producer Data
    mapping(address => DataTypes.Producer) internal producers;
    mapping(uint256 => DataTypes.Plan) internal plans;
    
    // NEW: Logic Contract Support
    function setPlanInfoApi(uint256 _planId, DataTypes.PlanInfoApi calldata vars) external;
    function setPlanInfoVesting(uint256 _planId, DataTypes.PlanInfoVesting calldata vars) external;
    function setCustomerPlan(uint256 _customerPlanId, DataTypes.CustomerPlan calldata vars) external;
}
```

### 🧠 Logic Layer (NEW)

#### 4. **ProducerApi.sol** - API Plan Logic
```solidity
contract ProducerApi is Initializable, OwnableUpgradeable, UUPSUpgradeable, DelegateCall {
    // API Plan Management
    function addPlanInfoApi(DataTypes.PlanInfoApi memory _planInfoApi) external onlyProducer;
    
    // Usage Validation & Processing
    function validateApiUsage(uint256 _customerPlanId, uint256 _usageAmount) public view returns (bool);
    function processApiUsage(uint256 _customerPlanId, uint256 _usageAmount) external onlyProducer;
    
    // Cost Calculation
    function calculateApiCost(uint256 _planId, uint256 _duration) external view returns (uint256);
}
```

**Özellikler:**
- Stream-based subscription logic
- API quota management
- Real-time usage validation
- Cost calculation algorithms

#### 5. **ProducerVestingApi.sol** - Vesting Plan Logic
```solidity
contract ProducerVestingApi is Initializable, OwnableUpgradeable, UUPSUpgradeable, DelegateCall {
    // Vesting Plan Management
    function addPlanInfoVesting(DataTypes.PlanInfoVesting memory _planInfoVesting) external onlyProducer;
    
    // Vesting Calculations
    function calculateVestedAmount(uint256 _customerPlanId) external view returns (uint256);
    function isCliffEnded(uint256 _customerPlanId) external view returns (bool);
    
    // Token Claims
    function claimVestedTokens(uint256 _customerPlanId, uint256 _amount) external;
}
```

**Özellikler:**
- Cliff period management
- Linear vesting calculations
- Gradual token release
- Claim functionality

#### 6. **StreamLockManager.sol** - Stream Management
```solidity
contract StreamLockManager is Initializable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    // Stream Creation
    function createStreamLock(address _producer, uint256 _amount, uint256 _duration) external returns (bytes32);
    
    // Stream Management
    function settleStream(bytes32 _streamId) external;
    function cancelStream(bytes32 _streamId) external;
    
    // Balance Queries
    function getAccruedAmount(bytes32 _streamId) external view returns (uint256);
    function validateStreamAccess(address _user, bytes32 _streamId) external view returns (bool);
}
```

### 📊 Data Structures

#### Core Data Types
```solidity
library DataTypes {
    enum PlanTypes { api, vesting, nUsage }
    enum Status { active, inactive, paused, expired }
    
    struct Producer {
        uint256 id;
        address producerAddress;
        address cloneAddress;
        string name;
        string description;
        Status status;
        uint256 createdAt;
    }
    
    struct Plan {
        uint256 id;
        uint256 producerId;
        string name;
        string description;
        PlanTypes planType;
        uint256 price;
        Status status;
        uint256 createdAt;
    }
    
    // NEW: API Plan Specific Data
    struct PlanInfoApi {
        uint256 planId;
        uint256 flowRate;        // Stream flow rate per second
        uint256 perMonthLimit;   // Monthly API call limit
        uint256 perCallCost;     // Cost per API call
    }
    
    // NEW: Vesting Plan Specific Data
    struct PlanInfoVesting {
        uint256 planId;
        uint256 totalAmount;     // Total tokens to vest
        uint256 cliffDuration;   // Cliff period in seconds
        uint256 vestingDuration; // Total vesting period
        uint256 startTime;       // Vesting start timestamp
    }
    
    struct CustomerPlan {
        uint256 id;
        uint256 planId;
        address customerAdress;
        address producerAddress;
        uint256 startDate;
        uint256 endDate;
        Status status;
        uint256 remainingQuota;  // For API/usage plans
        bytes32 streamId;        // Associated stream
    }
}
```

### 🔄 Contract Interactions

#### 1. Producer Registration Flow
```
Frontend → Factory.newBcontract() → Producer Clone Creation → ProducerStorage Update
```

#### 2. Plan Creation Flow
```
Producer → Producer.addPlan() → Logic Contract (ProducerApi/ProducerVestingApi) → ProducerStorage
```

#### 3. Customer Subscription Flow
```
Customer → Producer.addCustomerPlan() → StreamLockManager.createStreamLock() → ProducerStorage
```

#### 4. Service Usage Flow
```
Producer → ProducerApi.validateApiUsage() → ProducerApi.processApiUsage() → ProducerStorage Update
```

### 🛡️ Security Features

#### Access Control
- **onlyOwner**: Critical functions protected
- **onlyProducer**: Logic functions restricted to producer contracts
- **onlyFactory**: Storage updates restricted to authorized contracts

#### Upgrade Safety
- **UUPS Pattern**: Secure upgradeability
- **Initialization**: Proper proxy initialization
- **Authorization**: Upgrade authorization controls

#### Stream Security
- **Reentrancy Protection**: ReentrancyGuard implementation
- **Pause Mechanism**: Emergency pause functionality
- **Access Validation**: Stream access controls

### 📈 Gas Optimization

#### Efficient Data Access
- **Memory vs Storage**: Optimized data retrieval
- **Batch Operations**: Multiple operations in single transaction
- **View Functions**: Gas-free data queries

#### Smart Iteration
- **Two-Pass Filtering**: Efficient active producer filtering
- **Pagination Support**: Large dataset handling
- **Minimal Storage**: Optimized storage layouts

### 🚀 Integration Points

#### Frontend Integration
```typescript
// Factory interactions
const { producers } = useProducers();
const { plans } = usePlans(producerAddress);

// Plan creation
await producerApi.addPlanInfoApi(apiPlanData);
await producerVestingApi.addPlanInfoVesting(vestingPlanData);

// Stream management
await streamLockManager.createStreamLock(producer, amount, duration);
```

#### Contract Integration
```solidity
// Producer to Logic Contract
IProducerApi(producerApiAddress).addPlanInfoApi(_planInfoApi);
IProducerVestingApi(vestingApiAddress).addPlanInfoVesting(_planInfoVesting);

// Stream Integration
IStreamLockManager(streamManagerAddress).createStreamLock(_producer, _amount, _duration);
```

### 📋 Deployment Architecture

#### Proxy Deployment Order
1. **ProducerStorage** (Non-upgradeable)
2. **StreamLockManager** (UUPS Proxy)
3. **ProducerApi** (UUPS Proxy)
4. **ProducerVestingApi** (UUPS Proxy)
5. **ProducerNUsage** (UUPS Proxy)
6. **Factory** (UUPS Proxy)
7. **Producer Implementation** (Template)

#### Configuration
```solidity
// Factory initialization
factory.initialize(
    uriGenerator,
    producerStorage,
    producerApi,
    producerNUsage,
    producerVestingApi,
    streamLockManager,
    producerImplementation
);

// ProducerStorage setup
producerStorage.setFactory(factory, producerApi, producerNUsage, producerVestingApi);
```

---

**Architecture Status**: ✅ Complete  
**Last Updated**: 12 Eylül 2025  
**Version**: v1.0 Production Ready

# Production Deployment Guide 🚀

## Overview
This guide covers the complete production deployment process for the Blicontract streaming platform.

## Quick Start
```bash
# Complete production deployment (recommended)
npx hardhat run scripts/deploy-complete.ts --network mainnet

# Or step by step deployment
npx hardhat run scripts/deploy-production.ts --network mainnet
```

## Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### 2. Environment Variables
Create `.env` file with:
```bash
PRIVATE_KEY=your_deployer_private_key
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. Network Configuration
Ensure `hardhat.config.ts` has mainnet configuration:
```typescript
networks: {
  mainnet: {
    url: process.env.MAINNET_RPC_URL,
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

## Deployment Scripts

### 🎯 deploy-complete.ts (Recommended)
Complete deployment pipeline with all steps automated:
- Contract deployment with proxy patterns
- Authorization setup
- Test token deployment (optional)
- Contract verification
- Deployment artifact saving

### 🔧 deploy-production.ts
Core deployment script with detailed configuration:
- StreamLockManager (UUPS Proxy)
- ProducerStorage (UUPS Proxy) 
- URIGenerator (UUPS Proxy)
- Factory (UUPS Proxy)
- Producer implementation
- **ProducerApi (UUPS Proxy)** - API subscription logic
- **ProducerNUsage (UUPS Proxy)** - Usage tracking logic  
- **ProducerVestingApi (UUPS Proxy)** - Vesting API logic

## Step-by-Step Deployment

### Step 1: Pre-deployment Checks
```bash
# Verify account balance
npx hardhat balance --network mainnet

# Test deployment on testnet first
npx hardhat run scripts/deploy-complete.ts --network sepolia
```

### Step 2: Contract Deployment
```bash
# Deploy to mainnet
npx hardhat run scripts/deploy-complete.ts --network mainnet
```

### Step 3: Post-deployment Verification
```bash
# Verify deployed contracts
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>

# Run integration tests
npm test
```

## Contract Addresses Structure

After deployment, contracts are saved to:
```
deployments/
├── deployment-{network}-{timestamp}.json
└── latest-{network}.json
```

Example structure:
```json
{
  "deployer": "0x...",
  "network": { "name": "mainnet", "chainId": "1" },
  "deploymentTime": "2024-...",
  "factory": "0x...",
  "streamLockManager": "0x...",
  "producerStorage": "0x...",
  "uriGenerator": "0x...",
  "producerApi": "0x...",
  "producerNUsage": "0x...",
  "producerVestingApi": "0x...",
  "testTokens": {
    "usdc": "0x...",
    "dai": "0x..."
  }
}
```

## Security Considerations

### 1. Deployer Account
- Use hardware wallet for mainnet deployment
- Ensure sufficient ETH for gas fees (recommended: 0.5+ ETH)
- Verify account has no prior smart contract deployments if using CREATE2

### 2. Contract Security
- All contracts use UUPS proxy pattern for upgradeability
- Initial ownership transferred to deployer
- StreamLockManager authorization restricted to Factory

### 3. Verification
- Always verify contracts on Etherscan post-deployment
- Ensure proxy implementation matches deployment
- Validate authorization and access controls

## Gas Optimization

### Estimated Gas Costs (at 20 gwei):
- StreamLockManager: ~2.5M gas (~0.05 ETH)
- ProducerStorage: ~3.2M gas (~0.064 ETH)  
- URIGenerator: ~3.0M gas (~0.06 ETH)
- Factory: ~2.8M gas (~0.056 ETH)
- ProducerApi: ~2.2M gas (~0.044 ETH)
- ProducerNUsage: ~1.8M gas (~0.036 ETH)
- ProducerVestingApi: ~2.5M gas (~0.05 ETH)
- **Total: ~18M gas (~0.36 ETH)**

### Gas Optimization Tips:
```bash
# Set gas price explicitly
--gas-price 15000000000  # 15 gwei

# Monitor gas tracker before deployment
# Use scripts during low network congestion
```

## Network-Specific Instructions

### Mainnet Deployment
```bash
npx hardhat run scripts/deploy-complete.ts --network mainnet
```

### Polygon Deployment  
```bash
npx hardhat run scripts/deploy-complete.ts --network polygon
```

### Arbitrum Deployment
```bash
npx hardhat run scripts/deploy-complete.ts --network arbitrum
```

## Troubleshooting

### Common Issues

#### 1. Out of Gas
```bash
# Increase gas limit in hardhat.config.ts
gas: 8000000
```

#### 2. Nonce Too Low
```bash
# Reset account nonce
npx hardhat reset-nonce --network mainnet
```

#### 3. Verification Failed
```bash
# Manual verification
npx hardhat verify --network mainnet CONTRACT_ADDRESS "constructor" "args"
```

### Error Recovery

#### Partial Deployment Failure
1. Check deployment logs for successful contracts
2. Update deployment script to skip completed steps
3. Resume from failed step

#### Contract Upgrade Required
```bash
# Upgrade contracts using proxy admin
npx hardhat run scripts/upgrade-contracts.ts --network mainnet
```

## Monitoring & Maintenance

### Post-deployment Checklist
- [ ] All contracts verified on block explorer
- [ ] Factory authorized in StreamLockManager
- [ ] Producer implementation deployed correctly
- [ ] Test transactions successful
- [ ] Frontend updated with new addresses
- [ ] Monitoring tools configured

### Ongoing Monitoring
- Set up alerts for contract events
- Monitor proxy admin ownership
- Track gas usage and optimization opportunities
- Regular security audits

## Integration with Frontend

### Contract Addresses
Update frontend configuration with deployed addresses:
```typescript
const contracts = {
  factory: "0x...",
  streamLockManager: "0x...",
  producerStorage: "0x...",
  uriGenerator: "0x...",
  producerApi: "0x...",
  producerNUsage: "0x...",
  producerVestingApi: "0x..."
};
```

### ABI Updates
Ensure frontend has latest contract ABIs:
```bash
cp artifacts/contracts/*.sol/*.json frontend/src/contracts/
```

## New Logic Contracts Features 🆕

### 📊 ProducerApi
- **Purpose**: Handles API subscription plans with streaming payments
- **Features**: 
  - API plan creation with flow rates and monthly limits
  - Real-time usage validation and quota management
  - Stream-based billing for API consumption
- **Key Functions**: `addPlanInfoApi()`, `validateApiUsage()`

### 📈 ProducerNUsage  
- **Purpose**: Advanced usage tracking and analytics
- **Features**:
  - Detailed usage metrics collection
  - Customer usage history and patterns
  - Resource consumption monitoring
- **Key Functions**: Usage tracking, analytics, and reporting

### 🔄 ProducerVestingApi
- **Purpose**: Vesting API plans with cliff periods and gradual token release
- **Features**:
  - Cliff-based vesting schedules
  - Stream-based token vesting
  - Progressive API access unlocking
- **Key Functions**: `addPlanInfoVesting()`, `startVesting()`, `claimTokens()`

### 🔗 Integration Benefits
- **Modular Architecture**: Each logic contract handles specific functionality
- **Upgradeable**: UUPS proxy pattern for future improvements  
- **Gas Optimized**: Separate contracts reduce main contract size
- **Specialized Logic**: Focused contracts for better code organization


For deployment issues:
1. Check deployment logs in `deployments/` directory
2. Verify network configuration in `hardhat.config.ts`
3. Ensure sufficient balance and proper gas settings
4. Test on testnet before mainnet deployment

## Production Checklist

### Pre-deployment
- [ ] Code audited and tested (154+ tests passing)
- [ ] Environment variables configured
- [ ] Network settings verified
- [ ] Deployer account funded
- [ ] Gas prices acceptable

### During Deployment
- [ ] Monitor transaction confirmations
- [ ] Verify each contract deployment
- [ ] Check authorization setup
- [ ] Validate proxy deployments

### Post-deployment
- [ ] Contract verification complete
- [ ] Deployment artifacts saved
- [ ] Frontend integration tested
- [ ] Security monitoring active
- [ ] Documentation updated

---

🎉 **Ready for Production!** Your Blicontract platform is now deployed and ready for streaming subscriptions.

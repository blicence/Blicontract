# Blicontract - Decentralized Subscription Platform

Blicontract enables small and medium-sized service providers to offer their services to end users using blockchain technology, with specific quantities or time periods.

## 🎯 Overview

Our platform allows producers to create subscription plans and manage customers through a decentralized smart contract system with streaming payments.

## 📋 Features

- **Three Plan Types**: 
  - **NUsage**: Pay-per-use service with no time limit
  - **VestingApi**: Scheduled services with future start times
  - **ApiUsage**: Regular interval payments (hourly, daily, monthly)

- **NFT Subscriptions**: ERC1155 tokens represent customer subscriptions
- **Streaming Payments**: Custom token locking and streaming system
- **Offline Support**: QR codes for offline service verification

## 🏗️ Architecture

```
Factory → Producer Clones → StreamLockManager → Customer Plans → NFT Subscriptions
```

## 📖 Documentation

### Technical Documentation
- [Turkish Workflow](doc/akis.md)
- [English Workflow](doc/workflow.md)
- [Contract Documentation](doc/contract/)
- [Stream Implementation](STREAM_IMPLEMENTATION.md)

### End-User Scenarios & Use Cases
- **[End-User Scenarios](end-user-scenarios/)** - Comprehensive real-world scenarios
  - [Platform Overview](end-user-scenarios/00-GENEL-BAKIS.md) - Basic concepts and terminology
  - [Education Platform](end-user-scenarios/01-EGITIM-PLATFORMU-SENARYOSU.md) - Online education subscription model
  - [Fitness Gym](end-user-scenarios/02-SPOR-SALONU-SENARYOSU.md) - Pay-per-visit gym membership
  - [SaaS Platform](end-user-scenarios/03-SAAS-PLATFORMU-SENARYOSU.md) - Enterprise API access model
  - [Comparison Analysis](end-user-scenarios/04-KARSILASTIRMA-VE-AVANTAJLAR.md) - Traditional vs Blicence systems

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test:hh

# Deploy locally
npm run deploy:localhost
```

## 🌟 Production Deployment

### Quick Production Deploy (Recommended)
```bash
# Complete automated deployment pipeline
npm run production:deploy:mainnet

# Test on Fuji testnet first (recommended)
npm run production:deploy:fuji
```

**✨ New Features:**
- **Smart Deployment**: Automatically detects existing deployments and skips redeployment
- **State Persistence**: Saves deployment addresses to JSON for reuse
- **Full Automation**: Deployment + configuration in one command
- **Network Aware**: Optimized for mainnet, testnets, and localhost

### Manual Production Deploy
```bash
# Core deployment only
npm run production:core --network mainnet

# Configure existing contracts
npm run production:configure --network mainnet
```

### Supported Networks
- **Mainnet**: `npm run production:deploy:mainnet`
- **Fuji** (Avalanche testnet): `npm run production:deploy:fuji` ⭐ **Recommended for testing**
- **Sepolia** (Ethereum testnet): `npm run production:deploy:sepolia`
- **Polygon**: `npm run production:deploy:polygon`
- **Arbitrum**: `npm run production:deploy:arbitrum`

📖 **[Complete Production Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)**

## 📊 Current Status

✅ **Phase 1**: Core streaming infrastructure  
✅ **Phase 2**: Integration framework  
✅ **Phase 3**: Production deployment ready

## 📄 License

MIT


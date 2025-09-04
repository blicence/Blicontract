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

- [Turkish Workflow](doc/akis.md)
- [English Workflow](doc/workflow.md)
- [Contract Documentation](doc/contract/)
- [Stream Implementation](STREAM_IMPLEMENTATION.md)

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

## 📊 Current Status

✅ **Phase 1**: Core streaming infrastructure  
✅ **Phase 2**: Integration framework  
✅ **Phase 3**: Production deployment ready

## 📄 License

MIT


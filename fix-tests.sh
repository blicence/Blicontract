#!/bin/bash

# Test dosyalarındaki yaygın hataları düzelt
find test -name "*.ts" -type f -exec sed -i 's/import { ethers, upgrades } from "hardhat";/import { ethers } from "hardhat";\nimport hre from "hardhat";/g' {} \;

# const { upgrades } = require -> hre.upgrades kullan
find test -name "*.ts" -type f -exec sed -i 's/const { upgrades } = require("@openzeppelin\/hardhat-upgrades");//g' {} \;

# upgrades.deployProxy -> hre.upgrades.deployProxy
find test -name "*.ts" -type f -exec sed -i 's/upgrades\.deployProxy(/\/\/ @ts-ignore\n        hre.upgrades.deployProxy(/g' {} \;

# ethers.constants.AddressZero → ethers.ZeroAddress
find test -name "*.ts" -type f -exec sed -i 's/ethers\.ZeroAddress/ethers.ZeroAddress/g' {} \;

echo "Test dosyaları düzeltildi!"

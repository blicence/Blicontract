/* 
import { ContractFactory, Wallet } from "ethers";
import { upgrades, ethers, waffle } from "hardhat";
import { CustomerNftUpgradeable, ProducerLogicUpgradeable, BcontractFactory } from "../../typechain-types";
import * as fs from "fs";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "../../scripts/ProxiesAddresses";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


export async function CustomerNftUpgradeableFixture() {
  async (signers: Wallet[]) => {
    const customerNftUpgradeable: ContractFactory = await ethers.getContractFactory(
      `CustomerNftUpgradeable`
    );
    const customerNft = (await upgrades.deployProxy(customerNftUpgradeable, {
      kind: "uups",
    })) as CustomerNftUpgradeable;
    await customerNft.deployed();

    return { customerNft: customerNft };
  };
}


export async function ProducerLogicUpgradeableFixture() {
  async (signers: Wallet[]) => {
    const producerLogicUpgradeable: ContractFactory = await ethers.getContractFactory(
      `ProducerLogicUpgradeable`
    );
    const producerLogic = (await upgrades.deployProxy(producerLogicUpgradeable, {
      kind: "uups",
    })) as ProducerLogicUpgradeable;
    await producerLogic.deployed();

    return { producerLogic: producerLogic };
  };
}
export async function BcontractFactoryFixture() {
  async (signers: Wallet[]) => {
    const bcontractFactory: ContractFactory = await ethers.getContractFactory(
      `BcontractFactory`
    );
    const bcontractv2Factory = (await upgrades.deployProxy(bcontractFactory, {
      kind: "uups",
    })) as BcontractFactory;
    await bcontractv2Factory.deployed();

    return { bcontractv2Factory: bcontractv2Factory };
  };
}


export async function deployProxysFixture() {
  const [deployer, addr1, addr2] = await ethers.getSigners();
  const proxyAddresses: ProxiesAddresses = {
    PRODUCER_LOGIC_PROXY_ADDRESS: "",
    CUSTOMER_NFT_PROXY_ADDRESS: "",
    BCONTRACT_FACTORY_PROXY_ADDRESS: ""
  };
  console.log("Deploying contracts with the account:", deployer.address);



  const ProducerLogic = await ethers.getContractFactory("ProducerLogicUpgradeable");
  const producerLogic = await upgrades.deployProxy(ProducerLogic, [], {
    kind: "uups",
  });
  await producerLogic.deployed();
  console.log("producerLogic deployed to:", producerLogic.address);
  proxyAddresses.PRODUCER_LOGIC_PROXY_ADDRESS = producerLogic.address;
  
  const CustomerNftUpgradeable = await ethers.getContractFactory("CustomerNftUpgradeable");
  const customerNft = await upgrades.deployProxy(CustomerNftUpgradeable, [], {
    kind: "uups",
  });
  await customerNft.deployed();
  console.log("CustomerNftUpgradeable deployed to:", customerNft.address);
  proxyAddresses.CUSTOMER_NFT_PROXY_ADDRESS = customerNft.address;



  const BcontractFactory = await ethers.getContractFactory("BcontractFactory");
 

  const bcontractFactory = await upgrades.deployProxy(
    BcontractFactory,
    [customerNft.address, producerLogic.address],
    {
      initializer: "initialize",
      unsafeAllow: ["delegatecall"],
    },
  );
  await bcontractFactory.deployed();

  proxyAddresses.BCONTRACT_FACTORY_PROXY_ADDRESS = bcontractFactory.address;
  fs.writeFileSync(
    `./${PROXIES_ADDRESSES_FILENAME}`,
    JSON.stringify(proxyAddresses)
  );


  return { producerLogic: producerLogic, customerNft: customerNft, bcontractFactory: bcontractFactory }
}

export async function userList() {

  const [
    owner,
    userA,
    userB,
    ProducerA,
    ProducerB,
    ProducerC]: SignerWithAddress[] = await ethers.getSigners();
  return { owner,userA, userB, ProducerA, ProducerB, ProducerC };

}
 */
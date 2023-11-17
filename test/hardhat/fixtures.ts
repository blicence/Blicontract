
import { ContractFactory, Wallet } from "ethers";
import { upgrades, ethers, waffle } from "hardhat";
 
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
 
import * as fs from 'fs';
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "../../scripts/test/ProxiesAddresses";
import { URIGenerator } from "../../typechain-types";
import { Factory } from "../../typechain-types/contracts/v3/Factory";
import { ProducerLogic } from "../../typechain-types/contracts/v3/ProducerLogic";

export async function SadeTokenFixture(){
   
    const mockerc=await ethers.getContractFactory('MockERC20');
    console.log("sade token ");
    const token = await mockerc.deploy();
    await token.deployed();
    console.log("mockerc deployed to:", token.address);
    return  token  ;
  
}

export async function URIGeneratorFixture() {
  
    const urigen: ContractFactory = await ethers.getContractFactory(
      `URIGenerator`
    );
    const urg = (await upgrades.deployProxy(urigen, {
      kind: "uups",
    })) as URIGenerator;
    await urg.deployed();

    return urg;
  
}


export async function ProducerLogicFixture() {
  
    const ProducerLogic: ContractFactory = await ethers.getContractFactory(
      `ProducerLogic`
    );
    const producerLogic = (await upgrades.deployProxy(ProducerLogic, {
      kind: "uups",
    })) as ProducerLogic;
    await producerLogic.deployed();

    return  producerLogic ;
  
}
export async function BStorageFixture() {
  const Bstorage = await ethers.getContractFactory("BStorage");
  const bstorage =await Bstorage.deploy();
  await bstorage.deployed();
  console.log("Bstorage deployed to:", bstorage.address);
  return bstorage;
}
export async function ProducerStorageFixture() {
  const Pstorage = await ethers.getContractFactory("ProducerStorage");
 const pstorage =await Pstorage.deploy();
 await pstorage.deployed();
  console.log("Pstorage deployed to:", pstorage.address);
  return pstorage;
}
  

export async function FactoryFixture() {
  const urigenerator=await URIGeneratorFixture();
  const producerLogic=await ProducerLogicFixture();
  const bstorage=await BStorageFixture();
  const pstorage=await ProducerStorageFixture();

  async (signers: Wallet[]) => {
    const Factory: ContractFactory = await ethers.getContractFactory(
      `Factory`
    );
 const factory = await upgrades.deployProxy(
    Factory,
    [urigenerator.address,producerLogic.address,bstorage.address,pstorage.address],
    {
      initializer: "initialize",
      unsafeAllow: ["delegatecall"],
    },
  );
  await factory.deployed();

    return { factory: factory };
  };
}


export async function deployProxysFixture() {
  const [deployer, addr1, addr2] = await ethers.getSigners();
  const proxyAddresses: ProxiesAddresses = {
    PRODUCER_LOGIC_PROXY_ADDRESS: "",
    URI_GENERATOR_PROXY_ADDRESS: "",
    FACTORY_PROXY_ADDRESS: "", 
    PRODUCER_STORAGE_PROXY_ADDRESS: "",
  };
  console.log("Deploying contracts with the account:", deployer.address);


 

  const ProducerLogic = await ethers.getContractFactory("ProducerLogic");
  const producerLogic = await upgrades.deployProxy(ProducerLogic, [], {
    kind: "uups",
  });
  await producerLogic.deployed();
  console.log("producerLogic deployed to:", producerLogic.address);
  proxyAddresses.PRODUCER_LOGIC_PROXY_ADDRESS = producerLogic.address;
 

  //************** */
  const UriGenerator = await ethers.getContractFactory("URIGenerator");
  const uriGenerator = await upgrades.deployProxy(UriGenerator, [], {
    kind: "uups",
  });
  await uriGenerator.deployed();
  console.log("uriGenerator deployed to:", uriGenerator.address);
  proxyAddresses.URI_GENERATOR_PROXY_ADDRESS = uriGenerator.address;

  //************** */
  
 
  
 const Pstorage = await ethers.getContractFactory("ProducerStorage");
 const pstorage =await Pstorage.deploy();
 await pstorage.deployed();
 console.log("pstorage deployed to:", pstorage.address);
 proxyAddresses.PRODUCER_STORAGE_PROXY_ADDRESS = pstorage.address;


  const Factory = await ethers.getContractFactory("Factory");
  // For now, BcontractFactory is not going to use UUPS proxy. When we try to convert it to this model
  // we start to receive errors about "contract code is too large". It demands a deeper analysis

  // The @openzeppelin/utils/Address, used on setGameImplementation function, has delegateCall,
  // then we need to include the 'unsafeAllow'. However, we made a restriction to setGameImplemention
  // be called only through proxy

  const factory = await upgrades.deployProxy(
    Factory,
    [uriGenerator.address,producerLogic.address ,pstorage.address],
    {
      initializer: "initialize",
      unsafeAllow: ["delegatecall"],
    },
  );
  
  await factory.deployed(); 
 
 
  await pstorage.setFactory(factory.address);
  console.log("pstorage setFactory to:", factory.address);

 /*  proxyAddresses.FACTORY_PROXY_ADDRESS = factory.address;
  fs.writeFileSync(
    `./${PROXIES_ADDRESSES_FILENAME}`,
    JSON.stringify(proxyAddresses)
  ); */


  return { producerLogic: producerLogic, urigenarator: uriGenerator, factory: factory,   pstorage: pstorage }
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

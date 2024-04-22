import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
export async function setProxys() {
    const [deployer, addr1, addr2] = await ethers.getSigners();


    const proxyAddresses: ProxiesAddresses =   {
      FACTORY_PROXY_ADDRESS: '0x069dAa294631857aB555e6AEB02D0Ab7EafB9D22',
      URI_GENERATOR_PROXY_ADDRESS: '0x0c0CDeDF014e71456F275b38Fd00267B5eCf393a',
      PRODUCER_STORAGE_PROXY_ADDRESS: '0xD1E91b8a9FbB1a1A9c973dD83FCA88d8171497E2',
      PRODUCER_API_PROXY_ADDRESS: '0x5E95a820efe21AcD8881f87Ca3b1c240c8cD6604',
      PRODUCER_NUSAGE_PROXY_ADDRESS: '0x26ba913972B40A0a2aDC5a9D2dA712bdc9E73210',
      PRODUCER_VESTING_API_PROXY_ADDRESS: '0x32072a2dB11E06f5E35F683cE9F5B34Ff8E38fFa'
    }
 

    //************** */
    const producerApi = await ethers.getContractAt("ProducerApi", proxyAddresses.PRODUCER_API_PROXY_ADDRESS);
    const producerVestingApi = await ethers.getContractAt("ProducerVestingApi", proxyAddresses.PRODUCER_VESTING_API_PROXY_ADDRESS);
    const producerNusage = await ethers.getContractAt("ProducerNUsage", proxyAddresses.PRODUCER_NUSAGE_PROXY_ADDRESS);
    const uriGenerator = await ethers.getContractAt("URIGenerator", proxyAddresses.URI_GENERATOR_PROXY_ADDRESS);
    const pstorage = await ethers.getContractAt("ProducerStorage", proxyAddresses.PRODUCER_STORAGE_PROXY_ADDRESS);
    const factory = await ethers.getContractAt("Factory", proxyAddresses.FACTORY_PROXY_ADDRESS);


    //************** 

 
    let tx0=await pstorage.setFactory(
        factory.address,
        producerApi.address,
        producerNusage.address,
        producerVestingApi.address
      );
      tx0.wait();
      ethers.provider.waitForTransaction(tx0.hash); 
      
      console.log("pstorage setFactory to:", factory.address);    
      //**************  
      let tx1 = await producerApi.setProducerStorage(pstorage.address);
      tx1.wait();
      ethers.provider.waitForTransaction(tx1.hash);  
       console.log("producerApi setProducerStorage to:", pstorage.address);    
       //**************  
      let tx2 = await producerNusage.setProducerStorage(pstorage.address);
      tx2.wait();
      ethers.provider.waitForTransaction(tx2.hash);
      console.log("producerNusage setProducerStorage to:", pstorage.address);   
        //************** 
      let tx3 = await producerVestingApi.setProducerStorage(pstorage.address);
      tx3.wait();
      ethers.provider.waitForTransaction(tx3.hash);
      console.log("producerVestinfApi setProducerStorage to:", pstorage.address);  
        //**************  
      let tx4 = await uriGenerator.setProducerStorage(pstorage.address);
      tx4.wait();
      ethers.provider.waitForTransaction(tx4.hash);
      console.log("uriGenerator setProducerStorage to:", pstorage.address);     
      //**************  
    
    /*   let superflHostAddress = "0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9"
    
      let tx5=await producerApi.setSuperInitialize(superflHostAddress,true,true,true,);
      tx5.wait();
      ethers.provider.waitForTransaction(tx5.hash);
      console.log("producerApi SetSuperInitialize to:", superflHostAddress);   */  
/*       // **************  
       let superVestingAddres="0xf428308b426D7cD7Ad8eBE549d750f31C8E060Ca"
       let tx6=await producerVestingApi.setSuperInitialize(superVestingAddres);
        tx6.wait();
        ethers.provider.waitForTransaction(tx6.hash);
        console.log("producerVestinfApi SetSuperInitialize to:", superVestingAddres);
      // **************    
     */




 
    console.log(
        `*************** set proxy addreses:   ***********`
    );


}

setProxys().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
   
import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
export async function setProxys() {
    const [deployer, addr1, addr2] = await ethers.getSigners();
    const data = fs.readFileSync("PROXIES_ADDRESSES.io", "utf-8");

    const proxyAddresses: ProxiesAddresses =  JSON.parse(data);
    
 

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
    // sep
  
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
   
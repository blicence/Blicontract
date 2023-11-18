import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
export async function setProxys() {
    const [deployer, addr1, addr2] = await ethers.getSigners();


    const proxyAddresses: ProxiesAddresses =   {
      FACTORY_PROXY_ADDRESS: '0x157dC44dB0a71C3eb40cb68a4728711Bd969E988',
      URI_GENERATOR_PROXY_ADDRESS: '0xD8f70d9e620C98b49c7cE82f223d54E950721066',
      PRODUCER_STORAGE_PROXY_ADDRESS: '0x789bD60Db3018793c090831bEe74F19a9621cFA4',
      PRODUCER_API_PROXY_ADDRESS: '0x30c3042cF2E31ededF9d4bf441b108A38723C189',
      PRODUCER_NUSAGE_PROXY_ADDRESS: '0x7AD5C4591b9eF047069C6849fD757Afb1c4C0324',
      PRODUCER_VESTING_API_PROXY_ADDRESS: '0x4112181175cE8A83ba15c4074771B39720847132'
    }
  /* goerli  {FACTORY_PROXY_ADDRESS:"0x4B6B5AD2f2c380F101b8eA8Ff960B66136c4DB5d",
    URI_GENERATOR_PROXY_ADDRESS:"0x7A6EE0f55C95ffA28581729b285805d6Df1F2B4A",PRODUCER_STORAGE_PROXY_ADDRESS:"0x917D80eE776e2f8ea297D10a8D01Bf7468D7E706",PRODUCER_API_PROXY_ADDRESS:"0x80bBa45A344F85C29Bf830dBB1977967dc214383",PRODUCER_NUSAGE_PROXY_ADDRESS:"0xE0c9DA1e16A09026eb51E08491Ea357664d5ba40",PRODUCER_VESTING_API_PROXY_ADDRESS:"0x09DB4EC615f89d0AfC67cB9Ff11FB046A5e38C1E"} */

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
        let superflHostAddressFuji="0x85Fe79b998509B77BF10A8BD4001D58475D29386";
      let tx5=await producerApi.setSuperInitialize(superflHostAddress,true,true,true,);
      tx5.wait();
      ethers.provider.waitForTransaction(tx5.hash);
      console.log("producerApi SetSuperInitialize to:", superflHostAddress);   */  
      //**************  
       let superVestingAddres="0xf428308b426D7cD7Ad8eBE549d750f31C8E060Ca"
       let tx6=await producerVestingApi.setSuperInitialize(superVestingAddres);
        tx6.wait();
        ethers.provider.waitForTransaction(tx6.hash);
        console.log("producerVestinfApi SetSuperInitialize to:", superVestingAddres);
      //**************    
    




 
    console.log(
        `*************** set proxy addreses:   ***********`
    );


}

setProxys().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
   
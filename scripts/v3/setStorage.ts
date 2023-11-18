import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";

export async function setProxys() {


    const proxyAddresses: ProxiesAddresses = { "FACTORY_PROXY_ADDRESS": "0xc938327ee2592d21fFF586BE2B56490bC1BFD48d", "URI_GENERATOR_PROXY_ADDRESS": "0xecE1a57876E36c24aD4Ce0063C40004918e56bd8", "PRODUCER_STORAGE_PROXY_ADDRESS": "0x92fFE5c2ACdfa588234b0f73788eA0ad707C988F", "PRODUCER_API_PROXY_ADDRESS": "0x671fc63a7cFCC8e4A9fD630e37D8DA6Ee7CC02af", "PRODUCER_NUSAGE_PROXY_ADDRESS": "0x8917d2558b29ca243623Ff309a02a3d30c26661A", "PRODUCER_VESTING_API_PROXY_ADDRESS": "0x68a083E7B2F7f579988591c391AB6F33a7844896" }


    //************** */
    const producerApi = await ethers.getContractAt("ProducerApi", proxyAddresses.PRODUCER_API_PROXY_ADDRESS);
    const producerVestingApi = await ethers.getContractAt("ProducerVestingApi", proxyAddresses.PRODUCER_VESTING_API_PROXY_ADDRESS);
    const producerNusage = await ethers.getContractAt("ProducerNUsage", proxyAddresses.PRODUCER_NUSAGE_PROXY_ADDRESS);
    const uriGenerator = await ethers.getContractAt("URIGenerator", proxyAddresses.URI_GENERATOR_PROXY_ADDRESS);
    const pstorage = await ethers.getContractAt("ProducerStorage", proxyAddresses.PRODUCER_STORAGE_PROXY_ADDRESS);
    const factory = await ethers.getContractAt("Factory", proxyAddresses.FACTORY_PROXY_ADDRESS);


    //************** */



    let tx0=  await pstorage.setFactory(
        factory.address,
        producerApi.address,
        producerNusage.address,
        producerVestingApi.address
    );
    tx0.wait();
    ethers.provider.waitForTransaction(tx0.hash);
    console.log("pstorage setFactory to:", factory.address); 
    let tx1 = await producerApi.setProducerStorage(pstorage.address);
    tx1.wait();  
        ethers.provider.waitForTransaction(tx1.hash);
    console.log("producerApi setProducerStorage to:", pstorage.address);
      let tx2= await producerNusage.setProducerStorage(pstorage.address);
      tx2.wait();  
        ethers.provider.waitForTransaction(tx2.hash);
    console.log("producerNusage setProducerStorage to:", pstorage.address);
      let tx3= await producerVestingApi.setProducerStorage(pstorage.address);
      tx3.wait();
      ethers.provider.waitForTransaction(tx3.hash);
      console.log("producerVestinfApi setProducerStorage to:", pstorage.address); 
     let tx4=await uriGenerator.setProducerStorage(pstorage.address);
      tx4.wait();
      ethers.provider.waitForTransaction(tx4.hash);
      console.log("uriGenerator setProducerStorage to:", pstorage.address);   

 
      // goerli 0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9
      let superflHostAddress = "0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9"
    let tx5=await producerApi.SetSuperInitialize(superflHostAddress);

    tx5.wait();
    ethers.provider.waitForTransaction(tx5.hash);
// 0xf428308b426D7cD7Ad8eBE549d750f31C8E060Ca
    let superVestingAddres="0xf428308b426D7cD7Ad8eBE549d750f31C8E060Ca"
    let tx6=await producerVestingApi.SetSuperInitialize(superVestingAddres);
    




 
    console.log(
        `*************** set proxy addreses:   ***********`
    );


}

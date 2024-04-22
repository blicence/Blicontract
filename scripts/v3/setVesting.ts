import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
export async function setProxys() {
    const [deployer, addr1, addr2] = await ethers.getSigners();

    const data = fs.readFileSync("PROXIES_ADDRESSES.io", "utf-8");

    const proxyAddresses: ProxiesAddresses =  JSON.parse(data);

    const data2 = fs.readFileSync("vestingAddress", "utf-8");

    const superVestingAddres =   data2;
 
   let producerVestingApiadress =proxyAddresses.PRODUCER_VESTING_API_PROXY_ADDRESS;
   
    const producerVestingApi = await ethers.getContractAt("ProducerVestingApi", producerVestingApiadress);
 
 
    
 
       // **************  

       let tx6=await producerVestingApi.setSuperInitialize(superVestingAddres);
        tx6.wait();
        ethers.provider.waitForTransaction(tx6.hash);
        console.log("producerVestinfApi SetSuperInitialize to:", superVestingAddres);
      // **************    
    




 
    console.log(
        `*************** set vesting addreses:   ***********`
    );


}

setProxys().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
   
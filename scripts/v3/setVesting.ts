import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
export async function setProxys() {
    const [deployer, addr1, addr2] = await ethers.getSigners();


 
   let producerVestingApiadress ='0x32072a2dB11E06f5E35F683cE9F5B34Ff8E38fFa'
   let superVestingAddres="0xfdde4079e3b783dad6e6304B54860884Af91093c"
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
   
/* 


import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert, Console } from "console";
import { ethers, hardhatArguments, network } from "hardhat";
import { deployProxysFixture, SadeTokenFixture, testSuperfluid, userList } from "./fixtures"; import { Producer, Status, CustomerPlan, PlanInfoApi, PlanInfoNUsage, PlanInfoVesting, PlanTypes, Plan } from "./model";
import { BigNumber } from "ethers";
import { copyFileSync } from "fs";
export const toBN = (x: any) => ethers.BigNumber.from(x);
 
import {
    Framework,
    SuperToken,
    WrapperSuperToken,
} from "@superfluid-finance/sdk-core";
 
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
import { Provider } from "@ethersproject/providers";
 

describe("Producer vesting", async function () {
    const { urigenarator, factory, pstorage, producerApi, producerVestinfApi, producerNusage } = await loadFixture(deployProxysFixture);
    const {   frameworkClass,fDAIx,fDAI,chainId,sfDeployer,owner,userA, userB, ProducerA, ProducerB,ProducerC,sadeToken } = await loadFixture(testSuperfluid);
    let firstClone: any;
    let EndTime: string;
    let EVMSnapshotId: string;
    let cloneAddress: string[3]; 
    const _revertToSnapshot = async (snapshotId: string) => {
        await network.provider.send("evm_revert", [snapshotId]);
    };
   
 
  
     let data1: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p1", description: "d1", image: "i1", externalLink: "e1", cloneAddress: ProducerA.address, exists: true };
    let data2: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p2", description: "d2", image: "i2", externalLink: "e1", cloneAddress: ProducerA.address, exists: true };

    let addProdcuer1 = await factory.connect(ProducerA).newBcontract(data1);
    let addProdcuer2 = await factory.connect(ProducerB).newBcontract(data2);  
 

before(async()=>{
   
    let data1: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p1", description: "d1", image: "i1", externalLink: "e1", cloneAddress: ProducerA.address, exists: true };
    let data2: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p2", description: "d2", image: "i2", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }
    let data3: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p3", description: "d3", image: "i3", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }

    let addProdcuer1 = await factory.connect(ProducerA).newBcontract(data1);
    let addProdcuer2 = await factory.connect(ProducerB).newBcontract(data2);
    let addProdcuer3 = await factory.connect(ProducerC).newBcontract(data3);

 
});

 
describe("  Cases", async() => {
 
    
    cloneAddress = (await factory.connect(ProducerC).getClones());
    console.log("cloneAddress", cloneAddress);
    firstClone = await ethers.getContractAt("Producer", cloneAddress[1]);
    let getProducer = await firstClone.getProducer();
    let owner1 = await firstClone.owner();
    console.log("11firstClone", firstClone.address);
    console.log("11111firstClone getProducer name ?", getProducer.name);
    console.log("111Producer clone addres", getProducer.cloneAddress);
    console.log("111Producer owner addres", owner1);
 


})
}); */
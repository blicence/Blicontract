 


import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert, Console } from "console";
import { ethers, hardhatArguments } from "hardhat";
import { deployProxysFixture, SadeTokenFixture, userList } from "./fixtures"; import { Producer, Status, CustomerPlan, PlanInfoApi, PlanInfoNUsage, PlanInfoVesting, PlanTypes, Plan } from "./model";
import { BigNumber } from "ethers";
import { copyFileSync } from "fs";
import { TestToken } from "../../typechain-types/contracts/fortest/TestToken";

import {
  Framework,
  SuperToken,
  WrapperSuperToken,
} from "@superfluid-finance/sdk-core";
import TestTokenAbi from "../../artifacts/contracts/fortest/TestToken.sol/TestToken.json";
import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
import { Provider } from "@ethersproject/providers";
export const toBN = (x: any) => ethers.BigNumber.from(x);
describe("Start", async function () {

  it("should run successfully", async function () {
    const { urigenarator, factory, pstorage, producerApi, producerVestingApi, producerNusage } = await loadFixture(deployProxysFixture);
    const { owner, userA, userB, ProducerA, ProducerB, ProducerC } = await loadFixture(userList);

    let data1: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p1", description: "d1", image: "i1", externalLink: "e1", cloneAddress: ProducerA.address, exists: true };
    let data2: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p2", description: "d2", image: "i2", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }
    let data3: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p3", description: "d3", image: "i3", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }
    let cloneAddress: string[3];
    let firstClone: any;
    const sadeToken = await SadeTokenFixture();
    let suptoken = await ethers.getContractAt("ISuperToken", sadeToken.address);

    let plan1: Plan = { planId: 1, producer: ProducerA.address, name: "name", description: "description", externalLink: "externalLink", totalSupply: 1000, currentSupply: 0, backgroundColor: "1", image: "1", priceAddress: sadeToken.address, startDate: 1, status: Status.inactive, planType: PlanTypes.api, custumerPlanIds: [] };

    let planInfoApi1: PlanInfoApi = { planId: 2, flowRate: 3858024691358024, perMonthLimit: 1 };


    let planInfoNUsage1: PlanInfoNUsage = { planId: 0, oneUsagePrice: 1, minUsageLimit: 1, maxUsageLimit: 1 }

  





    await sadeToken.mint(ProducerA.address, 500);
    await sadeToken.mint(ProducerB.address, 500);
    await sadeToken.mint(ProducerC.address, 500);

    const ProducerABlance = await sadeToken.balanceOf(ProducerA.address)
    console.log("ProducerABlance", ProducerABlance);
    expect(ProducerABlance).to.equal(500);
    let addProdcuer1 = await factory.connect(ProducerA).newBcontract(data1);
    let addProdcuer2 = await factory.connect(ProducerB).newBcontract(data2);
    let addProdcuer3 = await factory.connect(ProducerC).newBcontract(data3);
    console.log("2112121",);

    cloneAddress = (await factory.connect(ProducerC).getClones());
    console.log("cloneAddress", cloneAddress);

    expect(await (await factory.connect(ProducerC).currentPR_ID())).to.equal((3), "getProducers after add 3 producers");
    firstClone = await ethers.getContractAt("Producer", cloneAddress[1])
    let name = await firstClone.getProducer().then((z: { name: any; }) => { return z.name })
    let getProducer = await firstClone.getProducer();
    let owner1 = await firstClone.owner();
    console.log("firstClone", firstClone.address);
    console.log("firstClone getProducer name ?", getProducer.name);
    console.log("Producer clone addres", getProducer.cloneAddress);
    console.log("Producer owner addres", owner1);

    console.log("Producerc", ProducerA.address);
    let firstorage = await ethers.getContractAt("ProducerStorage", pstorage.address)
    console.log("Producerc", ProducerC.address);
    let sname = await firstorage.getProducer(firstClone.address).then((z: { name: any; }) => { return z.name })
    console.log("sname getProducer name ?", sname);
    console.log("firstClone getProducer name ?", name);
    expect(data1.name).to.equal(name, "firstClone getProducer name ");

    let data4: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p4", description: "d4", image: "i4", externalLink: "e4", cloneAddress: firstClone.address, exists: true }
    let setProducer = await firstClone.connect(ProducerA).setProducer(data4);

    let setname = await firstorage.getProducer(firstClone.address).then((z: { name: any; }) => { return z.name });
    console.log("setname", setname);
    expect(data4.name).to.equal(setname, "setProducer name ");
    let status: Status = Status.inactive;
    let planTypeApi: PlanTypes = PlanTypes.api;
    const blockNumBefore = await ethers.provider.getBlockNumber();

    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let uplanId = timestampBefore + new Date().valueOf();


    let crateplanData: Plan = {
      planId: uplanId,
      producer: firstClone.address,
      name: "name",
      description: "description",
      externalLink: "externalLink",
      totalSupply: 1000,
      currentSupply: 0,
      backgroundColor: "1",
      image: "1",
      priceAddress: sadeToken.address,
      startDate: 1,
      status: Status.active,
      planType: PlanTypes.api,
      custumerPlanIds: [0],

    }


    console.log("createPlanData set producer name ", crateplanData);
    let addPlan = await firstClone.connect(ProducerA).addPlan(crateplanData);
    //await expect(addPlan).to.emit(firstClone, "LogAddPlan").withArgs(1,ProducerA.address);
       const receipt = await addPlan.wait();
       const event: any = receipt.events.find(
         (e: any) => e.address === firstClone.address,
       );
       const decodedEvent = firstClone.interface.decodeEventLog(
         'LogAddPlan',
         event.data,
         event.topics,
       );
       console.log("decodedEvent", decodedEvent);
    
    await expect(firstClone.connect(ProducerB).addPlan(crateplanData)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(firstClone.connect(ProducerA).addPlan(crateplanData)).to.be.revertedWith("plan exsist not add plan");


    let getplans2 = await firstClone.connect(ProducerA).getPlans();

    console.log("getPlans", getplans2);
     let addplanapi = await firstClone.connect(ProducerA).addPlanInfoApi(planInfoApi1);
      console.log("ProducerC ad", ProducerA.address);
  
    let planInfoNUsage: PlanInfoNUsage = { planId: uplanId, oneUsagePrice: 1, minUsageLimit: 1, maxUsageLimit: 1 }
    let addplanNUsage = await firstClone.connect(ProducerA).addPlanInfoNUsage(planInfoNUsage);
    console.log("addplanNUsage", addplanNUsage);
    let wait = await addplanNUsage.wait();


    let customerPlans: CustomerPlan = {
      customerAdress: ProducerC.address,
      planId: crateplanData.planId,
      custumerPlanId: 0,
      producerId: 1,
      cloneAddress: firstClone.address,
      priceAddress: sadeToken.address,
      startDate: timestampBefore,
      endDate: timestampBefore+ 1 * 30 * 24 * 60 * 60,
      remainingQuota: 1,
      status: Status.active,
      planType: PlanTypes.nUsage

    }
    await sadeToken.connect(ProducerC).approve(firstClone.address, 1000);
    let addcustomerPlansa = await firstClone.connect(ProducerC).addCustomerPlan(customerPlans);
    console.log("addcustomerPlansa", addcustomerPlansa);
    let rx = await addcustomerPlansa.wait();
    console.log("addcustomerPlansa rx", rx);
    let getplans = await firstClone.connect(ProducerA).getPlans();


    //console.log("getPlans", getplans);
    let balance = await sadeToken.balanceOf(firstClone.address);
    console.log("balance", balance);
    await expect(firstClone.connect(ProducerB).updateCustomerPlan(customerPlans)).to.be.revertedWith("only customer can call this function");

    // get customer 
    let getcustomer = await firstClone.connect(ProducerA).getCustomer(ProducerC.address);
    console.log("getcustomer", getcustomer);
    console.log("customer c", getcustomer.customerPlans);

    console.log("customer c", (getcustomer.customerPlans)[0].custumerPlanId);
    let tokenid = ((getcustomer.customerPlans)[0].custumerPlanId);

    console.log("token id", tokenid);
    let uri = await firstClone.connect(ProducerC).uri(tokenid);
    console.log("uri", uri);

  // let custumerPlanId=ethers.utils.solidityKeccak256(["uint256","address","address"],[ uplanId,ProducerC.address,firstClone.address]) */
   //   let custumerPlanId=ethers.utils.sha256( ethers.utils.defaultAbiCoder.encode (["string","string","string"],[ "2","2",'2']))
     
   const signers = await ethers.getSigners();
   let owner11=signers[0];
   let userA1=signers[1];
   let userB1=signers[2];
   let userC1=signers[3];
   const sfDeployer = await deployTestFramework();
   const contractsFramework = await sfDeployer.frameworkDeployer.getFramework();

   console.log("contractsFramework host sssssssssssss",contractsFramework);
   producerApi.SetSuperInitialize(contractsFramework.host);

    const  flow=await ethers.getContractFactory("FlowScheduler");
    const flowScheduler = await flow.deploy(
      contractsFramework.host, // host argument
      "" 
    );

    const vestingScheduler = await ethers.getContractFactory("VestingScheduler");
    const vestingScheduler1 = await vestingScheduler.deploy(
      contractsFramework.host, // host argument
      "" 
    );
    console.log("vestingScheduler1 address",vestingScheduler1.address);
   producerVestingApi.SetSuperInitialize(vestingScheduler1.address)
 
 console.log(" vestingScheduler1 ddddddddddd",vestingScheduler1.address);
 
    const provider = owner11.provider!;
   const chainId = (await provider.getNetwork()).chainId;
   const frameworkClass = await Framework.create({
       chainId,
       resolverAddress: contractsFramework.resolver,
       provider: provider as unknown as Provider,
       protocolReleaseVersion: "test",
   });
console.log("1");
   const tokenDeployment = await sfDeployer.frameworkDeployer.deployWrapperSuperToken(
    "Fake DAI Token",
    "fDAI",
    18,
    ethers.utils.parseEther("100000000").toString()
);
console.log("2");
const fDAIx = (await frameworkClass.loadSuperToken(
    "fDAIx",
)) as WrapperSuperToken;
const fDAI = new ethers.Contract(
    fDAIx.underlyingToken.address,
   TestTokenAbi.abi,
    owner,
) as unknown as TestToken;
console.log("3");
const initialAmount = ethers.utils.parseUnits("10000");
const initialAmount1 = ethers.utils.parseUnits("30000");
/* await fDAI.approve(fDAIx.address, ethers.constants.MaxInt256); */

for (let i = 0; i < signers.length; i++) {
  const signer = signers[i]!;
  await sadeToken.connect(signer).mint(signer.address, initialAmount, {
    from: signer.address,
});
  await fDAI.connect(signer).mint(signer.address, initialAmount1, {
      from: signer.address,
  });
  await fDAI
      .connect(signer)
      .approve(fDAIx.address, initialAmount, {
          from: signer.address,
      });

    const upgradeOp = fDAIx.upgrade({
      amount: initialAmount.toString(),
  });
  await upgradeOp.exec(signer);  
}
const balance11 = await fDAI.balanceOf(userC1.address);
console.log("balance11111111111111111111", balance11);
console.log("fDAIx",fDAIx.address);
console.log("fDAI",fDAI.address);



let crateplanDatavesting: Plan = {
  planId: 2,
  producer: firstClone.address,
  name: "name",
  description: "description",
  externalLink: "externalLink",
  totalSupply: 1000,
  currentSupply: 0,
  backgroundColor: "1",
  image: "1",
  priceAddress: fDAIx.address,
  startDate: 1,
  status: Status.active,
  planType: PlanTypes.api,
  custumerPlanIds: [0],

}

let addplanapir = await firstClone.connect(ProducerA).addPlanInfoApi(planInfoApi1);

  let addPlanvesting  = await firstClone.connect(ProducerA).addPlan(crateplanDatavesting);
console.log("addPlanvesting",addPlanvesting);
let waitvesting = await addPlanvesting.wait();
console.log("waitvesting",waitvesting); 
/* let planInfoVesting1Q:PlanInfoVesting={planId:2,cliffDate:1,flowRate:3858024691358024,startAmount:1,ctx:new Uint8Array(1)}; */
/* let addplanvesting = await firstClone.connect(ProducerA).addPlanInfoVesting(planInfoVesting1Q); */
/* console.log("addplanvesting",addplanvesting);
let waitvesting1 = await addplanvesting.wait(); */
let customerPlansvesting: CustomerPlan = {
  customerAdress: userC1.address,
  planId: 2,
  custumerPlanId: 0,
  producerId: 1,
  cloneAddress: firstClone.address,
  priceAddress: fDAIx.address,
  startDate: timestampBefore+ 1 * 30 * 24 * 60 * 60,
  endDate: timestampBefore+ 12 * 30 * 24 * 60 * 60,
  remainingQuota: 1,
  status: Status.active,
  planType: PlanTypes.api

}
let balance1 = await fDAI.balanceOf(userC1.address);
console.log("balance1", balance1);
console.log("sender",userC1.address);
console.log("fDAIx",fDAIx.address);
console.log(" firstClone",firstClone.address);

 
let flowOp1 = fDAIx.updateFlowOperatorPermissions({
  flowOperator: producerApi.address,
  permissions: 7,
  flowRateAllowance: "10000000000000000000"
});
//await flowOp1.exec(userC1);
let flowOp2 = fDAIx.updateFlowOperatorPermissions({
  flowOperator: vestingScheduler1.address,
  permissions: 7,
  flowRateAllowance: "0"
});
let flowOp3 = fDAIx.updateFlowOperatorPermissions({
  flowOperator: producerVestingApi.address,  
   permissions: 7,
  flowRateAllowance: "10000000000000000000" 
}); 
//await flowOp3.exec(userC1);
 //await flowOp2.exec(userC1);  
 
/*  
let addcustomerPlansaVesting = await firstClone.connect(userC1).addCustomerPlan(customerPlansvesting);


let getplans3 = await firstClone.connect(ProducerA).getPlans();

console.log("getPlans", getplans3);


let getcustomer1 = await firstClone.connect(ProducerA).getCustomer(userC1.address);
console.log("getcustomer", getcustomer1);
console.log("customer c", getcustomer1.customerPlans);  */


let crateplanData3: Plan = {
  planId: 3,
  producer: firstClone.address,
  name: "name",
  description: "description",
  externalLink: "externalLink",
  totalSupply: 1000,
  currentSupply: 0,
  backgroundColor: "1",
  image: "1",
  priceAddress: fDAIx.address,
  startDate: 1,
  status: Status.active,
  planType: PlanTypes.vestingApi,
  custumerPlanIds: [0],

}
let planInfoVesting1: PlanInfoVesting = { planId: 3, cliffDate: 1949340308, flowRate: 38580246913, startAmount: 3858024691358, ctx: new Uint8Array(1) };


 
  let addPlanvesting1  = await firstClone.connect(ProducerA).addPlan(crateplanData3);
   let addplanapi1 = await firstClone.connect(ProducerA).addPlanInfoVesting(planInfoVesting1);
console.log("addplanapi1",addplanapi1);

  let customerPlansvesting3: CustomerPlan = {
    customerAdress: userC1.address,
    planId: 3,
    custumerPlanId: 0,
    producerId: 1,
    cloneAddress: firstClone.address,
    priceAddress: fDAIx.address,
    startDate: timestampBefore+ 21 * 30 * 24 * 60 * 60,
    endDate: 4001130825,
    remainingQuota: 1,
    status: Status.active,
    planType: PlanTypes.vestingApi
  
  }
    console.log("addplanapi1",addplanapi1);
  let addcustomerPlansaVesting1 = await firstClone.connect(userC1).addCustomerPlan(customerPlansvesting3);
console.log("addcustomerPlansaVesting1",addcustomerPlansaVesting1);
  let getplans4 = await firstClone.connect(ProducerA).getPlans();

  console.log("getPlans", getplans4);
  
  
  let getcustomer4 = await firstClone.connect(ProducerA).getCustomer(userC1.address);
  console.log("getcustomer", getcustomer4);
  console.log("customer c", getcustomer4.customerPlans);  

 });

  


 });

 //



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
let owner:SignerWithAddress;
let userA:SignerWithAddress;
let userB:SignerWithAddress;
let userC:SignerWithAddress;
let ProducerA:SignerWithAddress;
let ProducerB:SignerWithAddress;
let ProducerC:SignerWithAddress;
let pstorage:any;
let factory:any;
let producerVestingApi:any;
let producerApi:any;
let uriGenerator:any;
let producerNusage:any;
let provider:any;
let chainId:any;
let frameworkClass:any;
let sfDeployer:any;
let contractsFramework:any;
let flow:any;
let flowScheduler:any;
let vestingScheduler:any;
let fDAI:any;
let fDAIx:any;
let initialAmount:any;
let sadeToken:any;


before(async function () {
  const signers = await ethers.getSigners();
   [
    owner,
    userA,
    userB,
    userC,
    ProducerA,
    ProducerB,
    ProducerC]  = await ethers.getSigners();
   [    uriGenerator, factory, pstorage, producerApi, producerNusage, producerVestingApi ]    =  await deployProxysFixture() ;
   provider = owner.provider!;
   chainId = (await provider.getNetwork()).chainId;
   sfDeployer = await deployTestFramework();
   contractsFramework = await sfDeployer.frameworkDeployer.getFramework();
   flow = await ethers.getContractFactory("FlowScheduler");
   flowScheduler = await flow.deploy(
    contractsFramework.host, // host argument
    ""
  );
  const vestingS = await ethers.getContractFactory("VestingScheduler");
      vestingScheduler = await vestingS.deploy(
    contractsFramework.host, // host argument
    ""
  );
   
  producerVestingApi.setSuperInitialize(vestingScheduler.address);
  frameworkClass = await Framework.create({
    chainId,
    resolverAddress: contractsFramework.resolver,
    provider: provider as unknown as Provider,
    protocolReleaseVersion: "test",
  });
  const tokenDeployment = await sfDeployer.frameworkDeployer.deployWrapperSuperToken(
    "Fake DAI Token",
    "fDAI",
    18,
    ethers.utils.parseEther("100000000").toString()
  );
    fDAIx = (await frameworkClass.loadSuperToken(
    "fDAIx",
  )) as WrapperSuperToken;
    fDAI = new ethers.Contract(
    fDAIx.underlyingToken.address,
    TestTokenAbi.abi,
    this.owner,
  ) as unknown as TestToken;
  initialAmount =ethers.utils.parseUnits("30000")
  let ss= await ethers.getSigners();
  for (let i = 0; i < 7; i++) {
    const signer = ss[i]!;
      sadeToken = await SadeTokenFixture();
    await sadeToken.connect(signer).mint(signer.address, initialAmount, {
      from: signer.address,
    });
    await fDAI.connect(signer).mint(signer.address, initialAmount, {
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

});
describe("Start", async function () {
 


    
  it("should run successfully", async function () {

  

    let data1: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p1", description: "d1", image: "i1", externalLink: "e1", cloneAddress: ProducerA.address, exists: true };
    let data2: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p2", description: "d2", image: "i2", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }
    let data3: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p3", description: "d3", image: "i3", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }
    let firstClone: any;

    let planInfoApi1: PlanInfoApi = { planId: 2, flowRate: 3858024691358024, perMonthLimit: 1 };

    await sadeToken.mint(ProducerA.address, 500);
    await sadeToken.mint(ProducerB.address, 500);
    await sadeToken.mint(ProducerC.address, 500);
    const ProducerABlance = await sadeToken.balanceOf(ProducerA.address)
    expect(ProducerABlance).to.equal(500);
    await factory.connect(ProducerA).newBcontract(data1);
    await factory.connect(ProducerB).newBcontract(data2);
    await factory.connect(ProducerC).newBcontract(data3);

    let cloneAddress = (await pstorage.connect(ProducerC).getClones());

    expect(await (await factory.connect(ProducerC).currentPR_ID())).to.equal((3), "getProducers after add 3 producers");
    firstClone = await ethers.getContractAt("Producer", cloneAddress[1])
    let name = await firstClone.getProducer().then((z: { name: any; }) => { return z.name })
    let getProducer = await firstClone.getProducer();
    let owner1 = await firstClone.owner();
    let firstorage = await ethers.getContractAt("ProducerStorage", pstorage.address)
    await firstorage.getProducer(firstClone.address).then((z: { name: any; }) => { return z.name })
    expect(data1.name).to.equal(name, "firstClone getProducer name ");

    let data4: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p4", description: "d4", image: "i4", externalLink: "e4", cloneAddress: firstClone.address, exists: true }
    await firstClone.connect(ProducerA).setProducer(data4);

    let setname = await firstorage.getProducer(firstClone.address).then((z: { name: any; }) => { return z.name });
    expect(data4.name).to.equal(setname, "setProducer name ");
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let uplanId = timestampBefore + new Date().valueOf();
    let crateplanData: Plan = {
      planId: uplanId,
      producerId: getProducer.producerId,
      cloneAddress: firstClone.address,
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
    let addPlan = await firstClone.connect(ProducerA).addPlan(crateplanData);
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
      producerId: getProducer.producerId,
      cloneAddress: firstClone.address,
      priceAddress: sadeToken.address,
      startDate: timestampBefore,
      endDate: timestampBefore + 1 * 30 * 24 * 60 * 60,
      remainingQuota: 1,
      status: Status.active,
      planType: PlanTypes.nUsage

    }
    await sadeToken.connect(ProducerC).approve(firstClone.address, 1000);
    let addcustomerPlansa = await firstClone.connect(ProducerC).addCustomerPlan(customerPlans);
    let rx = await addcustomerPlansa.wait();
    let getplans = await firstClone.connect(ProducerA).getPlans();


    //console.log("getPlans", getplans);
    let balance = await sadeToken.balanceOf(firstClone.address);
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
 
 
    // producerApi.setSuperInitialize(contractsFramework.host,true,true,true);
 
  

   
 
// sdade
      
    
  
    



    let crateplanDatavesting: Plan = {
      planId: 2,
      producerId: getProducer.producerId,
      cloneAddress: firstClone.address,
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
    console.log("6");
    let addplanapir = await firstClone.connect(ProducerA).addPlanInfoApi(planInfoApi1);
    console.log("7");
    let addPlanvesting = await firstClone.connect(ProducerA).addPlan(crateplanDatavesting);
    console.log("addPlanvesting", addPlanvesting);
    let waitvesting = await addPlanvesting.wait();
    console.log("waitvesting", waitvesting);
    /* let planInfoVesting1Q:PlanInfoVesting={planId:2,cliffDate:1,flowRate:3858024691358024,startAmount:1,ctx:new Uint8Array(1)}; */
    /* let addplanvesting = await firstClone.connect(ProducerA).addPlanInfoVesting(planInfoVesting1Q); */
    /* console.log("addplanvesting",addplanvesting);
    let waitvesting1 = await addplanvesting.wait(); */
    let customerPlansvesting: CustomerPlan = {
      customerAdress: userC.address,
      planId: 2,
      custumerPlanId: 0,
      producerId: getProducer.producerId,
      cloneAddress: firstClone.address,
      priceAddress: fDAIx.address,
      startDate: timestampBefore + 1 * 30 * 24 * 60 * 60,
      endDate: timestampBefore + 12 * 30 * 24 * 60 * 60,
      remainingQuota: 1,
      status: Status.active,
      planType: PlanTypes.api

    }
 


    let flowOp1 = fDAIx.updateFlowOperatorPermissions({
      flowOperator: producerApi.address,
      permissions: 7,
      flowRateAllowance: "10000000000000000000"
    });
    await flowOp1.exec(userC);
    let flowOp2 = fDAIx.updateFlowOperatorPermissions({
      flowOperator: vestingScheduler.address,
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


    let addcustomerPlansaVesting = await firstClone.connect(userC).addCustomerPlan(customerPlansvesting);


    let getplans3 = await firstClone.connect(ProducerA).getPlans();

    console.log("getPlans", getplans3);


    let getcustomer1 = await firstClone.connect(ProducerA).getCustomer(userC.address);
    console.log("getcustomer", getcustomer1);
    console.log("customer c", getcustomer1.customerPlans);


    let crateplanData3: Plan = {
      planId: 3,
      producerId: getProducer.producerId,
      cloneAddress: firstClone.address,
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



    let addPlanvesting1 = await firstClone.connect(ProducerA).addPlan(crateplanData3);
    let addplanapi1 = await firstClone.connect(ProducerA).addPlanInfoVesting(planInfoVesting1);
    console.log("addplanapi1", addplanapi1);

    let customerPlansvesting3: CustomerPlan = {
      customerAdress: userC.address,
      planId: 3,
      custumerPlanId: 0,
      producerId: getProducer.producerId,
      cloneAddress: firstClone.address,
      priceAddress: fDAIx.address,
      startDate: timestampBefore + 21 * 30 * 24 * 60 * 60,
      endDate: 4001130825,
      remainingQuota: 1,
      status: Status.active,
      planType: PlanTypes.vestingApi

    }
    console.log("addplanapi1", addplanapi1);
    let addcustomerPlansaVesting1 = await firstClone.connect(userC).addCustomerPlan(customerPlansvesting3);
    console.log("addcustomerPlansaVesting1", addcustomerPlansaVesting1);
    let getplans4 = await firstClone.connect(ProducerA).getPlans();

    console.log("getPlans", getplans4);


    let getcustomer4 = await firstClone.connect(ProducerA).getCustomer(userC.address);
    console.log("getcustomer", getcustomer4);
    console.log("customer c", getcustomer4.customerPlans);

  });




});

//
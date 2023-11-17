import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert, Console } from "console";
import { ethers } from "hardhat";
import { deployProxysFixture, SadeTokenFixture, userList } from "./fixtures";
import { CreatePlanData, Producer, PlanInfo, PlanStatus, CustomerPlan, CreateCustomerPlan } from "./model";

export const toBN = (x: any) => ethers.BigNumber.from(x);
describe("Start", async function () {

  it("should run successfully", async function () {

    let producer1, producer2, producer3: SignerWithAddress;
    const { producerLogic, urigenarator, factory, pstorage } = await loadFixture(deployProxysFixture);
    const { owner, userA, userB, ProducerA, ProducerB, ProducerC } = await loadFixture(userList);

    // erc20 mint 
    const sadeToken = await SadeTokenFixture();
    await sadeToken.mint(ProducerA.address, 500);
    await sadeToken.mint(ProducerB.address, 500);
    await sadeToken.mint(ProducerC.address, 500);
    const ProducerABlance = await sadeToken.balanceOf(ProducerA.address)

    console.log("ProducerABlance", ProducerABlance);
    expect(ProducerABlance).to.equal(500);


    let data1: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p1", description: "d1", image: "i1", externalLink: "e1", cloneAddress: ProducerA.address, exists: true };
    let data2: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p2", description: "d2", image: "i2", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }
    let data3: Producer = { producerId: 0, producerAddress: ProducerA.address, name: "p3", description: "d3", image: "i3", externalLink: "e1", cloneAddress: ProducerA.address, exists: true }

    let addProdcuer1 = await factory.connect(ProducerA).newBcontract(data1);
    let addProdcuer2 = await factory.connect(ProducerB).newBcontract(data2);
    let addProdcuer3 = await factory.connect(ProducerC).newBcontract(data3);
     console.log("2112121",);

    let cloneAddress = (await factory.connect(ProducerC).getClones());
    console.log("cloneAddress", cloneAddress);

    expect(await (await factory.connect(ProducerC).currentPR_ID())).to.equal((3), "getProducers after add 3 producers");
  

    let firstClone = await ethers.getContractAt("Producer", cloneAddress[1])
    let name = await firstClone.getProducer().then((z: { name: any; }) => { return z.name })
    let getProducer = await firstClone.getProducer();
    let owner1 = await firstClone.owner();
    console.log("firstClone", firstClone.address);
    console.log("firstClone getProducer name ?", getProducer.name);
    console.log("Producer clone addres", getProducer.cloneAddress);
    console.log("Producer owner addres", owner1);

    console.log("Producerc", ProducerA.address);
     let firstorage = await ethers.getContractAt("ProducerStorage", pstorage.address)   
   
    // firstclone is producer3/* 
/*      const approve = await sadeToken.connect(ProducerA).approve(firstClone.address, 500);
    const approve2 = await sadeToken.connect(ProducerB).approve(firstClone.address, 500);
    const approve3 = await sadeToken.connect(ProducerC).approve(firstClone.address, 500); */
 

     console.log("Producerc", ProducerC.address);
     let sname = await firstorage.getProducer(firstClone.address).then((z: { name: any; }) => { return z.name })
    console.log("sname getProducer name ?", sname);
    console.log("firstClone getProducer name ?", name);
    expect(data1.name).to.equal(name, "firstClone getProducer name ");     

      let data4: Producer = { producerId:0,  producerAddress:ProducerA.address, name: "p4", description: "d4", image: "i4", externalLink: "e4",cloneAddress:firstClone.address, exists:true }
     let setProducer = await firstClone.connect(ProducerA).setProducer(data4);
 
let setname= await firstorage.getProducer(firstClone.address).then((z: { name: any; }) => { return z.name });
console.log("setname",setname);
expect(data4.name).to.equal(setname, "setProducer name ");
     
 
    let planInfo: PlanInfo = { description: "description1", externalLink: "externalLink", totalSupply: 1000, currentSupply: 0, backgroundColor: "1", price: 1, image: "1", priceAddress: sadeToken.address, priceSymbol: "sade" };
    let status: PlanStatus = PlanStatus.expired;
    let createPlanData: CreatePlanData = { name: "first", pricePerSecond: 123, info: planInfo, status: status }
    console.log("createPlanData set producer name ", createPlanData);
    let addPlan = await firstClone.connect(ProducerA).addPlan(createPlanData)
    let getplans = await firstClone.connect(ProducerA).getPlans();
    console.log("ProducerC ad", ProducerA.address);
    console.log("getPlans", getplans); 

    let customerplan: CreateCustomerPlan = {
      customerAdress: ProducerC.address,
      planId: 1, custumerPlanId: 1, producerId: 1, cloneAddress: "0x0433d874a28147db0b330c000fcc50c0f0baf425",
      price: 1, paid_in: 0, startTime: 0, endTime: 0
    }  
    let addcustomerplan = await firstClone.connect(ProducerB).addCustomerPlan(customerplan);  
    let getcustomerplan2 = await firstClone.connect(ProducerC).addCustomerPlan(customerplan);
    let getPlans = await firstClone.connect(ProducerC).getPlans();
    console.log("getPlans", getPlans);

    let getcustomer = await firstClone.connect(ProducerC).getCustomer(ProducerC.address);
    console.log("getcustomer", getcustomer);
    let uri = await firstClone.connect(ProducerC).uri("36546413839804865967760761014162095251436883311429874078000434382691432681707");
    console.log("uri", uri);  
  
       let getProducerBBlance = await  sadeToken.balanceOf(ProducerB.address);
       let getProducerCBlance= await  sadeToken.balanceOf(ProducerC.address);
       let getFirstProducerBlance = await sadeToken.balanceOf(firstClone.address);
       console.log("getProducerCBlance", getProducerCBlance);
       console.log("getProducerBBlance", getProducerBBlance);
       console.log("getFirstProducerBlance", getFirstProducerBlance);
       let withdrawTokens =await firstClone.connect(ProducerA).withdraw()
       console.log("withdrawTokens", withdrawTokens);  
  });


});
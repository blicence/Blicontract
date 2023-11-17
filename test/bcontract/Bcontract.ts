import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { artifacts, ethers } from "hardhat";
import { int } from "hardhat/internal/core/params/argumentTypes";
import type { Artifact } from "hardhat/types";



describe("Unit tests", function () {
  let admin: SignerWithAddress;
  let producer1, producer2, producer3: SignerWithAddress;
  let customer1, customer2, customer3;
  let bcontract;
  before(async function () {
    [this.admin, this.producer1, this.producer2, this.producer3, this.customer1, this.customer2, customer3] = await ethers.getSigners();

    const Lib = await ethers.getContractFactory("Logic");
    const lib = await Lib.deploy();
    await lib.deployed();

    const Bcontract = await ethers.getContractFactory("Bcontract", {
      signer: admin,
      libraries: {
        Logic: lib.address,
      },
    });
    this.bcontract = await Bcontract.deploy();
    await this.bcontract.deployed();
    console.log("Bcontract deployed to:", this.bcontract);
  });
  it("deployContract", async function () {

    expect(this.bcontract.address).to.be.a("string");
  });


  it("getProducers add", async function () {
    interface CreateProducerData {
      _producerId: number;
      _name: string;
      _description: string;
      _image: string;
      _externalLink: string;
    }
    let data1: CreateProducerData = { _producerId: 0, _name: "p1", _description: "d1", _image: "i1", _externalLink: "e1" };
    let data2: CreateProducerData = { _producerId: 0, _name: "p2", _description: "d2", _image: "i2", _externalLink: "e2" };
    let data3: CreateProducerData = { _producerId: 0, _name: "p3", _description: "d3", _image: "i3", _externalLink: "e3" };


    let addProdcuer1 = await this.bcontract.connect(this.producer1).producerCreateOrUpdated(data1);
    let addProdcuer2 = await this.bcontract.connect(this.producer2).producerCreateOrUpdated(data2);
    let addProdcuer3 = await this.bcontract.connect(this.producer3).producerCreateOrUpdated(data3);
    let sr = await this.bcontract.getProducers()
    console.log("getProducers length: " + sr.length)
    expect(await (await this.bcontract.getProducers()).length).to.equal((3), "getProducers after add 3 producers");
  });

  it("getProducerIdToProducer", async function () {
    let nproducer1 = await this.bcontract.connect(this.producer1).getProducerIdToProducer(1);
    let nproducer2 = await this.bcontract.connect(this.producer2).getProducerIdToProducer(2);
    let nproducer3 = await this.bcontract.connect(this.producer3).getProducerIdToProducer(3);
    console.log(nproducer1.name, nproducer2.name, nproducer3.name);
    expect(nproducer1.name).to.equal("p1", "getProducerIdToProducer after add 3 producers");
    expect(nproducer2.name).to.equal("p2", "getProducerIdToProducer after add 3 producers");
    expect(nproducer3.name).to.equal("p3", "getProducerIdToProducer after add 3 producers");


  });
  it("getProducer to produceraddress", async function () {

    let nproducer1 = await this.bcontract.connect(this.producer1).getProducer(this.producer1.getAddress());
    let nproducer2 = await this.bcontract.connect(this.producer2).getProducer(this.producer2.getAddress());
    let nproducer3 = await this.bcontract.connect(this.producer3).getProducer(this.producer3.getAddress());
    console.log(nproducer1.name, nproducer2.name, nproducer3.name);
    expect(nproducer1.name).to.equal("p1", "getProducer after add 3 producers");
    expect(nproducer2.name).to.equal("p2", "getProducer after add 3 producers");
    expect(nproducer3.name).to.equal("p3", "getProducer after add 3 producers");
  });

  it("Add plan ", async function () {
    interface CreatePlanData {
      name: string;
      pricePerSecond: number;
      status: PlanStatus;
      info: PlanInfo;
    }
    enum PlanStatus {
      inactive,
      active,
      expired
    }
    interface PlanInfo {
      description: string;
      externalLink: string;
      totalSupply: number;
      currentSupply: number;
      backgroundColor: string;
      price: number;
      image: string;
    }
    let planInfo: PlanInfo = { description: "description1", externalLink: "externalLink", totalSupply: 1000, currentSupply: 0, backgroundColor: "1", price: 10, image: "1" };
    let createPlanData: CreatePlanData = { name: "first", pricePerSecond: 123, info: planInfo, status: PlanStatus.active }
    let addPlan = await this.bcontract.connect(this.producer1).addPlan(createPlanData)
    let nproducer1 = await this.bcontract.connect(this.producer1).getProducer(this.producer1.getAddress());
    console.log(nproducer1.name, nproducer1.plans[0].name);
    expect(nproducer1.plans[0].name).to.equal("first", "Add plan after plan name");
    console.log(nproducer1.name, nproducer1.plans[0].info.description);
    expect(nproducer1.plans[0].info.description).to.equal("description1", "add plan description");
  });

  it("add CostumerPlan", async function () {
    interface CreateCustomerPlan {
      planId: number;
      producerId: number;
      price: number;
      paid_in: number;
    }
    let customerplan1: CreateCustomerPlan = { planId: 1, producerId: 2, price: 11, paid_in: 1 };
    let customerplan2: CreateCustomerPlan = { planId: 1, producerId: 2, price: 12, paid_in: 1 };

    let addCostumerPlan = await this.bcontract.connect(this.customer1).addCustomerPlan(customerplan1);
    let addCostumerPlan1 = await this.bcontract.connect(this.customer1).addCustomerPlan(customerplan2);
    let customer1plan = await this.bcontract.connect(this.customer1).getCustomer(this.customer1.getAddress());

    console.log("sade", customer1plan.customerPlans[0].CustumerPlanId);
    let plannft = await this.bcontract.connect(this.customer1).uri(1);
    console.log(plannft);
    expect(customer1plan.customerPlans[0].CustumerPlanId).to.equal(1, "customer CustumerPlanId");
    expect(customer1plan.customerPlans[0].price).to.equal(11, "customer CustumerPlanId 1");
    expect(customer1plan.customerPlans[1].price).to.equal(12, "customer CustumerPlanId2 ");


  }
  );

  it("plannft", async function () {
    let plannft = await this.bcontract.connect(this.customer1).getPlanNftUri(1);
    console.log(plannft);
  });


});

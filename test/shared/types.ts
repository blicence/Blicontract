 
import {BigNumber, ContractFactory, Wallet} from "ethers";
import {Result} from "ethers/lib/utils";
import {ethers, upgrades} from "hardhat";
import {  BcontractFactory, Bcontractv2, CustomerNftUpgradeable, ProducerLogicUpgradeable } from "../../typechain-types";

export interface Signers {
    owner: Wallet;
    userA: Wallet;
    userB: Wallet;
    producerA: Wallet;
    producerB: Wallet;
    producerC: Wallet;
   
}
/*  export type CustomerNftFixtureType = {
    bettor: Wallet;
    tokenAmount: BigNumber; 
  }; */

/*   export type IntegrationCustomerNftFixtureType = {
    customerNft: CustomerNftUpgradeable; 
  };
  
  export type IntegrationProducerLogicFixtureType = {
    producerLogic: ProducerLogicUpgradeable;
  };
  
  export type IntegrationBcontractV2FixtureType = {
    bcontractv2Factory: BcontractFactory;
  };
  

  export type IntegrationBcontractFixtureType = {
    bcontractv2: Bcontractv2;
    customerNft: CustomerNftUpgradeable;
    producerLogic: ProducerLogicUpgradeable;
   
  }; */
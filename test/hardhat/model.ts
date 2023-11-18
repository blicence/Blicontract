import { ISuperToken } from "../../typechain-types";

export enum Status {
  inactive,
  active,
  expired
}
export enum PlanTypes {
  api, // for api usage
  nUsage, // for number of usage,
  vestingApi // for vesting api usage,
}

export interface CreateProducerData {
  _producerId: number;
  _name: string;
  _description: string;
  _image: string;
  _externalLink: string;
}

export interface Producer {
  producerId?: number;
  producerAddress: string;
  name: string;
  description: string;
  image: string;
  externalLink: string;
  cloneAddress?: string;
  exists?: boolean;

}

export interface Plan {
  planId: number; // planId is unique for each plan
  producer: string; // producer clone address
  name: string;
  description: string; // description of the token
  externalLink: string; // link to the token's website
  totalSupply: number; // total number of tokens that can be minted
  currentSupply: number; // number of tokens that have been minted
  backgroundColor: string; // background color of the token
  image: string; // image of the token
  priceAddress: string; // address to which payments should be sent
  startDate: number; // date on which the token sale begins
  status: Status;
  planType: PlanTypes;
  custumerPlanIds: number[];
}


export interface PlanInfoApi {
  planId: number; // planId is unique for each plan
  flowRate: number; // cost of one token per second (in wei)
  perMonthLimit: number; // maximum number of tokens that can be minted in a month
}
export interface PlanInfoVesting {
  planId: number; // planId is unique for each plan 
  cliffDate: number; // cliff date of the vesting period
  flowRate: number; // rate at which tokens are vested per second
  startAmount: number; // total amount of tokens to be vested
  ctx: Uint8Array; // context of the vesting plan
}
export interface PlanInfoNUsage {
  planId: number; // planId is unique for each plan
  oneUsagePrice: number; // price of one usage of the plan
  minUsageLimit: number; // minimum usage limit of the plan
  maxUsageLimit: number; // maximum usage limit of the plan
}



 

export interface CustomerPlan {
  customerAdress: string; // address of the customer
  planId: number; // unique identifier for the plan associated with the customer plan
  custumerPlanId: number; // unique identifier for the customer plan
  producerId: number; // unique identifier for the producer associated with the customer plan
  cloneAddress: string; // clone address associated with the customer plan
  
  priceAddress: string;
  startDate: number; // the date when the plan starts
  endDate: number; // the date when the plan ends
  remainingQuota: number; // the monthly quota of the plan
   
  status: Status; // status of the customer plan
  planType: PlanTypes; // type of the plan associated with the customer plan


}


 
export interface Customer {
  customer: string; // address of the customer
  customerPlans: CustomerPlan[]; // array of customer plans
}
 
export interface UriMeta {
  custumerPlanId: number; // unique identifier for the customer plan
  planId: number; // unique identifier for each plan
  producerName: string; // name of the producer associated with the plan
  cloneAddress: string; // clone address associated with the plan
  description: string; // description of the token
  externalLink: string; // link to the token's website
  totalSupply: number; // total number of tokens that can be minted
  currentSupply: number; // number of tokens that have been minted
  backgroundColor: string; // background color of the token
  image: string; // image of the token
  priceAddress: string; // address to which payments should be sent
  startDate: number; // the date when the plan starts
  endDate: number; // the date when the plan ends
  remainingQuota: number; // the monthly quota of the plan
  planType: PlanTypes; // type of the plan
  status: Status; // status of the plan
}


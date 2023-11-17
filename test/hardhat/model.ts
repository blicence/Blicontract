export interface CreateProducerData {
    _producerId: number;
    _name: string;
    _description: string;
    _image: string;
    _externalLink: string;
  }
  export interface Producer {
producerId?:number;
producerAddress:string;
name: string;
description: string;
image: string;
externalLink: string;
cloneAddress?:string;
exists?:boolean;

  }


  export interface CreatePlanData {
    name: string;
    pricePerSecond: number;
    status: PlanStatus;
    info: PlanInfo;
  }
  export enum PlanStatus {
    inactive,
    active,
    expired
  }
  export interface PlanInfo {
    description: string;
    externalLink: string;
    totalSupply: number;
    currentSupply: number;
    backgroundColor: string;
    price: number;
    image: string;
    priceAddress:string;
    priceSymbol:string;


  }

 
 
export interface CustomerPlan {

    planId?: number;
    custumerPlanId?: number;
    producerId?: number;
    cloneAddress?: string;
    price?: number;
    paid_in?: number; // amount of tokens paid in
    startTime?: number;
    endTime?: number;
  }

 
  
export interface CreateCustomerPlan {
  customerAdress:string;
  planId?: number;
  custumerPlanId?: number;
  producerId?: number;
  cloneAddress?: string;
  price?: number;
  paid_in?: number; // amount of tokens paid in
  startTime?: number;
  endTime?: number;
}
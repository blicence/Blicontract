// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

//
library DataTypes {
    struct Producer {
        uint256 producerId;
        address producerAddress;
        string name;
        string description;
        string image;
        string externalLink;
        address cloneAddress;
        bool exists;
    }
    struct producerInfo {
        uint256 producerId;
        address cloneAddress;
        bool exists;
    }

    struct Plan {
        uint256 planId; // planId is unique for each plan
        address producer;
        string name;
        int96 pricePerSecond;
        PlanStatus status;
        PlanInfo info;
    }
    struct PlanInfo {
        string description;
        string externalLink;
        int256 totalSupply;
        int256 currentSupply;
        string backgroundColor;
        uint256 price;
        string image;
        address priceAddress;
        string priceSymbol;
    }
    
    struct CreatePlanData {
        string name;
        int96 pricePerSecond;
        PlanStatus status;
        PlanInfo info;
    }
    struct CreateCustomerPlan {
        address customerAdress;
        uint256 planId;
        uint256 custumerPlanId;
        uint256 producerId;
        address cloneAddress;
        uint256 price;
        int256 paid_in; // amount of tokens paid in
        uint256 startTime;
        uint256 endTime;
    }

    enum PlanStatus {
        inactive,
        active,
        expired
    }
    struct CustomerPlan {
        uint256 planId;
        uint256 custumerPlanId;
        uint256 producerId;
        address cloneAddress;
        uint256 price;
        int256 paid_in; // amount of tokens paid in
        uint256 startTime;
        uint256 endTime;
    }
    struct Customer {
        address customer;
        CustomerPlan[] customerPlans;
    }
    struct URIParams {
        address cloneAddress;
        uint256 producerId;
        string producerName;
        uint256 planId;
        string planName;
        uint256 custumerPlanId;
        uint256 startTime;
        uint256 endTime;
        uint256 price;
        address priceAddress;
        string priceSymbol;
        bool isactive;
    }
     

}

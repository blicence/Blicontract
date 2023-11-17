// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

library DataTypes {
    struct Producer {
        uint256 ProducerId;
        address produceraddress;
        string name;
        string description;
        string image;
        string externalLink;
        Plan[] plans;
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
    }
    struct CreateProducerData {
        uint256 _producerId;
        string _name;
        string _description;
        string _image;
        string _externalLink;
    }
    struct CreatePlanData {
        string name;
        int96 pricePerSecond;
        PlanStatus status;
        PlanInfo info;
    }
    struct CreateCustomerPlan {
        uint256 planId;
        uint256 producerId;
        uint256 price;
        int256 paid_in;
    }

    enum PlanStatus {
        inactive,
        active,
        expired
    }
    struct CustomerPlan {
        uint256 planId;
        uint256 CustumerPlanId;
        uint256 ProducerId;
        uint256 price;
        int256 paid_in; // amount of tokens paid in
        uint256 startTime;
        uint256 endTime;
    }
    struct Customer {
        address customer;
        CustomerPlan[] customerPlans;
    }
}

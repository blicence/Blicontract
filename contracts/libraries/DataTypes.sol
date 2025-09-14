// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

//
library DataTypes {
    /**
     * @title Producer
     * @dev This struct represents a producer.
     * @param producerId The ID of the producer.
     * @param producerAddress The address of the producer.
     * @param name The name of the producer.
     * @param description A description of the producer.
     * @param image An image associated with the producer.
     * @param externalLink An external link associated with the producer.
     * @param cloneAddress The clone address of the producer.
     * @param exists Indicates whether the producer exists or not.
     */
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

    /**
     * @title Plan
     * @dev This struct represents a plan.
     * @param planId The ID of the plan. Each plan has a unique ID.
     * @param producer The clone address of the producer.
     * @param name The name of the plan.
     * @param status The status of the plan.
     * @param planType The type of the plan.
     */
     
    struct Plan {
        uint256 planId; // planId is unique for each plan
        address cloneAddress; // producer   clone address
        uint256 producerId;

        string name;
        string description; // description of the token
        string externalLink; // link to the token's website
        int256 totalSupply; // total number of tokens that can be minted
        int256 currentSupply; // number of tokens that have been minted
        string backgroundColor; // background color of the token
        string image; // image of the token
        address priceAddress; // address to which payments should be sent
        uint32 startDate; // date on which the token sale begins
        Status status;
        PlanTypes planType;
        uint256[] custumerPlanIds;
    }
    /**
     * @title Status
     * @dev This enum represents the status of a plan.
     * @notice The possible values are: inactive, active, expired.
     */
    enum Status {
        inactive,
        active,
        expired
    }
    /**
     * @title PlanTypes
     * @dev This enum represents the type of a plan.
     * @notice The possible values are: api, nUsage, vestingApi.
     */
    enum PlanTypes {
        api, // for api usage
        nUsage, // for number of usage,
        vestingApi // for vesting api usage,
    }

    /**
     * @title StreamType
     * @dev This enum represents the type of stream in StreamLockManager.
     * @notice The possible values are: REGULAR, VESTING, USAGE_POOL.
     */
    enum StreamType {
        REGULAR,    // Regular streaming subscription
        VESTING,    // Vesting stream with cliff
        USAGE_POOL  // Prepaid usage pool
    }
    // When creating a producer plan, the information of the related plan will be entered according to the type of the plan.
    // For example, when creating an API plan, the API plan information will be entered.
    // This information will change according to the type of plan.

    // PlanInfoApi is a struct that contains information about a subscription plan. It contains the following fields:
    // description: a string containing a description of the plan
    // externalLink: a string containing an external link to more information about the plan
    // totalSupply: the total number of tokens that can be minted under the plan
    // currentSupply: the number of tokens that have been minted so far under the plan
    // backgroundColor: a string containing a hex color code for the background color of the plan
    // image: a string containing a link to an image representing the plan
    // priceAddress: the address of the ERC20 token that is used to pay for the plan
    // startDate: the date when the plan will start
    // pricePerSecond: the price of the plan in the ERC20 token per second
    // perMonthLimit: the maximum number of tokens that can be minted under the plan per month
    // perSecondLimit: the maximum number of tokens that can be minted under the plan per second

    /**
     * @title PlanInfoApi
     * @dev This struct represents an API plan.
     * @param description A description of the token.
     * @param externalLink A link to the token's website.
     * @param totalSupply The total number of tokens that can be minted.
     * @param currentSupply The number of tokens that have been minted.
     * @param backgroundColor The background color of the token.
     * @param image The image of the token.
     * @param priceAddress The address to which payments should be sent.
     * @param startDate The date on which the token sale begins.
     * @param pricePerSecond The cost of one token per second (in wei).
     * @param perMonthLimit The maximum number of tokens that can be minted in a month.
     */
    struct PlanInfoApi {
        uint256 planId; // planId is unique for each plan
        uint256 flowRate; // cost of one token per second (in wei)
        uint256 perMonthLimit; // maximum number of tokens that can be minted in a month
    }

    /**
     * @title PlanInfoVesting
     * @dev This struct represents a vesting plan.
     * @param description A description of the plan.
     * @param externalLink An external link associated with the plan.
     * @param totalSupply The total supply of the plan.
     * @param currentSupply The current supply of the plan.
     * @param backgroundColor The background color of the plan.
     * @param image An image associated with the plan.
     * @param startDate The start date of the plan.
     * @param cliffDate The cliff date of the plan.
     * @param flowRate The flow rate of the plan.
     * @param startAmount The start amount of the plan.
     * @param ctx The context of the plan.
     */
    struct PlanInfoVesting {
        uint256 planId; // planId is unique for each plan
        uint32 cliffDate;
        uint256 flowRate;
        uint256 startAmount;
        bytes ctx;
    }

    /**
     * @title PlanInfoNUsage
     * @dev This struct represents a plan for number of usages.
     * @param oneUsagePrice The cost of one usage (in wei).
     * @param minUsageLimit The minimum number of usages that can be purchased.
     * @param maxUsagelimit The maximum number of usages that can be purchased.
     */
    struct PlanInfoNUsage {
        uint256 planId; // planId is unique for each plan
        uint256 oneUsagePrice;
        uint32 minUsageLimit;
        uint32 maxUsageLimit;
    }

   
  

   

    struct CustomerPlan {
        address customerAdress;
        uint256 planId;
        uint256 custumerPlanId;
        uint256 producerId;
        address cloneAddress;
        address priceAddress;
        uint32 startDate; // the date when the plan starts
        uint32 endDate; // the date when the plan ends
        uint256 remainingQuota; // user remaining quota
        Status status;
        PlanTypes planType;
        // StreamLockManager integration fields
        uint256 streamId; // ID of associated stream in StreamLockManager (0 if no stream)
        bool hasActiveStream; // Whether this customer plan has an active stream
    }

    /**
     * @title StreamCustomerLink
     * @dev This struct links StreamLockManager streams with customer plans.
     * @param streamId The ID of the stream in StreamLockManager.
     * @param customerPlanId The ID of the customer plan.
     * @param planId The ID of the producer plan.
     * @param streamType The type of stream (REGULAR, VESTING, USAGE_POOL).
     * @param isActive Whether the link is currently active.
     */
    struct StreamCustomerLink {
        uint256 streamId;
        uint256 customerPlanId;
        uint256 planId;
        StreamType streamType;
        bool isActive;
    }

    /**
     * @title UsagePoolInfo
     * @dev This struct contains information about usage pools for N-Usage plans.
     * @param totalUsages Total number of usages purchased.
     * @param usedUsages Number of usages already consumed.
     * @param remainingUsages Number of usages remaining.
     * @param lastUsageTime Timestamp of last usage.
     * @param isActive Whether the usage pool is currently active.
     */
    struct UsagePoolInfo {
        uint256 totalUsages;
        uint256 usedUsages;
        uint256 remainingUsages;
        uint256 lastUsageTime;
        bool isActive;
    }

    struct Customer {
        address customer;
        CustomerPlan[] customerPlans;
    } 
 
}

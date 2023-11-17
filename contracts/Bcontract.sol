// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

import {PlanNft} from "./PlanNft.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import {Events} from "./libraries/Events.sol";
import {Errors} from "./libraries/Errors.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import {Logic} from "./libraries/Logic.sol";
import {BcontractStorage} from "./storage/BcontractStorage.sol";
import "hardhat/console.sol";
import {CustomerNft} from "./CustomerNft.sol";

contract Bcontract is BcontractStorage {
    CustomerNft customerNft;

    constructor() {
        customerNft = new CustomerNft();
    }

    function producerCreateOrUpdated(DataTypes.CreateProducerData calldata vars)
        public
    {
        uint256 producerId = currentProducer_ID();
        bool isNew = Logic.producerCreateOrUpdated(
            vars,
            producerId,
            producersmapping,
            produceridAddressMapping
        );
        if (isNew == true) {
            incrementProducer_ID(); // todo  if update is not increment
        }
    }

    function addPlan(DataTypes.CreatePlanData calldata vars) public {
        address produceraddress = msg.sender;
        uint256 planId = currentPLAN_ID();
        Logic.AddPlan(vars, produceraddress, planId, producersmapping);
    }

    function getPlan(uint256 planId)
        public
        view
        returns (DataTypes.Plan memory plan)
    {
        address produceraddress = msg.sender;

        plan = Logic.getPlan(planId, producersmapping, produceraddress);
        return plan;
    }

    function addCustomerPlan(DataTypes.CreateCustomerPlan calldata vars)
        public
    {
        uint256 customerPlanId = incrementCustomer_PLAN_ID();
        Logic.AddCustomerPlan(vars, customermapping, customerPlanId);
        address customeraddress = msg.sender;
        DataTypes.Plan memory plan = getPlan(vars.planId);
        DataTypes.PlanInfo memory info = plan.info;
        console.log("customerPlanId 1=", vars.planId);

        customerNft.mintWithMetadata(
            customeraddress,
            customerPlanId,
            vars.planId,
            info.price,
            plan.name,
            info.description,
            info.image
        );
    }

    function getProducer(address produceraddress)
        public
        view
        returns (DataTypes.Producer memory)
    {
        DataTypes.Producer memory producer = producersmapping[produceraddress];
        return producer;
    }

    function getProducerIdToProducer(uint256 producerID)
        public
        view
        returns (DataTypes.Producer memory)
    {
        DataTypes.Producer memory producer = Logic.getProducerIdToProducer(
            producerID,
            producersmapping,
            produceridAddressMapping
        );

        return producer;
    }

    function getProducers() public view returns (DataTypes.Producer[] memory) {
        DataTypes.Producer[] memory producers = Logic.getProducers(
            currentProducer_ID(),
            producersmapping,
            produceridAddressMapping
        );

        return producers;
    }

    /*     function getPlanStatus(uint256 planId)
        public
        view
        returns (PlanStatus status)
    {
        address produceraddress = msg.sender;
        Producer memory producer = producersmapping[produceraddress];
        for (uint256 i = 0; i < producer.plans.length; i++) {
            if (producer.plans[i].planId == planId) {
                status = producer.plans[i].status;
                return status;
            }
        }
    } */

    /*   function getPlanInfo(uint256 planId)
        public
        view
        returns (PlanInfo memory info)
    {
        address produceraddress = msg.sender;
        Producer memory producer = producersmapping[produceraddress];
        for (uint256 i = 0; i < producer.plans.length; i++) {
            if (producer.plans[i].planId == planId) {
                info = producer.plans[i].info;
                return info;
            }
        }
    } */

    /*     function getPlanPrice(uint256 planId) public view returns (int96 psc) {
        address produceraddress = msg.sender;
        Producer memory producer = producersmapping[produceraddress];
        for (uint256 i = 0; i < producer.plans.length; i++) {
            if (producer.plans[i].planId == planId) {
                psc = producer.plans[i].pricePerSecond;
                return psc;
            }
        }
    } */

    function getCustomer(address customeraddress)
        public
        view
        returns (DataTypes.Customer memory)
    {
        DataTypes.Customer memory customer = Logic.getCustomer(
            customeraddress,
            customermapping
        );

        return customer;
    }

    function getCustomerPlan(uint256 customerPlanId)
        public
        view
        returns (DataTypes.CustomerPlan[] memory cpl)
    {
        address customeraddress = msg.sender;

        cpl = Logic.getCustomerPlan(
            customerPlanId,
            customeraddress,
            customermapping
        );
        return cpl;
    }

    function getPlanNftUri(uint256 tokenId)
        public
        view
        returns (string memory)
    {
        return customerNft.getPlanNftUri(tokenId);
    }
}

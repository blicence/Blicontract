// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DataTypes} from "./../libraries/DataTypes.sol";
import "hardhat/console.sol";

library Logic {
    function producerCreateOrUpdated(
        DataTypes.CreateProducerData calldata vars,
        uint256 Producer_ID,
        mapping(address => DataTypes.Producer) storage producersmapping,
        mapping(uint256 => address) storage produceridAddressMapping
    ) public returns (bool isNew) {
        uint256 _PRODUCER_ID = 0; // todo make simple version
        if (vars._producerId == 0) {
            isNew = true;
            _PRODUCER_ID = Producer_ID + 1;
        } else {
            _PRODUCER_ID = Producer_ID;
            isNew = false;
        }

        // vars._producerId = PRODUCER_ID.current();
        address produceraddress = msg.sender;

        produceridAddressMapping[_PRODUCER_ID] = produceraddress;

        DataTypes.Producer storage producer = producersmapping[produceraddress];
        producer.name = vars._name;
        producer.description = vars._description;
        producer.image = vars._image;
        producer.externalLink = vars._externalLink;
        producersmapping[produceraddress] = producer;
        /*   emit Events.producerCreateOrUpdatedEvent(
            produceraddress,
            vars._name,
            vars._description,
            vars._image,
            vars._externalLink
        ); */
        return isNew;
    }

    function AddPlan(
        DataTypes.CreatePlanData calldata vars,
        address _produceraddress,
        uint256 PLAN_ID,
        mapping(address => DataTypes.Producer) storage producersmapping
    ) public {
        address produceraddress = _produceraddress;

        DataTypes.Producer storage producer = producersmapping[produceraddress];
        require(
            producer.ProducerId == 0,
            "Producer not found or not created yet "
        );
        // PlanInfo memory pinfo=info;
        // PLAN_ID.increment();
        //incrementProducer_ID();
        producer.plans.push(
            DataTypes.Plan(
                ++PLAN_ID,
                produceraddress,
                vars.name,
                vars.pricePerSecond,
                vars.status,
                vars.info
            )
        );
    }

    function getPlan(
        uint256 planId,
        mapping(address => DataTypes.Producer) storage producersmapping,
        address produceraddress
    ) public view returns (DataTypes.Plan memory plan) {
        DataTypes.Producer memory producer = producersmapping[produceraddress];
        for (uint256 i = 0; i < producer.plans.length; i++) {
            if (producer.plans[i].planId == planId) {
                plan = producer.plans[i];
                plan.planId = producer.plans[i].planId;
                plan.producer = payable(producer.plans[i].producer);
                plan.name = producer.plans[i].name;
                plan.pricePerSecond = producer.plans[i].pricePerSecond;
                plan.status = producer.plans[i].status;
                plan.info = producer.plans[i].info;
                return plan;
            }
        }
    }

    /*   function CustomerPlanMint(uint256 planID, uint256 customerPlanId) public {
        address customeraddress = msg.sender;

       // DataTypes.Plan memory plan = getPlan(planID);
        DataTypes.PlanInfo memory info = plan.info;
          PlanNft.mintWithMetadata(
            customeraddress,
            customerPlanId,
            planID,
            info.price,
            plan.name,
            info.description,
            info.image
        );  
    } */

    function AddCustomerPlan(
        DataTypes.CreateCustomerPlan calldata vars,
        mapping(address => DataTypes.Customer) storage customermapping,
        uint256 customerPlanId
    ) public {
        address customeraddress = msg.sender;

        DataTypes.Customer storage customer = customermapping[customeraddress];

        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp; // todo  endtime is  in the future
        console.log("endtime", endTime);
        console.log("starttime", startTime);
        console.log("customerPlanId", customerPlanId);
        customer.customerPlans.push(
            DataTypes.CustomerPlan(
                vars.planId,
                customerPlanId,
                vars.producerId,
                vars.price,
                vars.paid_in,
                startTime,
                endTime
            )
        );
        // CustomerPlanMint(vars.planId);
    }

    function getProducerIdToProducer(
        uint256 producerID,
        mapping(address => DataTypes.Producer) storage producersmapping,
        mapping(uint256 => address) storage produceridAddressMapping
    ) public view returns (DataTypes.Producer memory) {
        address produceraddress = produceridAddressMapping[producerID];
        DataTypes.Producer memory producer = producersmapping[produceraddress];

        producer.ProducerId = producer.ProducerId;
        producer.produceraddress = payable(produceraddress);
        producer.name = producer.name;
        producer.description = producer.description;
        producer.image = producer.image;
        producer.externalLink = producer.externalLink;
        return producer;
    }

    function getProducers(
        uint256 currentProducer_ID,
        mapping(address => DataTypes.Producer) storage producersmapping,
        mapping(uint256 => address) storage produceridAddressMapping
    ) public view returns (DataTypes.Producer[] memory) {
        DataTypes.Producer[] memory producers = new DataTypes.Producer[](
            currentProducer_ID
        );
        for (uint256 i = 0; i < currentProducer_ID; i++) {
            address produceraddress = produceridAddressMapping[i];
            DataTypes.Producer memory producer = producersmapping[
                produceraddress
            ];
            producers[i] = producer;
            producers[i].ProducerId = producer.ProducerId;
            producers[i].produceraddress = payable(produceraddress);
            producers[i].name = producer.name;
            producers[i].description = producer.description;
            producers[i].image = producer.image;
            producers[i].externalLink = producer.externalLink; // todo
        }
        return producers;
    }

    function getCustomer(
        address customeraddress,
        mapping(address => DataTypes.Customer) storage customermapping
    ) public view returns (DataTypes.Customer memory) {
        DataTypes.Customer memory customer = customermapping[customeraddress];

        customer.customer = payable(customeraddress);
        /*cus.customerPlans = customer.customerPlans; */

        return customer;
    }

    function getCustomerPlan(
        uint256 customerPlanId,
        address customerAddress,
        mapping(address => DataTypes.Customer) storage customermapping
    ) public view returns (DataTypes.CustomerPlan[] memory cpl) {
        // address customeraddress = msg.sender;
        DataTypes.Customer memory customer = customermapping[customerAddress];
        //  cpl = customer.customerPlans[customerPlanId];
        for (uint256 i = 1; i < customer.customerPlans.length; i++) {
            if (customer.customerPlans[i].CustumerPlanId == customerPlanId) {
                cpl = customer.customerPlans;
                cpl[i].CustumerPlanId = customer
                    .customerPlans[i]
                    .CustumerPlanId;
                cpl[i].planId = customer.customerPlans[i].planId;
                cpl[i].ProducerId = customer.customerPlans[i].ProducerId;
                cpl[i].price = customer.customerPlans[i].price;
                cpl[i].paid_in = customer.customerPlans[i].paid_in;
                cpl[i].startTime = customer.customerPlans[i].startTime;
                cpl[i].endTime = customer.customerPlans[i].endTime;

                return cpl;
            }
        }
    }
}

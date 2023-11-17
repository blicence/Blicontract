// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "hardhat/console.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

abstract contract BcontractStorage {
    using Counters for Counters.Counter;
    Counters.Counter private PRODUCER_ID;
    Counters.Counter private PLAN_ID;
    Counters.Counter private customer_PLAN_ID;

    mapping(address => DataTypes.Producer) internal producersmapping;
    mapping(address => DataTypes.Customer) internal customermapping;
    mapping(uint256 => address) internal produceridAddressMapping; /* producerid to address mapping */

    function currentProducer_ID() public view returns (uint256) {
        return PRODUCER_ID.current();
    }

    function incrementProducer_ID() public returns (uint256) {
        PRODUCER_ID.increment();
        return PRODUCER_ID.current();
    }

    function currentPLAN_ID() public view returns (uint256) {
        return PLAN_ID.current();
    }

    function incrementPLAN_ID() public returns (uint256) {
        PLAN_ID.increment();
        return PLAN_ID.current();
    }

    function currentCustomer_PLAN_ID() public view returns (uint256) {
        return customer_PLAN_ID.current();
    }

    function incrementCustomer_PLAN_ID() public returns (uint256) {
        customer_PLAN_ID.increment();
        return customer_PLAN_ID.current();
    }
}

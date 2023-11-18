// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
import {DataTypes} from "./../libraries/DataTypes.sol";
import {ISuperfluid} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

interface IProducerApi {
    function setProducerStorage(address _producerStorage) external;

  //  function SetSuperInitialize(ISuperfluid _host) external;

    function addCustomerPlan(DataTypes.CustomerPlan memory vars) external;

    function updateCustomerPlan(DataTypes.CustomerPlan memory vars) external;
}

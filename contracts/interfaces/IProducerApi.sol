// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
 import {DataTypes} from "./../libraries/DataTypes.sol";

interface IProducerApi {
       function setProducerStorage(address _producerStorage) external;
 function addCustomerPlan(DataTypes.CustomerPlan memory vars) external;
  function updateCustomerPlan(DataTypes.CustomerPlan memory vars) external;
    
}

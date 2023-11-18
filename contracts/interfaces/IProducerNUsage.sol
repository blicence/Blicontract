// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
import {DataTypes} from "./../libraries/DataTypes.sol";

interface IProducerNUsage {
    function setProducerStorage(address _producerStorage) external;

    function addCustomerPlan(DataTypes.CustomerPlan memory vars) external;

    function updateCustomerPlan(
        DataTypes.CustomerPlan memory vars
    ) external;

    function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    ) external returns (uint256);
}

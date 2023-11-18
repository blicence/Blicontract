// SPDX-License-Identifier: MIT
import {ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
pragma solidity 0.8.17;
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IVestingScheduler} from "./IVestingScheduler.sol";

interface IProducerVestingApi {
    function setSuperInitialize(
  
         IVestingScheduler _vestingScheduler
    ) external;

    function createVestingSchedule(
        ISuperToken superToken,
        address receiver,
        uint32 startDate,
        uint32 cliffDate,
        int96 flowRate,
        uint256 startAmount,
        uint32 endDate,
        bytes memory ctx
    ) external;

    function getVestingSchedule(
        ISuperToken superToken,
        address account,
        address receiver
    ) external view returns (IVestingScheduler.VestingSchedule memory);

    function updateVestingSchedule(
        ISuperToken superToken,
        address receiver,
        uint32 endDate,
        bytes memory ctx
    ) external returns (bytes memory newCtx);

    function deleteVestingSchedule(
        ISuperToken superToken,
        address receiver,
        bytes memory ctx
    ) external returns (bytes memory newCtx);

    function addCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) external;

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) external;
}

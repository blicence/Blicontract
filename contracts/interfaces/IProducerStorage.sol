// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {DataTypes} from "./../libraries/DataTypes.sol";
import {IFactory} from "./../interfaces/IFactory.sol";

interface IProducerStorage {
    function setFactory(
        IFactory _factory,
        address _producerApi,
        address _producerUsageApi,
        address _producervestingApi
    ) external;

    function exsistProducer(
        address _producerAddress
    ) external view returns (bool);

    function addProducer(DataTypes.Producer calldata vars) external;

    function setProducer(DataTypes.Producer calldata vars) external;

    function addPlan(
        DataTypes.CreatePlanData calldata vars
    ) external returns (uint256 planId);

    function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external;

    function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars) external;

    function addPlanInfoVesting(
        DataTypes.PlanInfoVesting calldata vars
    ) external;

    function setPlan(DataTypes.CreatePlanData calldata vars) external;

    function getProducer(
        address producerOwner
    ) external view returns (DataTypes.Producer memory);

    function getPlan(
        uint256 _planId
    ) external view returns (DataTypes.Plan memory plan);

    function getPlanInfoApi(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoApi memory pInfoApi);

    function getPlanInfoNUsage(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoNUsage memory plan);

    function getPlanInfoVesting(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoVesting memory plan);

    function getCustomerPlanInfo(
        uint256 _planId
    ) external view returns (DataTypes.CustomerPlanInfo memory cApi);

    function getPlans(
        address producerAddress
    ) external view returns (DataTypes.Plan[] memory);

    function getParams(
        uint256 tokenId
    ) external view returns (DataTypes.URIParams memory);

    function getCustomer(
        address customerAddress
    ) external view returns (DataTypes.Customer memory);

    function getCustomerPlanId(
        uint256 planid,
        address customeraddress,
        address producerAddress
    ) external pure returns (uint);

    function getCustomerPlanIdDecode(
        uint custumerPlanId
    )
        external
        pure
        returns (
            uint256 planid,
            address customeraddress,
            address producerAddress
        );

    function addCustomerPlan(
        DataTypes.CreateCustomerPlan calldata vars
    ) external returns (DataTypes.URIParams memory);

    function useFromQuota(
        DataTypes.UpdateCustomerPlan calldata vars
    ) external returns (uint256);

    function updateCustomerPlan(
        DataTypes.UpdateCustomerPlan calldata vars
    ) external;

    function exsitCustomerPlan(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) external view returns (bool);

    function SetCloneId(uint256 _producerId, address _cloneAddress) external;

    function getCloneId(uint256 _producerId) external view returns (address);

    function getClones(uint256 id) external view returns (address[] memory);

    function incrementPR_ID() external returns (uint256);

    function currentPR_ID() external view returns (uint256);

 
    // function currenPL_ID() external view returns (uint256);
}
